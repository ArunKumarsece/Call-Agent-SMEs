/**
 * LiveAudioService — HYBRID v5 (Sarvam STT primary + Deepgram fallback → Gemini audio)
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * Architecture:
 *   Mic (16kHz PCM) ──→ Sarvam/Deepgram STT WebSocket ──→ text
 *                                                            ↓
 *   Speaker ←── audio ←── Gemini Live API ←── text (clientContent)
 *
 * WHY:
 *   - Streaming raw audio to Gemini causes token accumulation → progressive latency
 *   - Sending TEXT to Gemini keeps context tiny → constant fast latency every turn
 *   - Sarvam AI Saaras v3 has best Tanglish/Tamil accuracy with codemix mode
 *   - Deepgram Nova-3 multi-language is reliable fallback
 *
 * STT PROVIDERS:
 *   Primary:  Sarvam AI — wss://api.sarvam.ai/speech-to-text/streaming
 *             Model: saaras:v3, mode: codemix, language: ta-IN
 *             Supports: PCM 16kHz, VAD signals, code-mixed speech
 *
 *   Fallback: Deepgram — wss://api.deepgram.com/v1/listen
 *             Model: nova-3, language: multi (code-switching)
 *             Supports: PCM 16kHz, interim results, endpointing
 *
 * SETUP REQUIRED:
 *   Add to your .env file:
 *     VITE_SARVAM_API_KEY=your-sarvam-key      (from dashboard.sarvam.ai)
 *     VITE_DEEPGRAM_API_KEY=your-deepgram-key   (from console.deepgram.com)
 *
 *   For CRA use REACT_APP_SARVAM_API_KEY / REACT_APP_DEEPGRAM_API_KEY instead.
 *
 *   TODO (later): Switch to fetching keys from backend endpoints:
 *     GET /sarvam-key  → { key: "..." }
 *     GET /deepgram-key → { key: "..." }
 */

import { SpeakerVoiceLock } from './speakerVoiceLock.js';
import { getAPIBase } from '../api';
import CallRecordingSDK from './callRecordingSDK.js';

// ─── Constants ───────────────────────────────────────────────────────────────

const MODEL      = 'models/gemini-2.5-flash-native-audio-preview-12-2025';
const MIC_RATE   = 16000;
const SPEAK_RATE = 24000;
const WORKLET_CHUNK = 1024;  // 64ms frames

// Context compression (safety net — text tokens are small but still accumulate)
const CTX_TRIGGER_TOKENS = 10000;
const CTX_TARGET_TOKENS  = 5000;

// STT debounce — wait after last transcript before sending to Gemini
const SEND_DEBOUNCE_MS = 500;

// ─── API Keys (from env — switch to endpoint fetch later) ────────────────────
// Vite:    import.meta.env.VITE_SARVAM_API_KEY
// CRA:     process.env.REACT_APP_SARVAM_API_KEY
// Generic: process.env.SARVAM_API_KEY
const ENV_SARVAM_KEY   = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SARVAM_API_KEY)
                       || (typeof process !== 'undefined' && process.env?.REACT_APP_SARVAM_API_KEY)
                       || null;

const ENV_DEEPGRAM_KEY = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_DEEPGRAM_API_KEY)
                       || (typeof process !== 'undefined' && process.env?.REACT_APP_DEEPGRAM_API_KEY)
                       || null;

// ─── PCM Helpers ─────────────────────────────────────────────────────────────

function fromB64(b64) {
    const bin = atob(b64);
    const u8  = new Uint8Array(bin.length);
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

// ─── AudioWorklet ────────────────────────────────────────────────────────────

const WORKLET_SRC = `
class CaptureProc extends AudioWorkletProcessor {
    constructor(options) {
        super();
        this._chunk = (options && options.processorOptions && options.processorOptions.chunk) || 1024;
        this._buf = [];
    }
    process(inputs) {
        const ch = inputs[0]?.[0];
        if (ch) { for (let i = 0; i < ch.length; i++) this._buf.push(ch[i]); }
        while (this._buf.length >= this._chunk)
            this.port.postMessage(new Float32Array(this._buf.splice(0, this._chunk)));
        return true;
    }
}
registerProcessor('capture-proc', CaptureProc);
`;
const WORKLET_URL = 'data:application/javascript;base64,' + btoa(WORKLET_SRC);

// ─── Gapless Audio Player ─────────────────────────────────────────────────────

class Player {
    constructor() { this._ctx = null; this._t = 0; this._srcs = []; }

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

    close() { this.stop(); if (this._ctx) { try { this._ctx.close(); } catch (_) {} this._ctx = null; } }
    get isPlaying() { return this._srcs.length > 0; }
}

// ─── STT Provider: Sarvam AI ─────────────────────────────────────────────────

class SarvamSTT {
    constructor(apiKey, onTranscript, onSpeechStart, onSpeechEnd, onError) {
        this._key = apiKey;
        this._ws = null;
        this._onTranscript = onTranscript;
        this._onSpeechStart = onSpeechStart;
        this._onSpeechEnd = onSpeechEnd;
        this._onError = onError;
        this._alive = false;
    }

    async connect() {
        // Sarvam STT WebSocket endpoint: wss://api.sarvam.ai/speech-to-text/ws
        // Auth: Api-Subscription-Key header — but browser WebSockets can't set
        // custom headers, so we pass it as a query param.
        // If this doesn't work, you'll need a backend proxy.
        const params = new URLSearchParams({
            'model': 'saaras:v3',
            'mode': 'codemix',
            'language-code': 'ta-IN',
            'sample_rate': String(MIC_RATE),
            'input_audio_codec': 'pcm_s16le',
            'high_vad_sensitivity': 'true',
            'vad_signals': 'true',
            'Api-Subscription-Key': this._key,
        });

        const url = `wss://api.sarvam.ai/speech-to-text/ws?${params}`;

        return new Promise((resolve, reject) => {
            // Try connecting — if query-param auth fails, Sarvam needs a backend proxy
            const ws = new WebSocket(url);
            this._ws = ws;

            const timeout = setTimeout(() => {
                reject(new Error('Sarvam STT connection timeout'));
                try { ws.close(); } catch (_) {}
            }, 8000);

            ws.onopen = () => {
                clearTimeout(timeout);
                this._alive = true;
                console.log('[STT:Sarvam] ✅ Connected (codemix mode)');
                resolve();
            };

            ws.onmessage = (evt) => {
                try {
                    const msg = JSON.parse(evt.data);

                    if (msg.type === 'speech_start') {
                        this._onSpeechStart?.();
                    } else if (msg.type === 'speech_end') {
                        this._onSpeechEnd?.();
                    } else if (msg.type === 'transcript' || msg.transcript || msg.text) {
                        const text = msg.text || msg.transcript || '';
                        if (text.trim()) {
                            this._onTranscript(text.trim(), true);
                        }
                    }
                } catch (_) {}
            };

            ws.onerror = (e) => {
                clearTimeout(timeout);
                console.error('[STT:Sarvam] Error');
                this._alive = false;
                reject(new Error('Sarvam STT error'));
                this._onError?.();
            };

            ws.onclose = () => {
                clearTimeout(timeout);
                this._alive = false;
                console.log('[STT:Sarvam] Disconnected');
            };
        });
    }

    sendAudio(pcmI16Bytes) {
        if (this._ws?.readyState === WebSocket.OPEN) {
            this._ws.send(pcmI16Bytes);
        }
    }

    close() {
        this._alive = false;
        if (this._ws) { try { this._ws.close(); } catch (_) {} this._ws = null; }
    }

    get isAlive() { return this._alive && this._ws?.readyState === WebSocket.OPEN; }
}

// ─── STT Provider: Deepgram (fallback) ───────────────────────────────────────

class DeepgramSTT {
    constructor(apiKey, onTranscript, onSpeechStart, onSpeechEnd, onError) {
        this._key = apiKey;
        this._ws = null;
        this._onTranscript = onTranscript;
        this._onSpeechStart = onSpeechStart;
        this._onSpeechEnd = onSpeechEnd;
        this._onError = onError;
        this._alive = false;
        this._speaking = false;
    }

    async connect() {
        const params = new URLSearchParams({
            model: 'nova-3',
            // Tamil standalone mode — handles Tamil+English code-mixing
            // better than 'multi' which doesn't include Tamil
            language: 'ta',
            encoding: 'linear16',
            sample_rate: String(MIC_RATE),
            channels: '1',
            interim_results: 'true',
            endpointing: '100',
            smart_format: 'true',
            punctuate: 'true',
        });

        const url = `wss://api.deepgram.com/v1/listen?${params}`;

        return new Promise((resolve, reject) => {
            const ws = new WebSocket(url, ['token', this._key]);
            this._ws = ws;

            const timeout = setTimeout(() => {
                reject(new Error('Deepgram STT connection timeout'));
                try { ws.close(); } catch (_) {}
            }, 8000);

            ws.onopen = () => {
                clearTimeout(timeout);
                this._alive = true;
                console.log('[STT:Deepgram] ✅ Connected (nova-3 multi)');
                resolve();
            };

            ws.onmessage = (evt) => {
                try {
                    const msg = JSON.parse(evt.data);

                    if (msg.type === 'Results') {
                        const alt = msg.channel?.alternatives?.[0];
                        const text = alt?.transcript || '';
                        const isFinal = msg.is_final;

                        if (text.trim()) {
                            if (!this._speaking) {
                                this._speaking = true;
                                this._onSpeechStart?.();
                            }
                            this._onTranscript(text.trim(), isFinal);
                        }

                        if (msg.speech_final) {
                            this._speaking = false;
                            this._onSpeechEnd?.();
                        }
                    }
                } catch (_) {}
            };

            ws.onerror = () => {
                clearTimeout(timeout);
                this._alive = false;
                reject(new Error('Deepgram STT error'));
                this._onError?.();
            };

            ws.onclose = () => {
                clearTimeout(timeout);
                this._alive = false;
                console.log('[STT:Deepgram] Disconnected');
            };
        });
    }

    sendAudio(pcmI16Bytes) {
        if (this._ws?.readyState === WebSocket.OPEN) {
            this._ws.send(pcmI16Bytes.buffer);
        }
    }

    close() {
        this._alive = false;
        if (this._ws) {
            try { this._ws.send(JSON.stringify({ type: 'CloseStream' })); } catch (_) {}
            try { this._ws.close(); } catch (_) {}
            this._ws = null;
        }
    }

    get isAlive() { return this._alive && this._ws?.readyState === WebSocket.OPEN; }
}

// ─── LiveAudioService ────────────────────────────────────────────────────────

export class LiveAudioService {

    static _sharedMicCtx       = null;
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

        // Turn state
        this._playing             = false;
        this._turnInterrupted     = false;
        this._discardUntilNewTurn = false;

        // KB
        this._kbContext = '';

        // Session
        this._resumptionToken = null;
        this._geminiKey       = null;
        this._isReconnecting  = false;
        this._keepalive       = null;

        // STT
        this._stt             = null;   // active STT provider
        this._sttProvider     = '';     // 'sarvam' or 'deepgram'
        this._sarvamKey       = null;
        this._deepgramKey     = null;
        this._finalText       = '';
        this._sendTimer       = null;
        this._userSpeaking    = false;

        // Diagnostics
        this._turnCount        = 0;
        this._sessionStartTime = 0;
        this._lastSendTime     = 0;
        this._lastAudioRcvTime = 0;

        // Recording (via CallRecordingSDK)
        this._recorder         = null;
        this._recordingStartTime = 0;
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
        this._playing             = false;
        this._turnInterrupted     = false;
        this._discardUntilNewTurn = false;
        this._kbContext           = '';
        this._resumptionToken     = null;
        this._turnCount           = 0;
        this._sessionStartTime    = Date.now();
        this._finalText           = '';

        try {
            this._player.prime();
            const API = getAPIBase();

            // Fetch Gemini key from backend + KB in parallel
            // STT keys come from env vars (switch to endpoint later)
            const [geminiKey] = await Promise.all([
                this._fetchKey(API, 'gemini-key'),
                agentConfig.id ? this._loadKB(API, agentConfig.id) : Promise.resolve(),
            ]);

            this._geminiKey   = geminiKey;
            this._sarvamKey   = ENV_SARVAM_KEY;
            this._deepgramKey = ENV_DEEPGRAM_KEY;

            // TODO: Later, switch to fetching from endpoints:
            // this._sarvamKey   = await this._fetchKey(API, 'sarvam-key').catch(() => null);
            // this._deepgramKey = await this._fetchKey(API, 'deepgram-key').catch(() => null);

            if (!this._sarvamKey && !this._deepgramKey) {
                throw new Error('No STT API key found. Set VITE_SARVAM_API_KEY or VITE_DEEPGRAM_API_KEY in .env');
            }

            console.log('[LA] STT keys:', this._sarvamKey ? '✅ Sarvam' : '❌ Sarvam', '|', this._deepgramKey ? '✅ Deepgram' : '❌ Deepgram');

            // Initialize recorder (if options.recordingEnabled)
            if (options.recordingEnabled !== false && agentConfig?.id) {
                this._initializeRecorder(agentConfig.id, options.callerId);
            }

            // Connect to Gemini
            const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${geminiKey}`;
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
        this._stt?.close();
        this._player.close();
        if (this._keepalive) { clearInterval(this._keepalive); this._keepalive = null; }
        if (this._ws) { try { this._ws.close(1000, 'bye'); } catch (_) {} this._ws = null; }
        
        // End recording (async, fire-and-forget)
        if (this._recorder) {
            this._recorder.endSession().catch(e => console.warn('[LA] Error ending recording:', e));
        }
        
        this._emit('onClose');
    }

    toggleMute() {
        this._muted = !this._muted;
        return this._muted;
    }

    sendText(text) {
        if (!text?.trim()) return;
        this._sendToGemini(text.trim());
    }

    static resetSharedResources() {
        if (LiveAudioService._sharedMicCtx) {
            try { LiveAudioService._sharedMicCtx.close(); } catch (_) {}
            LiveAudioService._sharedMicCtx = null;
        }
        LiveAudioService._sharedWorkletReady = false;
        LiveAudioService._sharedWorkletNode  = null;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // INIT HELPERS
    // ═══════════════════════════════════════════════════════════════════════════

    async _fetchKey(apiBase, endpoint) {
        const res = await fetch(`${apiBase}/${endpoint}`);
        if (!res.ok) throw new Error(`Cannot fetch ${endpoint}`);
        const { key } = await res.json();
        return key;
    }

    async _loadKB(apiBase, agentId) {
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                const res = await fetch(`${apiBase}/agents/public/${agentId}/kb-context`);
                if (res.ok) {
                    const data = await res.json();
                    this._kbContext = data.context || '';
                    if (this._kbContext.length > 0) {
                        console.log(`[LA] KB loaded: ${this._kbContext.length} chars`);
                        return;
                    }
                }
            } catch (e) {
                console.warn(`[LA] KB attempt ${attempt + 1} failed:`, e.message);
            }
            if (attempt < 2) await new Promise(r => setTimeout(r, 500));
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // GEMINI WEBSOCKET
    // ═══════════════════════════════════════════════════════════════════════════

    _connectWS(url) {
        return new Promise((resolve, reject) => {
            const ws = new WebSocket(url);
            ws.binaryType = 'arraybuffer';
            this._ws = ws;

            const timeout = setTimeout(() => {
                reject(new Error('Timeout'));
                try { ws.close(); } catch (_) {}
            }, 15000);

            ws.onopen = () => {
                console.log('[LA] Gemini WS open');
                this._sendSetup();
            };

            ws.onmessage = async (evt) => {
                const raw = typeof evt.data === 'string' ? evt.data : new TextDecoder().decode(new Uint8Array(evt.data));
                let msg;
                try { msg = JSON.parse(raw); } catch { return; }

                if (msg.setupComplete !== undefined) {
                    clearTimeout(timeout);
                    try {
                        if (!this._isReconnecting) {
                            await this._startMic();
                            await this._connectSTT();
                        }
                        this._live = true;
                        this._emit('onOpen');
                        if (!this._isReconnecting) this._sendGreeting();
                        this._isReconnecting = false;

                        if (!this._keepalive) {
                            this._keepalive = setInterval(() => {
                                if (this._ws?.readyState === WebSocket.OPEN) {
                                    this._wsSend({ clientContent: { turns: [] } });
                                }
                            }, 15000);
                        }
                        resolve();
                    } catch (e) { reject(e); }
                    return;
                }

                if (msg.error) {
                    clearTimeout(timeout);
                    const e = new Error(msg.error.message || JSON.stringify(msg.error));
                    reject(e); this._emit('onError', e);
                    return;
                }

                if (msg.goAway || msg.go_away) {
                    this._scheduleReconnect();
                    return;
                }

                if (msg.sessionResumptionUpdate || msg.session_resumption_update) {
                    const sru = msg.sessionResumptionUpdate || msg.session_resumption_update;
                    if (sru.newHandle || sru.new_handle) {
                        this._resumptionToken = sru.newHandle || sru.new_handle;
                    }
                    return;
                }

                if (msg.usageMetadata || msg.usage_metadata) {
                    const total = (msg.usageMetadata || msg.usage_metadata).totalTokenCount || 0;
                    if (total > 0) console.log(`[LA] 📊 Context: ${total} tokens (turn #${this._turnCount})`);
                }

                this._handleServerContent(msg);
            };

            ws.onerror = () => { clearTimeout(timeout); reject(new Error('WS error')); };
            ws.onclose = (e) => {
                clearTimeout(timeout);
                this._live = false;
                if (!this._stop && this._resumptionToken && !this._isReconnecting) {
                    this._attemptResume();
                } else if (!this._stop) {
                    reject(new Error(e.reason || `code ${e.code}`));
                    this._emit('onError', new Error(e.reason));
                    this._emit('onClose');
                }
            };
        });
    }

    async _attemptResume() {
        if (!this._geminiKey || !this._resumptionToken) return;
        this._isReconnecting = true;
        try {
            const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${this._geminiKey}`;
            await this._connectWS(url);
        } catch (e) {
            this._isReconnecting = false;
            this._emit('onError', e);
            this._emit('onClose');
        }
    }

    _scheduleReconnect() {
        setTimeout(() => {
            if (this._stop) return;
            if (this._ws) { try { this._ws.close(1000); } catch (_) {} }
            this._attemptResume();
        }, 500);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SETUP — text in, audio out
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

        this._wsSend({
            setup: {
                model: MODEL,
                generationConfig: {
                    responseModalities: ['AUDIO'],
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice_id || 'Puck' } } },
                    thinkingConfig: { thinkingBudget: 0 },
                },
                systemInstruction: { parts: [{ text: sysText }] },
                contextWindowCompression: {
                    triggerTokens: String(CTX_TRIGGER_TOKENS),
                    slidingWindow: { targetTokens: String(CTX_TARGET_TOKENS) },
                },
                sessionResumption: this._resumptionToken ? { handle: this._resumptionToken } : {},
                outputAudioTranscription: {},
            }
        });

        console.log(`[LA] Gemini setup sent | KB: ${kb.length} chars | STT: ${this._sttProvider || 'pending'}`);
    }

    _sendGreeting() {
        this._sendToGemini('Greet me warmly in Tanglish, say your name and role, ask how you can help. Max 2 sentences.');
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // RECORDING — Async call recording (non-blocking)
    // ═══════════════════════════════════════════════════════════════════════════

    _initializeRecorder(agentId, callerId = null) {
        try {
            this._recorder = new CallRecordingSDK(agentId, callerId);
            this._recordingStartTime = Date.now();

            // Start recording session
            this._recorder.startSession().then(() => {
                console.log('[LA] 🔴 Recording started (async, non-blocking)');
            }).catch(e => {
                console.warn('[LA] Error starting recording:', e);
            });
        } catch (e) {
            console.warn('[LA] Could not initialize recorder:', e);
        }
    }

    async _recordTranscript(role, text, timestampMs = null) {
        if (!this._recorder) return;
        try {
            await this._recorder.addTranscript(role, text, timestampMs);
        } catch (e) {
            console.warn('[LA] Error recording transcript:', e);
        }
    }

    async _recordAudio(pcmI16Bytes) {
        if (!this._recorder) return;
        try {
            await this._recorder.addAudio(pcmI16Bytes);
        } catch (e) {
            console.warn('[LA] Error recording audio:', e);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STT CONNECTION — Sarvam primary, Deepgram fallback
    // ═══════════════════════════════════════════════════════════════════════════

    async _connectSTT() {
        const onTranscript  = (text, isFinal) => this._onSTTTranscript(text, isFinal);
        const onSpeechStart = () => this._onSTTSpeechStart();
        const onSpeechEnd   = () => this._onSTTSpeechEnd();

        // Try Sarvam first
        if (this._sarvamKey) {
            try {
                const sarvam = new SarvamSTT(this._sarvamKey, onTranscript, onSpeechStart, onSpeechEnd, () => {
                    console.warn('[LA] Sarvam STT died → falling back to Deepgram');
                    this._fallbackToDeepgram(onTranscript, onSpeechStart, onSpeechEnd);
                });
                await sarvam.connect();
                this._stt = sarvam;
                this._sttProvider = 'sarvam';
                console.log('[LA] 🎯 STT: Sarvam AI (codemix for Tanglish)');
                return;
            } catch (e) {
                console.warn('[LA] Sarvam connect failed:', e.message);
            }
        }

        // Fall back to Deepgram
        await this._fallbackToDeepgram(onTranscript, onSpeechStart, onSpeechEnd);
    }

    async _fallbackToDeepgram(onTranscript, onSpeechStart, onSpeechEnd) {
        if (!this._deepgramKey) {
            console.error('[LA] ❌ No Deepgram key either — STT unavailable');
            this._emit('onError', new Error('No STT provider available'));
            return;
        }

        try {
            const dg = new DeepgramSTT(this._deepgramKey, onTranscript, onSpeechStart, onSpeechEnd, () => {
                console.error('[LA] ❌ Deepgram STT also died');
            });
            await dg.connect();
            this._stt = dg;
            this._sttProvider = 'deepgram';
            console.log('[LA] 🔄 STT: Deepgram Nova-3 (fallback)');
        } catch (e) {
            console.error('[LA] Deepgram connect failed:', e.message);
            this._emit('onError', new Error('All STT providers failed'));
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STT CALLBACKS
    // ═══════════════════════════════════════════════════════════════════════════

    _onSTTSpeechStart() {
        this._userSpeaking = true;

        // Interrupt agent if playing
        if (this._playing) {
            console.log('[LA] 🎤 User speaking → interrupt agent');
            this._player.stop();
            this._playing             = false;
            this._turnInterrupted     = true;
            this._discardUntilNewTurn = true;
        }
    }

    _onSTTSpeechEnd() {
        this._userSpeaking = false;
    }

    _onSTTTranscript(text, isFinal) {
        if (this._muted || !this._live) return;

        // Show interim/final transcription to user
        this._emit('onTranscription', text, true);

        if (isFinal && text.trim()) {
            this._finalText += (this._finalText ? ' ' : '') + text.trim();

            // Debounce: wait for user to fully stop, then send
            if (this._sendTimer) clearTimeout(this._sendTimer);
            this._sendTimer = setTimeout(() => {
                const toSend = this._finalText.trim();
                this._finalText = '';
                if (!toSend) return;

                // Record user transcript (async, fire-and-forget)
                const timestampMs = (Date.now() - this._recordingStartTime);
                this._recordTranscript('user', toSend, timestampMs);

                console.log(`[LA] 📝 Sending: "${toSend}" [via ${this._sttProvider}]`);
                this._lastSendTime = Date.now();
                this._lastAudioRcvTime = 0;
                this._emit('onTranscription', toSend, true);
                this._sendToGemini(toSend);
            }, SEND_DEBOUNCE_MS);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SEND TEXT TO GEMINI
    // ═══════════════════════════════════════════════════════════════════════════

    _sendToGemini(text) {
        if (!text?.trim() || this._ws?.readyState !== WebSocket.OPEN) return;
        this._wsSend({
            clientContent: {
                turns: [{ role: 'user', parts: [{ text: text.trim() }] }],
                turnComplete: true,
            }
        });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SERVER CONTENT
    // ═══════════════════════════════════════════════════════════════════════════

    _handleServerContent(msg) {
        const sc = msg.serverContent || msg.server_content;
        if (!sc) return;

        if (sc.interrupted) {
            this._player.stop();
            this._playing = false;
            this._discardUntilNewTurn = true;
            this._emit('onInterrupted');
            return;
        }

        const parts = sc.modelTurn?.parts || sc.model_turn?.parts || [];
        for (const p of parts) {
            const d = p.inlineData || p.inline_data;
            const mime = d?.mimeType || d?.mime_type || '';
            if (mime.startsWith('audio/pcm')) {
                if (this._discardUntilNewTurn || this._turnInterrupted) continue;

                if (!this._lastAudioRcvTime && this._lastSendTime) {
                    const lat = Date.now() - this._lastSendTime;
                    console.log(`[LA] ⏱️ LATENCY: ${lat}ms (turn #${this._turnCount + 1}) [${this._sttProvider}]`);
                    this._lastAudioRcvTime = Date.now();
                }

                this._playing = true;
                this._player.play(fromB64(d.data));
            }
        }

        if (sc.turnComplete || sc.turn_complete) {
            this._turnCount++;
            this._playing = false;
            this._turnInterrupted = false;
            this._discardUntilNewTurn = false;
            this._lastSendTime = 0;
            this._lastAudioRcvTime = 0;
            const elapsed = ((Date.now() - this._sessionStartTime) / 1000).toFixed(0);
            console.log(`[LA] ✅ Turn #${this._turnCount} (${elapsed}s) [${this._sttProvider}]`);
            this._emit('onTurnComplete');
        }

        const otx = sc.outputTranscription || sc.output_transcription;
        if (otx?.text) {
            // Record agent transcript (async, fire-and-forget)
            const timestampMs = (Date.now() - this._recordingStartTime);
            this._recordTranscript('agent', otx.text, timestampMs);

            if (!this._discardUntilNewTurn && this._mode === 'chat') {
                this._emit('onTranscription', otx.text, false);
            }
            if (otx.text.includes('[END_CALL]')) {
                this._emit('onCallEnd');
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // MICROPHONE — streams PCM to STT provider (NOT to Gemini)
    // ═══════════════════════════════════════════════════════════════════════════

    async _startMic() {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!LiveAudioService._sharedMicCtx) {
            LiveAudioService._sharedMicCtx = new AC({ sampleRate: MIC_RATE });
        }
        this._micCtx = LiveAudioService._sharedMicCtx;
        if (this._micCtx.state === 'suspended') await this._micCtx.resume();

        if (!LiveAudioService._sharedWorkletReady) {
            await this._micCtx.audioWorklet.addModule(WORKLET_URL);
            LiveAudioService._sharedWorkletReady = true;
        }

        this._stream = await navigator.mediaDevices.getUserMedia({
            audio: { channelCount: 1, sampleRate: MIC_RATE, echoCancellation: true, noiseSuppression: true, autoGainControl: true }
        });

        this._source = this._micCtx.createMediaStreamSource(this._stream);

        if (!LiveAudioService._sharedWorkletNode) {
            LiveAudioService._sharedWorkletNode = new AudioWorkletNode(this._micCtx, 'capture-proc', { processorOptions: { chunk: WORKLET_CHUNK } });
        }
        this._worklet = LiveAudioService._sharedWorkletNode;

        // Stream mic audio to STT provider (NOT to Gemini)
        this._worklet.port.onmessage = (ev) => {
            if (this._micCtx?.state === 'suspended') this._micCtx.resume();
            if (!this._live || this._muted) return;

            const f32 = ev.data;
            const i16 = f32ToI16(f32);

            // Send raw PCM to STT
            if (this._stt?.isAlive) {
                this._stt.sendAudio(new Uint8Array(i16.buffer));
            }

            // Record audio (async, fire-and-forget)
            this._recordAudio(new Uint8Array(i16.buffer));
        };

        if (!this._source._isConnected) {
            this._source.connect(this._worklet);
            this._source._isConnected = true;
        }
        console.log('[LA] 🎤 Mic started → streaming to STT');
    }

    _stopMic() {
        if (this._worklet) { try { this._worklet.disconnect(); } catch (_) {} }
        if (this._stream) { this._stream.getTracks().forEach(t => t.stop()); this._stream = null; }
        this._source = null;
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