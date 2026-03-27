import { useState, useEffect, useRef } from 'react';
import { agentsAPI } from '../api';
import { LiveAudioService } from '../services/liveAudioService';

export default function VoiceCallWidget({ agentId, agentName, agent }) {
    const [connected, setConnected] = useState(false);
    const [connecting, setConnecting] = useState(false);
    const [muted, setMuted] = useState(false);
    const [mode, setMode] = useState('chat');  // 'voice' or 'chat'
    const [messages, setMessages] = useState([]);
    const [status, setStatus] = useState('Click the phone button to start');
    const [textInput, setTextInput] = useState('');
    const liveServiceRef = useRef(null);
    const messagesEndRef = useRef(null);
    const userTranscriptRef = useRef('');
    const agentTranscriptRef = useRef('');
    const statusDebounceTimerRef = useRef(null);  // Debounce timer for status updates

    // Debounced status setter to prevent rapid UI flickering
    const setStatusDebounced = (newStatus) => {
        if (statusDebounceTimerRef.current) {
            clearTimeout(statusDebounceTimerRef.current);
        }
        // For important states, set immediately; for transient states, debounce 200ms
        const transientStates = ['Thinking...', 'Processing...', 'Listening', 'Speaking'];
        const isTransient = transientStates.some(s => newStatus?.includes(s));
        
        if (!isTransient) {
            setStatus(newStatus);
        } else {
            statusDebounceTimerRef.current = setTimeout(() => {
                setStatus(newStatus);
                statusDebounceTimerRef.current = null;
            }, 150);
        }
    };

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
        setStatusDebounced('⏳ Connecting...');
        setMessages([]);

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
                setStatusDebounced('🟢 Ready — speak now');
                if (mode === 'chat') {
                    addMessage('system', `Connected to ${agentName}`);
                }
                userTranscriptRef.current = '';
                agentTranscriptRef.current = '';
            },
            onClose: () => {
                setConnected(false);
                setConnecting(false);
                setMuted(false);
                setStatusDebounced('Call ended');
                if (mode === 'chat') {
                    addMessage('system', 'Disconnected');
                }
            },
            onError: (e) => {
                console.error('Voice error:', e);
                setConnected(false);
                setConnecting(false);
                setStatusDebounced(`❌ ${e?.message || 'Error'}`);
                if (mode === 'chat') {
                    addMessage('system', `⚠️ ${e?.message}`);
                }
            },
            onInterrupted: () => {
                setStatusDebounced('⚡ Interrupted');
                console.log('[Widget] Agent interrupted, ready for new input');
            },
            onTurnComplete: () => {
                // Server acknowledged end of speech & processed user input
                setStatusDebounced('🎧 Listening for response...');
                console.log('[Widget] Turn complete, agent processing');
            },
            onTranscription: (text, isUser) => {
                if (!text || !text.trim() || mode !== 'chat') return;

                if (isUser) {
                    if (userTranscriptRef.current === '') {
                        userTranscriptRef.current = text;
                        addMessage('user', `🎤 ${text}`);
                    } else {
                        userTranscriptRef.current += text;
                        updateLastMessage('user', `🎤 ${userTranscriptRef.current}`);
                    }
                    agentTranscriptRef.current = '';
                    setStatusDebounced('⏸️ Processing...');
                } else {
                    if (agentTranscriptRef.current === '') {
                        agentTranscriptRef.current = text;
                        addMessage('agent', text);
                    } else {
                        agentTranscriptRef.current += text;
                        updateLastMessage('agent', agentTranscriptRef.current);
                    }
                    userTranscriptRef.current = '';
                    setStatusDebounced('🗣️ Agent speaking');
                }
            },
        }, { 
            mode,
            recordingEnabled: true,  // Enable recording for all calls
            callerId: null  // Can be set to user email/ID for tracking
        });

        if (!success) {
            setConnecting(false);
            setStatusDebounced('❌ Connection failed');
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
            setStatusDebounced(nowMuted ? '🔇 Muted' : '🎬 On');
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
            setStatusDebounced('⏸️ Processing your message...');
        } else {
            addMessage('user', msg);
            setStatusDebounced('⏳ Thinking...');
            try {
                const response = await agentsAPI.chat(agentId, msg);
                addMessage('agent', response.response);
                setStatusDebounced('✅ Ready');
            } catch (err) {
                addMessage('system', `⚠️ Error: ${err.message}`);
                setStatusDebounced('❌ Error');
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
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {/* Mode Toggle */}
                    <div style={{ display: 'flex', gap: '4px' }}>
                        <button 
                            className={`btn btn-sm ${mode === 'voice' ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setMode('voice')}
                            disabled={connected}
                            title="Voice mode - agent speaks, no transcription"
                        >
                            🎤 Voice
                        </button>
                        <button 
                            className={`btn btn-sm ${mode === 'chat' ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setMode('chat')}
                            disabled={connected}
                            title="Chat mode - type messages, agent speaks responses"
                        >
                            💬 Chat
                        </button>
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
            </div>

            <div className="voice-widget-body">
                <div className="voice-widget-messages">
                    {messages.length === 0 && mode === 'chat' && (
                        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                            <div style={{ fontSize: '2rem', marginBottom: '12px' }}>💬</div>
                            <p>Type messages or click the phone button to talk</p>
                            <p style={{ fontSize: '12px', marginTop: '8px' }}>
                                Fast response time, no latency
                            </p>
                        </div>
                    )}
                    {messages.length === 0 && mode === 'voice' && (
                        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                            <div style={{ fontSize: '2rem', marginBottom: '12px' }}>🎙️</div>
                            <p>Click the phone button to start voice call</p>
                            <p style={{ fontSize: '12px', marginTop: '8px' }}>
                                Real-time voice interaction, no text shown
                            </p>
                        </div>
                    )}
                    {mode === 'chat' && messages.map((msg, i) => (
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

                {mode === 'chat' && (
                    <form className="voice-text-input" onSubmit={handleTextSubmit}>
                        <input value={textInput} onChange={e => setTextInput(e.target.value)} placeholder={connected ? "Type..." : "Message..."} />
                        <button type="submit" className="btn btn-primary btn-sm">Send</button>
                    </form>
                )}
            </div>
        </div>
    );
}
