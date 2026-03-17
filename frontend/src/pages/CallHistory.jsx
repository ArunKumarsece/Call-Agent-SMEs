import { useEffect, useState } from 'react';
import { analyticsAPI } from '../api';

export default function CallHistory() {
    const [calls, setCalls] = useState([]);
    const [selected, setSelected] = useState(null);
    const [detail, setDetail] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => { loadCalls(); }, []);

    async function loadCalls() {
        try {
            setLoading(true);
            const data = await analyticsAPI.calls({ limit: 50 });
            setCalls(data);
            if (data.length > 0) {
                selectCall(data[0]);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    async function selectCall(call) {
        setSelected(call);
        try {
            const full = await analyticsAPI.getCall(call.id);
            setDetail(full);
        } catch {
            setDetail(call);
        }
    }

    async function seedDemo() {
        await analyticsAPI.seedDemo();
        await loadCalls();
    }

    if (loading) {
        return (
            <div className="loading-container">
                <div className="spinner"></div>
            </div>
        );
    }

    if (error) {
        return <div className="toast toast-error">{error}</div>;
    }

    return (
        <div style={{ animation: 'pageEnter 0.5s ease-out' }}>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Call History</h1>
                    <p className="page-subtitle">Review every call, transcript, and outcome.</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-secondary" onClick={loadCalls}>Refresh</button>
                    <button className="btn btn-ghost" onClick={seedDemo}>Demo Data</button>
                </div>
            </div>

            <div className="call-history-grid">
                <div className="card call-history-list">
                    <div className="call-history-header">Recent Calls</div>
                    {calls.length === 0 ? (
                        <div className="activity-empty">No calls recorded yet.</div>
                    ) : (
                        <div className="call-history-items">
                            {calls.map((call) => (
                                <button
                                    key={call.id}
                                    className={`call-history-item ${selected?.id === call.id ? 'active' : ''}`}
                                    onClick={() => selectCall(call)}
                                >
                                    <div>
                                        <div className="call-history-title">{call.agent_name || 'Agent'}</div>
                                        <div className="call-history-meta">
                                            {call.intent || 'general'} · {Math.round(call.duration_sec || 0)}s · {call.sentiment || 'unknown'}
                                        </div>
                                    </div>
                                    <span className={`status-pill status-${call.status || 'completed'}`}>{call.status || 'completed'}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="card call-history-detail">
                    {detail ? (
                        <>
                            <div className="call-history-detail-header">
                                <div>
                                    <div className="call-history-title">{detail.agent_name || 'Agent'}</div>
                                    <div className="call-history-meta">
                                        {detail.intent || 'general'} · {Math.round(detail.duration_sec || 0)}s · {detail.sentiment || 'unknown'}
                                    </div>
                                </div>
                                <span className={`status-pill status-${detail.status || 'completed'}`}>{detail.status || 'completed'}</span>
                            </div>

                            {detail.summary && (
                                <div className="call-history-summary">
                                    <div className="call-history-section-title">Summary</div>
                                    <div className="call-history-summary-text">{detail.summary}</div>
                                </div>
                            )}

                            <div className="call-history-section-title">Transcript</div>
                            <div className="call-history-transcript">
                                {(detail.transcript || []).length === 0 ? (
                                    <div className="activity-empty">No transcript available.</div>
                                ) : (
                                    detail.transcript.map((item, idx) => (
                                        <div
                                            key={`${detail.id}-${idx}`}
                                            className={`transcript-line ${item.role === 'agent' ? 'agent' : 'user'}`}
                                        >
                                            <div className="transcript-role">{item.role}</div>
                                            <div className="transcript-text">{item.text}</div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="activity-empty">Select a call to view details.</div>
                    )}
                </div>
            </div>
        </div>
    );
}
