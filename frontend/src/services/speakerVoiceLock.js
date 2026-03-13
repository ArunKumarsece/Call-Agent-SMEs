/**
 * Speaker Voice Lock v2 — Fast speaker verification with MFCC + Delta features
 * ──────────────────────────────────────────────────────────────────────────────
 *
 * Algorithm:
 *   1. FFT → 26-band Mel filterbank → log energy → DCT → 13 MFCCs per frame
 *   2. Delta coefficients computed across frames for temporal dynamics
 *   3. Feature vector = [13 MFCC + 13 Delta] = 26-dimensional
 *   4. Enrollment: collect multiple feature vectors, compute centroid + covariance
 *   5. Verification: Mahalanobis-inspired distance (weighted cosine similarity)
 *   6. Adaptive centroid that drifts toward verified frames
 *
 * Phases — designed for minimal latency:
 *   WAITING    → agent is greeting, mic is muted to Gemini. Collect ambient noise.
 *   ENROLLING  → first real speech from user, capture voiceprint (2-3 chunks)
 *   LOCKED     → speaker verified, only matched voice passes through
 *
 * All processing is pure JS — no external libraries needed.
 */

// ─── Constants ────────────────────────────────────────────────────────────────

const FFT_SIZE = 512;              // 32ms at 16kHz
const NUM_MEL = 26;                // Mel filterbank bands
const NUM_MFCC = 13;               // Cepstral coefficients
const FEAT_DIM = NUM_MFCC * 2;     // MFCC + Delta = 26D feature vector
const SR = 16000;

// Timing
const WAIT_CHUNKS = 8;             // ~2s of silence calibration (fast)
const ENROLL_MIN = 3;              // Only 3 speech chunks to lock (aggressive — fast lock)
const ENROLL_TIMEOUT = 20;         // Give up after 20 chunks (~5s)

// Thresholds
const VERIFY_INIT = 0.65;          // Initial cosine similarity threshold (generous)
const VERIFY_MAX = 0.82;           // Max tightening
const VERIFY_TIGHTEN = 0.004;      // Tighten per verified frame
const ADAPT_RATE = 0.05;           // Centroid adaptation speed
const ENERGY_FLOOR = 0.006;        // Absolute minimum RMS to consider
const SPEECH_MULT = 2.0;           // Speech = ambient * SPEECH_MULT
const ZCR_MAX = 0.35;              // Max zero-crossing rate for speech (noise is higher)

// ─── DSP: FFT (Radix-2 in-place) ─────────────────────────────────────────────

function fft(re, im) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
        let bit = n >> 1;
        for (; j & bit; bit >>= 1) j ^= bit;
        j ^= bit;
        if (i < j) {
            [re[i], re[j]] = [re[j], re[i]];
            [im[i], im[j]] = [im[j], im[i]];
        }
    }
    for (let len = 2; len <= n; len <<= 1) {
        const half = len >> 1;
        const ang = -2 * Math.PI / len;
        const wR = Math.cos(ang), wI = Math.sin(ang);
        for (let i = 0; i < n; i += len) {
            let cR = 1, cI = 0;
            for (let j = 0; j < half; j++) {
                const a = i + j, b = a + half;
                const tR = re[b] * cR - im[b] * cI;
                const tI = re[b] * cI + im[b] * cR;
                re[b] = re[a] - tR; im[b] = im[a] - tI;
                re[a] += tR; im[a] += tI;
                const nR = cR * wR - cI * wI;
                cI = cR * wI + cI * wR; cR = nR;
            }
        }
    }
}

// ─── DSP: Precomputed tables ──────────────────────────────────────────────────

const _hanning = new Float64Array(FFT_SIZE);
for (let i = 0; i < FFT_SIZE; i++) _hanning[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (FFT_SIZE - 1)));

function _hz2mel(f) { return 2595 * Math.log10(1 + f / 700); }
function _mel2hz(m) { return 700 * (10 ** (m / 2595) - 1); }

const _melBank = (() => {
    const bins = FFT_SIZE / 2 + 1;
    const mLo = _hz2mel(80), mHi = _hz2mel(SR / 2);
    const pts = new Float64Array(NUM_MEL + 2);
    for (let i = 0; i < pts.length; i++) pts[i] = mLo + (mHi - mLo) * i / (NUM_MEL + 1);
    const bp = new Float64Array(pts.length);
    for (let i = 0; i < pts.length; i++) bp[i] = Math.floor((FFT_SIZE + 1) * _mel2hz(pts[i]) / SR);

    const fb = [];
    for (let m = 0; m < NUM_MEL; m++) {
        const f = new Float64Array(bins);
        const [l, c, r] = [bp[m], bp[m + 1], bp[m + 2]];
        for (let k = Math.max(0, Math.floor(l)); k <= Math.min(Math.floor(r), bins - 1); k++) {
            f[k] = k < c ? (c !== l ? (k - l) / (c - l) : 0)
                         : (r !== c ? (r - k) / (r - c) : 0);
        }
        fb.push(f);
    }
    return fb;
})();

const _dct = (() => {
    const m = [];
    for (let i = 0; i < NUM_MFCC; i++) {
        const row = new Float64Array(NUM_MEL);
        for (let j = 0; j < NUM_MEL; j++) row[j] = Math.cos(Math.PI * i * (j + 0.5) / NUM_MEL);
        m.push(row);
    }
    return m;
})();

// ─── Feature extraction ───────────────────────────────────────────────────────

function rms(s) {
    let v = 0;
    for (let i = 0; i < s.length; i++) v += s[i] * s[i];
    return Math.sqrt(v / (s.length || 1));
}

/** Zero-crossing rate: proportion of sign changes. Speech ~0.05-0.25, noise ~0.3-0.5. */
function zcr(s) {
    if (s.length < 2) return 0;
    let crossings = 0;
    for (let i = 1; i < s.length; i++) {
        if ((s[i] >= 0) !== (s[i - 1] >= 0)) crossings++;
    }
    return crossings / (s.length - 1);
}

/** Check if a chunk looks like speech (energy + ZCR heuristic). */
function isSpeechLike(samples, energyThresh) {
    const e = rms(samples);
    if (e < energyThresh) return false;
    // Speech has structured formants → lower ZCR than random noise
    const z = zcr(samples);
    return z < ZCR_MAX;
}

/** Extract per-frame MFCCs from a Float32Array chunk. Returns array of Float64Array[13]. */
function frameMFCCs(samples) {
    const hop = FFT_SIZE / 2;
    const nFrames = Math.max(0, Math.floor((samples.length - FFT_SIZE) / hop) + 1);
    if (nFrames === 0) return [];

    const bins = FFT_SIZE / 2 + 1;
    const frames = [];

    for (let f = 0; f < nFrames; f++) {
        const off = f * hop;
        const re = new Float64Array(FFT_SIZE);
        const im = new Float64Array(FFT_SIZE);
        for (let i = 0; i < FFT_SIZE && off + i < samples.length; i++) {
            re[i] = samples[off + i] * _hanning[i];
        }
        fft(re, im);

        // Power spectrum
        const pow = new Float64Array(bins);
        for (let k = 0; k < bins; k++) pow[k] = re[k] * re[k] + im[k] * im[k];

        // Mel energies
        const mel = new Float64Array(NUM_MEL);
        for (let m = 0; m < NUM_MEL; m++) {
            let s = 0;
            const filt = _melBank[m];
            for (let k = 0; k < bins; k++) s += pow[k] * filt[k];
            mel[m] = Math.log(Math.max(s, 1e-10));
        }

        // DCT → MFCC
        const mfcc = new Float64Array(NUM_MFCC);
        for (let i = 0; i < NUM_MFCC; i++) {
            let s = 0;
            const row = _dct[i];
            for (let j = 0; j < NUM_MEL; j++) s += mel[j] * row[j];
            mfcc[i] = s;
        }
        frames.push(mfcc);
    }
    return frames;
}

/** Compute delta coefficients from MFCC frame sequence. Width=2. */
function computeDeltas(frames) {
    const n = frames.length;
    if (n < 3) {
        // Not enough frames; return zeros
        return frames.map(f => new Float64Array(f.length));
    }
    const deltas = [];
    for (let t = 0; t < n; t++) {
        const d = new Float64Array(frames[0].length);
        const prev = frames[Math.max(0, t - 1)];
        const next = frames[Math.min(n - 1, t + 1)];
        // Simplified delta: (next - prev) / 2
        for (let i = 0; i < d.length; i++) d[i] = (next[i] - prev[i]) * 0.5;
        deltas.push(d);
    }
    return deltas;
}

/** Build 26D feature vector: mean of [MFCC|Delta] across all frames in chunk. */
function chunkFeature(samples) {
    const frames = frameMFCCs(samples);
    if (frames.length === 0) return null;

    const deltas = computeDeltas(frames);
    const feat = new Float64Array(FEAT_DIM);
    let count = 0;

    for (let t = 0; t < frames.length; t++) {
        // Only include frames with enough energy (skip silent sub-frames)
        const fr = frames[t];
        for (let i = 0; i < NUM_MFCC; i++) feat[i] += fr[i];
        const dt = deltas[t];
        for (let i = 0; i < NUM_MFCC; i++) feat[NUM_MFCC + i] += dt[i];
        count++;
    }

    if (count === 0) return null;
    for (let i = 0; i < FEAT_DIM; i++) feat[i] /= count;
    return feat;
}

// ─── Vector math ──────────────────────────────────────────────────────────────

function cosine(a, b) {
    let dot = 0, mA = 0, mB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i]; mA += a[i] * a[i]; mB += b[i] * b[i];
    }
    const d = Math.sqrt(mA) * Math.sqrt(mB);
    return d > 0 ? dot / d : 0;
}

/** Weighted cosine: weights the feature dimensions by inverse variance. */
function weightedCosine(a, b, invVar) {
    let dot = 0, mA = 0, mB = 0;
    for (let i = 0; i < a.length; i++) {
        const w = invVar[i];
        const wa = a[i] * w, wb = b[i] * w;
        dot += wa * wb; mA += wa * wa; mB += wb * wb;
    }
    const d = Math.sqrt(mA) * Math.sqrt(mB);
    return d > 0 ? dot / d : 0;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── SpeakerVoiceLock v2 ──────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

export class SpeakerVoiceLock {
    constructor(options = {}) {
        this.state = 'WAITING';  // WAITING → ENROLLING → LOCKED

        // Ambient calibration
        this._waitCount = 0;
        this._energies = [];
        this._ambientRMS = 0;
        this._speechThresh = ENERGY_FLOOR;

        // Enrollment
        this._enrollFeats = [];   // Array of 26D feature vectors
        this._enrollCount = 0;
        this._consecutiveSpeech = 0; // consecutive speech-like chunks

        // Speaker profile
        this._centroid = null;    // 26D mean feature vector
        this._invVar = null;      // 26D inverse-variance weights
        this._threshold = options.verifyThreshold || VERIFY_INIT;
        this._verified = 0;
        this._rejected = 0;

        // UI stats
        this._lastSim = 0;
        this._lastEnergy = 0;
        this._lastDecision = 'silence';

        // Callbacks
        this._onStateChange = options.onStateChange || null;
        this._onVoiceLockEvent = options.onVoiceLockEvent || null;
    }

    get info() {
        return {
            state: this.state,
            similarity: this._lastSim,
            energy: this._lastEnergy,
            decision: this._lastDecision,
            threshold: this._threshold,
            verified: this._verified,
            rejected: this._rejected,
        };
    }

    /**
     * Process a mic chunk (Float32Array, 16kHz mono).
     * Returns { action: 'pass'|'gate'|'silence', audio: Float32Array }
     *   - 'silence': don't send anything to Gemini (pre-lock)
     *   - 'gate':    send silence to Gemini (below threshold / wrong speaker)
     *   - 'pass':    send real audio to Gemini (verified speaker)
     */
    process(f32) {
        const energy = rms(f32);
        this._lastEnergy = energy;

        switch (this.state) {
            case 'WAITING':   return this._onWaiting(f32, energy);
            case 'ENROLLING': return this._onEnrolling(f32, energy);
            case 'LOCKED':    return this._onLocked(f32, energy);
            default:          return { action: 'pass', audio: f32 };
        }
    }

    // ── WAITING: collect ambient noise floor while agent greets ────────────────

    _onWaiting(f32, energy) {
        this._waitCount++;
        this._energies.push(energy);

        if (this._waitCount >= WAIT_CHUNKS) {
            // Compute ambient floor: median of collected energies
            const sorted = [...this._energies].sort((a, b) => a - b);
            this._ambientRMS = sorted[Math.floor(sorted.length * 0.5)];
            this._speechThresh = Math.max(this._ambientRMS * SPEECH_MULT, ENERGY_FLOOR);
            this._setState('ENROLLING');
            console.log(`[VL] Ambient=${this._ambientRMS.toFixed(5)}, speechThresh=${this._speechThresh.toFixed(5)}`);
        }

        this._lastDecision = 'silence';
        return { action: 'silence', audio: new Float32Array(f32.length) };
    }

    // ── ENROLLING: capture voiceprint from first speech ────────────────────────

    _onEnrolling(f32, energy) {
        this._enrollCount++;

        // Is this real speech? (energy + ZCR check to filter noise)
        if (isSpeechLike(f32, this._speechThresh)) {
            this._consecutiveSpeech++;
            // Require at least 2 consecutive speech-like chunks to accept
            if (this._consecutiveSpeech >= 2) {
                const feat = chunkFeature(f32);
                if (feat) {
                    this._enrollFeats.push(feat);
                    this._lastDecision = 'enrolling';
                    this._emitEvent('enrolling', {
                        frames: this._enrollFeats.length,
                        needed: ENROLL_MIN,
                    });
                }
            }
        } else {
            this._consecutiveSpeech = 0;
        }

        // Lock as soon as we have enough
        if (this._enrollFeats.length >= ENROLL_MIN) {
            this._buildProfile();
            this._setState('LOCKED');
            this._lastDecision = 'pass';
            console.log(`[VL] LOCKED with ${this._enrollFeats.length} vectors, thresh=${this._threshold.toFixed(3)}`);
            this._emitEvent('locked', { frames: this._enrollFeats.length });
            return { action: 'pass', audio: f32 };
        }

        // Timeout
        if (this._enrollCount >= ENROLL_TIMEOUT) {
            if (this._enrollFeats.length >= 1) {
                this._buildProfile();
                this._threshold = Math.max(this._threshold - 0.10, 0.50);
                this._setState('LOCKED');
                console.log(`[VL] Partial lock — ${this._enrollFeats.length} vectors`);
                this._emitEvent('locked', { frames: this._enrollFeats.length, partial: true });
            } else {
                this._centroid = null;
                this._setState('LOCKED');
                console.log('[VL] Enrollment timeout → energy-only fallback');
                this._emitEvent('fallback', {});
            }
            return { action: 'pass', audio: f32 };
        }

        // Still enrolling — send silence to Gemini
        this._lastDecision = 'silence';
        return { action: 'silence', audio: new Float32Array(f32.length) };
    }

    // ── LOCKED: verify every chunk against speaker profile ────────────────────

    _onLocked(f32, energy) {
        // Sub-threshold → gate
        if (energy < this._speechThresh) {
            this._lastSim = 0;
            this._lastDecision = 'gate';
            return { action: 'gate', audio: new Float32Array(f32.length) };
        }

        // Also gate if it looks like noise (high ZCR), not speech
        if (zcr(f32) >= ZCR_MAX) {
            this._lastSim = 0;
            this._lastDecision = 'gate';
            return { action: 'gate', audio: new Float32Array(f32.length) };
        }

        // No profile (fallback) → energy-only pass
        if (!this._centroid) {
            this._lastSim = 1;
            this._lastDecision = 'pass';
            return { action: 'pass', audio: f32 };
        }

        // Extract feature & compare
        const feat = chunkFeature(f32);
        if (!feat) {
            this._lastDecision = 'gate';
            return { action: 'gate', audio: new Float32Array(f32.length) };
        }

        // Use weighted cosine if we have variance info, plain cosine otherwise
        const sim = this._invVar
            ? weightedCosine(feat, this._centroid, this._invVar)
            : cosine(feat, this._centroid);
        this._lastSim = sim;

        if (sim >= this._threshold) {
            // ✓ Verified speaker
            this._verified++;
            this._lastDecision = 'pass';

            // Adapt centroid
            for (let i = 0; i < FEAT_DIM; i++) {
                this._centroid[i] = this._centroid[i] * (1 - ADAPT_RATE) + feat[i] * ADAPT_RATE;
            }

            // Tighten threshold after settling
            if (this._verified > 5 && this._threshold < VERIFY_MAX) {
                this._threshold += VERIFY_TIGHTEN;
            }

            return { action: 'pass', audio: f32 };
        } else {
            // ✗ Rejected
            this._rejected++;
            this._lastDecision = 'rejected';
            this._emitEvent('rejected', { similarity: sim, threshold: this._threshold });
            return { action: 'gate', audio: new Float32Array(f32.length) };
        }
    }

    // ── Profile builder ───────────────────────────────────────────────────────

    _buildProfile() {
        const n = this._enrollFeats.length;
        const mean = new Float64Array(FEAT_DIM);
        for (const f of this._enrollFeats)
            for (let i = 0; i < FEAT_DIM; i++) mean[i] += f[i];
        for (let i = 0; i < FEAT_DIM; i++) mean[i] /= n;

        // Compute variance per dimension (for weighted cosine)
        if (n >= 2) {
            const variance = new Float64Array(FEAT_DIM);
            for (const f of this._enrollFeats)
                for (let i = 0; i < FEAT_DIM; i++) {
                    const d = f[i] - mean[i];
                    variance[i] += d * d;
                }
            this._invVar = new Float64Array(FEAT_DIM);
            for (let i = 0; i < FEAT_DIM; i++) {
                variance[i] /= n;
                // Inverse variance (clamp to avoid division by zero)
                this._invVar[i] = 1.0 / Math.max(variance[i], 1e-6);
            }
            // Normalize so max weight = 1
            let maxW = 0;
            for (let i = 0; i < FEAT_DIM; i++) if (this._invVar[i] > maxW) maxW = this._invVar[i];
            if (maxW > 0) for (let i = 0; i < FEAT_DIM; i++) this._invVar[i] /= maxW;
        } else {
            this._invVar = null; // Not enough data for variance — use plain cosine
        }

        this._centroid = mean;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    _setState(s) {
        const prev = this.state;
        this.state = s;
        if (this._onStateChange) try { this._onStateChange(s, prev); } catch (e) { console.error('[VL]', e); }
    }

    _emitEvent(ev, data) {
        if (this._onVoiceLockEvent) try { this._onVoiceLockEvent(ev, data); } catch (e) { console.error('[VL]', e); }
    }

    reset() {
        this.state = 'WAITING';
        this._waitCount = 0;
        this._energies = [];
        this._ambientRMS = 0;
        this._speechThresh = ENERGY_FLOOR;
        this._enrollFeats = [];
        this._enrollCount = 0;
        this._consecutiveSpeech = 0;
        this._centroid = null;
        this._invVar = null;
        this._threshold = VERIFY_INIT;
        this._verified = 0;
        this._rejected = 0;
        this._lastSim = 0;
        this._lastEnergy = 0;
        this._lastDecision = 'silence';
    }

    get interruptThreshold() {
        return this._speechThresh * 5.0;
    }
}
