/**
 * AI Voice Agent Widget — Self-Contained Embeddable SDK
 * ═══════════════════════════════════════════════════════
 * Connects directly to Gemini Live API via raw WebSocket.
 * Same audio pipeline as the dashboard — guaranteed compatibility.
 *
 * Usage:
 *   <script>
 *     window.AgentWidgetConfig = {
 *       agentId: "your-agent-id",
 *       serverUrl: "https://your-backend.com",
 *       theme: "dark",           // "dark" | "light"
 *       position: "bottom-right", // "bottom-right" | "bottom-left"
 *       title: "AI Assistant",
 *       subtitle: "Click to start a voice call",
 *       primaryColor: "#6C63FF"
 *     };
 *   </script>
 *   <script src="https://your-backend.com/static/widget/agent-widget.js"></script>
 */
(function () {
    'use strict';

    // ═════════════════════════════════════════════════════════════════
    // Constants
    // ═════════════════════════════════════════════════════════════════
    var MODEL = 'models/gemini-2.5-flash-native-audio-preview-12-2025';
    var MIC_RATE = 16000;
    var OUT_RATE = 24000;

    // ═════════════════════════════════════════════════════════════════
    // PCM Helpers
    // ═════════════════════════════════════════════════════════════════
    function toB64(uint8) {
        var s = '';
        for (var i = 0; i < uint8.byteLength; i++) s += String.fromCharCode(uint8[i]);
        return btoa(s);
    }

    function fromB64(b64) {
        var bin = atob(b64);
        var out = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
        return out;
    }

    function f32ToI16(f32) {
        var i16 = new Int16Array(f32.length);
        for (var i = 0; i < f32.length; i++) {
            var s = Math.max(-1, Math.min(1, f32[i]));
            i16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        return i16;
    }

    function i16ToF32(bytes) {
        var i16 = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
        var f32 = new Float32Array(i16.length);
        for (var i = 0; i < i16.length; i++) f32[i] = i16[i] / 32768.0;
        return f32;
    }

    // ═════════════════════════════════════════════════════════════════
    // Player — separate 24kHz AudioContext for gapless playback
    // ═════════════════════════════════════════════════════════════════
    function Player() {
        this._ctx = null;
        this._t = 0;
        this._srcs = [];
    }

    Player.prototype.prime = function () {
        if (!this._ctx || this._ctx.state === 'closed') {
            var C = window.AudioContext || window.webkitAudioContext;
            this._ctx = new C({ sampleRate: OUT_RATE });
        }
        if (this._ctx.state === 'suspended') this._ctx.resume();
        return this._ctx;
    };

    Player.prototype.play = function (bytes) {
        var ctx = this.prime();
        var f32 = i16ToF32(bytes);
        if (!f32.length) return;
        var buf = ctx.createBuffer(1, f32.length, OUT_RATE);
        buf.copyToChannel(f32, 0);
        var src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(ctx.destination);
        var at = Math.max(ctx.currentTime, this._t);
        src.start(at);
        this._t = at + buf.duration;
        var self = this;
        this._srcs.push(src);
        src.onended = function () {
            var idx = self._srcs.indexOf(src);
            if (idx >= 0) self._srcs.splice(idx, 1);
        };
    };

    Player.prototype.stop = function () {
        for (var i = 0; i < this._srcs.length; i++) {
            try { this._srcs[i].stop(0); } catch (_) { }
        }
        this._srcs = [];
        if (this._ctx && this._ctx.state !== 'closed') this._t = this._ctx.currentTime;
    };

    Player.prototype.close = function () {
        this.stop();
        if (this._ctx) { try { this._ctx.close(); } catch (_) { } this._ctx = null; }
    };

    // ═════════════════════════════════════════════════════════════════
    // WidgetLiveService — raw WebSocket to Gemini Live API
    // Matches the dashboard's LiveAudioService exactly.
    // ═════════════════════════════════════════════════════════════════
    function WidgetLiveService() {
        this._ws = null;
        this._micCtx = null;
        this._processor = null;
        this._stream = null;
        this._player = new Player();
        this._muted = false;
        this._live = false;
        this._stop = false;
        this._playing = false;
        this._turnInterrupted = false;
        this._cbs = {};
        this._agentData = null;
        this._kbContext = '';
        this._keepalive = null;
    }

    WidgetLiveService.prototype.connect = async function (serverUrl, agentId, callbacks) {
        this._cbs = callbacks || {};
        this._stop = false;
        this._live = false;
        this._playing = false;
        this._turnInterrupted = false;

        try {
            // 1. Prime player AudioContext (must happen in user gesture context)
            this._player.prime();

            // 2. Boot — fetch agent config + KB context + Gemini key
            var bootRes = await fetch(serverUrl + '/api/widget/' + agentId + '/boot');
            if (!bootRes.ok) throw new Error('Failed to load agent config (HTTP ' + bootRes.status + ')');
            var boot = await bootRes.json();

            this._agentData = boot.agent;
            this._kbContext = boot.kb_context || '';
            var apiKey = boot.gemini_key;

            if (!apiKey) throw new Error('No Gemini API key configured on the server.');

            console.log('[Widget] Boot OK — agent:', boot.agent.name, ', KB:', this._kbContext.length, 'chars');

            // 3. Connect WebSocket — blocks until setupComplete
            var wsUrl =
                'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta' +
                '.GenerativeService.BidiGenerateContent?key=' + apiKey;

            await this._openWS(wsUrl);
            return true;
        } catch (e) {
            console.error('[Widget] Connect error:', e);
            this._emit('onError', e);
            return false;
        }
    };

    WidgetLiveService.prototype._openWS = function (url) {
        var self = this;
        return new Promise(function (resolve, reject) {
            var ws = new WebSocket(url);
            ws.binaryType = 'arraybuffer';
            self._ws = ws;

            var timer = setTimeout(function () {
                reject(new Error('Timeout waiting for Gemini setup'));
                try { ws.close(); } catch (_) { }
            }, 15000);

            ws.onopen = function () {
                console.log('[Widget] WS open → sending setup');
                self._sendSetup();
            };

            ws.onmessage = async function (evt) {
                var text = typeof evt.data === 'string'
                    ? evt.data
                    : new TextDecoder().decode(new Uint8Array(evt.data));
                var msg;
                try { msg = JSON.parse(text); } catch (_) { return; }

                // setupComplete
                if (msg.setupComplete !== undefined || msg.setup_complete !== undefined) {
                    console.log('[Widget] setupComplete ✅');
                    clearTimeout(timer);
                    try {
                        await self._startMic();
                        self._live = true;
                        self._emit('onOpen');
                        self._greet();
                        resolve();
                    } catch (e) {
                        reject(new Error('Mic: ' + e.message));
                    }
                    return;
                }

                if (msg.error) {
                    clearTimeout(timer);
                    var err = new Error(msg.error.message || JSON.stringify(msg.error));
                    reject(err);
                    self._emit('onError', err);
                    return;
                }

                self._handleContent(msg);
            };

            ws.onerror = function () {
                clearTimeout(timer);
                reject(new Error('WebSocket error'));
            };

            ws.onclose = function (e) {
                clearTimeout(timer);
                self._live = false;
                if (!self._stop) {
                    var reason = e.reason || ('code ' + e.code);
                    console.warn('[Widget] WS closed:', reason);
                    self._emit('onClose');
                }
            };
        });
    };

    WidgetLiveService.prototype._sendSetup = function () {
        var agent = this._agentData || {};
        var kbContext = this._kbContext || '';

        var kbBlock = kbContext
            ? '\n\nKNOWLEDGE BASE (ONLY use this information to answer questions — NEVER make up information not listed here):\n' +
              kbContext +
              '\n\nCRITICAL RESPONSE RULES FOR KNOWLEDGE BASE:\n' +
              '- If the KB context starts with "[KB INFO: ...]", it tells you how many total entries exist vs what you see. You are seeing only a SMALL SUBSET.\n' +
              '- BROAD QUERIES ("list all products", "what do you have", "tell me everything"):\n' +
              '  * NEVER list every item one-by-one. This is a voice call — long lists are terrible UX.\n' +
              '  * Instead: mention the CATEGORIES you see and say how many total products you have.\n' +
              '  * Then ASK the user which category interests them.\n' +
              '  * Keep it to 2-3 sentences MAX.\n' +
              '- SPECIFIC QUERIES: give full details from context.\n' +
              '- If the user asks something not covered, say you don\'t have that information.'
            : '';

        var sys =
            'You are ' + (agent.name || 'AI') + ', a ' + (agent.role || 'assistant') + '. ' +
            'ALWAYS respond in Tanglish — a natural spoken mix of Tamil and English, ' +
            'the way people actually talk in Tamil Nadu. ' +
            'Write Tamil words in Tamil script, English words in English. ' +
            'NEVER write pure Tamil or pure English — always mix both naturally. ' +
            'Examples of Tanglish style:\n' +
            '  "Seri saar, ungaloda order ID enna?"\n' +
            '  "Ok, naan check pannuren, oru minute wait pannunga."\n' +
            '  "Sorry saar, system-la details match aagala."\n' +
            '  "Delivery Tuesday-la vanthidum, tension vendam!"\n' +
            'Keep responses short — 1-2 sentences max. Voice conversation only, no bullet points.\n' +
            'CALL ENDING RULES:\n' +
            '- If the user says bye/goodbye/end call/hang up/cut the call or anything indicating they want to end, ' +
            'ALWAYS ask for confirmation first like "Seri, call end pannalama? Confirm pannunga."\n' +
            '- Only after the user explicitly confirms (yes/ok/seri/aamaa/end it), say your final goodbye and include the exact token [END_CALL] at the very end of your response.\n' +
            '- If the user says no/not yet/wait, continue the conversation normally.\n' +
            '- NEVER include [END_CALL] unless the user has confirmed they want to end.' +
            (agent.system_prompt ? '\n\n' + agent.system_prompt : '') +
            kbBlock;

        this._send({
            setup: {
                model: MODEL,
                generationConfig: {
                    responseModalities: ['AUDIO'],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: { voiceName: agent.voice_id || 'Puck' }
                        }
                    },
                    thinkingConfig: { includeThoughts: false },
                },
                systemInstruction: { parts: [{ text: sys }] },
                inputAudioTranscription: {},
                outputAudioTranscription: {},
            }
        });

        console.log('[Widget] Setup sent — model:', MODEL, ', voice:', agent.voice_id);
    };

    WidgetLiveService.prototype._greet = function () {
        this._send({
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
    };

    WidgetLiveService.prototype._handleContent = function (msg) {
        var sc = msg.serverContent || msg.server_content;
        if (!sc) return;

        // Interrupted
        if (sc.interrupted) {
            this._playing = false;
            this._turnInterrupted = false;
            this._player.stop();
            this._emit('onInterrupted');
            return;
        }

        // Model audio output
        var parts = (sc.modelTurn && sc.modelTurn.parts) || (sc.model_turn && sc.model_turn.parts) || [];
        for (var i = 0; i < parts.length; i++) {
            var d = parts[i].inlineData || parts[i].inline_data;
            var mime = (d && (d.mimeType || d.mime_type)) || '';
            if (mime.indexOf('audio/pcm') === 0) {
                if (this._turnInterrupted) continue;
                this._playing = true;
                this._player.play(fromB64(d.data));
            }
        }

        // Turn complete
        if (sc.turnComplete || sc.turn_complete) {
            this._playing = false;
            this._turnInterrupted = false;
            this._emit('onTurnComplete');
        }

        // Input transcription (user speech → text)
        var itx = sc.inputTranscription || sc.input_transcription;
        if (itx && itx.text) this._emit('onTranscription', itx.text, true);

        // Output transcription (agent speech → text)
        var otx = sc.outputTranscription || sc.output_transcription;
        if (otx && otx.text) {
            this._emit('onTranscription', otx.text, false);
            if (otx.text.indexOf('[END_CALL]') >= 0) {
                console.log('[Widget] Agent confirmed call end');
                this._emit('onCallEnd');
            }
        }
    };

    // ── Mic (ScriptProcessorNode — works on all origins incl. file://) ─

    WidgetLiveService.prototype._startMic = async function () {
        this._stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                channelCount: 1,
                sampleRate: MIC_RATE,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
            }
        });

        var C = window.AudioContext || window.webkitAudioContext;
        this._micCtx = new C({ sampleRate: MIC_RATE });
        if (this._micCtx.state === 'suspended') await this._micCtx.resume();

        var src = this._micCtx.createMediaStreamSource(this._stream);
        this._processor = this._micCtx.createScriptProcessor(4096, 1, 1);

        var self = this;
        this._processor.onaudioprocess = function (e) {
            if (!self._live || self._muted || !self._ws || self._ws.readyState !== WebSocket.OPEN) return;

            var inputData = e.inputBuffer.getChannelData(0);
            var chunk = new Uint8Array(f32ToI16(inputData).buffer);
            self._send({
                realtimeInput: {
                    mediaChunks: [{ mimeType: 'audio/pcm;rate=' + MIC_RATE, data: toB64(chunk) }]
                }
            });
        };

        src.connect(this._processor);
        this._processor.connect(this._micCtx.destination);

        // Keepalive: send silent chunk every 8s to prevent WS timeout
        this._keepalive = setInterval(function () {
            if (!self._live || !self._ws || self._ws.readyState !== WebSocket.OPEN) return;
            if (self._micCtx && self._micCtx.state === 'suspended') self._micCtx.resume();
            var silence = new Uint8Array(256);
            self._send({
                realtimeInput: {
                    mediaChunks: [{ mimeType: 'audio/pcm;rate=' + MIC_RATE, data: toB64(silence) }]
                }
            });
        }, 8000);

        console.log('[Widget] Mic started (ScriptProcessor)');
    };

    WidgetLiveService.prototype._stopMic = function () {
        if (this._keepalive) { clearInterval(this._keepalive); this._keepalive = null; }
        if (this._processor) { try { this._processor.disconnect(); } catch (_) { } this._processor = null; }
        if (this._stream) { this._stream.getTracks().forEach(function (t) { t.stop(); }); this._stream = null; }
    };

    // ── Public API ───────────────────────────────────────────────────

    WidgetLiveService.prototype.disconnect = function () {
        this._stop = true;
        this._live = false;
        this._stopMic();
        this._player.close();
        if (this._micCtx) { try { this._micCtx.close(); } catch (_) { } this._micCtx = null; }
        if (this._ws) { try { this._ws.close(1000, 'bye'); } catch (_) { } this._ws = null; }
        this._emit('onClose');
    };

    WidgetLiveService.prototype.toggleMute = function () {
        this._muted = !this._muted;
        return this._muted;
    };

    WidgetLiveService.prototype.sendText = function (text) {
        this._send({
            clientContent: {
                turns: [{ role: 'user', parts: [{ text: text }] }],
                turnComplete: true,
            }
        });
    };

    WidgetLiveService.prototype._send = function (obj) {
        if (this._ws && this._ws.readyState === WebSocket.OPEN) {
            this._ws.send(JSON.stringify(obj));
        }
    };

    WidgetLiveService.prototype._emit = function (ev) {
        if (typeof this._cbs[ev] === 'function') {
            var args = Array.prototype.slice.call(arguments, 1);
            try { this._cbs[ev].apply(null, args); } catch (e) { console.error('[Widget]', e); }
        }
    };

    // ═════════════════════════════════════════════════════════════════
    // Widget UI
    // ═════════════════════════════════════════════════════════════════
    function init() {
        var config = window.AgentWidgetConfig || {};
        var AGENT_ID = config.agentId || '';
        var SERVER_URL = (config.serverUrl || '').replace(/\/$/, '');
        var THEME = config.theme || 'dark';
        var POSITION = config.position || 'bottom-right';
        var TITLE = config.title || 'AI Assistant';
        var SUBTITLE = config.subtitle || 'Click to start a voice call';
        var PRIMARY_COLOR = config.primaryColor || '#6C63FF';

        if (!AGENT_ID) {
            console.error('[AgentWidget] No agentId in AgentWidgetConfig');
            return;
        }
        if (!SERVER_URL) {
            console.error('[AgentWidget] No serverUrl in AgentWidgetConfig');
            return;
        }

        console.log('[AgentWidget] Initializing —', TITLE, '(', AGENT_ID, ')');

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
#aw-fab{position:fixed;' + (posLeft ? 'left:24px' : 'right:24px') + ';bottom:24px;z-index:99999;width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,' + C.primary + ',#00D9FF);border:none;cursor:pointer;box-shadow:0 4px 20px rgba(108,99,255,.4);font-size:28px;display:flex;align-items:center;justify-content:center;transition:all .3s ease}\
#aw-fab:hover{transform:scale(1.1);box-shadow:0 8px 30px rgba(108,99,255,.5)}\
#aw-panel{position:fixed;' + (posLeft ? 'left:24px' : 'right:24px') + ';bottom:100px;z-index:99999;width:380px;max-height:540px;background:' + C.bg + ';border:1px solid ' + C.border + ';border-radius:20px;box-shadow:0 20px 60px rgba(0,0,0,.4);display:none;flex-direction:column;overflow:hidden;font-family:Inter,-apple-system,sans-serif;color:' + C.text + '}\
#aw-panel.open{display:flex;animation:awUp .3s ease}\
@keyframes awUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}\
.aw-hdr{padding:16px 20px;background:' + (isDark ? 'rgba(108,99,255,.05)' : '#FAFAFA') + ';border-bottom:1px solid ' + C.border + ';display:flex;align-items:center;justify-content:space-between}\
.aw-hdr-title{font-size:16px;font-weight:700;margin:0}\
.aw-hdr-sub{font-size:11px;color:' + C.textMuted + ';margin:2px 0 0}\
.aw-close{background:none;border:none;color:' + C.textMuted + ';font-size:20px;cursor:pointer;padding:4px}\
.aw-msgs{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;min-height:200px;max-height:300px}\
.aw-msg{padding:10px 14px;border-radius:14px;font-size:13px;line-height:1.5;max-width:85%;word-break:break-word}\
.aw-msg-user{align-self:flex-end;background:' + C.userMsg + ';color:' + (isDark ? 'white' : '#333') + ';border-bottom-right-radius:4px}\
.aw-msg-agent{align-self:flex-start;background:' + C.agentMsg + ';border:1px solid ' + C.border + ';border-bottom-left-radius:4px}\
.aw-msg-system{align-self:center;background:transparent;color:' + C.textMuted + ';font-size:11px;text-align:center}\
.aw-status{text-align:center;font-size:12px;color:' + C.textMuted + ';padding:4px}\
.aw-controls{padding:16px;display:flex;align-items:center;justify-content:center;gap:16px;border-top:1px solid ' + C.border + '}\
.aw-mic{width:56px;height:56px;border-radius:50%;border:none;background:linear-gradient(135deg,' + C.primary + ',#00D9FF);color:white;font-size:24px;cursor:pointer;transition:all .3s;box-shadow:0 4px 15px rgba(108,99,255,.3)}\
.aw-mic:hover{transform:scale(1.05)}\
.aw-mic.live{background:' + C.danger + ';box-shadow:0 4px 15px rgba(239,68,68,.4);animation:awPulse 1.2s ease infinite}\
@keyframes awPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}\
.aw-mute{width:40px;height:40px;border-radius:50%;border:1px solid ' + C.border + ';background:rgba(108,99,255,.15);color:' + C.text + ';font-size:18px;cursor:pointer;transition:all .3s;display:none;align-items:center;justify-content:center}\
.aw-mute.active{background:rgba(239,68,68,.25);border-color:' + C.danger + '}\
.aw-input-row{display:flex;gap:8px;padding:0 16px 12px}\
.aw-input-row input{flex:1;padding:8px 12px;background:' + C.bgSec + ';border:1px solid ' + C.border + ';border-radius:10px;color:' + C.text + ';font-size:13px;outline:none;font-family:inherit}\
.aw-input-row button{padding:8px 14px;background:' + C.primary + ';border:none;border-radius:10px;color:white;font-size:12px;font-weight:600;cursor:pointer}\
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
        panel.innerHTML =
            '<div class="aw-hdr"><div><div class="aw-hdr-title">' + TITLE + '</div>' +
            '<div class="aw-hdr-sub">' + SUBTITLE + '</div></div>' +
            '<button class="aw-close" id="aw-close-btn">\u2715</button></div>' +
            '<div class="aw-msgs" id="aw-msgs"></div>' +
            '<div class="aw-status" id="aw-status">Click the mic to start a live voice call</div>' +
            '<div class="aw-controls">' +
            '<button class="aw-mute" id="aw-mute-btn" title="Mute/Unmute">🎤</button>' +
            '<button class="aw-mic" id="aw-mic-btn">📞</button>' +
            '</div>' +
            '<div class="aw-input-row">' +
            '<input type="text" id="aw-text-input" placeholder="Or type a message..." />' +
            '<button id="aw-text-send">Send</button></div>';
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
        var userT = '', agentT = '';
        var chatHistory = [];

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

        // ── Core: Toggle Call ────────────────────────────────
        function toggleCall() {
            if (isConnected) { endCall(); return; }
            if (isConnecting) return;
            startCall();
        }

        async function startCall() {
            isConnecting = true;
            micBtn.innerHTML = '⏳';
            statusEl.textContent = 'Connecting to AI agent...';

            liveService = new WidgetLiveService();

            var ok = await liveService.connect(SERVER_URL, AGENT_ID, {
                onOpen: function () {
                    isConnected = true;
                    isConnecting = false;
                    micBtn.innerHTML = '⏹️';
                    micBtn.classList.add('live');
                    muteBtn.style.display = 'flex';
                    statusEl.textContent = '🟢 Live — Speak naturally, AI is listening';
                    addMsg('system', 'Connected! Start speaking.');
                    userT = '';
                    agentT = '';
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
                onTurnComplete: function () {
                    statusEl.textContent = '🟢 Listening...';
                },
                onCallEnd: function () {
                    setTimeout(function () {
                        if (liveService) { liveService.disconnect(); liveService = null; }
                    }, 2000);
                },
                onTranscription: function (text, isUser) {
                    if (!text || !text.trim()) return;
                    if (isUser) {
                        if (userT === '') { userT = text; addMsg('user', '🎤 ' + text); }
                        else { userT += text; updateLastMsg('user', '🎤 ' + userT); }
                        agentT = '';
                        statusEl.textContent = '🟢 Listening...';
                    } else {
                        var clean = text.replace('[END_CALL]', '').trim();
                        if (!clean) return;
                        if (agentT === '') { agentT = clean; addMsg('agent', clean); }
                        else { agentT += clean; updateLastMsg('agent', agentT); }
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
                // Send through live session
                liveService.sendText(text);
            } else {
                // REST fallback — public widget chat endpoint
                chatHistory.push({ role: 'user', content: text });
                try {
                    var r = await fetch(SERVER_URL + '/api/widget/' + AGENT_ID + '/chat', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ message: text, history: chatHistory }),
                    });
                    var d = await r.json();
                    var reply = d.response || 'No response';
                    addMsg('agent', reply);
                    chatHistory.push({ role: 'assistant', content: reply });
                    statusEl.textContent = 'Agent responded';
                } catch (err) {
                    addMsg('system', '⚠️ ' + err.message);
                    statusEl.textContent = 'Error';
                }
            }
        }

        console.log('[AgentWidget] ✅ Widget ready! Agent:', TITLE);
    }

    // Run init when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
