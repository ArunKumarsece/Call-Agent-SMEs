/**
 * AI Voice Agent Widget — Embeddable SDK (Live API Version)
 * Uses LiveAudioService with @google/genai SDK.
 */

import { LiveAudioService } from './services/liveAudioService';

// Ensure LiveAudioService is bundled correctly
console.log('[AgentWidget] Loading widget with Live API support...');

(function () {
    'use strict';

    const config = window.AgentWidgetConfig || {};
    const AGENT_ID = config.agentId || '';
    // Server URL isn't strictly needed for Live API main flow, but kept for fallback/config fetching if needed
    const SERVER_URL = (config.serverUrl || 'http://localhost:8000').replace(/\/$/, '');
    const THEME = config.theme || 'dark';
    const POSITION = config.position || 'bottom-right';
    const TITLE = config.title || 'AI Assistant';
    const SUBTITLE = config.subtitle || 'Click to start a voice call';
    const PRIMARY_COLOR = config.primaryColor || '#6C63FF';

    console.log('[AgentWidget] Config:', { AGENT_ID, SERVER_URL, THEME, POSITION, TITLE });

    if (!AGENT_ID) {
        console.error('[AgentWidget] No agentId provided in AgentWidgetConfig');
        return;
    }

    // ─── Styles ─────────────────────────────────────────
    const isDark = THEME === 'dark';
    const colors = {
        bg: isDark ? '#1A1A3E' : '#FFFFFF',
        bgSecondary: isDark ? '#12122A' : '#F5F5F5',
        text: isDark ? '#F0F0FF' : '#1A1A2E',
        textMuted: isDark ? '#9090B0' : '#666666',
        border: isDark ? 'rgba(108, 99, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)',
        primary: PRIMARY_COLOR,
        danger: '#EF4444',
        userMsg: isDark ? '#4F46E5' : '#E8E5FF',
        agentMsg: isDark ? '#242450' : '#F0F0F0',
    };

    const posStyles = {
        'bottom-right': 'right: 24px; bottom: 24px;',
        'bottom-left': 'left: 24px; bottom: 24px;',
    };

    const css = `
    #agent-widget-fab {
      position: fixed;
      ${posStyles[POSITION] || posStyles['bottom-right']}
      z-index: 99999;
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: linear-gradient(135deg, ${colors.primary}, #00D9FF);
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 20px rgba(108, 99, 255, 0.4);
      font-size: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s ease;
    }
    #agent-widget-fab:hover {
      transform: scale(1.1);
      box-shadow: 0 8px 30px rgba(108, 99, 255, 0.5);
    }
    #agent-widget-panel {
      position: fixed;
      ${POSITION === 'bottom-left' ? 'left: 24px;' : 'right: 24px;'}
      bottom: 100px;
      z-index: 99999;
      width: 380px;
      max-height: 520px;
      background: ${colors.bg};
      border: 1px solid ${colors.border};
      border-radius: 20px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
      display: none;
      flex-direction: column;
      overflow: hidden;
      font-family: 'Inter', -apple-system, sans-serif;
      color: ${colors.text};
    }
    #agent-widget-panel.open { display: flex; animation: awSlideUp 0.3s ease; }
    @keyframes awSlideUp {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .aw-header {
      padding: 16px 20px;
      background: ${isDark ? 'rgba(108, 99, 255, 0.05)' : '#FAFAFA'};
      border-bottom: 1px solid ${colors.border};
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .aw-header-title {
      font-size: 16px;
      font-weight: 700;
      margin: 0;
    }
    .aw-header-sub {
      font-size: 11px;
      color: ${colors.textMuted};
      margin: 2px 0 0;
    }
    .aw-close {
      background: none;
      border: none;
      color: ${colors.textMuted};
      font-size: 20px;
      cursor: pointer;
      padding: 4px;
    }
    .aw-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      min-height: 200px;
      max-height: 300px;
    }
    .aw-msg {
      padding: 10px 14px;
      border-radius: 14px;
      font-size: 13px;
      line-height: 1.5;
      max-width: 85%;
      word-break: break-word;
    }
    .aw-msg-user {
      align-self: flex-end;
      background: ${colors.userMsg};
      color: ${isDark ? 'white' : '#333'};
      border-bottom-right-radius: 4px;
    }
    .aw-msg-agent {
      align-self: flex-start;
      background: ${colors.agentMsg};
      border: 1px solid ${colors.border};
      border-bottom-left-radius: 4px;
    }
    .aw-msg-system {
      align-self: center;
      background: transparent;
      color: ${colors.textMuted};
      font-size: 11px;
      text-align: center;
    }
    .aw-status {
      text-align: center;
      font-size: 12px;
      color: ${colors.textMuted};
      padding: 4px;
    }
    .aw-controls {
      padding: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 16px;
      border-top: 1px solid ${colors.border};
    }
    .aw-mic {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      border: none;
      background: linear-gradient(135deg, ${colors.primary}, #00D9FF);
      color: white;
      font-size: 24px;
      cursor: pointer;
      transition: all 0.3s ease;
      box-shadow: 0 4px 15px rgba(108, 99, 255, 0.3);
    }
    .aw-mic:hover { transform: scale(1.05); }
    .aw-mic.recording {
      background: ${colors.danger};
      box-shadow: 0 4px 15px rgba(239, 68, 68, 0.4);
      animation: awPulse 1.2s ease infinite;
    }
    @keyframes awPulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.05); }
    }
    .aw-input-row {
      display: flex;
      gap: 8px;
      padding: 0 16px 12px;
    }
    .aw-input-row input {
      flex: 1;
      padding: 8px 12px;
      background: ${colors.bgSecondary};
      border: 1px solid ${colors.border};
      border-radius: 10px;
      color: ${colors.text};
      font-size: 13px;
      outline: none;
      font-family: inherit;
    }
    .aw-input-row button {
      padding: 8px 14px;
      background: ${colors.primary};
      border: none;
      border-radius: 10px;
      color: white;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }
  `;

    // ─── Inject Styles ──────────────────────────────────
    const styleEl = document.createElement('style');
    styleEl.textContent = css;
    document.head.appendChild(styleEl);

    // ─── Build DOM ──────────────────────────────────────
    const fab = document.createElement('button');
    fab.id = 'agent-widget-fab';
    fab.innerHTML = '🎤';
    fab.setAttribute('aria-label', 'Open AI Voice Agent');
    document.body.appendChild(fab);

    const panel = document.createElement('div');
    panel.id = 'agent-widget-panel';
    panel.innerHTML = `
    <div class="aw-header">
      <div>
        <div class="aw-header-title">${TITLE}</div>
        <div class="aw-header-sub">${SUBTITLE}</div>
      </div>
      <button class="aw-close" id="aw-close">✕</button>
    </div>
    <div class="aw-messages" id="aw-messages"></div>
    <div class="aw-status" id="aw-status">Click the mic to start speaking</div>
    <div class="aw-controls">
      <button class="aw-mic" id="aw-mic">🎤</button>
    </div>
    <div class="aw-input-row">
      <input type="text" id="aw-text-input" placeholder="Or type a message..." />
      <button id="aw-text-send">Send</button>
    </div>
  `;
    document.body.appendChild(panel);

    const messagesEl = document.getElementById('aw-messages');
    const statusEl = document.getElementById('aw-status');
    const micBtn = document.getElementById('aw-mic');
    const closeBtn = document.getElementById('aw-close');
    const textInput = document.getElementById('aw-text-input');
    const textSend = document.getElementById('aw-text-send');

    // ─── State ──────────────────────────────────────────
    let liveService = null;
    let isConnected = false;
    let isConnecting = false;
    let agentConfig = null;

    // Transcript accumulators
    let userTranscript = '';
    let agentTranscript = '';

    // ─── Events ─────────────────────────────────────────
    fab.addEventListener('click', () => {
        panel.classList.toggle('open');
        fab.innerHTML = panel.classList.contains('open') ? '✕' : '🎤';
    });

    closeBtn.addEventListener('click', () => {
        panel.classList.remove('open');
        fab.innerHTML = '🎤';
    });

    micBtn.addEventListener('click', toggleCall);

    textSend.addEventListener('click', sendTextMessage);
    textInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') sendTextMessage();
    });

    // ─── Helper Functions ───────────────────────────────
    function addMsg(role, text) {
        const div = document.createElement('div');
        div.className = `aw-msg aw-msg-${role}`;
        div.textContent = text;
        messagesEl.appendChild(div);
        messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    // Update last message of a specific role
    function updateLastMsg(role, text) {
        const msgs = messagesEl.getElementsByClassName(`aw-msg-${role}`);
        if (msgs.length > 0) {
            msgs[msgs.length - 1].textContent = text;
            messagesEl.scrollTop = messagesEl.scrollHeight;
        } else {
            addMsg(role, text);
        }
    }

    async function fetchAgentConfig() {
        try {
            const res = await fetch(`${SERVER_URL}/api/agents/public/${AGENT_ID}`);
            if (!res.ok) throw new Error('Failed to fetch agent config');
            return await res.json();
        } catch (err) {
            console.error('[AgentWidget] Error fetching agent config:', err);
            return {
                id: AGENT_ID,
                name: TITLE,
                role: 'Assistant',
                system_prompt: '',
                voice_id: 'Puck'
            };
        }
    }

    // ─── Core Logic (Live API) ──────────────────────────
    async function toggleCall() {
        if (isConnected) {
            endCall();
            return;
        }

        if (isConnecting) return;

        startCall();
    }

    async function startCall() {
        isConnecting = true;
        micBtn.innerHTML = '⏳';
        statusEl.textContent = 'Connecting...';

        if (!agentConfig) {
            agentConfig = await fetchAgentConfig();
        }

        liveService = new LiveAudioService();

        const success = await liveService.connect(agentConfig, {
            onOpen: () => {
                isConnected = true;
                isConnecting = false;
                micBtn.innerHTML = '⏹️';
                micBtn.classList.add('recording');
                statusEl.textContent = '🟢 Live — Listening...';
                addMsg('system', `Connected to ${agentConfig.name}`);
                userTranscript = '';
                agentTranscript = '';
            },
            onClose: () => {
                isConnected = false;
                isConnecting = false;
                micBtn.innerHTML = '🎤';
                micBtn.classList.remove('recording');
                statusEl.textContent = 'Call ended';
                addMsg('system', 'Call disconnected');
                liveService = null;
            },
            onError: (e) => {
                console.error('[AgentWidget] Error:', e);
                isConnected = false;
                isConnecting = false;
                micBtn.innerHTML = '🎤';
                micBtn.classList.remove('recording');
                statusEl.textContent = 'Error';
                addMsg('system', `⚠️ ${e?.message || 'Connection error'}`);
                liveService = null;
            },
            onInterrupted: () => {
                statusEl.textContent = '⚡ Interrupted — Listening...';
            },
            onTranscription: (text, isUser) => {
                if (!text || !text.trim()) return;

                if (isUser) {
                    if (userTranscript === '') {
                        userTranscript = text;
                        addMsg('user', `🎤 ${text}`);
                    } else {
                        userTranscript += text;
                        updateLastMsg('user', `🎤 ${userTranscript}`);
                    }
                    agentTranscript = '';
                    statusEl.textContent = '🟢 Listening...';
                } else {
                    if (agentTranscript === '') {
                        agentTranscript = text;
                        addMsg('agent', text);
                    } else {
                        agentTranscript += text;
                        updateLastMsg('agent', agentTranscript);
                    }
                    userTranscript = '';
                    statusEl.textContent = '🗣️ Agent speaking...';
                }
            }
        });

        if (!success) {
            isConnecting = false;
            micBtn.innerHTML = '🎤';
            statusEl.textContent = 'Connection failed';
        }
    }

    function endCall() {
        if (liveService) {
            liveService.disconnect();
            liveService = null;
        }
    }

    async function sendTextMessage() {
        const text = textInput.value.trim();
        if (!text) return;
        textInput.value = '';

        if (isConnected && liveService) {
            addMsg('user', text);
            liveService.sendText(text);
            statusEl.textContent = 'Thinking...';
        } else {
            // REST Fallback setup
            addMsg('user', text);
            statusEl.textContent = 'Thinking...';
            try {
                const res = await fetch(`${SERVER_URL}/api/agents/${AGENT_ID}/chat`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: text }),
                });
                const data = await res.json();
                addMsg('agent', data.response);
                statusEl.textContent = 'Agent responded';
            } catch (err) {
                addMsg('system', '⚠️ ' + err.message);
                statusEl.textContent = 'Error';
            }
        }
    }

    console.log('[AgentWidget] 🎉 Widget initialized (Live API mode)!');
})();
