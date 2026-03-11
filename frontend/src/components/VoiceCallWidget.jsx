// // import { useState, useEffect, useRef } from 'react';
// // import { agentsAPI } from '../api';
// // import { LiveAudioService } from '../services/liveAudioService';

// // export default function VoiceCallWidget({ agentId, agentName, agent }) {
// //     const [connected, setConnected] = useState(false);
// //     const [connecting, setConnecting] = useState(false);
// //     const [muted, setMuted] = useState(false);
// //     const [messages, setMessages] = useState([]);
// //     const [status, setStatus] = useState('Click the phone button to start a live voice call');
// //     const [textInput, setTextInput] = useState('');
// //     const liveServiceRef = useRef(null);
// //     const messagesEndRef = useRef(null);
// //     // Track partial transcriptions for accumulation
// //     const userTranscriptRef = useRef('');
// //     const agentTranscriptRef = useRef('');

// //     useEffect(() => {
// //         return () => {
// //             if (liveServiceRef.current) {
// //                 liveServiceRef.current.disconnect();
// //             }
// //         };
// //     }, []);

// //     useEffect(() => {
// //         messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
// //     }, [messages]);

// //     function addMessage(role, text) {
// //         setMessages(prev => [...prev, { role, text, time: new Date() }]);
// //     }

// //     // Update last message of a specific role (for streaming transcripts)
// //     function updateLastMessage(role, text) {
// //         setMessages(prev => {
// //             const lastIdx = [...prev].reverse().findIndex(m => m.role === role);
// //             if (lastIdx === -1) {
// //                 return [...prev, { role, text, time: new Date() }];
// //             }
// //             const actualIdx = prev.length - 1 - lastIdx;
// //             const updated = [...prev];
// //             updated[actualIdx] = { ...updated[actualIdx], text };
// //             return updated;
// //         });
// //     }

// //     async function startCall() {
// //         if (connected || connecting) return;
// //         setConnecting(true);
// //         setStatus('Connecting to AI...');

// //         const service = new LiveAudioService();
// //         liveServiceRef.current = service;

// //         // Build agent config from props
// //         const agentConfig = agent || {
// //             name: agentName,
// //             role: 'Customer Support',
// //             system_prompt: '',
// //             voice_id: 'Puck',
// //         };

// //         const success = await service.connect(agentConfig, {
// //             onOpen: () => {
// //                 setConnected(true);
// //                 setConnecting(false);
// //                 setStatus('🟢 Live — Speak naturally, the AI is listening');
// //                 addMessage('system', `Connected to ${agentName}. Start speaking!`);
// //                 // Reset transcript accumulators
// //                 userTranscriptRef.current = '';
// //                 agentTranscriptRef.current = '';
// //             },
// //             onClose: () => {
// //                 setConnected(false);
// //                 setConnecting(false);
// //                 setMuted(false);
// //                 setStatus('Call ended. Click phone to start again.');
// //                 addMessage('system', 'Call disconnected');
// //             },
// //             onError: (e) => {
// //                 console.error('Voice error:', e);
// //                 setConnected(false);
// //                 setConnecting(false);
// //                 setStatus(`Error: ${e?.message || 'Connection failed'}`);
// //                 addMessage('system', `⚠️ ${e?.message || 'Connection error'}`);
// //             },
// //             onInterrupted: () => {
// //                 setStatus('⚡ Interrupted — listening to you...');
// //             },
// //             onTranscription: (text, isUser) => {
// //                 if (!text || !text.trim()) return;

// //                 if (isUser) {
// //                     if (userTranscriptRef.current === '') {
// //                         // New user turn
// //                         userTranscriptRef.current = text;
// //                         addMessage('user', `🎤 ${text}`);
// //                     } else {
// //                         userTranscriptRef.current += text;
// //                         updateLastMessage('user', `🎤 ${userTranscriptRef.current}`);
// //                     }
// //                     // Reset agent transcript for next agent turn
// //                     agentTranscriptRef.current = '';
// //                     setStatus('🟢 Listening...');
// //                 } else {
// //                     if (agentTranscriptRef.current === '') {
// //                         // New agent response
// //                         agentTranscriptRef.current = text;
// //                         addMessage('agent', text);
// //                     } else {
// //                         agentTranscriptRef.current += text;
// //                         updateLastMessage('agent', agentTranscriptRef.current);
// //                     }
// //                     // Reset user transcript for next user turn
// //                     userTranscriptRef.current = '';
// //                     setStatus('🗣️ Agent speaking...');
// //                 }
// //             },
// //         });

// //         if (!success) {
// //             setConnecting(false);
// //             setStatus('Failed to connect. Check your API key.');
// //         }
// //     }

// //     function endCall() {
// //         if (liveServiceRef.current) {
// //             liveServiceRef.current.disconnect();
// //             liveServiceRef.current = null;
// //         }
// //         setConnected(false);
// //         setConnecting(false);
// //         setMuted(false);
// //         setStatus('Call ended.');
// //     }

// //     function toggleMute() {
// //         if (liveServiceRef.current) {
// //             const nowMuted = liveServiceRef.current.toggleMute();
// //             setMuted(nowMuted);
// //             setStatus(nowMuted ? '🔇 Microphone muted' : '🟢 Microphone unmuted — listening');
// //         }
// //     }

// //     async function handleTextSubmit(e) {
// //         e.preventDefault();
// //         if (!textInput.trim()) return;

// //         const msg = textInput.trim();
// //         setTextInput('');

// //         if (connected && liveServiceRef.current) {
// //             // Send text through Live API session (will get audio response)
// //             addMessage('user', msg);
// //             liveServiceRef.current.sendText(msg);
// //             setStatus('Thinking...');
// //         } else {
// //             // Fallback: use REST API for text chat when not in a call
// //             addMessage('user', msg);
// //             setStatus('Thinking...');
// //             try {
// //                 const response = await agentsAPI.chat(agentId, msg);
// //                 addMessage('agent', response.response);
// //                 setStatus('Agent responded. Type another message or start a call.');
// //             } catch (err) {
// //                 addMessage('system', `⚠️ ${err.message}`);
// //                 setStatus('Error getting response');
// //             }
// //         }
// //     }

// //     return (
// //         <div className="voice-widget" style={{ maxWidth: 600 }}>
// //             <div className="voice-widget-header">
// //                 <div>
// //                     <h3 style={{ fontSize: 'var(--font-base)', fontWeight: 700 }}>
// //                         🧪 Test Call — {agentName}
// //                     </h3>
// //                     <span className={`badge ${connected ? 'badge-success' : connecting ? 'badge-warning' : 'badge-warning'}`} style={{ marginTop: 4 }}>
// //                         {connected ? '🟢 Live' : connecting ? '🟡 Connecting...' : '⚪ Disconnected'}
// //                     </span>
// //                 </div>
// //                 {connected && (
// //                     <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
// //                         <button
// //                             className={`btn btn-sm ${muted ? 'btn-warning' : 'btn-secondary'}`}
// //                             onClick={toggleMute}
// //                             title={muted ? 'Unmute' : 'Mute'}
// //                         >
// //                             {muted ? '🔇 Muted' : '🎤 Mic On'}
// //                         </button>
// //                         <button className="btn btn-danger btn-sm" onClick={endCall}>
// //                             📞 End Call
// //                         </button>
// //                     </div>
// //                 )}
// //             </div>

// //             <div className="voice-widget-body">
// //                 <div className="voice-widget-messages">
// //                     {messages.length === 0 && (
// //                         <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 'var(--space-xl)' }}>
// //                             <div style={{ fontSize: '2rem', marginBottom: 'var(--space-md)' }}>🎙️</div>
// //                             <p>Start a live voice call or type a message below</p>
// //                             <p style={{ fontSize: 'var(--font-xs)', marginTop: 'var(--space-sm)' }}>
// //                                 Voice calls use Gemini Live API with real-time audio
// //                             </p>
// //                         </div>
// //                     )}
// //                     {messages.map((msg, i) => (
// //                         <div
// //                             key={i}
// //                             className={`voice-message ${msg.role === 'user' ? 'user' : 'agent'}`}
// //                             style={msg.role === 'system' ? {
// //                                 alignSelf: 'center',
// //                                 background: 'rgba(108, 99, 255, 0.1)',
// //                                 border: '1px solid var(--border-color)',
// //                                 fontSize: 'var(--font-xs)',
// //                                 color: 'var(--text-secondary)',
// //                                 maxWidth: '100%',
// //                             } : {}}
// //                         >
// //                             {msg.text}
// //                         </div>
// //                     ))}
// //                     <div ref={messagesEndRef} />
// //                 </div>

// //                 <div className="voice-status">{status}</div>

// //                 <div className="voice-controls">
// //                     {!connected && !connecting && (
// //                         <button
// //                             className="mic-btn"
// //                             onClick={startCall}
// //                             title="Start voice call"
// //                             style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
// //                         >
// //                             📞
// //                         </button>
// //                     )}
// //                     {connecting && (
// //                         <button className="mic-btn" disabled style={{ opacity: 0.6 }}>
// //                             ⏳
// //                         </button>
// //                     )}
// //                 </div>

// //                 <form className="voice-text-input" onSubmit={handleTextSubmit}>
// //                     <input
// //                         value={textInput}
// //                         onChange={e => setTextInput(e.target.value)}
// //                         placeholder={connected ? "Type during call..." : "Type a message (no call)..."}
// //                     />
// //                     <button type="submit" className="btn btn-primary btn-sm">Send</button>
// //                 </form>
// //             </div>
// //         </div>
// //     );
// // }


// import { useState, useEffect, useRef, useCallback } from 'react';
// import { agentsAPI } from '../api';
// import { LiveAudioService } from '../services/liveAudioService';

// // ─── Ring tone via Web Audio API ──────────────────────────────────────────────
// function useRingTone() {
//     const ctxRef = useRef(null);
//     const timersRef = useRef([]);

//     const start = useCallback(() => {
//         stop();
//         const AudioCtx = window.AudioContext || window.webkitAudioContext;
//         if (!AudioCtx) return;
//         const ctx = new AudioCtx();
//         ctxRef.current = ctx;
//         function ring() {
//             if (!ctxRef.current) return;
//             const now = ctx.currentTime;
//             [480, 440].forEach(freq => {
//                 const osc = ctx.createOscillator();
//                 const gain = ctx.createGain();
//                 osc.connect(gain); gain.connect(ctx.destination);
//                 osc.frequency.value = freq; osc.type = 'sine';
//                 gain.gain.setValueAtTime(0, now);
//                 gain.gain.linearRampToValueAtTime(0.14, now + 0.05);
//                 gain.gain.setValueAtTime(0.14, now + 0.4);
//                 gain.gain.linearRampToValueAtTime(0, now + 0.45);
//                 gain.gain.setValueAtTime(0, now + 0.62);
//                 gain.gain.linearRampToValueAtTime(0.14, now + 0.67);
//                 gain.gain.setValueAtTime(0.14, now + 1.05);
//                 gain.gain.linearRampToValueAtTime(0, now + 1.1);
//                 osc.start(now); osc.stop(now + 1.15);
//             });
//             timersRef.current.push(setTimeout(ring, 2400));
//         }
//         ring();
//     }, []);

//     const stop = useCallback(() => {
//         timersRef.current.forEach(clearTimeout); timersRef.current = [];
//         if (ctxRef.current) { try { ctxRef.current.close(); } catch (_) {} ctxRef.current = null; }
//     }, []);

//     useEffect(() => () => stop(), [stop]);
//     return { start, stop };
// }

// // ─── Agent Decision Panel ─────────────────────────────────────────────────────
// function AgentDecisionPanel({ decision, onClose }) {
//     if (!decision) return null;
//     const sentColor = { positive: '#22c55e', neutral: '#94a3b8', negative: '#ef4444', mixed: '#f59e0b' }[decision.sentiment] || '#94a3b8';
//     return (
//         <div style={{ background: 'rgba(108,99,255,0.07)', border: '1px solid rgba(108,99,255,0.2)', borderRadius: 10, padding: '10px 14px', marginBottom: 8, fontSize: 11, position: 'relative' }}>
//             <button onClick={onClose} style={{ position: 'absolute', top: 6, right: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 13 }}>✕</button>
//             <div style={{ fontWeight: 700, color: '#6c63ff', marginBottom: 6, fontSize: 12 }}>🤖 Multi-Agent Decision</div>
//             <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
//                 {[
//                     ['Intent', decision.intent, '#6c63ff'],
//                     ['Mood', decision.sentiment, sentColor],
//                     ['Lang', decision.language_hint?.replace(/_/g, ' '), '#0ea5e9'],
//                     ['Confidence', Math.round((decision.confidence || 0) * 100) + '%', '#f59e0b'],
//                 ].map(([label, val, color]) => val && (
//                     <span key={label} style={{ background: color + '18', color, borderRadius: 6, padding: '2px 8px', fontWeight: 600 }}>
//                         {label}: {val}
//                     </span>
//                 ))}
//                 {decision.rag_used && <span style={{ background: '#22c55e18', color: '#22c55e', borderRadius: 6, padding: '2px 8px', fontWeight: 600 }}>📚 RAG</span>}
//                 {decision.should_escalate && <span style={{ background: '#ef444418', color: '#ef4444', borderRadius: 6, padding: '2px 8px', fontWeight: 700 }}>⚠️ Escalate</span>}
//             </div>
//             {decision.agents_invoked?.length > 0 && (
//                 <div style={{ marginTop: 5, color: '#64748b', fontSize: 10 }}>{decision.agents_invoked.join(' → ')}</div>
//             )}
//         </div>
//     );
// }

// // ─── Waveform visualiser (live mic levels) ────────────────────────────────────
// function WaveBar({ active }) {
//     const bars = [0.4, 0.7, 1.0, 0.8, 0.5, 0.9, 0.6, 1.0, 0.7, 0.4];
//     return (
//         <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 24 }}>
//             {bars.map((h, i) => (
//                 <div key={i} style={{
//                     width: 3, borderRadius: 2,
//                     background: active ? '#ef4444' : '#94a3b8',
//                     height: active ? `${h * 100}%` : '20%',
//                     transition: 'height 0.15s ease',
//                     animation: active ? `wave-bar ${0.4 + i * 0.07}s ease-in-out infinite alternate` : 'none',
//                 }} />
//             ))}
//         </div>
//     );
// }

// // ─── Main Widget ──────────────────────────────────────────────────────────────
// export default function VoiceCallWidget({ agentId, agentName, agent }) {
//     const [phase, setPhase] = useState('idle'); // idle | ringing | connected | agent_speaking | listening
//     const [connected, setConnected] = useState(false);
//     const [connecting, setConnecting] = useState(false);
//     const [muted, setMuted] = useState(false);
//     const [messages, setMessages] = useState([]);
//     const [status, setStatus] = useState('Click 📞 to start a live voice call');
//     const [textInput, setTextInput] = useState('');
//     const [lastDecision, setLastDecision] = useState(null);
//     const [showDecision, setShowDecision] = useState(false);

//     const liveServiceRef = useRef(null);
//     const messagesEndRef = useRef(null);
//     const userTranscriptRef = useRef('');
//     const agentTranscriptRef = useRef('');
//     const ringingTimerRef = useRef(null);
//     const ringTone = useRingTone();

//     useEffect(() => () => { endCall(); }, []);
//     useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

//     function addMessage(role, text) {
//         setMessages(prev => [...prev, { role, text, id: Date.now() + Math.random() }]);
//     }

//     function updateLastMessage(role, text) {
//         setMessages(prev => {
//             const lastIdx = [...prev].reverse().findIndex(m => m.role === role);
//             if (lastIdx === -1) return [...prev, { role, text, id: Date.now() }];
//             const actualIdx = prev.length - 1 - lastIdx;
//             const updated = [...prev];
//             updated[actualIdx] = { ...updated[actualIdx], text };
//             return updated;
//         });
//     }

//     // ── Start call: ring then connect ─────────────────────────────────────────
//     async function startCall() {
//         if (connected || connecting) return;

//         // Ring first
//         setPhase('ringing');
//         ringTone.start();
//         setStatus('📳 Ringing...');

//         ringingTimerRef.current = setTimeout(async () => {
//             ringTone.stop();
//             setConnecting(true);
//             setPhase('connecting');
//             setStatus('Connecting to Gemini Live...');

//             const service = new LiveAudioService();
//             liveServiceRef.current = service;

//             const agentConfig = agent || { name: agentName, role: 'Customer Support', system_prompt: '', voice_id: 'Puck' };

//             const success = await service.connect(agentConfig, {
//                 onOpen: () => {
//                     setConnected(true);
//                     setConnecting(false);
//                     setPhase('agent_speaking');
//                     setStatus(`🔊 ${agentName} is greeting you...`);
//                     addMessage('system', `📞 Connected to ${agentName}. Agent is speaking first...`);
//                     userTranscriptRef.current = '';
//                     agentTranscriptRef.current = '';
//                 },

//                 onClose: () => {
//                     setConnected(false);
//                     setConnecting(false);
//                     setMuted(false);
//                     setPhase('idle');
//                     setStatus('Call ended. Click 📞 to call again.');
//                     addMessage('system', '📞 Call ended');
//                 },

//                 onError: (e) => {
//                     console.error('Live voice error:', e);
//                     setConnected(false);
//                     setConnecting(false);
//                     setPhase('idle');
//                     const msg = e?.message || 'Connection failed';
//                     setStatus(`⚠️ ${msg}`);
//                     addMessage('system', `⚠️ ${msg}`);
//                 },

//                 onInterrupted: () => {
//                     agentTranscriptRef.current = '';
//                     setPhase('listening');
//                     setStatus('🎤 Listening — speak naturally...');
//                 },

//                 onTranscription: (text, isUser) => {
//                     if (!text?.trim()) return;

//                     if (isUser) {
//                         // Accumulate user speech transcript
//                         if (userTranscriptRef.current === '') {
//                             userTranscriptRef.current = text;
//                             addMessage('user', `🎤 ${text}`);
//                         } else {
//                             userTranscriptRef.current += ' ' + text;
//                             updateLastMessage('user', `🎤 ${userTranscriptRef.current}`);
//                         }
//                         agentTranscriptRef.current = '';
//                         setPhase('listening');
//                         setStatus('🎤 Listening...');
//                     } else {
//                         // Accumulate agent response transcript
//                         if (agentTranscriptRef.current === '') {
//                             agentTranscriptRef.current = text;
//                             addMessage('agent', text);
//                         } else {
//                             agentTranscriptRef.current += text;
//                             updateLastMessage('agent', agentTranscriptRef.current);
//                         }
//                         userTranscriptRef.current = '';
//                         setPhase('agent_speaking');
//                         setStatus(`🔊 ${agentName} is speaking...`);
//                     }
//                 },
//             });

//             if (!success) {
//                 setConnecting(false);
//                 setPhase('idle');
//                 setStatus('❌ Failed to connect. Check your Gemini API key supports Live API.');
//             }
//         }, 2000); // 2s ring
//     }

//     function endCall() {
//         ringTone.stop();
//         clearTimeout(ringingTimerRef.current);
//         if (liveServiceRef.current) {
//             liveServiceRef.current.disconnect();
//             liveServiceRef.current = null;
//         }
//         setConnected(false);
//         setConnecting(false);
//         setMuted(false);
//         setPhase('idle');
//         setStatus('Call ended. Click 📞 to call again.');
//     }

//     function toggleMute() {
//         if (!liveServiceRef.current) return;
//         const nowMuted = liveServiceRef.current.toggleMute();
//         setMuted(nowMuted);
//         setStatus(nowMuted ? '🔇 Microphone muted — agent can still speak' : '🎤 Microphone unmuted — listening');
//     }

//     async function handleTextSubmit(e) {
//         e.preventDefault();
//         if (!textInput.trim()) return;
//         const msg = textInput.trim();
//         setTextInput('');
//         addMessage('user', msg);

//         if (connected && liveServiceRef.current) {
//             // Send through live session — will get real-time audio response
//             liveServiceRef.current.sendText(msg);
//             setStatus('Thinking...');
//         } else {
//             // REST fallback when not in a live call
//             setStatus('Thinking...');
//             try {
//                 const response = await agentsAPI.chat(agentId, msg);
//                 addMessage('agent', response.response);
//                 if (response.intent) {
//                     setLastDecision(response);
//                     setShowDecision(true);
//                 }
//                 setStatus('Done. Click 📞 to start a live call.');
//             } catch (err) {
//                 addMessage('system', `⚠️ ${err.message}`);
//                 setStatus('Error getting response');
//             }
//         }
//     }

//     // ── Render ────────────────────────────────────────────────────────────────
//     const isActive = connected || connecting || phase === 'ringing';

//     const phaseConfig = {
//         idle:          { bg: 'linear-gradient(135deg,#22c55e,#16a34a)', icon: '📞', shadow: '0 4px 20px rgba(34,197,94,0.4)', pulse: false },
//         ringing:       { bg: 'linear-gradient(135deg,#f59e0b,#d97706)', icon: '📳', shadow: '0 4px 20px rgba(245,158,11,0.5)', pulse: true },
//         connecting:    { bg: 'linear-gradient(135deg,#6c63ff,#4f46e5)', icon: '⏳', shadow: '0 4px 20px rgba(108,99,255,0.4)', pulse: false },
//         agent_speaking:{ bg: 'linear-gradient(135deg,#6c63ff,#4f46e5)', icon: '🔊', shadow: '0 4px 20px rgba(108,99,255,0.5)', pulse: true },
//         listening:     { bg: 'linear-gradient(135deg,#ef4444,#dc2626)', icon: '🎤', shadow: '0 4px 20px rgba(239,68,68,0.5)', pulse: true },
//     };
//     const pc = phaseConfig[phase] || phaseConfig.idle;

//     const statusLabel = {
//         idle:          '⚪ Ready',
//         ringing:       '📳 Ringing...',
//         connecting:    '🟡 Connecting...',
//         agent_speaking:`🔊 ${agentName} speaking`,
//         listening:     '🎤 Live — Listening',
//     }[phase] || '⚪ Ready';

//     return (
//         <>
//             <style>{`
//                 @keyframes ring-pulse {
//                     0%   { transform: scale(1);    opacity: 1; }
//                     50%  { transform: scale(1.06); opacity: 0.9; }
//                     100% { transform: scale(1);    opacity: 1; }
//                 }
//                 @keyframes wave-bar {
//                     from { height: 20%; }
//                     to   { height: 90%; }
//                 }
//                 .call-main-btn { transition: transform 0.15s ease, box-shadow 0.15s ease; }
//                 .call-main-btn:hover:not(:disabled) { transform: scale(1.07); }
//                 .call-main-btn.pulsing { animation: ring-pulse 0.9s ease-in-out infinite; }
//             `}</style>

//             <div className="voice-widget" style={{ maxWidth: 620 }}>
//                 {/* ── Header ── */}
//                 <div className="voice-widget-header">
//                     <div>
//                         <h3 style={{ fontSize: 'var(--font-base)', fontWeight: 700 }}>
//                             🧪 Test Call — {agentName}
//                         </h3>
//                         <span className={`badge ${connected ? 'badge-success' : phase === 'ringing' || phase === 'connecting' ? 'badge-warning' : 'badge-warning'}`} style={{ marginTop: 4 }}>
//                             {statusLabel}
//                         </span>
//                     </div>

//                     {isActive && (
//                         <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
//                             {connected && (
//                                 <button
//                                     className={`btn btn-sm ${muted ? 'btn-warning' : 'btn-secondary'}`}
//                                     onClick={toggleMute}
//                                 >
//                                     {muted ? '🔇 Unmute' : '🎤 Mute'}
//                                 </button>
//                             )}
//                             <button className="btn btn-danger btn-sm" onClick={endCall}>
//                                 📞 End Call
//                             </button>
//                         </div>
//                     )}
//                 </div>

//                 <div className="voice-widget-body">
//                     {/* Multi-agent decision (text-only calls) */}
//                     {showDecision && lastDecision && (
//                         <AgentDecisionPanel decision={lastDecision} onClose={() => setShowDecision(false)} />
//                     )}

//                     {/* Messages */}
//                     <div className="voice-widget-messages">
//                         {messages.length === 0 && (
//                             <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 'var(--space-xl)' }}>
//                                 <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🎙️</div>
//                                 <p style={{ fontWeight: 600 }}>Gemini Live API — Real-time voice</p>
//                                 <p style={{ fontSize: 'var(--font-xs)', marginTop: 8, color: 'var(--text-muted)' }}>
//                                     Agent speaks first • Interruption supported • No button press needed
//                                 </p>
//                             </div>
//                         )}
//                         {messages.map((msg) => (
//                             <div
//                                 key={msg.id}
//                                 className={`voice-message ${msg.role === 'user' ? 'user' : 'agent'}`}
//                                 style={msg.role === 'system' ? {
//                                     alignSelf: 'center',
//                                     background: 'rgba(108,99,255,0.08)',
//                                     border: '1px solid var(--border-color)',
//                                     fontSize: 'var(--font-xs)',
//                                     color: 'var(--text-secondary)',
//                                     maxWidth: '100%',
//                                     textAlign: 'center',
//                                 } : {}}
//                             >
//                                 {msg.text}
//                             </div>
//                         ))}
//                         <div ref={messagesEndRef} />
//                     </div>

//                     {/* Status */}
//                     <div className="voice-status">{status}</div>

//                     {/* Main call button + waveform */}
//                     <div className="voice-controls" style={{ flexDirection: 'column', gap: 10 }}>
//                         <button
//                             className={`call-main-btn${pc.pulse ? ' pulsing' : ''}`}
//                             onClick={isActive ? endCall : startCall}
//                             disabled={phase === 'connecting'}
//                             style={{
//                                 width: 72, height: 72, borderRadius: '50%', border: 'none',
//                                 cursor: phase === 'connecting' ? 'wait' : 'pointer',
//                                 fontSize: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
//                                 background: pc.bg, boxShadow: pc.shadow, color: 'white',
//                             }}
//                             title={isActive ? 'End call' : 'Start live call'}
//                         >
//                             {pc.icon}
//                         </button>

//                         {/* Live waveform indicator */}
//                         {phase === 'listening' && <WaveBar active={!muted} />}

//                         {phase === 'agent_speaking' && (
//                             <div style={{ fontSize: 11, color: '#6c63ff', fontWeight: 600, letterSpacing: 0.5 }}>
//                                 AGENT SPEAKING — just interrupt naturally
//                             </div>
//                         )}
//                         {phase === 'listening' && (
//                             <div style={{ fontSize: 11, color: '#ef4444', fontWeight: 600, letterSpacing: 0.5 }}>
//                                 ● LIVE LISTENING — speak naturally
//                             </div>
//                         )}
//                     </div>

//                     {/* Text input */}
//                     <form className="voice-text-input" onSubmit={handleTextSubmit}>
//                         <input
//                             value={textInput}
//                             onChange={e => setTextInput(e.target.value)}
//                             placeholder={connected ? 'Type during live call...' : 'Or type to chat (no call)...'}
//                         />
//                         <button type="submit" className="btn btn-primary btn-sm">Send</button>
//                     </form>
//                 </div>
//             </div>
//         </>
//     );
// }

import { useState, useEffect, useRef, useCallback } from 'react';
import { agentsAPI } from '../api';
import { LiveAudioService } from '../services/liveAudioService';

// ─── Ring tone via Web Audio API ──────────────────────────────────────────────
function useRingTone() {
    const ctxRef = useRef(null);
    const timersRef = useRef([]);

    const start = useCallback(() => {
        stop();
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        ctxRef.current = ctx;
        function ring() {
            if (!ctxRef.current) return;
            const now = ctx.currentTime;
            [480, 440].forEach(freq => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain); gain.connect(ctx.destination);
                osc.frequency.value = freq; osc.type = 'sine';
                gain.gain.setValueAtTime(0, now);
                gain.gain.linearRampToValueAtTime(0.14, now + 0.05);
                gain.gain.setValueAtTime(0.14, now + 0.4);
                gain.gain.linearRampToValueAtTime(0, now + 0.45);
                gain.gain.setValueAtTime(0, now + 0.62);
                gain.gain.linearRampToValueAtTime(0.14, now + 0.67);
                gain.gain.setValueAtTime(0.14, now + 1.05);
                gain.gain.linearRampToValueAtTime(0, now + 1.1);
                osc.start(now); osc.stop(now + 1.15);
            });
            timersRef.current.push(setTimeout(ring, 2400));
        }
        ring();
    }, []);

    const stop = useCallback(() => {
        timersRef.current.forEach(clearTimeout); timersRef.current = [];
        if (ctxRef.current) { try { ctxRef.current.close(); } catch (_) {} ctxRef.current = null; }
    }, []);

    useEffect(() => () => stop(), [stop]);
    return { start, stop };
}

// ─── Agent Decision Panel ─────────────────────────────────────────────────────
function AgentDecisionPanel({ decision, onClose }) {
    if (!decision) return null;
    const sentColor = { positive: '#22c55e', neutral: '#94a3b8', negative: '#ef4444', mixed: '#f59e0b' }[decision.sentiment] || '#94a3b8';
    return (
        <div style={{ background: 'rgba(108,99,255,0.07)', border: '1px solid rgba(108,99,255,0.2)', borderRadius: 10, padding: '10px 14px', marginBottom: 8, fontSize: 11, position: 'relative' }}>
            <button onClick={onClose} style={{ position: 'absolute', top: 6, right: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 13 }}>✕</button>
            <div style={{ fontWeight: 700, color: '#6c63ff', marginBottom: 6, fontSize: 12 }}>Multi-Agent Decision</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {[
                    ['Intent', decision.intent, '#6c63ff'],
                    ['Mood', decision.sentiment, sentColor],
                    ['Lang', decision.language_hint?.replace(/_/g, ' '), '#0ea5e9'],
                    ['Confidence', Math.round((decision.confidence || 0) * 100) + '%', '#f59e0b'],
                ].map(([label, val, color]) => val && (
                    <span key={label} style={{ background: color + '18', color, borderRadius: 6, padding: '2px 8px', fontWeight: 600 }}>
                        {label}: {val}
                    </span>
                ))}
                {decision.rag_used && <span style={{ background: '#22c55e18', color: '#22c55e', borderRadius: 6, padding: '2px 8px', fontWeight: 600 }}>RAG</span>}
                {decision.should_escalate && <span style={{ background: '#ef444418', color: '#ef4444', borderRadius: 6, padding: '2px 8px', fontWeight: 700 }}>Escalate</span>}
            </div>
            {decision.agents_invoked?.length > 0 && (
                <div style={{ marginTop: 5, color: '#64748b', fontSize: 10 }}>{decision.agents_invoked.join(' → ')}</div>
            )}
        </div>
    );
}

// ─── Waveform visualiser (live mic levels) ────────────────────────────────────
function WaveBar({ active }) {
    const bars = [0.4, 0.7, 1.0, 0.8, 0.5, 0.9, 0.6, 1.0, 0.7, 0.4];
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 24 }}>
            {bars.map((h, i) => (
                <div key={i} style={{
                    width: 3, borderRadius: 2,
                    background: active ? '#ef4444' : '#94a3b8',
                    height: active ? `${h * 100}%` : '20%',
                    transition: 'height 0.15s ease',
                    animation: active ? `wave-bar ${0.4 + i * 0.07}s ease-in-out infinite alternate` : 'none',
                }} />
            ))}
        </div>
    );
}

// SVG icon components for call phases
const PhoneIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>;
const ClockIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
const SpeakerIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>;
const MicIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>;

// ── Main Widget ──────────────────────────────────────────────────────────────
export default function VoiceCallWidget({ agentId, agentName, agent }) {
    const [phase, setPhase] = useState('idle'); // idle | ringing | connected | agent_speaking | listening
    const [connected, setConnected] = useState(false);
    const [connecting, setConnecting] = useState(false);
    const [muted, setMuted] = useState(false);
    const [messages, setMessages] = useState([]);
    const [status, setStatus] = useState('Click the call button to start a live voice call');
    const [textInput, setTextInput] = useState('');
    const [lastDecision, setLastDecision] = useState(null);
    const [showDecision, setShowDecision] = useState(false);
    const [voiceLockState, setVoiceLockState] = useState('WAITING');

    const liveServiceRef = useRef(null);
    const messagesEndRef = useRef(null);
    const userTranscriptRef = useRef('');
    const agentTranscriptRef = useRef('');
    const ringingTimerRef = useRef(null);
    const ringTone = useRingTone();

    useEffect(() => () => { endCall(); }, []);
    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    function addMessage(role, text) {
        setMessages(prev => [...prev, { role, text, id: Date.now() + Math.random() }]);
    }

    function updateLastMessage(role, text) {
        setMessages(prev => {
            const lastIdx = [...prev].reverse().findIndex(m => m.role === role);
            if (lastIdx === -1) return [...prev, { role, text, id: Date.now() }];
            const actualIdx = prev.length - 1 - lastIdx;
            const updated = [...prev];
            updated[actualIdx] = { ...updated[actualIdx], text };
            return updated;
        });
    }

    // ── Start call: ring then connect ─────────────────────────────────────────
    async function startCall() {
        if (connected || connecting) return;

        // Ring first
        setPhase('ringing');
        ringTone.start();
        setStatus('Ringing...');

        ringingTimerRef.current = setTimeout(async () => {
            ringTone.stop();
            setConnecting(true);
            setPhase('connecting');
            setStatus('Connecting to Gemini Live...');

            const service = new LiveAudioService();
            liveServiceRef.current = service;

            const agentConfig = { id: agentId, ...(agent || { name: agentName, role: 'Customer Support', system_prompt: '', voice_id: 'Puck' }) };

            const success = await service.connect(agentConfig, {
                onOpen: () => {
                    setConnected(true);
                    setConnecting(false);
                    setPhase('agent_speaking');
                    setStatus(`${agentName} is greeting you...`);
                    addMessage('system', `Connected to ${agentName}. Agent is speaking first...`);
                    setVoiceLockState('WAITING');
                    userTranscriptRef.current = '';
                    agentTranscriptRef.current = '';
                },

                onClose: () => {
                    // Only handle if we didn't voluntarily end the call
                    // (endCall() sets liveServiceRef.current = null before this fires)
                    if (!liveServiceRef.current) return;
                    setConnected(false);
                    setConnecting(false);
                    setMuted(false);
                    setPhase('idle');
                    setStatus('Call ended. Click call button to call again.');
                    addMessage('system', 'Call ended');
                    liveServiceRef.current = null;
                },

                onError: (e) => {
                    console.error('[VoiceWidget] Live voice error:', e);
                    setConnected(false);
                    setConnecting(false);
                    setPhase('idle');
                    const msg = e?.message || 'Connection failed';
                    setStatus(`Error: ${msg}`);
                    addMessage('system', msg);
                    liveServiceRef.current = null;
                },

                onInterrupted: () => {
                    // Agent stopped mid-sentence — clear partial transcript
                    agentTranscriptRef.current = '';
                    // Remove the last agent message bubble if it was partial
                    setMessages(prev => {
                        const last = prev[prev.length - 1];
                        if (last?.role === 'agent') {
                            // Mark it as interrupted rather than deleting
                            const updated = [...prev];
                            updated[updated.length - 1] = { ...last, text: last.text + ' [interrupted]' };
                            return updated;
                        }
                        return prev;
                    });
                    setPhase('listening');
                    setStatus('Go ahead — I\'m listening...');
                },

                onTranscription: (text, isUser) => {
                    if (!text?.trim()) return;

                    if (isUser) {
                        // Accumulate user speech transcript
                        if (userTranscriptRef.current === '') {
                            userTranscriptRef.current = text;
                            addMessage('user', text);
                        } else {
                            userTranscriptRef.current += ' ' + text;
                            updateLastMessage('user', userTranscriptRef.current);
                        }
                        agentTranscriptRef.current = '';
                        setPhase('listening');
                        setStatus('Listening...');
                    } else {
                        // Accumulate agent response transcript
                        if (agentTranscriptRef.current === '') {
                            agentTranscriptRef.current = text;
                            addMessage('agent', text);
                        } else {
                            agentTranscriptRef.current += text;
                            updateLastMessage('agent', agentTranscriptRef.current);
                        }
                        userTranscriptRef.current = '';
                        setPhase('agent_speaking');
                        setStatus(`${agentName} is speaking...`);
                    }
                },

                onCallEnd: () => {
                    addMessage('system', 'Call ended by agent — goodbye!');
                    // Small delay so the user hears the agent's goodbye audio
                    setTimeout(() => endCall(), 1500);
                },

                onVoiceLockState: (state) => {
                    setVoiceLockState(state);
                    if (state === 'LOCKED') {
                        addMessage('system', 'Voice locked — only your voice will be processed');
                    }
                },

                onVoiceLockEvent: (event, data) => {
                    if (event === 'rejected') {
                        console.log(`[VL] Rejected voice: similarity=${data.similarity?.toFixed(2)}`);
                    }
                },
            });

            if (!success) {
                setConnecting(false);
                setPhase('idle');
                setStatus('Failed to connect. Check your Gemini API key supports Live API.');
            }
        }, 2000); // 2s ring
    }

    function endCall() {
        ringTone.stop();
        clearTimeout(ringingTimerRef.current);
        const svc = liveServiceRef.current;
        liveServiceRef.current = null;  // null FIRST so onClose callback skips
        if (svc) svc.disconnect();
        setConnected(false);
        setConnecting(false);
        setMuted(false);
        setPhase('idle');
        setStatus('Call ended. Click call button to call again.');
    }

    function toggleMute() {
        if (!liveServiceRef.current) return;
        const nowMuted = liveServiceRef.current.toggleMute();
        setMuted(nowMuted);
        setStatus(nowMuted ? 'Microphone muted — agent can still speak' : 'Microphone unmuted — listening');
    }

    async function handleTextSubmit(e) {
        e.preventDefault();
        if (!textInput.trim()) return;
        const msg = textInput.trim();
        setTextInput('');
        addMessage('user', msg);

        if (connected && liveServiceRef.current) {
            // Send through live session — will get real-time audio response
            liveServiceRef.current.sendText(msg);
            setStatus('Thinking...');
        } else {
            // REST fallback when not in a live call
            setStatus('Thinking...');
            try {
                const response = await agentsAPI.chat(agentId, msg);
                addMessage('agent', response.response);
                if (response.intent) {
                    setLastDecision(response);
                    setShowDecision(true);
                }
                setStatus('Done. Start a live call for voice.');
            } catch (err) {
                addMessage('system', err.message);
                setStatus('Error getting response');
            }
        }
    }

    // ── Render ────────────────────────────────────────────────────────────────
    const isActive = connected || connecting || phase === 'ringing';

    const phaseConfig = {
        idle:          { bg: 'linear-gradient(135deg,#22c55e,#16a34a)', icon: <PhoneIcon />, shadow: '0 4px 20px rgba(34,197,94,0.4)', pulse: false },
        ringing:       { bg: 'linear-gradient(135deg,#f59e0b,#d97706)', icon: <PhoneIcon />, shadow: '0 4px 20px rgba(245,158,11,0.5)', pulse: true },
        connecting:    { bg: 'linear-gradient(135deg,#6c63ff,#4f46e5)', icon: <ClockIcon />, shadow: '0 4px 20px rgba(108,99,255,0.4)', pulse: false },
        agent_speaking:{ bg: 'linear-gradient(135deg,#6c63ff,#4f46e5)', icon: <SpeakerIcon />, shadow: '0 4px 20px rgba(108,99,255,0.5)', pulse: true },
        listening:     { bg: 'linear-gradient(135deg,#ef4444,#dc2626)', icon: <MicIcon />, shadow: '0 4px 20px rgba(239,68,68,0.5)', pulse: true },
    };
    const pc = phaseConfig[phase] || phaseConfig.idle;

    const statusLabel = {
        idle:          'Ready',
        ringing:       'Ringing...',
        connecting:    'Connecting...',
        agent_speaking:`${agentName} speaking`,
        listening:     'Live — Listening',
    }[phase] || 'Ready';

    return (
        <>
            <style>{`
                @keyframes ring-pulse {
                    0%   { transform: scale(1);    opacity: 1; }
                    50%  { transform: scale(1.06); opacity: 0.9; }
                    100% { transform: scale(1);    opacity: 1; }
                }
                @keyframes wave-bar {
                    from { height: 20%; }
                    to   { height: 90%; }
                }
                .call-main-btn { transition: transform 0.15s ease, box-shadow 0.15s ease; }
                .call-main-btn:hover:not(:disabled) { transform: scale(1.07); }
                .call-main-btn.pulsing { animation: ring-pulse 0.9s ease-in-out infinite; }
            `}</style>

            <div className="voice-widget" style={{ maxWidth: 620, animation: 'pageEnter 0.4s ease-out' }}>
                {/* ── Header ── */}
                <div className="voice-widget-header" style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <div>
                        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{
                                width: 32, height: 32, borderRadius: 10,
                                background: 'linear-gradient(135deg, rgba(108,92,231,0.15), rgba(0,206,201,0.15))',
                                border: '1px solid rgba(108,92,231,0.2)',
                                display: 'inline-grid', placeItems: 'center',
                            }}>                            
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                            </span>
                            Test Call — {agentName}
                        </h3>
                        <span className={`badge ${connected ? 'badge-success' : phase === 'ringing' || phase === 'connecting' ? 'badge-warning' : 'badge-warning'}`} style={{ marginTop: 6 }}>
                            {statusLabel}
                        </span>
                    </div>

                    {isActive && (
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            {connected && (
                                <button
                                    className={`btn btn-sm ${muted ? 'btn-warning' : 'btn-secondary'}`}
                                    onClick={toggleMute}
                                >
                                    {muted ? 'Unmute' : 'Mute'}
                                </button>
                            )}
                            <button className="btn btn-danger btn-sm" onClick={endCall}>
                                End Call
                            </button>
                        </div>
                    )}
                </div>

                <div className="voice-widget-body">
                    {/* Multi-agent decision (text-only calls) */}
                    {showDecision && lastDecision && (
                        <AgentDecisionPanel decision={lastDecision} onClose={() => setShowDecision(false)} />
                    )}

                    {/* Messages */}
                    <div className="voice-widget-messages">
                        {messages.length === 0 && (
                            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 'var(--space-xl)' }}>
                                <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🎙️</div>
                                <p style={{ fontWeight: 600 }}>Gemini Live API — Real-time voice</p>
                                <p style={{ fontSize: 'var(--font-xs)', marginTop: 8, color: 'var(--text-muted)' }}>
                                    Agent speaks first • Interruption supported • No button press needed
                                </p>
                            </div>
                        )}
                        {messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`voice-message ${msg.role === 'user' ? 'user' : 'agent'}`}
                                style={msg.role === 'system' ? {
                                    alignSelf: 'center',
                                    background: 'rgba(108,99,255,0.08)',
                                    border: '1px solid var(--border-color)',
                                    fontSize: 'var(--font-xs)',
                                    color: 'var(--text-secondary)',
                                    maxWidth: '100%',
                                    textAlign: 'center',
                                } : {}}
                            >
                                {msg.text}
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Status */}
                    <div className="voice-status">{status}</div>

                    {/* Main call button + waveform */}
                    <div className="voice-controls" style={{ flexDirection: 'column', gap: 10 }}>
                        <button
                            className={`call-main-btn${pc.pulse ? ' pulsing' : ''}`}
                            onClick={isActive ? endCall : startCall}
                            disabled={phase === 'connecting'}
                            style={{
                                width: 72, height: 72, borderRadius: '50%', border: 'none',
                                cursor: phase === 'connecting' ? 'wait' : 'pointer',
                                fontSize: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: pc.bg, boxShadow: pc.shadow, color: 'white',
                            }}
                            title={isActive ? 'End call' : 'Start live call'}
                        >
                            {pc.icon}
                        </button>

                        {/* Live waveform indicator */}
                        {phase === 'listening' && <WaveBar active={!muted} />}

                        {phase === 'agent_speaking' && (
                            <div style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                                Agent speaking — just talk to interrupt
                            </div>
                        )}
                        {phase === 'listening' && (
                            <div style={{ fontSize: 11, color: '#ef4444', fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                                ● Live listening — speak naturally
                            </div>
                        )}

                        {/* Voice Lock Status Indicator */}
                        {connected && (
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                fontSize: 10, fontWeight: 600, marginTop: 4,
                                padding: '3px 10px', borderRadius: 12,
                                background: voiceLockState === 'LOCKED'
                                    ? 'rgba(34,197,94,0.1)'
                                    : voiceLockState === 'ENROLLING'
                                        ? 'rgba(245,158,11,0.1)'
                                        : 'rgba(148,163,184,0.1)',
                                border: `1px solid ${voiceLockState === 'LOCKED'
                                    ? 'rgba(34,197,94,0.3)'
                                    : voiceLockState === 'ENROLLING'
                                        ? 'rgba(245,158,11,0.3)'
                                        : 'rgba(148,163,184,0.2)'}`,
                                color: voiceLockState === 'LOCKED'
                                    ? '#22c55e'
                                    : voiceLockState === 'ENROLLING'
                                        ? '#f59e0b'
                                        : '#94a3b8',
                            }}>
                                <span style={{
                                    width: 6, height: 6, borderRadius: '50%',
                                    background: voiceLockState === 'LOCKED'
                                        ? '#22c55e'
                                        : voiceLockState === 'ENROLLING'
                                            ? '#f59e0b'
                                            : '#94a3b8',
                                }} />
                                {voiceLockState === 'LOCKED'
                                    ? 'Voice Locked'
                                    : voiceLockState === 'ENROLLING'
                                        ? 'Enrolling voice...'
                                        : 'Waiting...'}
                            </div>
                        )}
                    </div>

                    {/* Text input */}
                    <form className="voice-text-input" onSubmit={handleTextSubmit}>
                        <input
                            value={textInput}
                            onChange={e => setTextInput(e.target.value)}
                            placeholder={connected ? 'Type during live call...' : 'Or type to chat (no call)...'}
                        />
                        <button type="submit" className="btn btn-primary btn-sm">Send</button>
                    </form>
                </div>
            </div>
        </>
    );
}