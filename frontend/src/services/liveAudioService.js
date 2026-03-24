/**
 * LiveAudioService — Gemini Live API real-time voice client
 * ══════════════════════════════════════════════════════════
 *
 * Model: gemini-2.5-flash-native-audio-preview-12-2025
 * Protocol: Raw WebSocket to generativelanguage.googleapis.com
 * Endpoint: v1beta (camelCase JSON fields required)
 *
 * BUGS FIXED:
 *  1. "Request contains an invalid argument" crash
 *     - _sendSetup() was using snake_case "system_instruction" — must be camelCase "systemInstruction"
 *     - _greet() was sending bare { turnComplete: true } without turns array — Gemini rejects this
 *
 *  2. Ghost responses after interrupt (race condition)
 *     - Added _discardUntilNewTurn flag that stays true from interrupt until turnComplete
 *     - Audio chunks arriving between interrupt and turnComplete are silently dropped
 *
 *  3. Premature speech cutoff for Tamil
 *     - Silence threshold increased from 3 frames (300ms) to 12 frames (~1.2s)
 *     - Tamil speech has 400-800ms intra-sentence pauses; old threshold cut mid-sentence
 *     - Minimum 3 consecutive speech frames required (was 2)
 *
 *  4. Agent self-interruption (echo)
 *     - Echo gate: while agent plays audio and user hasn't started speaking, skip VAD
 *     - Audio still streams to Gemini for server-side interrupt detection
 *
 *  5. Manual turnComplete removed
 *     - Gemini's server-side VAD handles end-of-speech detection from the audio stream
 *     - Client VAD only used for: stopping agent audio on interrupt + UI state feedback
 *
 *  6. KB fetch with retry (3 attempts, 500ms backoff)
 *
 *  7. All commented-out legacy code removed (was 657 lines of dead code)
 */

import { SpeakerVoiceLock } from './speakerVoiceLock.js';
import { getAPIBase } from '../api';

// ─── Constants ───────────────────────────────────────────────────────────────

const MODEL       = 'models/gemini-2.5-flash-native-audio-preview-12-2025';
const MIC_RATE    = 16000;
const SPEAK_RATE  = 24000;

// VAD tuning for Tamil/Tanglish
const VAD_THRESHOLD         = 0.02;   // RMS energy floor
const VAD_SILENCE_FRAMES    = 12;     // ~1.2s silence = end of speech
const VAD_MIN_SPEECH_FRAMES = 3;      // consecutive frames to confirm real speech
const VAD_MIN_SPEECH_MS     = 500;    // ignore speech shorter than this

// ─── PCM Helpers ─────────────────────────────────────────────────────────────

function toB64(u8) {
    let s = '';
    for (let i = 0; i < u8.byteLength; i++) s += String.fromCharCode(u8[i]);
    return btoa(s);
}

function fromB64(b64) {
    const bin = atob(b64);
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return u8;
}

function f32ToI16(f32) {
    const i16 = new Int16Array(f32.length);
    for (let i = 0; i < f32.length; i++) {
        const s = Math.max(-1, Math.min(1, f32[i]));
        i16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return i16;
}

function i16ToF32(bytes) {
    const i16 = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
    const f32 = new Float32Array(i16.length);
    for (let i = 0; i < i16.length; i++) f32[i] = i16[i] / 32768.0;
    return f32;
}

// ─── AudioWorklet (inlined as blob URL) ──────────────────────────────────────

const WORKLET_SRC = `
class CaptureProc extends AudioWorkletProcessor {
    constructor() { super(); this._buf = []; }
    process(inputs) {
        const ch = inputs[0]?.[0];
        if (ch) { for (let i = 0; i < ch.length; i++) this._buf.push(ch[i]); }
        while (this._buf.length >= 4096)
            this.port.postMessage(new Float32Array(this._buf.splice(0, 4096)));
        return true;
    }
}
registerProcessor('capture-proc', CaptureProc);
`;

// ─── Gapless Audio Player (24kHz output context) ─────────────────────────────

class Player {
    constructor() {
        this._ctx  = null;
        this._t    = 0;
        this._srcs = [];
    }

    prime() {
        if (!this._ctx || this._ctx.state === 'closed') {
            const AC = window.AudioContext || window.webkitAudioContext;
            this._ctx = new AC({ sampleRate: SPEAK_RATE });
        }
        if (this._ctx.state === 'suspended') this._ctx.resume();
        return this._ctx;
    }

    play(pcmBytes) {
        const ctx = this.prime();
        const f32 = i16ToF32(pcmBytes);
        if (!f32.length) return;
        const buf = ctx.createBuffer(1, f32.length, SPEAK_RATE);
        buf.copyToChannel(f32, 0);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(ctx.destination);
        const at = Math.max(ctx.currentTime, this._t);
        src.start(at);
        this._t = at + buf.duration;
        this._srcs.push(src);
        src.onended = () => {
            const idx = this._srcs.indexOf(src);
            if (idx >= 0) this._srcs.splice(idx, 1);
        };
    }

    stop() {
        for (const s of this._srcs) { try { s.stop(0); } catch (_) {} }
        this._srcs = [];
        if (this._ctx && this._ctx.state !== 'closed') this._t = this._ctx.currentTime;
    }

    close() {
        this.stop();
        if (this._ctx) { try { this._ctx.close(); } catch (_) {} this._ctx = null; }
    }
}

// ─── LiveAudioService ────────────────────────────────────────────────────────

export class LiveAudioService {

    // Shared across instances to avoid recreation latency
    static _sharedMicCtx      = null;
    static _sharedWorkletReady = false;
    static _sharedWorkletNode  = null;

    constructor() {
        this._ws      = null;
        this._live    = false;
        this._stop    = false;
        this._muted   = false;
        this._cbs     = {};
        this._cfg     = null;
        this._mode    = 'chat';
        this._player  = new Player();
        this._micCtx  = null;
        this._worklet = null;
        this._stream  = null;
        this._source  = null;
        this._keepalive = null;

        // Turn & interrupt state
        this._playing              = false;
        this._turnInterrupted      = false;
        this._discardUntilNewTurn  = false;

        // VAD state
        this._lastWasSpeech        = false;
        this._vadSilenceFrames     = 0;
        this._vadConsecutiveSpeech = 0;
        this._speechStartTime      = 0;

        // KB
        this._kbContext = '';
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PUBLIC API
    // ═══════════════════════════════════════════════════════════════════════════

    async connect(agentConfig, callbacks, options = {}) {
        this._cbs   = callbacks || {};
        this._cfg   = agentConfig;
        this._mode  = options.mode || 'chat';
        this._stop  = false;
        this._live  = false;
        this._playing = false;
        this._turnInterrupted = false;
        this._discardUntilNewTurn = false;
        this._kbContext = '';

        try {
            this._player.prime();
            const API = getAPIBase();

            // Load KB with retry
            if (agentConfig.id) {
                await this._loadKB(API, agentConfig.id);
            }

            // Get Gemini key
            const res = await fetch(`${API}/gemini-key`);
            if (!res.ok) throw new Error('Cannot fetch Gemini key');
            const { key } = await res.json();

            // Connect WebSocket (blocks until setupComplete)
            const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${key}`;
            await this._connectWS(url);
            return true;
        } catch (e) {
            console.error('[LA] connect failed:', e);
            this._emit('onError', e);
            return false;
        }
    }

    disconnect() {
        this._stop = true;
        this._live = false;
        this._stopMic();
        this._player.close();
        if (this._ws) { try { this._ws.close(1000, 'bye'); } catch (_) {} this._ws = null; }
        this._emit('onClose');
    }

    toggleMute() { this._muted = !this._muted; return this._muted; }

    sendText(text) {
        if (!text?.trim()) return;
        this._wsSend({
            clientContent: {
                turns: [{ role: 'user', parts: [{ text }] }],
                turnComplete: true,
            }
        });
    }

    static resetSharedResources() {
        if (LiveAudioService._sharedMicCtx) {
            try { LiveAudioService._sharedMicCtx.close(); } catch (_) {}
            LiveAudioService._sharedMicCtx = null;
        }
        LiveAudioService._sharedWorkletReady = false;
        LiveAudioService._sharedWorkletNode = null;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // KB LOADING (retry with backoff)
    // ═══════════════════════════════════════════════════════════════════════════

    async _loadKB(apiBase, agentId) {
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                const t0 = performance.now();
                const res = await fetch(`${apiBase}/agents/public/${agentId}/kb-context`);
                if (res.ok) {
                    const data = await res.json();
                    this._kbContext = data.context || '';
                    console.log(`[LA] KB loaded (attempt ${attempt + 1}): ${this._kbContext.length} chars in ${(performance.now() - t0).toFixed(0)}ms`);
                    if (this._kbContext.length > 0) return;
                }
            } catch (e) {
                console.warn(`[LA] KB attempt ${attempt + 1} failed:`, e.message);
            }
            if (attempt < 2) await new Promise(r => setTimeout(r, 500));
        }
        if (!this._kbContext) console.warn('[LA] KB context empty after all retries');
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // WEBSOCKET CONNECTION
    // ═══════════════════════════════════════════════════════════════════════════

    _connectWS(url) {
        return new Promise((resolve, reject) => {
            const ws = new WebSocket(url);
            ws.binaryType = 'arraybuffer';
            this._ws = ws;

            const timeout = setTimeout(() => {
                reject(new Error('Timeout waiting for setupComplete'));
                try { ws.close(); } catch (_) {}
            }, 15000);

            ws.onopen = () => {
                console.log('[LA] WS open → sending setup');
                this._sendSetup();
            };

            ws.onmessage = async (evt) => {
                const raw = typeof evt.data === 'string'
                    ? evt.data
                    : new TextDecoder().decode(new Uint8Array(evt.data));
                let msg;
                try { msg = JSON.parse(raw); } catch { return; }

                // setupComplete
                if (msg.setupComplete !== undefined) {
                    console.log('[LA] setupComplete ✅');
                    clearTimeout(timeout);
                    try {
                        await this._startMic();
                        this._live = true;
                        this._emit('onOpen');
                        this._sendGreeting();
                        resolve();
                    } catch (e) {
                        reject(new Error('Mic: ' + e.message));
                    }
                    return;
                }

                if (msg.error) {
                    clearTimeout(timeout);
                    const e = new Error(msg.error.message || JSON.stringify(msg.error));
                    console.error('[LA] Server error:', e.message);
                    reject(e);
                    this._emit('onError', e);
                    return;
                }

                this._handleServerContent(msg);
            };

            ws.onerror = () => { clearTimeout(timeout); reject(new Error('WS error')); };

            ws.onclose = (e) => {
                clearTimeout(timeout);
                this._live = false;
                if (!this._stop) {
                    const reason = e.reason || `code ${e.code}`;
                    console.warn('[LA] WS closed:', reason);
                    reject(new Error(reason));
                    this._emit('onError', new Error(reason));
                    this._emit('onClose');
                }
            };
        });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SETUP (FIX #1: correct camelCase for v1beta WebSocket protocol)
    // ═══════════════════════════════════════════════════════════════════════════

    _sendSetup() {
        const { name, role, system_prompt, voice_id } = this._cfg || {};
        const kb = this._kbContext || '';

        const kbBlock = kb ? [
            '\n\nKNOWLEDGE BASE (ONLY use this information — NEVER invent facts):',
            kb,
            '\nKB RULES:',
            '- BROAD queries: mention CATEGORIES and count, ask which interests them. Max 2-3 sentences.',
            '- SPECIFIC queries: give full details from KB.',
            '- If not in KB: say "Sorry, en kitta antha information illa" in Tanglish.',
        ].join('\n') : '';

        const sysText = [
            `You are ${name || 'AI'}, a ${role || 'assistant'}.`,
            'ALWAYS respond in Tanglish — a natural spoken mix of Tamil and English.',
            'Write Tamil words in Tamil script, English words in English.',
            'Keep responses short — 1-2 sentences max. Voice conversation only.',
            '',
            'CALL ENDING: If user says bye/end call, ask "Seri, call end pannalama?" first.',
            'Only after user confirms, say goodbye and add [END_CALL] at the end.',
            system_prompt || '',
            kbBlock,
        ].filter(Boolean).join('\n');

        // CRITICAL: Raw WebSocket protocol requires camelCase.
        // "systemInstruction" NOT "system_instruction"
        // transcription configs go at setup level, NOT inside generationConfig
        this._wsSend({
            setup: {
                model: MODEL,
                generationConfig: {
                    responseModalities: ['AUDIO'],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: { voiceName: voice_id || 'Puck' }
                        }
                    },
                },
                systemInstruction: {
                    parts: [{ text: sysText }]
                },
                inputAudioTranscription: {},
                outputAudioTranscription: {},
            }
        });

        console.log('[LA] Setup sent — model:', MODEL, '| KB:', kb.length, 'chars');
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // GREETING (FIX #1: must include turns array with content)
    // ═══════════════════════════════════════════════════════════════════════════

    _sendGreeting() {
        // Gemini requires a valid clientContent with turns array.
        // A bare { turnComplete: true } without turns → "invalid argument" error.
        this._wsSend({
            clientContent: {
                turns: [{
                    role: 'user',
                    parts: [{
                        text: 'Greet me warmly in Tanglish, say your name and role, ask how you can help. Max 2 sentences.'
                    }]
                }],
                turnComplete: true,
            }
        });
        console.log('[LA] Greeting prompt sent');
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SERVER CONTENT (FIX #2: interrupt-safe audio discard)
    // ═══════════════════════════════════════════════════════════════════════════

    _handleServerContent(msg) {
        const sc = msg.serverContent || msg.server_content;
        if (!sc) return;

        // Server acknowledged interrupt
        if (sc.interrupted) {
            console.log('[LA] Server: interrupted');
            this._player.stop();
            this._playing = false;
            // FIX #2: keep discarding until the old turn fully completes.
            this._discardUntilNewTurn = true;
            this._emit('onInterrupted');
            return;
        }

        // Audio/text from model
        const parts = sc.modelTurn?.parts || sc.model_turn?.parts || [];
        for (const p of parts) {
            const d = p.inlineData || p.inline_data;
            const mime = d?.mimeType || d?.mime_type || '';
            if (mime.startsWith('audio/pcm')) {
                // FIX #2: discard audio from interrupted/stale turns
                if (this._discardUntilNewTurn || this._turnInterrupted) continue;
                this._playing = true;
                this._player.play(fromB64(d.data));
            }
        }

        // Turn complete
        if (sc.turnComplete || sc.turn_complete) {
            this._playing = false;
            // FIX #2: NOW safe to accept audio from the next turn
            this._turnInterrupted = false;
            this._discardUntilNewTurn = false;
            this._emit('onTurnComplete');
        }

        // User transcription
        const itx = sc.inputTranscription || sc.input_transcription;
        if (itx?.text && this._mode === 'chat') {
            this._emit('onTranscription', itx.text, true);
        }

        // Agent transcription (suppress if discarding stale turn)
        const otx = sc.outputTranscription || sc.output_transcription;
        if (otx?.text) {
            if (!this._discardUntilNewTurn && this._mode === 'chat') {
                this._emit('onTranscription', otx.text, false);
            }
            if (otx.text.includes('[END_CALL]')) {
                console.log('[LA] Agent confirmed call end');
                this._emit('onCallEnd');
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // MICROPHONE (FIX #3 VAD, FIX #4 echo gate, FIX #5 no manual turnComplete)
    // ═══════════════════════════════════════════════════════════════════════════

    async _startMic() {
        this._lastWasSpeech = false;
        this._vadSilenceFrames = 0;
        this._vadConsecutiveSpeech = 0;
        this._speechStartTime = 0;

        const AC = window.AudioContext || window.webkitAudioContext;
        if (!LiveAudioService._sharedMicCtx) {
            LiveAudioService._sharedMicCtx = new AC({ sampleRate: MIC_RATE });
            console.log('[LA] Created shared mic AudioContext');
        }
        this._micCtx = LiveAudioService._sharedMicCtx;
        if (this._micCtx.state === 'suspended') await this._micCtx.resume();

        if (!LiveAudioService._sharedWorkletReady) {
            const blob = new Blob([WORKLET_SRC], { type: 'application/javascript' });
            const url  = URL.createObjectURL(blob);
            await this._micCtx.audioWorklet.addModule(url);
            LiveAudioService._sharedWorkletReady = true;
            console.log('[LA] Worklet loaded');
        }

        this._stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                channelCount: 1, sampleRate: MIC_RATE,
                echoCancellation: true, noiseSuppression: true, autoGainControl: true,
            }
        });

        this._source = this._micCtx.createMediaStreamSource(this._stream);

        if (!LiveAudioService._sharedWorkletNode) {
            LiveAudioService._sharedWorkletNode = new AudioWorkletNode(this._micCtx, 'capture-proc');
            console.log('[LA] Created shared worklet node');
        }
        this._worklet = LiveAudioService._sharedWorkletNode;

        // ── Audio processing loop ────────────────────────────────────────
        this._worklet.port.onmessage = (ev) => {
            if (this._micCtx?.state === 'suspended') this._micCtx.resume();
            if (!this._live || this._muted || this._ws?.readyState !== WebSocket.OPEN) return;

            const f32 = ev.data;
            const pcm = new Uint8Array(f32ToI16(f32).buffer);

            // FIX #4: ECHO GATE — skip VAD while agent plays and user hasn't started
            if (this._playing && !this._lastWasSpeech) {
                this._sendAudio(pcm);
                return;
            }

            const isSpeech = this._detectSpeech(f32);

            // Speech START → interrupt agent
            if (isSpeech && !this._lastWasSpeech) {
                this._speechStartTime = Date.now();
                this._lastWasSpeech = true;
                console.log('[LA] 🎤 Speech start — interrupting agent');
                this._player.stop();
                this._turnInterrupted = true;
                this._discardUntilNewTurn = true;
                this._playing = false;
            }

            // Speech END (FIX #3: 12-frame silence, FIX #5: no manual turnComplete)
            if (!isSpeech && this._lastWasSpeech && this._vadSilenceFrames >= VAD_SILENCE_FRAMES) {
                const dur = Date.now() - this._speechStartTime;
                if (dur >= VAD_MIN_SPEECH_MS) {
                    console.log(`[LA] 🔇 Speech ended (${dur}ms) — Gemini will process`);
                }
                this._lastWasSpeech = false;
            }

            this._sendAudio(pcm);
        };

        // Keepalive
        this._keepalive = setInterval(() => {
            if (!this._live || this._ws?.readyState !== WebSocket.OPEN) return;
            this._sendAudio(new Uint8Array(256));
        }, 8000);

        if (!this._source._isConnected) {
            this._source.connect(this._worklet);
            this._source._isConnected = true;
        }
        console.log('[LA] Mic started');
    }

    _stopMic() {
        if (this._keepalive) { clearInterval(this._keepalive); this._keepalive = null; }
        if (this._worklet) { try { this._worklet.disconnect(); } catch (_) {} }
        if (this._stream) { this._stream.getTracks().forEach(t => t.stop()); this._stream = null; }
        this._source = null;
    }

    _sendAudio(pcmU8) {
        this._wsSend({
            realtimeInput: {
                mediaChunks: [{ mimeType: `audio/pcm;rate=${MIC_RATE}`, data: toB64(pcmU8) }]
            }
        });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // VAD (FIX #3: tuned for Tamil/Tanglish)
    // ═══════════════════════════════════════════════════════════════════════════

    _detectSpeech(f32) {
        if (!f32 || !f32.length) return false;

        let sum = 0;
        for (let i = 0; i < f32.length; i++) sum += f32[i] * f32[i];
        const rms = Math.sqrt(sum / f32.length);
        const isSpeech = rms > VAD_THRESHOLD;

        if (isSpeech) {
            this._vadSilenceFrames = 0;
            this._vadConsecutiveSpeech++;
        } else {
            this._vadSilenceFrames++;
            if (this._vadSilenceFrames > VAD_SILENCE_FRAMES) {
                this._vadConsecutiveSpeech = 0;
            }
        }

        return isSpeech && this._vadConsecutiveSpeech >= VAD_MIN_SPEECH_FRAMES;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // HELPERS
    // ═══════════════════════════════════════════════════════════════════════════

    _wsSend(obj) {
        if (this._ws?.readyState === WebSocket.OPEN) this._ws.send(JSON.stringify(obj));
    }

    _emit(ev, ...args) {
        if (typeof this._cbs[ev] === 'function') {
            try { this._cbs[ev](...args); } catch (e) { console.error('[LA]', e); }
        }
    }
}