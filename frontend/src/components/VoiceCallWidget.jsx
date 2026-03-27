import { useState, useEffect, useRef } from 'react';
import { agentsAPI } from '../api';
import { LiveAudioService } from '../services/liveAudioService';

/* ─── Waveform bars (decorative animation during call) ──────── */
function AudioWave({ active }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3, height: 28 }}>
      {[1, 2, 3, 4, 5, 6, 7].map(i => (
        <div key={i} style={{
          width: 3, borderRadius: 99,
          background: active ? 'var(--accent)' : 'var(--text-muted)',
          height: active ? `${Math.random() > 0.5 ? 100 : 50}%` : '30%',
          animation: active ? `dot-pulse ${0.5 + i * 0.1}s ease-in-out infinite alternate` : 'none',
          transition: 'background .3s, height .3s',
        }} />
      ))}
    </div>
  );
}

/* ─── Call Button ────────────────────────────────────────────── */
function CallButton({ state, onClick }) {
  const isIdle        = state === 'idle';
  const isConnecting  = state === 'connecting';
  const isActive      = state === 'active';

  const bg = isActive
    ? 'linear-gradient(135deg, var(--danger), #c0392b)'
    : 'linear-gradient(135deg, var(--accent), #6055e8)';

  const iconPath = isActive
    // hang-up icon
    ? 'M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z'
    // phone icon
    : 'M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z';

  return (
    <button
      onClick={onClick}
      disabled={isConnecting}
      style={{
        width: 72, height: 72, borderRadius: '50%',
        background: isConnecting ? 'var(--bg-elevated)' : bg,
        border: 'none', cursor: isConnecting ? 'not-allowed' : 'pointer',
        display: 'grid', placeItems: 'center',
        boxShadow: isActive
          ? '0 0 0 0 rgba(244,63,94,0.3)'
          : isIdle ? '0 0 0 0 var(--accent-glow)' : 'none',
        animation: !isConnecting ? 'pulse-glow 2.5s ease-in-out infinite' : 'none',
        transition: 'all var(--t-smooth)',
        transform: 'scale(1)',
        flexShrink: 0,
      }}
    >
      {isConnecting ? (
        <div className="spinner" style={{ width: 24, height: 24, borderWidth: 2 }} />
      ) : (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="white"
          style={{ transform: isActive ? 'rotate(135deg)' : 'none', transition: 'transform .4s ease' }}>
          <path d={iconPath} />
        </svg>
      )}
    </button>
  );
}

/* ─── Chat Bubble ────────────────────────────────────────────── */
function Bubble({ msg }) {
  const isUser   = msg.role === 'user';
  const isSystem = msg.role === 'system';

  if (isSystem) return (
    <div style={{
      alignSelf: 'center', fontSize: '0.72rem', fontWeight: 500,
      color: 'var(--text-muted)', padding: '4px 12px',
      background: 'var(--bg-elevated)', borderRadius: 'var(--r-pill)',
      border: '1px solid var(--border)', margin: '4px 0',
    }}>
      {msg.text}
    </div>
  );

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: isUser ? 'flex-end' : 'flex-start',
      gap: 3,
    }}>
      <div style={{
        fontSize: '0.63rem', fontWeight: 600,
        color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.07em',
        paddingInline: 4,
      }}>
        {isUser ? 'You' : 'AI Agent'}
      </div>
      <div style={{
        maxWidth: '80%', padding: '10px 14px',
        borderRadius: isUser ? 'var(--r-lg) var(--r-lg) 4px var(--r-lg)' : 'var(--r-lg) var(--r-lg) var(--r-lg) 4px',
        fontSize: '0.87rem', lineHeight: 1.55,
        background: isUser ? 'var(--accent-soft)' : 'var(--bg-elevated)',
        color: 'var(--text-primary)',
        border: `1px solid ${isUser ? 'var(--border-accent)' : 'var(--border)'}`,
        animation: 'scaleIn .2s ease-out',
      }}>
        {msg.text}
      </div>
    </div>
  );
}

/* ─── Main Widget ─────────────────────────────────────────────── */
export default function VoiceCallWidget({ agentId, agentName, agent }) {
  const [connected,   setConnected]   = useState(false);
  const [connecting,  setConnecting]  = useState(false);
  const [muted,       setMuted]       = useState(false);
  const [mode,        setMode]        = useState('chat');
  const [messages,    setMessages]    = useState([]);
  const [status,      setStatus]      = useState('');
  const [textInput,   setTextInput]   = useState('');
  const [isSpeaking,  setIsSpeaking]  = useState(false);  // for waveform

  const liveRef      = useRef(null);
  const endRef       = useRef(null);
  const userTxRef    = useRef('');
  const agentTxRef   = useRef('');
  const debounceRef  = useRef(null);

  const callState = connecting ? 'connecting' : connected ? 'active' : 'idle';

  useEffect(() => () => { liveRef.current?.disconnect(); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  function setStatusD(s) {
    clearTimeout(debounceRef.current);
    const transient = ['Thinking', 'Processing', 'Listening', 'Speaking'].some(t => s?.includes(t));
    if (!transient) { setStatus(s); return; }
    debounceRef.current = setTimeout(() => setStatus(s), 150);
  }

  function addMsg(role, text) { setMessages(p => [...p, { role, text }]); }
  function updateLast(role, text) {
    setMessages(p => {
      const idx = [...p].reverse().findIndex(m => m.role === role);
      if (idx === -1) return [...p, { role, text }];
      const i = p.length - 1 - idx;
      return p.map((m, j) => j === i ? { ...m, text } : m);
    });
  }

  async function startCall() {
    if (connected || connecting) return;
    setConnecting(true); setStatusD('Connecting…'); setMessages([]);
    userTxRef.current = ''; agentTxRef.current = '';

    const svc = new LiveAudioService();
    liveRef.current = svc;

    const success = await svc.connect(
      agent || { name: agentName, role: 'Support', system_prompt: '', voice_id: 'Puck' },
      {
        onOpen: () => {
          setConnected(true); setConnecting(false); setStatusD('Ready — speak now');
          addMsg('system', `Connected to ${agentName}`);
        },
        onClose: () => {
          setConnected(false); setConnecting(false); setMuted(false);
          setIsSpeaking(false); setStatusD('Call ended');
          addMsg('system', 'Disconnected');
        },
        onError: e => {
          setConnected(false); setConnecting(false); setIsSpeaking(false);
          setStatusD(`Error: ${e?.message || 'Unknown'}`);
          addMsg('system', `⚠️ ${e?.message}`);
        },
        onInterrupted: () => { setStatusD('Interrupted'); setIsSpeaking(false); },
        onTurnComplete: () => { setStatusD('Listening…'); setIsSpeaking(false); },
        onTranscription: (text, isUser) => {
          if (!text?.trim() || mode !== 'chat') return;
          if (isUser) {
            if (!userTxRef.current) { userTxRef.current = text; addMsg('user', text); }
            else { userTxRef.current += text; updateLast('user', userTxRef.current); }
            agentTxRef.current = ''; setStatusD('Processing…');
          } else {
            setIsSpeaking(true);
            if (!agentTxRef.current) { agentTxRef.current = text; addMsg('agent', text); }
            else { agentTxRef.current += text; updateLast('agent', agentTxRef.current); }
            userTxRef.current = ''; setStatusD('Agent speaking…');
          }
        },
      },
      { mode, recordingEnabled: true, callerId: null }
    );

    if (!success) { setConnecting(false); setStatusD('Connection failed'); }
  }

  function endCall() {
    liveRef.current?.disconnect(); liveRef.current = null;
    setConnected(false); setConnecting(false); setMuted(false); setIsSpeaking(false);
  }

  function toggleMute() {
    if (!liveRef.current) return;
    const m = liveRef.current.toggleMute();
    setMuted(m); setStatusD(m ? 'Muted' : 'Unmuted');
  }

  async function handleSend(e) {
    e.preventDefault();
    const msg = textInput.trim(); if (!msg) return;
    setTextInput(''); addMsg('user', msg);
    if (connected && liveRef.current) {
      liveRef.current.sendText(msg); setStatusD('Processing…');
    } else {
      setStatusD('Thinking…');
      try {
        const r = await agentsAPI.chat(agentId, msg);
        addMsg('agent', r.response); setStatusD('Ready');
      } catch (err) {
        addMsg('system', `⚠️ ${err.message}`); setStatusD('Error');
      }
    }
  }

  const statusDot = connected ? '#22d3a0' : connecting ? '#fbbf24' : '#4f5872';

  return (
    <div style={{
      maxWidth: 660, margin: '0 auto',
      display: 'flex', flexDirection: 'column', gap: 'var(--space-md)',
      animation: 'pageEnter .35s ease-out',
    }}>

      {/* ── Top control bar ── */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 'var(--r-lg)', padding: 'var(--space-md) var(--space-lg)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      }}>
        {/* Status + waveform */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Live dot */}
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: statusDot,
            boxShadow: connected ? '0 0 10px rgba(34,211,160,0.6)' : 'none',
            transition: 'all .4s',
            flexShrink: 0,
          }} />
          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            {status || (connected ? 'Live' : connecting ? 'Connecting…' : 'Ready')}
          </span>
          {(connected || isSpeaking) && <AudioWave active={isSpeaking} />}
        </div>

        {/* Controls on right */}
        <div style={{ display: 'flex', align: 'center', gap: 8 }}>
          {/* Mode pills — only when not connected */}
          {!connected && (
            <div className="view-toggle">
              <button className={`view-toggle-btn ${mode === 'voice' ? 'active' : ''}`}
                onClick={() => setMode('voice')} disabled={connecting}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: 4 }}><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                Voice
              </button>
              <button className={`view-toggle-btn ${mode === 'chat' ? 'active' : ''}`}
                onClick={() => setMode('chat')} disabled={connecting}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: 4 }}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                Chat
              </button>
            </div>
          )}

          {/* Mute button — during call */}
          {connected && (
            <button
              onClick={toggleMute}
              className={`btn btn-sm ${muted ? 'btn-danger' : 'btn-secondary'}`}
              title={muted ? 'Unmute' : 'Mute'}
              style={{ width: 36, height: 36, padding: 0, borderRadius: '50%' }}
            >
              {muted ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23" stroke="currentColor" strokeWidth="2"/></svg>
              )}
            </button>
          )}
        </div>
      </div>

      {/* ── Main call area ── */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 'var(--r-lg)', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        minHeight: 420,
      }}>

        {/* Messages / Empty state */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-lg)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {messages.length === 0 && (
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: 16, padding: 'var(--space-xl) 0', textAlign: 'center',
            }}>
              {/* Big call button in center while idle */}
              <div style={{ position: 'relative' }}>
                {/* Ripple rings */}
                {[1, 2].map(r => (
                  <div key={r} style={{
                    position: 'absolute', inset: -r * 16,
                    borderRadius: '50%',
                    border: '1px solid var(--accent)',
                    opacity: 0.15 / r,
                    animation: `pulse-glow ${1.5 + r * 0.5}s ease-in-out infinite`,
                  }} />
                ))}
                <CallButton state={callState} onClick={callState === 'idle' ? startCall : endCall} />
              </div>

              {mode === 'chat' ? (
                <>
                  <p style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Start a conversation
                  </p>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', maxWidth: 260, lineHeight: 1.5 }}>
                    Click the button to call, or type a message below to chat without audio.
                  </p>
                </>
              ) : (
                <>
                  <p style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Voice mode
                  </p>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', maxWidth: 260, lineHeight: 1.5 }}>
                    Click the button to start a live voice call with your agent.
                  </p>
                </>
              )}
            </div>
          )}

          {messages.length > 0 && messages.map((msg, i) => <Bubble key={i} msg={msg} />)}
          <div ref={endRef} />
        </div>

        {/* ── Bottom bar: call btn + text input ── */}
        <div style={{
          padding: 'var(--space-sm) var(--space-md)',
          borderTop: '1px solid var(--border)',
          background: 'var(--bg-elevated)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          {/* Call / End button (small when messages exist) */}
          {messages.length > 0 && (
            <button
              onClick={callState === 'idle' ? startCall : endCall}
              disabled={connecting}
              title={connected ? 'End call' : 'Start call'}
              style={{
                width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                background: connected
                  ? 'linear-gradient(135deg, var(--danger), #c0392b)'
                  : 'linear-gradient(135deg, var(--accent), #6055e8)',
                border: 'none', cursor: 'pointer',
                display: 'grid', placeItems: 'center',
                boxShadow: connected ? 'none' : '0 2px 10px var(--accent-glow)',
                transition: 'all var(--t-fast)',
                opacity: connecting ? 0.6 : 1,
              }}
            >
              {connecting ? (
                <div className="spinner spinner-sm" style={{ width: 16, height: 16, borderTopColor: '#fff' }} />
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="white"
                  style={{ transform: connected ? 'rotate(135deg)' : 'none', transition: 'transform .4s' }}>
                  <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" />
                </svg>
              )}
            </button>
          )}

          {/* Text input — chat mode */}
          {mode === 'chat' && (
            <form onSubmit={handleSend} style={{ flex: 1, display: 'flex', gap: 8 }}>
              <input
                value={textInput}
                onChange={e => setTextInput(e.target.value)}
                placeholder={connected ? 'Type a message…' : 'Type to chat without calling…'}
                style={{
                  flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border)',
                  borderRadius: 'var(--r-pill)', padding: '9px 16px',
                  color: 'var(--text-primary)', fontSize: '0.87rem', outline: 'none',
                  transition: 'border-color var(--t-fast)',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
              <button type="submit" className="btn btn-primary btn-sm"
                style={{ borderRadius: 'var(--r-pill)', paddingInline: 18 }}
                disabled={!textInput.trim()}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z"/></svg>
                Send
              </button>
            </form>
          )}

          {/* Voice mode info when active */}
          {mode === 'voice' && connected && (
            <div style={{ flex: 1, fontSize: '0.82rem', color: 'var(--text-muted)', textAlign: 'center' }}>
              Voice call active — speak naturally
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
