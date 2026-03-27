/**
 * AI Voice Agent Widget — Embeddable SDK
 * Premium redesign matching the VoiceForge AI design system.
 */

import { LiveAudioService } from './services/liveAudioService';

(function () {
    'use strict';

    const config       = window.AgentWidgetConfig || {};
    const AGENT_ID     = config.agentId || '';
    const SERVER_URL   = (config.serverUrl || 'http://localhost:8000').replace(/\/$/, '');
    const THEME        = config.theme || 'dark';
    const POSITION     = config.position || 'bottom-right';
    const TITLE        = config.title || 'AI Assistant';
    const SUBTITLE     = config.subtitle || 'Live voice call with AI';
    const PRIMARY      = config.primaryColor || '#7c6dfa';

    if (!AGENT_ID) return;

    const isDark = THEME === 'dark';

    // ─── Color tokens ────────────────────────────────────────────────────────
    const C = {
        bg:          isDark ? '#0d0e1a' : '#ffffff',
        bgCard:      isDark ? '#12141f' : '#f9fafb',
        bgElevated:  isDark ? '#181a2a' : '#f1f5f9',
        bgInput:     isDark ? '#1e2035' : '#f0f0f6',
        border:      isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)',
        borderAccent:isDark ? `${PRIMARY}40` : `${PRIMARY}33`,
        text:        isDark ? '#e8eaf6' : '#1a1b2e',
        textSub:     isDark ? '#9ea3c0' : '#6b7280',
        textMuted:   isDark ? '#5a6080' : '#9ca3af',
        primary:     PRIMARY,
        danger:      '#f43f5e',
        success:     '#22d3a0',
        userBubble:  isDark ? `${PRIMARY}22` : `${PRIMARY}15`,
        agentBubble: isDark ? '#181a2a' : '#f3f4f6',
    };

    const isRight = POSITION !== 'bottom-left';
    const posPanel = isRight ? 'right: 24px;' : 'left: 24px;';
    const posFab   = isRight ? 'right: 24px; bottom: 24px;' : 'left: 24px; bottom: 24px;';

    // ─── Inject CSS ──────────────────────────────────────────────────────────
    const css = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

    #aw-fab {
      position: fixed; ${posFab} z-index: 99999;
      width: 60px; height: 60px; border-radius: 50%;
      background: linear-gradient(135deg, ${C.primary}, #a78bfa);
      border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 24px ${C.primary}55;
      transition: transform .25s ease, box-shadow .25s ease;
    }
    #aw-fab:hover { transform: scale(1.08); box-shadow: 0 6px 32px ${C.primary}77; }
    #aw-fab svg { transition: transform .3s ease; }

    #aw-panel {
      position: fixed; ${posPanel} bottom: 96px;
      z-index: 99999; width: 380px;
      background: ${C.bg};
      border: 1px solid ${C.border};
      border-radius: 20px;
      box-shadow: 0 24px 64px rgba(0,0,0,0.45), 0 0 0 1px ${C.border};
      display: none; flex-direction: column;
      font-family: 'Inter', -apple-system, sans-serif;
      color: ${C.text}; overflow: hidden;
      max-height: 580px;
    }
    #aw-panel.open { display: flex; animation: awUp .25s cubic-bezier(.34,1.56,.64,1); }
    @keyframes awUp {
      from { opacity: 0; transform: translateY(16px) scale(.97); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }

    /* Header */
    .aw-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 16px;
      background: ${C.bgCard};
      border-bottom: 1px solid ${C.border};
    }
    .aw-header-left { display: flex; align-items: center; gap: 10px; }
    .aw-avatar {
      width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0;
      background: linear-gradient(135deg, ${C.primary}33, #a78bfa33);
      border: 1px solid ${C.primary}33;
      display: grid; place-items: center;
      font-size: 16px; font-weight: 800; color: ${C.primary};
    }
    .aw-title { font-size: 14px; font-weight: 700; line-height: 1; }
    .aw-subtitle { font-size: 11px; color: ${C.textSub}; margin-top: 2px; }
    .aw-header-right { display: flex; align-items: center; gap: 6px; }

    /* Mode pills */
    .aw-mode-group { display: flex; gap: 2px; background: ${C.bgInput}; border-radius: 8px; padding: 2px; }
    .aw-mode-btn {
      padding: 4px 10px; border: none; border-radius: 6px; cursor: pointer;
      font-size: 11px; font-weight: 600; font-family: inherit;
      transition: all .18s ease; color: ${C.textMuted}; background: transparent;
    }
    .aw-mode-btn.active { background: ${C.primary}; color: white; }
    .aw-close-btn {
      width: 28px; height: 28px; border-radius: 8px; border: none; cursor: pointer;
      background: ${C.bgInput}; color: ${C.textMuted}; display: grid; place-items: center;
      transition: all .18s ease;
    }
    .aw-close-btn:hover { background: ${C.danger}22; color: ${C.danger}; }

    /* Status bar */
    .aw-statusbar {
      display: flex; align-items: center; gap: 7px;
      padding: 6px 16px; font-size: 11px; font-weight: 500;
      color: ${C.textSub}; border-bottom: 1px solid ${C.border};
      background: ${C.bgCard};
    }
    .aw-live-dot {
      width: 6px; height: 6px; border-radius: 50%;
      background: ${C.textMuted}; flex-shrink: 0; transition: background .3s;
    }
    .aw-live-dot.live { background: ${C.success}; box-shadow: 0 0 8px ${C.success}88; }
    .aw-live-dot.connecting { background: #fbbf24; }

    /* Wave bars */
    .aw-wave { display: flex; align-items: center; gap: 2px; height: 16px; margin-left: 4px; }
    .aw-wave span {
      width: 2px; border-radius: 99px;
      background: ${C.primary}; opacity: 0.7;
      animation: awBar .6s ease-in-out infinite alternate;
    }
    .aw-wave span:nth-child(1) { animation-delay: 0s; }
    .aw-wave span:nth-child(2) { animation-delay: .1s; }
    .aw-wave span:nth-child(3) { animation-delay: .2s; }
    .aw-wave span:nth-child(4) { animation-delay: .15s; }
    .aw-wave span:nth-child(5) { animation-delay: .05s; }
    @keyframes awBar {
      from { height: 3px; } to { height: 14px; }
    }

    /* Messages */
    .aw-msgs {
      flex: 1; overflow-y: auto; padding: 14px 12px;
      display: flex; flex-direction: column; gap: 8px;
      min-height: 220px; max-height: 320px;
      scrollbar-width: thin; scrollbar-color: ${C.border} transparent;
    }

    /* Empty state */
    .aw-empty {
      flex: 1; display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      gap: 10px; padding: 24px 16px; text-align: center;
    }
    .aw-empty-btn {
      width: 64px; height: 64px; border-radius: 50%; border: none; cursor: pointer;
      background: linear-gradient(135deg, ${C.primary}, #a78bfa);
      display: grid; place-items: center;
      box-shadow: 0 4px 20px ${C.primary}55;
      position: relative; transition: transform .2s ease;
    }
    .aw-empty-btn:disabled { opacity: .6; cursor: not-allowed; }
    .aw-empty-btn:not(:disabled):hover { transform: scale(1.06); }
    .aw-empty-btn::before, .aw-empty-btn::after {
      content: ''; position: absolute; inset: -10px;
      border-radius: 50%; border: 1px solid ${C.primary};
      opacity: .2; animation: awRipple 2s ease-out infinite;
    }
    .aw-empty-btn::after { inset: -20px; animation-delay: .5s; }
    @keyframes awRipple {
      from { opacity: .25; transform: scale(.9); }
      to   { opacity: 0;   transform: scale(1.15); }
    }
    .aw-empty-title { font-size: 13px; font-weight: 600; color: ${C.text}; }
    .aw-empty-hint { font-size: 11px; color: ${C.textMuted}; line-height: 1.5; max-width: 220px; }

    /* Bubbles */
    .aw-bubble-wrap { display: flex; flex-direction: column; }
    .aw-bubble-wrap.user { align-items: flex-end; }
    .aw-bubble-wrap.agent { align-items: flex-start; }
    .aw-bubble-wrap.system { align-items: center; }
    .aw-bubble-label {
      font-size: 9.5px; font-weight: 700; text-transform: uppercase;
      letter-spacing: .06em; color: ${C.textMuted}; margin-bottom: 3px; padding: 0 4px;
    }
    .aw-bubble {
      max-width: 82%; padding: 9px 13px;
      font-size: 13px; line-height: 1.5; word-break: break-word;
      animation: awBub .18s ease-out;
    }
    @keyframes awBub { from { opacity:0; transform:scale(.95); } to { opacity:1; transform:scale(1); } }
    .aw-bubble.user {
      background: ${C.userBubble}; color: ${C.text};
      border: 1px solid ${C.borderAccent};
      border-radius: 14px 14px 4px 14px;
    }
    .aw-bubble.agent {
      background: ${C.agentBubble}; color: ${C.text};
      border: 1px solid ${C.border};
      border-radius: 14px 14px 14px 4px;
    }
    .aw-bubble.system {
      background: ${C.bgInput}; color: ${C.textMuted};
      border-radius: 8px; font-size: 11px;
      border: 1px solid ${C.border}; max-width: 100%; text-align: center;
    }

    /* Footer */
    .aw-footer {
      display: flex; align-items: center; gap: 8px;
      padding: 10px 12px;
      border-top: 1px solid ${C.border};
      background: ${C.bgCard};
    }
    .aw-call-btn {
      width: 38px; height: 38px; border-radius: 50%; border: none; cursor: pointer; flex-shrink: 0;
      display: grid; place-items: center;
      background: linear-gradient(135deg, ${C.primary}, #a78bfa);
      box-shadow: 0 2px 12px ${C.primary}44;
      transition: all .2s ease;
    }
    .aw-call-btn.active {
      background: linear-gradient(135deg, ${C.danger}, #c0392b);
      box-shadow: 0 2px 12px ${C.danger}44;
    }
    .aw-call-btn:disabled { opacity: .55; cursor: not-allowed; }
    .aw-call-btn:not(:disabled):hover { transform: scale(1.08); }
    .aw-input {
      flex: 1; padding: 9px 14px; font-size: 13px; font-family: inherit;
      background: ${C.bgInput}; border: 1px solid ${C.border}; border-radius: 20px;
      color: ${C.text}; outline: none; transition: border-color .18s;
    }
    .aw-input:focus { border-color: ${C.primary}88; }
    .aw-send-btn {
      padding: 8px 14px; border: none; border-radius: 20px; cursor: pointer;
      background: ${C.primary}; color: white; font-size: 12px; font-weight: 600;
      font-family: inherit; transition: opacity .18s;
      display: flex; align-items: center; gap: 4px;
    }
    .aw-send-btn:hover { opacity: .88; }
    .aw-send-btn:disabled { opacity: .45; cursor: not-allowed; }
    `;

    const styleEl = document.createElement('style');
    styleEl.textContent = css;
    document.head.appendChild(styleEl);

    // ─── FAB button ─────────────────────────────────────────────────────────
    const fab = document.createElement('button');
    fab.id = 'aw-fab';
    fab.setAttribute('aria-label', 'Open AI Voice Agent');
    fab.innerHTML = phoneSVG();
    document.body.appendChild(fab);

    // ─── Panel ──────────────────────────────────────────────────────────────
    const panel = document.createElement('div');
    panel.id = 'aw-panel';
    panel.innerHTML = `
      <div class="aw-header">
        <div class="aw-header-left">
          <div class="aw-avatar">${TITLE[0].toUpperCase()}</div>
          <div>
            <div class="aw-title">${TITLE}</div>
            <div class="aw-subtitle">${SUBTITLE}</div>
          </div>
        </div>
        <div class="aw-header-right">
          <div class="aw-mode-group">
            <button class="aw-mode-btn active" id="aw-btn-voice">Voice</button>
            <button class="aw-mode-btn" id="aw-btn-chat">Chat</button>
          </div>
          <button class="aw-close-btn" id="aw-close" aria-label="Close">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
              <path d="M1 1l10 10M11 1L1 11"/>
            </svg>
          </button>
        </div>
      </div>

      <div class="aw-statusbar">
        <div class="aw-live-dot" id="aw-dot"></div>
        <span id="aw-status-text">Ready to connect</span>
        <div class="aw-wave" id="aw-wave" style="display:none">
          <span></span><span></span><span></span><span></span><span></span>
        </div>
      </div>

      <div class="aw-msgs" id="aw-msgs">
        <div class="aw-empty" id="aw-empty">
          <button class="aw-empty-btn" id="aw-start-btn" title="Start call">
            ${phoneSVG('white', 22)}
          </button>
          <div class="aw-empty-title">Tap to start</div>
          <div class="aw-empty-hint">Click the button above to begin a voice call, or switch to Chat mode to type.</div>
        </div>
      </div>

      <div class="aw-footer" id="aw-footer" style="display:none">
        <button class="aw-call-btn" id="aw-footer-call" title="Start / End call">
          ${phoneSVG('white', 16)}
        </button>
        <input class="aw-input" id="aw-text-input" placeholder="Type a message…" />
        <button class="aw-send-btn" id="aw-send-btn">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z"/></svg>
          Send
        </button>
      </div>
    `;
    document.body.appendChild(panel);

    // ─── Element refs ────────────────────────────────────────────────────────
    const $ = (id) => document.getElementById(id);
    const msgsEl      = $('aw-msgs');
    const emptyEl     = $('aw-empty');
    const footerEl    = $('aw-footer');
    const statusText  = $('aw-status-text');
    const dot         = $('aw-dot');
    const waveEl      = $('aw-wave');
    const textInput   = $('aw-text-input');
    const sendBtn     = $('aw-send-btn');
    const modeBtns    = { voice: $('aw-btn-voice'), chat: $('aw-btn-chat') };
    const startBtn    = $('aw-start-btn');
    const footerCall  = $('aw-footer-call');

    // ─── State ───────────────────────────────────────────────────────────────
    let svc          = null;
    let connected    = false;
    let connecting   = false;
    let agentCfg     = null;
    let mode         = 'voice';
    let userTx       = '';
    let agentTx      = '';

    // ─── UI helpers ──────────────────────────────────────────────────────────
    function setStatus(text, state = 'idle') {
        statusText.textContent = text;
        dot.className = 'aw-live-dot' + (state === 'live' ? ' live' : state === 'connecting' ? ' connecting' : '');
        waveEl.style.display = (state === 'live') ? 'flex' : 'none';
    }

    function addBubble(role, text) {
        // Remove empty state and show footer
        if (emptyEl.parentNode) { emptyEl.remove(); footerEl.style.display = 'flex'; }

        const wrap = document.createElement('div');
        wrap.className = `aw-bubble-wrap ${role}`;

        if (role !== 'system') {
            const label = document.createElement('div');
            label.className = 'aw-bubble-label';
            label.textContent = role === 'user' ? 'You' : 'Agent';
            wrap.appendChild(label);
        }

        const bub = document.createElement('div');
        bub.className = `aw-bubble ${role}`;
        bub.textContent = text;
        wrap.appendChild(bub);
        msgsEl.appendChild(wrap);
        msgsEl.scrollTop = msgsEl.scrollHeight;
        return bub; // return element for streaming updates
    }

    function updateLastBubble(role, text) {
        const bubbles = msgsEl.querySelectorAll(`.aw-bubble.${role}`);
        if (bubbles.length > 0) {
            bubbles[bubbles.length - 1].textContent = text;
            msgsEl.scrollTop = msgsEl.scrollHeight;
        } else {
            addBubble(role, text);
        }
    }

    function setCallActive(active) {
        connected = active;
        if (active) {
            footerCall.className = 'aw-call-btn active';
            footerCall.innerHTML = hangupSVG('white', 16);
            footerCall.title = 'End call';
        } else {
            footerCall.className = 'aw-call-btn';
            footerCall.innerHTML = phoneSVG('white', 16);
            footerCall.title = 'Start call';
        }
        startBtn.disabled = active || connecting;
    }

    // ─── Mode toggle ─────────────────────────────────────────────────────────
    function setMode(m) {
        if (connected) return;
        mode = m;
        modeBtns.voice.className = 'aw-mode-btn' + (m === 'voice' ? ' active' : '');
        modeBtns.chat.className  = 'aw-mode-btn' + (m === 'chat'  ? ' active' : '');
        // Show/hide text input
        textInput.style.display = sendBtn.style.display = (m === 'chat') ? '' : 'none';
        setStatus('Ready to connect', 'idle');
    }

    modeBtns.voice.addEventListener('click', () => setMode('voice'));
    modeBtns.chat.addEventListener('click',  () => setMode('chat'));

    // Init — voice mode, hide text input
    textInput.style.display = sendBtn.style.display = 'none';

    // ─── FAB / panel toggle ───────────────────────────────────────────────────
    fab.addEventListener('click', () => {
        const isOpen = panel.classList.toggle('open');
        fab.innerHTML = isOpen ? closeSVG() : phoneSVG();
    });
    $('aw-close').addEventListener('click', () => {
        panel.classList.remove('open');
        fab.innerHTML = phoneSVG();
    });

    // ─── Start / end call ────────────────────────────────────────────────────
    async function startCall() {
        if (connected || connecting) return;
        connecting = true;
        setStatus('Connecting…', 'connecting');
        startBtn.disabled = true;
        if (footerEl.style.display !== 'flex') { emptyEl.remove(); footerEl.style.display = 'flex'; }

        if (!agentCfg) {
            try {
                const res = await fetch(`${SERVER_URL}/api/agents/public/${AGENT_ID}`);
                agentCfg = res.ok ? await res.json() : { id: AGENT_ID, name: TITLE, role: 'Assistant', system_prompt: '', voice_id: 'Puck' };
            } catch { agentCfg = { id: AGENT_ID, name: TITLE, role: 'Assistant', system_prompt: '', voice_id: 'Puck' }; }
        }

        svc = new LiveAudioService();

        const ok = await svc.connect(agentCfg, {
            onOpen: () => {
                connecting = false;
                setStatus('Live — Listening', 'live');
                setCallActive(true);
                userTx = ''; agentTx = '';
                if (mode === 'chat') addBubble('system', `Connected to ${agentCfg.name}`);
            },
            onClose: () => {
                connecting = false;
                setCallActive(false);
                setStatus('Call ended', 'idle');
                if (mode === 'chat') addBubble('system', 'Call disconnected');
                svc = null;
            },
            onError: (e) => {
                connecting = false;
                setCallActive(false);
                setStatus('Connection error', 'idle');
                if (mode === 'chat') addBubble('system', `⚠️ ${e?.message || 'Error'}`);
                svc = null;
            },
            onInterrupted: () => { setStatus('Listening…', 'live'); },
            onTurnComplete: () => { setStatus('Listening…', 'live'); },
            onTranscription: (text, isUser) => {
                if (!text?.trim() || mode !== 'chat') return;
                if (isUser) {
                    if (!userTx) { userTx = text; addBubble('user', text); }
                    else { userTx += text; updateLastBubble('user', userTx); }
                    agentTx = '';
                    setStatus('Processing…', 'live');
                } else {
                    if (!agentTx) { agentTx = text; addBubble('agent', text); }
                    else { agentTx += text; updateLastBubble('agent', agentTx); }
                    userTx = '';
                    setStatus('Agent speaking…', 'live');
                }
            },
        }, { mode, recordingEnabled: true, callerId: null });

        if (!ok) {
            connecting = false;
            startBtn.disabled = false;
            setStatus('Connection failed', 'idle');
        }
    }

    function endCall() {
        if (svc) { svc.disconnect(); svc = null; }
        connecting = false;
        setCallActive(false);
    }

    startBtn.addEventListener('click', startCall);
    footerCall.addEventListener('click', () => connected ? endCall() : startCall());

    // ─── Text send ───────────────────────────────────────────────────────────
    async function sendText() {
        const text = textInput.value.trim();
        if (!text) return;
        textInput.value = '';
        addBubble('user', text);
        setStatus('Thinking…', connected ? 'live' : 'idle');

        if (connected && svc) {
            svc.sendText(text);
        } else {
            try {
                const res = await fetch(`${SERVER_URL}/api/agents/${AGENT_ID}/chat`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: text }),
                });
                const data = await res.json();
                addBubble('agent', data.response);
                setStatus('Ready', 'idle');
            } catch (err) {
                addBubble('system', `⚠️ ${err.message}`);
                setStatus('Error', 'idle');
            }
        }
    }

    sendBtn.addEventListener('click', sendText);
    textInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendText(); });

    // ─── SVG helpers ─────────────────────────────────────────────────────────
    function phoneSVG(fill = 'white', size = 26) {
        return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}">
          <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/>
        </svg>`;
    }
    function hangupSVG(fill = 'white', size = 16) {
        return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" style="transform:rotate(135deg)">
          <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/>
        </svg>`;
    }
    function closeSVG() {
        return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>`;
    }

})();
