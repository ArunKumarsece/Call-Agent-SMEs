import { useState, useEffect, useRef } from 'react';
import { agentsAPI } from '../api';
import { LiveAudioService } from '../services/liveAudioService';

export default function VoiceCallWidget({ agentId, agentName, agent }) {
    const [connected, setConnected] = useState(false);
    const [connecting, setConnecting] = useState(false);
    const [muted, setMuted] = useState(false);
    const [messages, setMessages] = useState([]);
    const [status, setStatus] = useState('Click the phone button to start');
    const [textInput, setTextInput] = useState('');
    const liveServiceRef = useRef(null);
    const messagesEndRef = useRef(null);
    const userTranscriptRef = useRef('');
    const agentTranscriptRef = useRef('');

    useEffect(() => {
        return () => {
            if (liveServiceRef.current) {
                liveServiceRef.current.disconnect();
            }
        };
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    function addMessage(role, text) {
        setMessages(prev => [...prev, { role, text, time: new Date() }]);
    }

    function updateLastMessage(role, text) {
        setMessages(prev => {
            const lastIdx = [...prev].reverse().findIndex(m => m.role === role);
            if (lastIdx === -1) {
                return [...prev, { role, text, time: new Date() }];
            }
            const actualIdx = prev.length - 1 - lastIdx;
            const updated = [...prev];
            updated[actualIdx] = { ...updated[actualIdx], text };
            return updated;
        });
    }

    async function startCall() {
        if (connected || connecting) return;
        setConnecting(true);
        setStatus('Connecting...');

        const service = new LiveAudioService();
        liveServiceRef.current = service;

        const agentConfig = agent || {
            name: agentName,
            role: 'Support',
            system_prompt: '',
            voice_id: 'Puck',
        };

        const success = await service.connect(agentConfig, {
            onOpen: () => {
                setConnected(true);
                setConnecting(false);
                setStatus('🟢 Live');
                addMessage('system', `Connected to ${agentName}`);
                userTranscriptRef.current = '';
                agentTranscriptRef.current = '';
            },
            onClose: () => {
                setConnected(false);
                setConnecting(false);
                setMuted(false);
                setStatus('Ended');
                addMessage('system', 'Disconnected');
            },
            onError: (e) => {
                console.error('Error:', e);
                setConnected(false);
                setConnecting(false);
                setStatus(`Error: ${e?.message || 'Failed'}`);
                addMessage('system', `⚠️ ${e?.message}`);
            },
            onInterrupted: () => {
                setStatus('⚡ Interrupted');
            },
            onTranscription: (text, isUser) => {
                if (!text || !text.trim()) return;

                if (isUser) {
                    if (userTranscriptRef.current === '') {
                        userTranscriptRef.current = text;
                        addMessage('user', `🎤 ${text}`);
                    } else {
                        userTranscriptRef.current += text;
                        updateLastMessage('user', `🎤 ${userTranscriptRef.current}`);
                    }
                    agentTranscriptRef.current = '';
                    setStatus('🟢 Listening');
                } else {
                    if (agentTranscriptRef.current === '') {
                        agentTranscriptRef.current = text;
                        addMessage('agent', text);
                    } else {
                        agentTranscriptRef.current += text;
                        updateLastMessage('agent', agentTranscriptRef.current);
                    }
                    userTranscriptRef.current = '';
                    setStatus('🗣️ Speaking');
                }
            },
        });

        if (!success) {
            setConnecting(false);
            setStatus('Failed');
        }
    }

    function endCall() {
        if (liveServiceRef.current) {
            liveServiceRef.current.disconnect();
            liveServiceRef.current = null;
        }
        setConnected(false);
        setConnecting(false);
        setMuted(false);
    }

    function toggleMute() {
        if (liveServiceRef.current) {
            const nowMuted = liveServiceRef.current.toggleMute();
            setMuted(nowMuted);
            setStatus(nowMuted ? '🔇 Muted' : '🎤 On');
        }
    }

    async function handleTextSubmit(e) {
        e.preventDefault();
        if (!textInput.trim()) return;

        const msg = textInput.trim();
        setTextInput('');

        if (connected && liveServiceRef.current) {
            addMessage('user', msg);
            liveServiceRef.current.sendText(msg);
            setStatus('Thinking...');
        } else {
            addMessage('user', msg);
            setStatus('Thinking...');
            try {
                const response = await agentsAPI.chat(agentId, msg);
                addMessage('agent', response.response);
                setStatus('Ready');
            } catch (err) {
                addMessage('system', `⚠️ Error`);
            }
        }
    }

    return (
        <div className="voice-widget" style={{ maxWidth: 600 }}>
            <div className="voice-widget-header">
                <div>
                    <h3 style={{ fontSize: 'var(--font-base)', fontWeight: 700 }}>
                        🧪 Test Call
                    </h3>
                    <span className={`badge ${connected ? 'badge-success' : 'badge-warning'}`}>
                        {connected ? '🟢 Live' : connecting ? '🟡 Connecting' : '⚪ Ready'}
                    </span>
                </div>
                {connected && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button className={`btn btn-sm ${muted ? 'btn-warning' : 'btn-secondary'}`} onClick={toggleMute}>
                            {muted ? '🔇' : '🎤'}
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={endCall}>
                            End
                        </button>
                    </div>
                )}
            </div>

            <div className="voice-widget-body">
                <div className="voice-widget-messages">
                    {messages.length === 0 && (
                        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                            <div style={{ fontSize: '2rem', marginBottom: '12px' }}>🎙️</div>
                            <p>Click the phone button to start</p>
                            <p style={{ fontSize: '12px', marginTop: '8px' }}>
                                VAD + Speaker Lock + Low Latency
                            </p>
                        </div>
                    )}
                    {messages.map((msg, i) => (
                        <div key={i} className={`voice-message ${msg.role === 'user' ? 'user' : 'agent'}`}
                            style={msg.role === 'system' ? { alignSelf: 'center', background: 'rgba(108,99,255,0.1)', border: '1px solid var(--border-color)', fontSize: '12px', color: 'var(--text-secondary)', maxWidth: '100%' } : {}}>
                            {msg.text}
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>

                <div className="voice-status">{status}</div>

                <div className="voice-controls">
                    {!connected && !connecting && (
                        <button className="mic-btn" onClick={startCall} style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                            📞
                        </button>
                    )}
                    {connecting && <button className="mic-btn" disabled style={{ opacity: 0.6 }}>⏳</button>}
                </div>

                <form className="voice-text-input" onSubmit={handleTextSubmit}>
                    <input value={textInput} onChange={e => setTextInput(e.target.value)} placeholder={connected ? "Type..." : "Message..."} />
                    <button type="submit" className="btn btn-primary btn-sm">Send</button>
                </form>
            </div>
        </div>
    );
}
