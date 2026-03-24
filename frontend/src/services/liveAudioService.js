// // /**
// //  * Gemini Live Audio Service
// //  * Uses @google/genai SDK with the Live API for real-time bidirectional audio.
// //  * Model: gemini-2.5-flash-native-audio-preview-12-2025 (free tier, native audio)
// //  */

// // import { GoogleGenAI, Modality } from '@google/genai';

// // const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
// // const MODEL = 'gemini-2.5-flash-native-audio-preview-12-2025';
// // const INPUT_SAMPLE_RATE = 16000;
// // const OUTPUT_SAMPLE_RATE = 24000; // Gemini outputs 24kHz audio

// // // ─── Helpers ─────────────────────────────────────────────

// // function encodeToBase64(bytes) {
// //     let binary = '';
// //     for (let i = 0; i < bytes.byteLength; i++) {
// //         binary += String.fromCharCode(bytes[i]);
// //     }
// //     return btoa(binary);
// // }

// // function decodeFromBase64(base64) {
// //     const binaryString = atob(base64);
// //     const bytes = new Uint8Array(binaryString.length);
// //     for (let i = 0; i < binaryString.length; i++) {
// //         bytes[i] = binaryString.charCodeAt(i);
// //     }
// //     return bytes;
// // }

// // // ─── Live Audio Service Class ────────────────────────────

// // export class LiveAudioService {
// //     constructor() {
// //         this.session = null;
// //         this.audioContext = null;
// //         this.mediaStream = null;
// //         this.processor = null;
// //         this.source = null;
// //         this.nextPlayTime = 0;
// //         this.callbacks = {};
// //         this.isMuted = false;
// //     }

// //     /**
// //      * Connect to Gemini Live API with native audio.
// //      * @param {Object} agent - Agent object with name, role, system_prompt, voice_id
// //      * @param {Object} callbacks - Event callbacks
// //      */
// //     async connect(agent, callbacks) {
// //         this.callbacks = callbacks;

// //         if (!API_KEY) {
// //             callbacks.onError?.({ message: 'VITE_GEMINI_API_KEY not set in frontend .env' });
// //             return false;
// //         }

// //         const ai = new GoogleGenAI({ apiKey: API_KEY });

// //         const systemInstruction = `
// // Role: ${agent.role || 'AI Assistant'}
// // Name: ${agent.name || 'Assistant'}

// // System Instructions:
// // ${agent.system_prompt || 'You are a helpful AI assistant.'}

// // Guidelines:
// // 1. Keep responses conversational and concise — this is a voice call.
// // 2. Respond in Tanglish (a natural mix of Tamil and English).
// // 3. Use Tamil script for Tamil words.
// // 4. Be friendly, warm, and helpful like a real human.
// // 5. Avoid long paragraphs. Keep sentences short for voice.
// //         `.trim();

// //         const voiceName = agent.voice_id || 'Puck';

// //         try {
// //             console.log(`🎙️ Connecting to Gemini Live API (${MODEL})...`);

// //             this.session = await ai.live.connect({
// //                 model: MODEL,
// //                 config: {
// //                     responseModalities: [Modality.AUDIO],
// //                     speechConfig: {
// //                         voiceConfig: {
// //                             prebuiltVoiceConfig: { voiceName }
// //                         }
// //                     },
// //                     systemInstruction,
// //                     inputAudioTranscription: {},
// //                     outputAudioTranscription: {},
// //                 },
// //                 callbacks: {
// //                     onopen: () => {
// //                         console.log('✅ Gemini Live API connected');
// //                         callbacks.onOpen?.();
// //                     },
// //                     onclose: (e) => {
// //                         console.log('🔌 Gemini Live API disconnected', e);
// //                         callbacks.onClose?.(e);
// //                     },
// //                     onerror: (e) => {
// //                         console.error('❌ Gemini Live API error:', e);
// //                         callbacks.onError?.(e);
// //                     },
// //                     onmessage: (message) => this._handleMessage(message),
// //                 },
// //             });

// //             // Start audio context and mic capture
// //             this.audioContext = new AudioContext({ sampleRate: INPUT_SAMPLE_RATE });
// //             await this._startMicCapture();

// //             console.log('🎤 Mic capture started');
// //             return true;
// //         } catch (error) {
// //             console.error('❌ Live API connection error:', error);
// //             callbacks.onError?.(error);
// //             return false;
// //         }
// //     }

// //     /**
// //      * Handle incoming messages from Gemini Live API.
// //      */
// //     _handleMessage(message) {
// //         // Handle audio output from the model
// //         const audioPart = message.serverContent?.modelTurn?.parts?.[0]?.inlineData;
// //         if (audioPart?.data) {
// //             this._playAudio(audioPart.data);
// //         }

// //         // Handle interruption (user started speaking while model was talking)
// //         if (message.serverContent?.interrupted) {
// //             console.log('⚡ Model interrupted');
// //             this.nextPlayTime = 0;
// //             this.callbacks.onInterrupted?.();
// //         }

// //         // Handle input transcription (what the user said)
// //         if (message.serverContent?.inputTranscription?.text) {
// //             this.callbacks.onTranscription?.(
// //                 message.serverContent.inputTranscription.text,
// //                 true // isUser
// //             );
// //         }

// //         // Handle output transcription (what the model said)
// //         if (message.serverContent?.outputTranscription?.text) {
// //             this.callbacks.onTranscription?.(
// //                 message.serverContent.outputTranscription.text,
// //                 false // isUser
// //             );
// //         }

// //         // Handle tool calls (if any)
// //         if (message.toolCall) {
// //             for (const fc of message.toolCall.functionCalls) {
// //                 console.log('🔧 Tool call:', fc.name, fc.args);
// //                 // Send a generic response for now
// //                 if (this.session) {
// //                     this.session.sendToolResponse({
// //                         functionResponses: [{
// //                             id: fc.id,
// //                             name: fc.name,
// //                             response: { result: 'Action completed successfully.' }
// //                         }]
// //                     });
// //                 }
// //             }
// //         }
// //     }

// //     /**
// //      * Start capturing audio from the microphone.
// //      */
// //     async _startMicCapture() {
// //         this.mediaStream = await navigator.mediaDevices.getUserMedia({
// //             audio: {
// //                 channelCount: 1,
// //                 sampleRate: INPUT_SAMPLE_RATE,
// //                 echoCancellation: true,
// //                 noiseSuppression: true,
// //                 autoGainControl: true,
// //             }
// //         });

// //         this.source = this.audioContext.createMediaStreamSource(this.mediaStream);

// //         // Use ScriptProcessorNode (compatible with HTTP localhost)
// //         this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
// //         this.processor.onaudioprocess = (e) => {
// //             if (!this.session || this.isMuted) return;

// //             const inputData = e.inputBuffer.getChannelData(0);

// //             // Convert float32 [-1, 1] to int16
// //             const pcm16 = new Int16Array(inputData.length);
// //             for (let i = 0; i < inputData.length; i++) {
// //                 const s = Math.max(-1, Math.min(1, inputData[i]));
// //                 pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
// //             }

// //             // Encode and send to Gemini
// //             const bytes = new Uint8Array(pcm16.buffer);
// //             const base64 = encodeToBase64(bytes);

// //             try {
// //                 this.session.sendRealtimeInput({
// //                     audio: {
// //                         data: base64,
// //                         mimeType: `audio/pcm;rate=${INPUT_SAMPLE_RATE}`,
// //                     }
// //                 });
// //             } catch (err) {
// //                 // Silently ignore send errors (session may be closing)
// //             }
// //         };

// //         this.source.connect(this.processor);
// //         this.processor.connect(this.audioContext.destination);
// //     }

// //     /**
// //      * Play received audio data from the model.
// //      */
// //     _playAudio(base64Data) {
// //         if (!this.audioContext) return;

// //         try {
// //             const bytes = decodeFromBase64(base64Data);
// //             const pcm16 = new Int16Array(bytes.buffer);
// //             const float32 = new Float32Array(pcm16.length);

// //             for (let i = 0; i < pcm16.length; i++) {
// //                 float32[i] = pcm16[i] / 32768.0;
// //             }

// //             const buffer = this.audioContext.createBuffer(1, float32.length, OUTPUT_SAMPLE_RATE);
// //             buffer.getChannelData(0).set(float32);

// //             const source = this.audioContext.createBufferSource();
// //             source.buffer = buffer;
// //             source.connect(this.audioContext.destination);

// //             const now = this.audioContext.currentTime;
// //             if (this.nextPlayTime < now) {
// //                 this.nextPlayTime = now;
// //             }
// //             source.start(this.nextPlayTime);
// //             this.nextPlayTime += buffer.duration;
// //         } catch (err) {
// //             console.error('Audio playback error:', err);
// //         }
// //     }

// //     /**
// //      * Send a text message through the Live API session.
// //      */
// //     sendText(text) {
// //         if (this.session) {
// //             this.session.sendClientContent({
// //                 turns: [{ role: 'user', parts: [{ text }] }]
// //             });
// //         }
// //     }

// //     /**
// //      * Toggle microphone mute/unmute.
// //      */
// //     toggleMute() {
// //         this.isMuted = !this.isMuted;
// //         return this.isMuted;
// //     }

// //     /**
// //      * Check if currently muted.
// //      */
// //     get muted() {
// //         return this.isMuted;
// //     }

// //     /**
// //      * Disconnect and clean up all resources.
// //      */
// //     disconnect() {
// //         if (this.processor) {
// //             this.processor.disconnect();
// //             this.processor = null;
// //         }
// //         if (this.source) {
// //             this.source.disconnect();
// //             this.source = null;
// //         }
// //         if (this.mediaStream) {
// //             this.mediaStream.getTracks().forEach(track => track.stop());
// //             this.mediaStream = null;
// //         }
// //         if (this.audioContext) {
// //             this.audioContext.close().catch(() => { });
// //             this.audioContext = null;
// //         }
// //         if (this.session) {
// //             try {
// //                 this.session.close();
// //             } catch (e) {
// //                 // Ignore close errors
// //             }
// //             this.session = null;
// //         }
// //         this.nextPlayTime = 0;
// //         this.isMuted = false;
// //         console.log('🔌 LiveAudioService disconnected and cleaned up');
// //     }
// // }


// /**
//  * LiveAudioService — Gemini Live API real-time voice
//  * ───────────────────────────────────────────────────
//  * Connects directly from the browser to:
//  *   wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent
//  *
//  * Flow:
//  *   1. Open WS → send setup message (model, system prompt, voice config)
//  *   2. Capture mic PCM16 @ 16kHz via AudioWorklet → send realtimeInput chunks
//  *   3. Receive serverContent with modelTurn audio parts → decode PCM24k → play
//  *   4. Interruption handled automatically by Gemini (sends interrupted signal)
//  */

// const GEMINI_LIVE_MODEL = 'models/gemini-2.5-flash-native-audio-preview-12-2025';
// const MIC_SAMPLE_RATE   = 16000;
// const OUT_SAMPLE_RATE   = 24000;

// // ─── PCM helpers ─────────────────────────────────────────────────────────────

// function float32ToPCM16(float32Array) {
//     const pcm = new Int16Array(float32Array.length);
//     for (let i = 0; i < float32Array.length; i++) {
//         const s = Math.max(-1, Math.min(1, float32Array[i]));
//         pcm[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
//     }
//     return pcm;
// }

// function pcm16ToFloat32(pcm16Buffer) {
//     const int16 = new Int16Array(pcm16Buffer);
//     const float32 = new Float32Array(int16.length);
//     for (let i = 0; i < int16.length; i++) {
//         float32[i] = int16[i] / 32768.0;
//     }
//     return float32;
// }

// function b64ToArrayBuffer(b64) {
//     const bin = atob(b64);
//     const buf = new ArrayBuffer(bin.length);
//     const view = new Uint8Array(buf);
//     for (let i = 0; i < bin.length; i++) view[i] = bin.charCodeAt(i);
//     return buf;
// }

// function arrayBufferToB64(buffer) {
//     const bytes = new Uint8Array(buffer);
//     let binary = '';
//     for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
//     return btoa(binary);
// }

// // ─── AudioWorklet processor source (inlined as blob) ─────────────────────────
// const WORKLET_SRC = `
// class PCMCapture extends AudioWorkletProcessor {
//     constructor() {
//         super();
//         this._buf = [];
//         this._count = 0;
//         this._chunkSize = 1600; // 100ms at 16kHz
//     }
//     process(inputs) {
//         const ch = inputs[0]?.[0];
//         if (!ch) return true;
//         for (let i = 0; i < ch.length; i++) this._buf.push(ch[i]);
//         this._count += ch.length;
//         if (this._count >= this._chunkSize) {
//             this.port.postMessage(new Float32Array(this._buf.splice(0, this._chunkSize)));
//             this._count -= this._chunkSize;
//         }
//         return true;
//     }
// }
// registerProcessor('pcm-capture', PCMCapture);
// `;

// // ─── Audio playback queue ──────────────────────────────────────────────────────
// class AudioPlaybackQueue {
//     constructor(sampleRate) {
//         this._ctx = null;
//         this._sampleRate = sampleRate;
//         this._queue = [];
//         this._playing = false;
//         this._nextTime = 0;
//         this._onTranscription = null;
//     }

//     setContext(ctx) { this._ctx = ctx; }
//     onTranscription(cb) { this._onTranscription = cb; }

//     enqueue(pcm16Buffer, text) {
//         this._queue.push({ pcm16Buffer, text });
//         if (!this._playing) this._drain();
//     }

//     _drain() {
//         if (!this._ctx || this._queue.length === 0) {
//             this._playing = false;
//             return;
//         }
//         this._playing = true;
//         const { pcm16Buffer, text } = this._queue.shift();
//         const float32 = pcm16ToFloat32(pcm16Buffer);
//         const audioBuffer = this._ctx.createBuffer(1, float32.length, this._sampleRate);
//         audioBuffer.copyToChannel(float32, 0);

//         const source = this._ctx.createBufferSource();
//         source.buffer = audioBuffer;
//         source.connect(this._ctx.destination);

//         const startAt = Math.max(this._ctx.currentTime, this._nextTime);
//         source.start(startAt);
//         this._nextTime = startAt + audioBuffer.duration;

//         if (text && this._onTranscription) {
//             this._onTranscription(text, false);
//         }

//         source.onended = () => this._drain();
//     }

//     clear() {
//         this._queue = [];
//         this._playing = false;
//         this._nextTime = 0;
//     }

//     get isPlaying() { return this._playing; }
// }

// // ─── Main service ─────────────────────────────────────────────────────────────
// export class LiveAudioService {
//     constructor() {
//         this._ws = null;
//         this._audioCtx = null;
//         this._workletNode = null;
//         this._stream = null;
//         this._playback = new AudioPlaybackQueue(OUT_SAMPLE_RATE);
//         this._muted = false;
//         this._connected = false;
//         this._callbacks = {};
//         this._agentTranscriptBuf = '';
//         this._userTranscriptBuf = '';
//         this._setupDone = false;
//     }

//     // ── Public API ────────────────────────────────────────────────────────────

//     async connect(agentConfig, callbacks) {
//         this._callbacks = callbacks || {};
//         this._agentConfig = agentConfig;

//         try {
//             // 1. Fetch Gemini key from backend
//             const keyRes = await fetch('/api/gemini-key');
//             if (!keyRes.ok) throw new Error('Could not fetch Gemini key from backend');
//             const { key } = await keyRes.json();

//             // 2. Build WS URL
//             const wsUrl =
//                 `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta` +
//                 `.GenerativeService.BidiGenerateContent?key=${key}`;

//             // 3. Set up audio context
//             const AudioCtx = window.AudioContext || window.webkitAudioContext;
//             this._audioCtx = new AudioCtx({ sampleRate: MIC_SAMPLE_RATE });
//             this._playback.setContext(this._audioCtx);
//             this._playback.onTranscription((text, isUser) => {
//                 this._emit('onTranscription', text, isUser);
//             });

//             // 4. Open WebSocket
//             await this._openWebSocket(wsUrl);

//             // 5. Start mic
//             await this._startMic();

//             return true;
//         } catch (err) {
//             console.error('LiveAudioService connect error:', err);
//             this._emit('onError', err);
//             return false;
//         }
//     }

//     disconnect() {
//         this._connected = false;
//         this._stopMic();
//         this._playback.clear();
//         if (this._ws) {
//             try { this._ws.close(); } catch (_) {}
//             this._ws = null;
//         }
//         if (this._audioCtx) {
//             try { this._audioCtx.close(); } catch (_) {}
//             this._audioCtx = null;
//         }
//         this._emit('onClose');
//     }

//     toggleMute() {
//         this._muted = !this._muted;
//         return this._muted;
//     }

//     sendText(text) {
//         if (!this._ws || this._ws.readyState !== WebSocket.OPEN) return;
//         this._wsSend({
//             clientContent: {
//                 turns: [{ role: 'user', parts: [{ text }] }],
//                 turnComplete: true,
//             }
//         });
//     }

//     // ── WebSocket ─────────────────────────────────────────────────────────────

//     _openWebSocket(url) {
//         return new Promise((resolve, reject) => {
//             const ws = new WebSocket(url);
//             this._ws = ws;
//             ws.binaryType = 'arraybuffer';

//             ws.onopen = () => {
//                 // Send setup immediately
//                 this._sendSetup();
//                 // Resolve after a tick — setup is async server-side
//                 setTimeout(resolve, 200);
//             };

//             ws.onmessage = (evt) => this._onMessage(evt);

//             ws.onclose = (evt) => {
//                 this._connected = false;
//                 if (!evt.wasClean && evt.code !== 1000) {
//                     this._emit('onError', new Error(`WS closed: ${evt.code} ${evt.reason}`));
//                 }
//                 this._emit('onClose');
//             };

//             ws.onerror = (err) => {
//                 reject(err);
//                 this._emit('onError', err);
//             };
//         });
//     }

//     _sendSetup() {
//         const { name, role, system_prompt, voice_id } = this._agentConfig || {};
//         const systemText =
//             `You are ${name || 'an AI assistant'}, a ${role || 'helpful assistant'}. ` +
//             `You MUST respond in Tanglish (a natural mix of Tamil and English). ` +
//             `Use Tamil script for Tamil words (e.g., "நான் உங்களுக்கு help பண்ணலாம்"). ` +
//             `Be concise, warm, and conversational — optimised for voice. ` +
//             (system_prompt ? `\n\nAgent instructions: ${system_prompt}` : '');

//         const setup = {
//             setup: {
//                 model: GEMINI_LIVE_MODEL,
//                 generationConfig: {
//                     responseModalities: ['AUDIO'],
//                     speechConfig: {
//                         voiceConfig: {
//                             prebuiltVoiceConfig: { voiceName: voice_id || 'Puck' }
//                         }
//                     }
//                 },
//                 systemInstruction: {
//                     parts: [{ text: systemText }]
//                 }
//             }
//         };
//         this._wsSend(setup);
//     }

//     _onMessage(evt) {
//         let msg;
//         try {
//             const text = typeof evt.data === 'string'
//                 ? evt.data
//                 : new TextDecoder().decode(evt.data);
//             msg = JSON.parse(text);
//         } catch (e) {
//             return;
//         }

//         // Setup complete
//         if (msg.setupComplete) {
//             this._connected = true;
//             this._setupDone = true;
//             this._emit('onOpen');

//             // Agent greets first
//             this._triggerGreeting();
//             return;
//         }

//         // Server content (audio + text)
//         if (msg.serverContent) {
//             const sc = msg.serverContent;

//             if (sc.interrupted) {
//                 this._playback.clear();
//                 this._agentTranscriptBuf = '';
//                 this._emit('onInterrupted');
//                 return;
//             }

//             if (sc.modelTurn?.parts) {
//                 for (const part of sc.modelTurn.parts) {
//                     // Audio chunk
//                     if (part.inlineData?.mimeType?.startsWith('audio/pcm')) {
//                         const pcmBuf = b64ToArrayBuffer(part.inlineData.data);
//                         this._playback.enqueue(pcmBuf, null);
//                     }
//                     // Text transcript of agent response
//                     if (part.text) {
//                         this._agentTranscriptBuf += part.text;
//                         this._emit('onTranscription', part.text, false);
//                     }
//                 }
//             }

//             if (sc.turnComplete) {
//                 this._agentTranscriptBuf = '';
//                 this._userTranscriptBuf = '';
//             }
//         }

//         // Input transcription (user speech → text)
//         if (msg.toolCallCancellation || msg.realtimeInputTranscription) {
//             const t = msg.realtimeInputTranscription?.text;
//             if (t) {
//                 this._userTranscriptBuf += t;
//                 this._emit('onTranscription', t, true);
//             }
//         }
//     }

//     _triggerGreeting() {
//         // Send a silent prompt to make the agent speak first
//         this._wsSend({
//             clientContent: {
//                 turns: [{
//                     role: 'user',
//                     parts: [{ text: 'Greet me warmly in Tanglish, introduce yourself by name and role, and ask how you can help. Keep it to 2 sentences.' }]
//                 }],
//                 turnComplete: true,
//             }
//         });
//     }

//     // ── Mic ───────────────────────────────────────────────────────────────────

//     async _startMic() {
//         this._stream = await navigator.mediaDevices.getUserMedia({
//             audio: {
//                 channelCount: 1,
//                 sampleRate: MIC_SAMPLE_RATE,
//                 echoCancellation: true,
//                 noiseSuppression: true,
//                 autoGainControl: true,
//             }
//         });

//         // Resume AudioContext (needed after user gesture)
//         if (this._audioCtx.state === 'suspended') {
//             await this._audioCtx.resume();
//         }

//         // Load worklet
//         const blob = new Blob([WORKLET_SRC], { type: 'application/javascript' });
//         const blobUrl = URL.createObjectURL(blob);
//         await this._audioCtx.audioWorklet.addModule(blobUrl);
//         URL.revokeObjectURL(blobUrl);

//         const source = this._audioCtx.createMediaStreamSource(this._stream);
//         this._workletNode = new AudioWorkletNode(this._audioCtx, 'pcm-capture');

//         this._workletNode.port.onmessage = (e) => {
//             if (this._muted || !this._connected) return;
//             const pcm16 = float32ToPCM16(e.data);
//             const b64 = arrayBufferToB64(pcm16.buffer);
//             this._wsSend({
//                 realtimeInput: {
//                     mediaChunks: [{
//                         mimeType: 'audio/pcm;rate=16000',
//                         data: b64,
//                     }]
//                 }
//             });
//         };

//         source.connect(this._workletNode);
//         // Don't connect worklet to destination — we don't want mic echo
//     }

//     _stopMic() {
//         if (this._workletNode) {
//             try { this._workletNode.disconnect(); } catch (_) {}
//             this._workletNode = null;
//         }
//         if (this._stream) {
//             this._stream.getTracks().forEach(t => t.stop());
//             this._stream = null;
//         }
//     }

//     // ── Helpers ───────────────────────────────────────────────────────────────

//     _wsSend(obj) {
//         if (this._ws?.readyState === WebSocket.OPEN) {
//             this._ws.send(JSON.stringify(obj));
//         }
//     }

//     _emit(event, ...args) {
//         if (this._callbacks[event]) {
//             try { this._callbacks[event](...args); } catch (e) { console.error(e); }
//         }
//     }
// }

// /**
//  * LiveAudioService — Gemini Live API real-time voice
//  *
//  * Model: gemini-2.5-flash-native-audio-preview-12-2025
//  * Endpoint: v1alpha (required for 2.5 preview models — v1beta returns 404)
//  *
//  * Features:
//  *  - Agent speaks first (greeting on setupComplete)
//  *  - Voice lock: calibrates on first speaker, gates background voices
//  *  - Interruption: client-side energy detection + server-side interrupted signal
//  *  - Gapless PCM playback via separate 24kHz AudioContext
//  */

/**
 * LiveAudioService — Gemini Live API
 * Based on the original working implementation pattern.
 */

import { SpeakerVoiceLock } from './speakerVoiceLock.js';

const GEMINI_LIVE_MODEL = 'models/gemini-2.5-flash-native-audio-preview-12-2025';
const MIC_SAMPLE_RATE   = 16000;
const OUT_SAMPLE_RATE   = 24000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toB64(uint8) {
    let s = '';
    for (let i = 0; i < uint8.byteLength; i++) s += String.fromCharCode(uint8[i]);
    return btoa(s);
}

function fromB64(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
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

function rmsEnergy(f32) {
    let s = 0;
    for (let i = 0; i < f32.length; i++) s += f32[i] * f32[i];
    return Math.sqrt(s / Math.max(f32.length, 1));
}

// ─── Worklet ──────────────────────────────────────────────────────────────────
const WORKLET = `
class Cap extends AudioWorkletProcessor {
    constructor() { super(); this._b = []; }
    process(inputs) {
        const ch = inputs[0]?.[0];
        if (ch) { for (let i=0;i<ch.length;i++) this._b.push(ch[i]); }
        while (this._b.length >= 4096)
            this.port.postMessage(new Float32Array(this._b.splice(0,4096)));
        return true;
    }
}
registerProcessor('cap',Cap);
`;

// ─── Player — separate 24kHz context ─────────────────────────────────────────
class Player {
    constructor() { this._ctx = null; this._t = 0; this._srcs = []; }

    // Call during/after a user gesture to pre-unlock the AudioContext
    prime() {
        if (!this._ctx || this._ctx.state === 'closed') {
            const C = window.AudioContext || window.webkitAudioContext;
            this._ctx = new C({ sampleRate: OUT_SAMPLE_RATE });
        }
        if (this._ctx.state === 'suspended') this._ctx.resume();
        return this._ctx;
    }

    play(bytes) {
        const ctx = this.prime();
        const f32 = i16ToF32(bytes);
        if (!f32.length) return;
        const buf = ctx.createBuffer(1, f32.length, OUT_SAMPLE_RATE);
        buf.copyToChannel(f32, 0);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(ctx.destination);
        const at = Math.max(ctx.currentTime, this._t);
        src.start(at);
        this._t = at + buf.duration;
        this._srcs.push(src);
        src.onended = () => {
            const i = this._srcs.indexOf(src);
            if (i >= 0) this._srcs.splice(i, 1);
        };
    }

    stop() {
        for (const s of this._srcs) { try { s.stop(0); } catch(_){} }
        this._srcs = [];
        if (this._ctx && this._ctx.state !== 'closed') this._t = this._ctx.currentTime;
    }

    close() {
        this.stop();
        if (this._ctx) { try { this._ctx.close(); } catch(_){} this._ctx = null; }
    }
}

// ─── Service ──────────────────────────────────────────────────────────────────
import { getAPIBase } from '../api';
export class LiveAudioService {
    // Shared static instances across calls to reduce latency
    static _sharedMicCtx = null;
    static _sharedWorkletLoaded = false;
    static _sharedWorklet = null;  // Reuse worklet node to prevent listener accumulation
    static _sharedSource = null;   // Reuse media stream source
    static _sharedStream = null;   // Reuse media stream

    constructor() {
        this._ws      = null;
        this._micCtx  = null;
        this._worklet = null;
        this._stream  = null;
        this._source  = null;
        this._player  = new Player();
        this._muted   = false;
        this._live    = false;
        this._stop    = false;
        this._playing = false;
        this._cbs     = {};
        this._cfg     = null;
        this._mode    = 'chat';  // 'voice' or 'chat' mode
        // Prevent _playing from being re-set after client-side interrupt
        this._turnInterrupted = false;
        this._keepalive = null;
        // VAD for interruption detection
        this._vadSilenceFrames = 0;
        this._vadSpeechThreshold = 0.02;  // RMS threshold (adaptive)
        this._vadLocked = false;  // True after user first speaks
        this._vadConsecutiveSpeech = 0;  // Frames of speech to trigger interrupt
        this._lastWasSpeech = false;  // Track previous frame state
        this._speechStart = 0;  // Track speech start time
        this._silenceRequired = 8;  // Frames of silence to trigger end-of-speech (~800ms for Tamil/Tanglish natural pauses)
        // Turn tracking for server-side cancellation
        this._currentTurnId = null;
        this._pendingTurnComplete = false;
        this._turnDebounceTimer = null;
        // Speech buffer to validate speech segments
        this._speechFrameBuffer = [];
        this._minSpeechFrames = 10;  // Require 10+ frames of continuous speech before accepting input
    }

    async connect(agentConfig, callbacks, options = {}) {
        this._cbs  = callbacks || {};
        this._cfg  = agentConfig;
        this._mode = options.mode || 'chat';  // 'voice' or 'chat'
        this._stop = false;
        this._live = false;
        this._playing = false;
        this._kbContext = '';
        this._turnInterrupted = false;
        this._userSpeakingStart = 0;  // Track speech start time for interruption

        try {
            // 1. Prime the player AudioContext during user-gesture
            this._player.prime();
            const API_BASE = getAPIBase();

            // 2. Load KB context SYNCHRONOUSLY before any agent responses
            if (agentConfig.id) {
                try {
                    const kbStart = performance.now();
                    const kbRes = await fetch(`${API_BASE}/agents/public/${agentConfig.id}/kb-context`);
                    if (kbRes.ok) {
                        const kbData = await kbRes.json();
                        this._kbContext = kbData.context || '';
                        const kbElapsed = performance.now() - kbStart;
                        console.log(`[LA] KB context loaded BEFORE setup in ${kbElapsed.toFixed(0)}ms: ${this._kbContext.length} chars`);
                    }
                } catch (e) {
                    console.warn('[LA] KB fetch failed, continuing without KB:', e.message);
                }
            }

            // 3. Get Gemini key
            const r = await fetch(`${API_BASE}/gemini-key`);
            if (!r.ok) throw new Error('Cannot load Gemini key');
            const { key } = await r.json();

            // 4. Connect WS — BLOCKING wait for setupComplete before continuing
            const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${key}`;
            await this._connect(url);

            return true;
        } catch(e) {
            console.error('[LA] failed:', e);
            this._emit('onError', e);
            return false;
        }
    }

    // Returns a promise that resolves when setupComplete arrives + mic starts
    _connect(url) {
        return new Promise((resolve, reject) => {
            const ws = new WebSocket(url);
            ws.binaryType = 'arraybuffer';   // must be set before any frames arrive
            this._ws = ws;

            const timer = setTimeout(() => {
                reject(new Error('Timeout waiting for setupComplete'));
                try { ws.close(); } catch(_){}
            }, 15000);

            ws.onopen = () => {
                console.log('[LA] open → setup');
                this._sendSetup();
            };

            ws.onmessage = async (evt) => {
                const text = typeof evt.data === 'string'
                    ? evt.data
                    : new TextDecoder().decode(new Uint8Array(evt.data));
                let msg;
                try { msg = JSON.parse(text); } catch { return; }

                console.log('[LA] ←', JSON.stringify(msg).slice(0, 150));

                // setupComplete
                if (msg.setupComplete !== undefined || msg.setup_complete !== undefined) {
                    console.log('[LA] setupComplete ✅');
                    clearTimeout(timer);
                    // Start mic now
                    try {
                        await this._startMic();
                        this._live = true;
                        this._emit('onOpen');
                        // Safe to send greeting now (KB already loaded synchronously in connect())
                        this._greet();
                        resolve();
                    } catch(e) {
                        reject(new Error('Mic: ' + e.message));
                    }
                    return;
                }

                if (msg.error) {
                    clearTimeout(timer);
                    const e = new Error(msg.error.message || JSON.stringify(msg.error));
                    reject(e);
                    this._emit('onError', e);
                    return;
                }

                this._handleContent(msg);
            };

            ws.onerror = () => {
                clearTimeout(timer);
                reject(new Error('WS error'));
            };

            ws.onclose = (e) => {
                clearTimeout(timer);
                this._live = false;
                const reason = e.reason || `code ${e.code}`;
                if (!this._stop) {
                    console.warn('[LA] closed:', reason);
                    reject(new Error(reason));
                    this._emit('onError', new Error(reason));
                    this._emit('onClose');
                }
            };
        });
    }

    _sendSetup() {
        const { name, role, system_prompt, voice_id } = this._cfg || {};
        const kbContext = this._kbContext || '';
        const kbBlock = kbContext
            ? `\n\nKNOWLEDGE BASE (ONLY use this information to answer questions — NEVER make up information not listed here):\n${kbContext}\n\nCRITICAL RESPONSE RULES FOR KNOWLEDGE BASE:\n- If the KB context starts with "[KB INFO: ...]", it tells you how many total entries exist vs what you see. You are seeing only a SMALL SUBSET.\n- BROAD QUERIES ("list all products", "what do you have", "tell me everything", "onnonu solu", "ellam solu"):\n  * NEVER list every item one-by-one. This is a voice call — long lists are terrible UX.\n  * Instead: mention the CATEGORIES you see (e.g. Smartphones, Laptops, Headphones, Tablets, Smartwatches) and say how many total products you have.\n  * Then ASK the user which category interests them: "Enga kitta [total] products irukku — Smartphones, Laptops, Headphones, Tablets mathiri categories la. Etha category pathi theriyanum?"\n  * Keep it to 2-3 sentences MAX.\n- SPECIFIC QUERIES ("tell me about iPhone 15", "Samsung price enna"): give full details from context.\n- If the user asks something not covered, say "Sorry, en kitta antha information illa" in Tanglish.`
            : '';
        const sys =
            `You are ${name||'AI'}, a ${role||'assistant'}. ` +
            `ALWAYS respond in Tanglish — a natural spoken mix of Tamil and English, ` +
            `the way people actually talk in Tamil Nadu. ` +
            `Write Tamil words in Tamil script, English words in English. ` +
            `NEVER write pure Tamil or pure English — always mix both naturally. ` +
            `Examples of Tanglish style:
` +
            `  "Seri saar, ungaloda order ID enna?"
` +
            `  "Ok, naan check pannuren, oru minute wait pannunga."
` +
            `  "Sorry saar, system-la details match aagala."
` +
            `  "Delivery Tuesday-la vanthidum, tension vendam!"
` +
            `Keep responses short — 1-2 sentences max. Voice conversation only, no bullet points.\n` +
            `CALL ENDING RULES:\n` +
            `- If the user says bye/goodbye/end call/hang up/cut the call or anything indicating they want to end, ` +
            `ALWAYS ask for confirmation first like "Seri, call end pannalama? Confirm pannunga."\n` +
            `- Only after the user explicitly confirms (yes/ok/seri/aamaa/end it), say your final goodbye and include the exact token [END_CALL] at the very end of your response.\n` +
            `- If the user says no/not yet/wait, continue the conversation normally.\n` +
            `- NEVER include [END_CALL] unless the user has confirmed they want to end.` +
            (system_prompt ? `\n\n${system_prompt}` : '') + kbBlock;

        this._send({
            setup: {
                model: GEMINI_LIVE_MODEL,
                generationConfig: {
                    responseModalities: ['AUDIO'],
                    speechConfig: {
                        voiceConfig: { prebuiltVoiceConfig: { voiceName: voice_id || 'Puck' } }
                    }
                },
                systemInstruction: sys
            }
        });

        console.log('[LA] setup sent — model:', GEMINI_LIVE_MODEL);
    }

    _greet() {
        // Greeting is sent as system initialization message, not as user input.
        // The system prompt in setup already handles the greeting instruction.
        // Just signal turn complete to let the model generate opening.
        this._send({
            clientContent: {
                turnComplete: true
            }
        });
    }

    _handleContent(msg) {
        const sc = msg.serverContent || msg.server_content;
        if (!sc) return;

        if (sc.interrupted) {
            this._playing = false;
            this._turnInterrupted = false;
            this._player.stop();
            this._emit('onInterrupted');
            return;
        }

        const parts = sc.modelTurn?.parts || sc.model_turn?.parts || [];
        for (const p of parts) {
            const d = p.inlineData || p.inline_data;
            const mime = d?.mimeType || d?.mime_type || '';
            if (mime.startsWith('audio/pcm')) {
                // If client-side interrupt was triggered, discard remaining audio
                // from this turn — server doesn't know we interrupted locally
                if (this._turnInterrupted) continue;
                this._playing = true;
                this._player.play(fromB64(d.data));
            }
            // Do NOT emit p.text — those are internal thinking tokens (**Crafting...**).
            // Real spoken transcripts come via inputTranscription/outputTranscription below.
        }

        if (sc.turnComplete || sc.turn_complete) {
            this._playing = false;
            this._turnInterrupted = false;
            this._emit('onTurnComplete');
        }

        // Transcript of what the user said (enabled by inputAudioTranscription:{} in setup)
        const itx = sc.inputTranscription || sc.input_transcription;
        if (itx?.text && this._mode === 'chat') this._emit('onTranscription', itx.text, true);

        // Transcript of what the agent said (enabled by outputAudioTranscription:{} in setup)
        const otx = sc.outputTranscription || sc.output_transcription;
        if (otx?.text) {
            if (this._mode === 'chat') this._emit('onTranscription', otx.text, false);
            // Detect [END_CALL] signal from agent
            if (otx.text.includes('[END_CALL]')) {
                console.log('[LA] Agent confirmed call end');
                this._emit('onCallEnd');
            }
        }
    }

    disconnect() {
        this._stop = true;
        this._live = false;
        this._stopMic();
        this._player.close();
        // Don't close shared AudioContext - it's reused across calls
        if (this._ws) { try { this._ws.close(1000,'bye'); } catch(_){} this._ws = null; }
        this._emit('onClose');
    }

    toggleMute() { this._muted = !this._muted; return this._muted; }

    async sendText(t) {
        // Gemini Live API doesn't support direct text input in the WebSocket protocol.
        // Text must be converted to audio first. For now, warn user.
        console.warn('[LA] Text input not supported in voice mode. Use voice input instead.');
        this._emit('onError', new Error('Text input disabled in voice mode.'));
    }

    // ── Voice lock (MFCC-based speaker verification) ──────────────────────────


    // ── Mic ───────────────────────────────────────────────────────────────────

    async _startMic() {
        // Reset VAD state for new conversation
        this._lastWasSpeech = false;
        this._vadSilenceFrames = 0;
        this._vadConsecutiveSpeech = 0;
        this._vadLocked = false;
        this._speechStart = 0;
        
        // Reuse shared AudioContext across calls to avoid recreation latency
        const C = window.AudioContext || window.webkitAudioContext;
        if (!LiveAudioService._sharedMicCtx) {
            LiveAudioService._sharedMicCtx = new C({ sampleRate: MIC_SAMPLE_RATE });
            console.log('[LA] Created shared AudioContext');
        }
        this._micCtx = LiveAudioService._sharedMicCtx;
        
        if (this._micCtx.state === 'suspended') await this._micCtx.resume();

        // Load worklet module only once
        if (!LiveAudioService._sharedWorkletLoaded) {
            const blob = new Blob([WORKLET], { type:'application/javascript' });
            const burl = URL.createObjectURL(blob);
            try { 
                await this._micCtx.audioWorklet.addModule(burl);
                LiveAudioService._sharedWorkletLoaded = true;
                console.log('[LA] Worklet module loaded');
            } catch (e) {
                console.error('[LA] Worklet load error:', e);
                throw e;
            }
        }

        // Get fresh media stream each call
        if (!this._stream) {
            this._stream = await navigator.mediaDevices.getUserMedia({
                audio: { channelCount:1, sampleRate:MIC_SAMPLE_RATE,
                         echoCancellation:true, noiseSuppression:true, autoGainControl:true }
            });
        }

        // Create source from stream each call (reuse worklet node to prevent listener accumulation)
        if (!this._source) {
            this._source = this._micCtx.createMediaStreamSource(this._stream);
        }

        // Create worklet node ONCE and reuse across calls (KEY FIX FOR LATENCY)
        if (!LiveAudioService._sharedWorklet) {
            LiveAudioService._sharedWorklet = new AudioWorkletNode(this._micCtx, 'cap');
            console.log('[LA] Created shared AudioWorkletNode');
        }
        this._worklet = LiveAudioService._sharedWorklet;

        // Replace the listener with a new one for this call (don't accumulate listeners)
        this._worklet.port.onmessage = (ev) => {
            if (this._micCtx?.state === 'suspended') this._micCtx.resume();
            if (!this._live || this._muted || this._ws?.readyState !== WebSocket.OPEN) return;

            const f32Chunk = ev.data;
            const chunk = new Uint8Array(f32ToI16(f32Chunk).buffer);
            
            // Voice Activity Detection & Turn Management
            const isSpeech = this._detectSpeech(f32Chunk);
            
            // SPEECH START: User begins speaking
            if (isSpeech && !this._lastWasSpeech) {
                this._speechStart = Date.now();
                this._lastWasSpeech = true;
                this._speechFrameBuffer = [f32Chunk];  // Start buffering speech
                this._vadConsecutiveSpeech = 1;
                console.log('[LA] 🎤 Speech detected, stopping agent playback and creating new turn');
                
                // CRITICAL FIX: Send explicit interrupt BEFORE stopping playback
                this._send({ clientContent: { turnComplete: true } });
                
                // Immediately stop the agent response
                if (this._player) {
                    this._player.stop();
                }
                
                // Mark turn as interrupted to discard old audio chunks
                this._turnInterrupted = true;
                // Generate new turn ID for server-side tracking
                this._currentTurnId = `turn_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
                console.log(`[LA] New turn ID: ${this._currentTurnId}`);
            } 
            // Continue buffering speech
            else if (isSpeech && this._lastWasSpeech) {
                this._speechFrameBuffer.push(f32Chunk);
                this._vadConsecutiveSpeech++;
                this._vadSilenceFrames = 0;
            }
            // SPEECH END: User stops speaking (silence after speech)
            // Require 8+ frames (~800ms) of silence to account for natural Tanglish speech pauses
            else if (!isSpeech && this._lastWasSpeech) {
                this._vadSilenceFrames++;
                
                // Validate enough speech was captured before triggering turnComplete
                const hasSufficientSpeech = this._speechFrameBuffer.length >= this._minSpeechFrames;
                const hasSufficientSilence = this._vadSilenceFrames >= this._silenceRequired;
                
                if (hasSufficientSilence && hasSufficientSpeech && !this._pendingTurnComplete) {
                    this._pendingTurnComplete = true;
                    const speechDuration = Date.now() - this._speechStart;
                    const bufferLen = this._speechFrameBuffer.length;
                    console.log(`[LA] ✓ User finished speaking (${speechDuration}ms, ${bufferLen} speech frames, ${this._vadSilenceFrames} silence frames). Sending turnComplete...`);
                    
                    // Debounce: wait 100ms to ensure no new speech arrives
                    if (this._turnDebounceTimer) clearTimeout(this._turnDebounceTimer);
                    this._turnDebounceTimer = setTimeout(() => {
                        if (this._lastWasSpeech === false && this._pendingTurnComplete) {
                            this._send({
                                clientContent: {
                                    turnComplete: true
                                }
                            });
                            this._pendingTurnComplete = false;
                        }
                    }, 100);
                    
                    this._lastWasSpeech = false;
                    this._speechFrameBuffer = [];
                }
            }
            
            // Send audio chunk to Gemini Live
            this._send({
                realtimeInput: {
                    mediaChunks: [{ mimeType:`audio/pcm;rate=${MIC_SAMPLE_RATE}`, data:toB64(chunk) }]
                }
            });
        };

        // Keepalive: send a silent chunk every 8s
        this._keepalive = setInterval(() => {
            if (!this._live || this._ws?.readyState !== WebSocket.OPEN) return;
            if (this._micCtx?.state === 'suspended') this._micCtx.resume();
            const silence = new Uint8Array(256);
            this._send({
                realtimeInput: {
                    mediaChunks: [{ mimeType:`audio/pcm;rate=${MIC_SAMPLE_RATE}`, data:toB64(silence) }]
                }
            });
        }, 8000);

        // Connect source to worklet only once
        if (!this._source._connected) {
            this._source.connect(this._worklet);
            this._source._connected = true;
        }
        console.log('[LA] mic started');
    }

    _stopMic() {
        if (this._keepalive) { clearInterval(this._keepalive); this._keepalive = null; }
        if (this._turnDebounceTimer) { clearTimeout(this._turnDebounceTimer); this._turnDebounceTimer = null; }
        // Don't disconnect worklet — keep it for reuse
        if (this._worklet) { 
            try { this._worklet.disconnect(); } catch(_){}
            // Don't null it out — let shared instance stay loaded
        }
        if (this._stream)  { this._stream.getTracks().forEach(t=>t.stop()); this._stream = null; }
        this._speechFrameBuffer = [];
        this._currentTurnId = null;
        this._pendingTurnComplete = false;
    }

    /**
     * Voice Activity Detection using RMS energy with adaptive threshold
     * Returns true if speech is detected
     */
    _detectSpeech(f32Chunk) {
        if (!f32Chunk || f32Chunk.length === 0) return false;

        // Calculate RMS (energy) of the chunk
        let sum = 0;
        for (let i = 0; i < f32Chunk.length; i++) {
            sum += f32Chunk[i] * f32Chunk[i];
        }
        const rms = Math.sqrt(sum / f32Chunk.length);

        // Adaptive threshold: base level is 0.02, increase to 0.03 when speech is detected
        const threshold = this._vadLocked ? this._vadSpeechThreshold * 1.5 : this._vadSpeechThreshold;
        const isSpeech = rms > threshold;

        if (isSpeech) {
            this._vadSilenceFrames = 0;
            this._vadConsecutiveSpeech++;
        } else {
            this._vadSilenceFrames++;
            // OPTIMIZED: Reduce from 20 frames (~2s) to 3 frames (~300ms) for faster response
            if (this._vadSilenceFrames > this._silenceRequired) {
                this._vadConsecutiveSpeech = 0;
                this._vadLocked = false;
            }
        }

        // Return true only if we have established speech (more robust than 2 frames for noisy environments)
        return isSpeech && this._vadConsecutiveSpeech >= 2; // Require 2 consecutive speech frames
    }

    /**
     * Send explicit interrupt to server to cancel in-flight response generation
     */
    _sendInterrupt() {
        if (!this._ws || this._ws.readyState !== WebSocket.OPEN) return;
        console.log(`[LA] Sending interrupt for turn ${this._currentTurnId}`);
        this._send({
            clientContent: {
                turns: [{ role: 'user', parts: [{ text: 'INTERRUPT', meta: { turnId: this._currentTurnId, action: 'interrupt' } }] }],
                turnComplete: true
            }
        });
    }

    // Static cleanup method to reset AudioContext/Worklet if needed
    static resetSharedResources() {
        if (LiveAudioService._sharedMicCtx) {
            try { LiveAudioService._sharedMicCtx.close(); } catch(_){}
            LiveAudioService._sharedMicCtx = null;
        }
        LiveAudioService._sharedWorkletLoaded = false;
        LiveAudioService._sharedWorkletUrl = null;
        console.log('[LA] Shared resources reset');
    }

    _send(obj) {
        if (this._ws?.readyState === WebSocket.OPEN) this._ws.send(JSON.stringify(obj));
    }

    _emit(ev, ...args) {
        if (typeof this._cbs[ev] === 'function')
            try { this._cbs[ev](...args); } catch(e) { console.error('[LA]', e); }
    }
}