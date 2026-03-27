import { useEffect, useState } from 'react';
import { analyticsAPI } from '../api';

export default function CallHistory() {
  const [calls, setCalls]     = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [search, setSearch]   = useState('');

  useEffect(() => { loadCalls(); }, []);

  async function loadCalls() {
    try {
      setLoading(true);
      const data = await analyticsAPI.calls({ limit: 60 });
      setCalls(data);
      if (data.length > 0) selectCall(data[0]);
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

  const filtered = calls.filter(c =>
    !search ||
    (c.agent_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.intent || '').toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return (
    <div className="loading-container">
      <div className="spinner" />
      <span style={{ color: 'var(--text-muted)', fontSize: '0.84rem' }}>Loading calls…</span>
    </div>
  );

  if (error) return <div className="toast toast-error">{error}</div>;

  const sentimentColor = { positive: 'var(--success)', negative: 'var(--danger)', neutral: 'var(--text-muted)' };

  return (
    <div style={{ animation: 'pageEnter .4s ease-out' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Call History</h1>
          <p className="page-subtitle">Review every conversation, transcript, and outcome in detail.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={loadCalls}>↺ Refresh</button>
          <button className="btn btn-ghost" onClick={async () => { await analyticsAPI.seedDemo(); loadCalls(); }}>
            Demo Data
          </button>
        </div>
      </div>

      {calls.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📞</div>
          <h2 className="empty-state-title">No calls yet</h2>
          <p className="empty-state-text">Make a test call from the Agent Detail page to see history here.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 'var(--space-lg)', alignItems: 'start' }}>
          {/* Left: call list */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {/* Search */}
            <div style={{ padding: 'var(--space-sm) var(--space-md)', borderBottom: '1px solid var(--border)' }}>
              <input
                style={{
                  width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)',
                  borderRadius: 'var(--r-sm)', padding: '8px 12px', color: 'var(--text-primary)',
                  fontSize: '0.82rem', outline: 'none',
                }}
                placeholder="Search by agent or intent…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            <div style={{ maxHeight: '68vh', overflowY: 'auto' }}>
              {filtered.map(call => (
                <button
                  key={call.id}
                  onClick={() => selectCall(call)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px var(--space-md)', background: selected?.id === call.id ? 'var(--accent-soft)' : 'transparent',
                    border: 'none', borderBottom: '1px solid var(--border)',
                    cursor: 'pointer', gap: 8, textAlign: 'left',
                    transition: 'background var(--t-fast)',
                    borderLeft: selected?.id === call.id ? '3px solid var(--accent)' : '3px solid transparent',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {call.agent_name || 'Agent'}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
                      {call.intent || 'general'} · {Math.round(call.duration_sec || 0)}s
                    </div>
                  </div>
                  <span className={`status-pill status-${call.status || 'completed'}`} style={{ flexShrink: 0, fontSize: '0.62rem' }}>
                    {call.status || 'done'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Right: detail */}
          <div className="card">
            {!detail ? (
              <div className="activity-empty">Select a call to view its details.</div>
            ) : (
              <>
                {/* Detail header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)', paddingBottom: 'var(--space-lg)', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-.02em' }}>
                      {detail.agent_name || 'Agent'}
                    </h2>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                      <span className="badge badge-neutral">{detail.intent || 'general'}</span>
                      <span className="badge badge-neutral" style={{ color: sentimentColor[detail.sentiment] || 'var(--text-muted)' }}>
                        {detail.sentiment || 'unknown'}
                      </span>
                      <span className="badge badge-neutral">{Math.round(detail.duration_sec || 0)}s</span>
                    </div>
                  </div>
                  <span className={`status-pill status-${detail.status || 'completed'}`}>
                    {detail.status || 'completed'}
                  </span>
                </div>

                {/* Summary */}
                {detail.summary && (
                  <div style={{ marginBottom: 'var(--space-lg)' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 8 }}>
                      AI Summary
                    </div>
                    <p style={{ fontSize: '0.87rem', color: 'var(--text-secondary)', lineHeight: 1.6, background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', padding: 'var(--space-md)', border: '1px solid var(--border)' }}>
                      {detail.summary}
                    </p>
                  </div>
                )}

                {/* Transcript */}
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 12 }}>
                  Transcript
                </div>
                <div style={{ maxHeight: '50vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(!detail.transcript || detail.transcript.length === 0) ? (
                    <div className="activity-empty">No transcript available.</div>
                  ) : (
                    detail.transcript.map((item, idx) => (
                      <div key={idx} style={{
                        display: 'flex', flexDirection: 'column',
                        alignItems: item.role === 'agent' ? 'flex-start' : 'flex-end',
                        gap: 3,
                      }}>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', paddingInline: 4 }}>
                          {item.role}
                        </div>
                        <div style={{
                          maxWidth: '80%', padding: '9px 14px', borderRadius: 'var(--r-md)',
                          fontSize: '0.84rem', lineHeight: 1.5,
                          background: item.role === 'agent' ? 'var(--bg-elevated)' : 'var(--accent-soft)',
                          color: item.role === 'agent' ? 'var(--text-secondary)' : 'var(--text-primary)',
                          border: `1px solid ${item.role === 'agent' ? 'var(--border)' : 'var(--border-accent)'}`,
                        }}>
                          {item.text}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
