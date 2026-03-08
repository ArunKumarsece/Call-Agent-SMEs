/**
 * AI Voice Agent Widget — Self-Contained Embeddable SDK
 * Uses @google/genai SDK via CDN for real-time Gemini Live API.
 * Identical code path as the dashboard test call — guaranteed compatibility.
 *
 * Usage:
 *   <script>
 *     window.AgentWidgetConfig = {
 *       agentId: "your-agent-id",
 *       serverUrl: "http://localhost:8000",
 *       theme: "dark",
 *       position: "bottom-right",
 *       title: "AI Assistant",
 *       subtitle: "Click to start a voice call",
 *       primaryColor: "#6C63FF"
 *     };
 *   </script>
 *   <script src="http://YOUR_SERVER/static/widget/agent-widget.js"></script>
 */
(function () {
    'use strict';

    // ═════════════════════════════════════════════════════════════════
    // Constants
    // ═════════════════════════════════════════════════════════════════
    var MODEL = 'gemini-2.5-flash-native-audio-preview-12-2025';
    var INPUT_SAMPLE_RATE = 16000;
    var OUTPUT_SAMPLE_RATE = 24000;

    // ═════════════════════════════════════════════════════════════════
    // Helpers
    // ═════════════════════════════════════════════════════════════════
    function encodeToBase64(bytes) {
        var bin = '';
        for (var i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
        return btoa(bin);
    }

    function decodeFromBase64(b64) {
        var bin = atob(b64);
        var bytes = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return bytes;
    }

    // ═════════════════════════════════════════════════════════════════
    // LiveAudioService — uses @google/genai SDK (loaded from CDN)
    // Same code path as dashboard VoiceCallWidget → liveAudioService.js
    // ═════════════════════════════════════════════════════════════════
    function LiveAudioService(GoogleGenAI, Modality) {
        this._GoogleGenAI = GoogleGenAI;
        this._Modality = Modality;
        this.session = null;
        this.audioContext = null;
        this.mediaStream = null;
        this.source = null;
        this.processor = null;
        this.nextPlayTime = 0;
        this.isMuted = false;
        this.connected = false;
        this.callbacks = {};
    }

    LiveAudioService.prototype.connect = async function (agentConfig, callbacks) {
        this.callbacks = callbacks || {};

        try {
            // ── Get API key ──────────────────────────────────
            var cfg = window.AgentWidgetConfig || {};
            var serverUrl = (cfg.serverUrl || 'http://localhost:8000').replace(/\/$/, '');
            var apiKey = '';

            try {
                var r = await fetch(serverUrl + '/api/config/gemini-key');
                if (r.ok) {
                    var d = await r.json();
                    apiKey = d.api_key || d.key || '';
                }
            } catch (_) { }

            if (!apiKey && cfg.apiKey) apiKey = cfg.apiKey;
            if (!apiKey && window.GEMINI_API_KEY) apiKey = window.GEMINI_API_KEY;
            if (!apiKey) throw new Error('No Gemini API key available.');

            console.log('[LiveAudio] Got API key, length:', apiKey.length);

            // ── Build system instruction ─────────────────────
            var systemText = [
                'Role: ' + (agentConfig.role || 'AI Assistant'),
                'Name: ' + (agentConfig.name || 'Assistant'),
                '',
                'System Instructions:',
                agentConfig.system_prompt || 'You are a helpful AI assistant.',
                '',
                'Guidelines:',
                '1. Keep responses conversational and concise — this is a voice call.',
                '2. Respond in Tanglish (a natural mix of Tamil and English).',
                '3. Use Tamil script for Tamil words.',
                '4. Be friendly, warm, and helpful like a real human.',
                '5. Avoid long paragraphs. Keep sentences short for voice.',
            ].join('\n');

            var voiceName = agentConfig.voice_id || agentConfig.voice || 'Puck';

            // ── Initialize SDK (exactly like dashboard) ──────
            console.log('[LiveAudio] Creating GoogleGenAI client with SDK');
            var ai = new this._GoogleGenAI({ apiKey: apiKey });

            // ── Start microphone + audio context ─────────────
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: INPUT_SAMPLE_RATE });
            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    channelCount: 1,
                    sampleRate: INPUT_SAMPLE_RATE,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                }
            });

            // ── Connect via SDK Live API (same as dashboard) ─
            console.log('[LiveAudio] Connecting to', MODEL, 'via SDK live.connect()');
            var self = this;

            this.session = await ai.live.connect({
                model: MODEL,
                config: {
                    responseModalities: [this._Modality.AUDIO],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: { voiceName: voiceName }
                        }
                    },
                    systemInstruction: systemText,
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                },
                callbacks: {
                    onopen: function () {
                        console.log('[LiveAudio] ✅ SDK session opened');
                        self.connected = true;
                        self._startMicStreaming();
                        self.callbacks.onOpen && self.callbacks.onOpen();
                    },
                    onclose: function (e) {
                        console.log('[LiveAudio] SDK session closed', e);
                        self.connected = false;
                        self.callbacks.onClose && self.callbacks.onClose();
                    },
                    onerror: function (e) {
                        console.error('[LiveAudio] SDK session error:', e);
                        self.callbacks.onError && self.callbacks.onError(e);
                    },
                    onmessage: function (message) {
                        self._handleSDKMessage(message);
                    },
                },
            });

            console.log('[LiveAudio] ✅ SDK live.connect() returned session');
            return true;
        } catch (err) {
            console.error('[LiveAudio] Connect error:', err);
            this.callbacks.onError && this.callbacks.onError(err);
            return false;
        }
    };

    LiveAudioService.prototype._handleSDKMessage = function (message) {
        // The SDK returns LiveServerMessage objects with typed fields

        // ── Model audio output ───────────────────────────
        if (message.serverContent && message.serverContent.modelTurn && message.serverContent.modelTurn.parts) {
            var parts = message.serverContent.modelTurn.parts;
            for (var i = 0; i < parts.length; i++) {
                var part = parts[i];
                if (part.inlineData && part.inlineData.data) {
                    this._playAudio(part.inlineData.data);
                }
                if (part.text && this.callbacks.onTranscription) {
                    this.callbacks.onTranscription(part.text, false);
                }
            }
        }

        // ── Input transcription (what user said) ─────────
        if (message.serverContent && message.serverContent.inputTranscription && message.serverContent.inputTranscription.text) {
            this.callbacks.onTranscription && this.callbacks.onTranscription(
                message.serverContent.inputTranscription.text, true
            );
        }

        // ── Output transcription (what agent said) ───────
        if (message.serverContent && message.serverContent.outputTranscription && message.serverContent.outputTranscription.text) {
            this.callbacks.onTranscription && this.callbacks.onTranscription(
                message.serverContent.outputTranscription.text, false
            );
        }

        // ── Interrupted ──────────────────────────────────
        if (message.serverContent && message.serverContent.interrupted) {
            this.nextPlayTime = 0;
            this.callbacks.onInterrupted && this.callbacks.onInterrupted();
        }
    };

    LiveAudioService.prototype._startMicStreaming = function () {
        this.source = this.audioContext.createMediaStreamSource(this.mediaStream);
        this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
        var self = this;

        this.processor.onaudioprocess = function (e) {
            if (!self.connected || self.isMuted || !self.session) return;

            var inputData = e.inputBuffer.getChannelData(0);

            // Float32 → PCM16
            var pcm16 = new Int16Array(inputData.length);
            for (var i = 0; i < inputData.length; i++) {
                var s = Math.max(-1, Math.min(1, inputData[i]));
                pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }

            // Send to Gemini via SDK's sendRealtimeInput
            var bytes = new Uint8Array(pcm16.buffer);
            var base64 = encodeToBase64(bytes);
            try {
                self.session.sendRealtimeInput({
                    media: {
                        mimeType: 'audio/pcm;rate=' + INPUT_SAMPLE_RATE,
                        data: base64
                    }
                });
            } catch (err) { /* ignore send errors during close */ }
        };

        this.source.connect(this.processor);
        this.processor.connect(this.audioContext.destination);
    };

    LiveAudioService.prototype._playAudio = function (base64Data) {
        if (!this.audioContext) return;
        try {
            var bytes = decodeFromBase64(base64Data);
            var pcm16 = new Int16Array(bytes.buffer);
            var float32 = new Float32Array(pcm16.length);
            for (var i = 0; i < pcm16.length; i++) float32[i] = pcm16[i] / 32768.0;

            var buffer = this.audioContext.createBuffer(1, float32.length, OUTPUT_SAMPLE_RATE);
            buffer.getChannelData(0).set(float32);

            var src = this.audioContext.createBufferSource();
            src.buffer = buffer;
            src.connect(this.audioContext.destination);

            var now = this.audioContext.currentTime;
            if (this.nextPlayTime < now) this.nextPlayTime = now;
            src.start(this.nextPlayTime);
            this.nextPlayTime += buffer.duration;
        } catch (err) {
            console.error('[LiveAudio] Playback error:', err);
        }
    };

    LiveAudioService.prototype.sendText = function (text) {
        if (!this.session) return;
        this.session.sendClientContent({
            turns: [{ role: 'user', parts: [{ text: text }] }],
            turnComplete: true
        });
    };

    LiveAudioService.prototype.toggleMute = function () {
        this.isMuted = !this.isMuted;
        return this.isMuted;
    };

    LiveAudioService.prototype.disconnect = function () {
        this.connected = false;
        if (this.processor) { this.processor.disconnect(); this.processor = null; }
        if (this.source) { this.source.disconnect(); this.source = null; }
        if (this.mediaStream) { this.mediaStream.getTracks().forEach(function (t) { t.stop(); }); this.mediaStream = null; }
        if (this.audioContext) { this.audioContext.close().catch(function () { }); this.audioContext = null; }
        if (this.session) { try { this.session.close(); } catch (_) { } this.session = null; }
        this.nextPlayTime = 0;
        this.isMuted = false;
        console.log('[LiveAudio] Disconnected');
    };

    // ═════════════════════════════════════════════════════════════════
    // Widget UI — waits for DOM to be ready
    // ═════════════════════════════════════════════════════════════════
    function init() {
        var config = window.AgentWidgetConfig || {};
        var AGENT_ID = config.agentId || '';
        var SERVER_URL = (config.serverUrl || 'http://localhost:8000').replace(/\/$/, '');
        var THEME = config.theme || 'dark';
        var POSITION = config.position || 'bottom-right';
        var TITLE = config.title || 'AI Assistant';
        var SUBTITLE = config.subtitle || 'Click to start a voice call';
        var PRIMARY_COLOR = config.primaryColor || '#6C63FF';

        console.log('[AgentWidget] Config:', { AGENT_ID: AGENT_ID, SERVER_URL: SERVER_URL, THEME: THEME });

        if (!AGENT_ID) {
            console.error('[AgentWidget] No agentId in AgentWidgetConfig');
            return;
        }

        var isDark = THEME === 'dark';
        var C = {
            bg: isDark ? '#1A1A3E' : '#FFFFFF',
            bgSec: isDark ? '#12122A' : '#F5F5F5',
            text: isDark ? '#F0F0FF' : '#1A1A2E',
            textMuted: isDark ? '#9090B0' : '#666666',
            border: isDark ? 'rgba(108,99,255,0.15)' : 'rgba(0,0,0,0.1)',
            primary: PRIMARY_COLOR,
            danger: '#EF4444',
            userMsg: isDark ? '#4F46E5' : '#E8E5FF',
            agentMsg: isDark ? '#242450' : '#F0F0F0',
        };
        var posLeft = POSITION === 'bottom-left';

        // ── Inject styles ────────────────────────────────────
        var styleEl = document.createElement('style');
        styleEl.textContent = '\
#aw-fab{position:fixed;'+ (posLeft ? 'left:24px' : 'right:24px') + ';bottom:24px;z-index:99999;width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,' + C.primary + ',#00D9FF);border:none;cursor:pointer;box-shadow:0 4px 20px rgba(108,99,255,.4);font-size:28px;display:flex;align-items:center;justify-content:center;transition:all .3s ease}\
#aw-fab:hover{transform:scale(1.1);box-shadow:0 8px 30px rgba(108,99,255,.5)}\
#aw-panel{position:fixed;'+ (posLeft ? 'left:24px' : 'right:24px') + ';bottom:100px;z-index:99999;width:380px;max-height:540px;background:' + C.bg + ';border:1px solid ' + C.border + ';border-radius:20px;box-shadow:0 20px 60px rgba(0,0,0,.4);display:none;flex-direction:column;overflow:hidden;font-family:Inter,-apple-system,sans-serif;color:' + C.text + '}\
#aw-panel.open{display:flex;animation:awUp .3s ease}\
@keyframes awUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}\
.aw-hdr{padding:16px 20px;background:'+ (isDark ? 'rgba(108,99,255,.05)' : '#FAFAFA') + ';border-bottom:1px solid ' + C.border + ';display:flex;align-items:center;justify-content:space-between}\
.aw-hdr-title{font-size:16px;font-weight:700;margin:0}\
.aw-hdr-sub{font-size:11px;color:'+ C.textMuted + ';margin:2px 0 0}\
.aw-close{background:none;border:none;color:'+ C.textMuted + ';font-size:20px;cursor:pointer;padding:4px}\
.aw-msgs{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;min-height:200px;max-height:300px}\
.aw-msg{padding:10px 14px;border-radius:14px;font-size:13px;line-height:1.5;max-width:85%;word-break:break-word}\
.aw-msg-user{align-self:flex-end;background:'+ C.userMsg + ';color:' + (isDark ? 'white' : '#333') + ';border-bottom-right-radius:4px}\
.aw-msg-agent{align-self:flex-start;background:'+ C.agentMsg + ';border:1px solid ' + C.border + ';border-bottom-left-radius:4px}\
.aw-msg-system{align-self:center;background:transparent;color:'+ C.textMuted + ';font-size:11px;text-align:center}\
.aw-status{text-align:center;font-size:12px;color:'+ C.textMuted + ';padding:4px}\
.aw-controls{padding:16px;display:flex;align-items:center;justify-content:center;gap:16px;border-top:1px solid '+ C.border + '}\
.aw-mic{width:56px;height:56px;border-radius:50%;border:none;background:linear-gradient(135deg,'+ C.primary + ',#00D9FF);color:white;font-size:24px;cursor:pointer;transition:all .3s;box-shadow:0 4px 15px rgba(108,99,255,.3)}\
.aw-mic:hover{transform:scale(1.05)}\
.aw-mic.live{background:'+ C.danger + ';box-shadow:0 4px 15px rgba(239,68,68,.4);animation:awPulse 1.2s ease infinite}\
@keyframes awPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}\
.aw-mute{width:40px;height:40px;border-radius:50%;border:1px solid '+ C.border + ';background:rgba(108,99,255,.15);color:' + C.text + ';font-size:18px;cursor:pointer;transition:all .3s;display:none;align-items:center;justify-content:center}\
.aw-mute.active{background:rgba(239,68,68,.25);border-color:'+ C.danger + '}\
.aw-input-row{display:flex;gap:8px;padding:0 16px 12px}\
.aw-input-row input{flex:1;padding:8px 12px;background:'+ C.bgSec + ';border:1px solid ' + C.border + ';border-radius:10px;color:' + C.text + ';font-size:13px;outline:none;font-family:inherit}\
.aw-input-row button{padding:8px 14px;background:'+ C.primary + ';border:none;border-radius:10px;color:white;font-size:12px;font-weight:600;cursor:pointer}\
';
        document.head.appendChild(styleEl);

        // ── Build DOM ────────────────────────────────────────
        var fab = document.createElement('button');
        fab.id = 'aw-fab';
        fab.innerHTML = '🎤';
        fab.setAttribute('aria-label', 'Open AI Voice Agent');
        document.body.appendChild(fab);

        var panel = document.createElement('div');
        panel.id = 'aw-panel';
        panel.innerHTML = '<div class="aw-hdr"><div><div class="aw-hdr-title">' + TITLE + '</div><div class="aw-hdr-sub">' + SUBTITLE + '</div></div><button class="aw-close" id="aw-close-btn">\u2715</button></div><div class="aw-msgs" id="aw-msgs"></div><div class="aw-status" id="aw-status">Click the mic to start a live voice call</div><div class="aw-controls"><button class="aw-mute" id="aw-mute-btn" title="Mute/Unmute">🎤</button><button class="aw-mic" id="aw-mic-btn">📞</button></div><div class="aw-input-row"><input type="text" id="aw-text-input" placeholder="Or type a message..." /><button id="aw-text-send">Send</button></div>';
        document.body.appendChild(panel);

        var msgsEl = document.getElementById('aw-msgs');
        var statusEl = document.getElementById('aw-status');
        var micBtn = document.getElementById('aw-mic-btn');
        var muteBtn = document.getElementById('aw-mute-btn');
        var closeBtn = document.getElementById('aw-close-btn');
        var textInput = document.getElementById('aw-text-input');
        var textSend = document.getElementById('aw-text-send');

        // ── State ────────────────────────────────────────────
        var liveService = null;
        var isConnected = false;
        var isConnecting = false;
        var agentConfig = null;
        var userT = '', agentT = '';
        var sdkLoaded = false;
        var GoogleGenAI = null, Modality = null;

        // ── Load SDK from CDN ────────────────────────────────
        async function ensureSDK() {
            if (sdkLoaded) return true;
            try {
                console.log('[AgentWidget] Loading @google/genai SDK from CDN...');
                var mod = await import('https://esm.run/@google/genai');
                GoogleGenAI = mod.GoogleGenAI;
                Modality = mod.Modality;
                sdkLoaded = true;
                console.log('[AgentWidget] ✅ SDK loaded from CDN');
                return true;
            } catch (err) {
                console.error('[AgentWidget] Failed to load SDK from CDN:', err);
                return false;
            }
        }

        // ── Events ───────────────────────────────────────────
        fab.addEventListener('click', function () {
            panel.classList.toggle('open');
            fab.innerHTML = panel.classList.contains('open') ? '✕' : '🎤';
        });

        closeBtn.addEventListener('click', function () {
            panel.classList.remove('open');
            fab.innerHTML = '🎤';
        });

        micBtn.addEventListener('click', toggleCall);
        muteBtn.addEventListener('click', toggleMute);
        textSend.addEventListener('click', sendText);
        textInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') sendText(); });

        // ── Helpers ──────────────────────────────────────────
        function addMsg(role, text) {
            var d = document.createElement('div');
            d.className = 'aw-msg aw-msg-' + role;
            d.textContent = text;
            msgsEl.appendChild(d);
            msgsEl.scrollTop = msgsEl.scrollHeight;
        }

        function updateLastMsg(role, text) {
            var items = msgsEl.getElementsByClassName('aw-msg-' + role);
            if (items.length > 0) {
                items[items.length - 1].textContent = text;
                msgsEl.scrollTop = msgsEl.scrollHeight;
            } else {
                addMsg(role, text);
            }
        }

        function fetchAgentConfig() {
            return fetch(SERVER_URL + '/api/agents/' + AGENT_ID)
                .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
                .catch(function () {
                    return { name: TITLE, role: 'Assistant', system_prompt: '', voice_id: 'Puck' };
                });
        }

        // ── Core: Toggle Call ────────────────────────────────
        function toggleCall() {
            if (isConnected) { endCall(); return; }
            if (isConnecting) return;
            startCall();
        }

        async function startCall() {
            isConnecting = true;
            micBtn.innerHTML = '⏳';
            statusEl.textContent = 'Loading SDK...';

            // Load SDK if not loaded yet
            var loaded = await ensureSDK();
            if (!loaded) {
                isConnecting = false;
                micBtn.innerHTML = '📞';
                statusEl.textContent = '⚠️ Failed to load AI SDK. Check internet.';
                addMsg('system', '⚠️ Failed to load Google AI SDK from CDN');
                return;
            }

            statusEl.textContent = 'Connecting to AI...';

            if (!agentConfig) agentConfig = await fetchAgentConfig();

            liveService = new LiveAudioService(GoogleGenAI, Modality);

            var ok = await liveService.connect(agentConfig, {
                onOpen: function () {
                    isConnected = true;
                    isConnecting = false;
                    micBtn.innerHTML = '⏹️';
                    micBtn.classList.add('live');
                    muteBtn.style.display = 'flex';
                    statusEl.textContent = '🟢 Live — Speak naturally, AI is listening';
                    addMsg('system', 'Connected to ' + (agentConfig.name || TITLE) + '. Start speaking!');
                    userT = ''; agentT = '';
                },
                onClose: function () {
                    isConnected = false;
                    isConnecting = false;
                    micBtn.innerHTML = '📞';
                    micBtn.classList.remove('live');
                    muteBtn.style.display = 'none';
                    muteBtn.classList.remove('active');
                    muteBtn.innerHTML = '🎤';
                    statusEl.textContent = 'Call ended. Click mic to call again.';
                    addMsg('system', 'Call disconnected');
                    liveService = null;
                },
                onError: function (e) {
                    console.error('[AgentWidget] Error:', e);
                    isConnected = false;
                    isConnecting = false;
                    micBtn.innerHTML = '📞';
                    micBtn.classList.remove('live');
                    muteBtn.style.display = 'none';
                    statusEl.textContent = '⚠️ ' + (e && e.message ? e.message : 'Connection error');
                    addMsg('system', '⚠️ ' + (e && e.message ? e.message : 'Connection error'));
                    liveService = null;
                },
                onInterrupted: function () {
                    statusEl.textContent = '⚡ Interrupted — listening to you...';
                },
                onTranscription: function (text, isUser) {
                    if (!text || !text.trim()) return;
                    if (isUser) {
                        if (userT === '') { userT = text; addMsg('user', '🎤 ' + text); }
                        else { userT += text; updateLastMsg('user', '🎤 ' + userT); }
                        agentT = '';
                        statusEl.textContent = '🟢 Listening...';
                    } else {
                        if (agentT === '') { agentT = text; addMsg('agent', text); }
                        else { agentT += text; updateLastMsg('agent', agentT); }
                        userT = '';
                        statusEl.textContent = '🗣️ Agent speaking...';
                    }
                }
            });

            if (!ok) {
                isConnecting = false;
                micBtn.innerHTML = '📞';
                statusEl.textContent = 'Connection failed. Check console for details.';
            }
        }

        function endCall() {
            if (liveService) { liveService.disconnect(); liveService = null; }
        }

        function toggleMute() {
            if (!liveService) return;
            var nowMuted = liveService.toggleMute();
            muteBtn.classList.toggle('active', nowMuted);
            muteBtn.innerHTML = nowMuted ? '🔇' : '🎤';
            muteBtn.title = nowMuted ? 'Unmute' : 'Mute';
            statusEl.textContent = nowMuted ? '🔇 Muted' : '🟢 Unmuted — Listening...';
        }

        async function sendText() {
            var text = textInput.value.trim();
            if (!text) return;
            textInput.value = '';
            addMsg('user', text);
            statusEl.textContent = 'Thinking...';

            if (isConnected && liveService) {
                liveService.sendText(text);
            } else {
                try {
                    var r = await fetch(SERVER_URL + '/api/agents/' + AGENT_ID + '/chat', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ message: text }),
                    });
                    var d = await r.json();
                    addMsg('agent', d.response);
                    statusEl.textContent = 'Agent responded';
                } catch (err) {
                    addMsg('system', '⚠️ ' + err.message);
                    statusEl.textContent = 'Error';
                }
            }
        }

        console.log('[AgentWidget] 🎉 Widget initialized! Ready for Live API voice calls.');
    } // end init()

    // Run init when DOM is ready (works when script is in <head> or <body>)
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();