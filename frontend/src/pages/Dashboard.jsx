import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { agentsAPI, analyticsAPI } from '../api';

const ROLE_META = {
  'Customer Support': { short: 'CS', from: '#7c6dfa', to: '#a29bfe' },
  'Sales':            { short: 'SL', from: '#00d4a4', to: '#55efc4' },
  'Technical Support':{ short: 'TS', from: '#f43f5e', to: '#fb7185' },
  'Receptionist':     { short: 'RC', from: '#fbbf24', to: '#fde68a' },
  'General Assistant':{ short: 'GA', from: '#38bdf8', to: '#7dd3fc' },
  'FAQ Bot':          { short: 'FQ', from: '#22d3a0', to: '#6ee7b7' },
};

// ─── Agent Card ───────────────────────────────────────────────
function AgentCard({ agent, index, onDelete, compact }) {
  const meta = ROLE_META[agent.role] || { short: 'AI', from: '#7c6dfa', to: '#a29bfe' };

  return (
    <div
      className="card agent-card"
      style={{ animation: `slideUp 0.45s ease-out ${index * 55}ms both` }}
    >
      {/* Gradient top bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, ${meta.from}, ${meta.to})`,
        borderRadius: 'var(--r-lg) var(--r-lg) 0 0',
      }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {/* Avatar */}
        <div style={{
          width: compact ? 40 : 52,
          height: compact ? 40 : 52,
          borderRadius: 'var(--r-md)',
          background: `linear-gradient(135deg, ${meta.from}20, ${meta.to}20)`,
          border: `1px solid ${meta.from}33`,
          display: 'grid', placeItems: 'center',
          fontSize: compact ? 12 : 14,
          fontWeight: 800, color: meta.from,
          letterSpacing: '-0.02em', flexShrink: 0,
        }}>
          {meta.short}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <h3 className="card-title" style={{ fontSize: compact ? '0.9rem' : '1rem' }}>{agent.name}</h3>
            <div style={{
              width: 7, height: 7, borderRadius: '50%', background: '#22d3a0',
              boxShadow: '0 0 8px rgba(34,211,160,0.6)', flexShrink: 0,
            }} />
          </div>
          <span className="badge badge-primary" style={{ marginTop: 4 }}>{agent.role}</span>
        </div>
      </div>

      <p className="agent-description line-clamp-3" style={{ marginTop: 12, marginBottom: 10 }}>
        {agent.description || 'No description provided.'}
      </p>

      {/* Meta badges */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        <span className="badge badge-warning">{agent.voice_id}</span>
        <span className="badge badge-teal">{agent.kb_count || 0} KB docs</span>
        <span className="badge badge-neutral">{agent.language}</span>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <Link to={`/agents/${agent.id}`} className="btn btn-primary btn-sm" style={{ flex: 1 }}>
          View
        </Link>
        <Link to={`/agents/${agent.id}?tab=test`} className="btn btn-secondary btn-sm">
          Test
        </Link>
        <Link to={`/agents/${agent.id}/edit`} className="btn btn-secondary btn-sm">
          Edit
        </Link>
        <button className="btn btn-danger btn-sm" onClick={() => onDelete(agent.id, agent.name)}>✕</button>
      </div>
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────
function StatCard({ label, value, icon, sub, delay = 0 }) {
  return (
    <div className="metric-card" style={{ animation: `slideUp 0.4s ease-out ${delay}ms both` }}>
      {icon && (
        <div className="metric-icon" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
          {icon}
        </div>
      )}
      <span className="metric-label">{label}</span>
      <span className="metric-value">{value}</span>
      {sub && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{sub}</span>}
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────
export default function Dashboard() {
  const [agents, setAgents]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [viewMode, setViewMode]   = useState('compact');
  const [analytics, setAnalytics] = useState(null);
  const [recentCalls, setRecentCalls] = useState([]);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    try {
      setLoading(true);
      const [agentData] = await Promise.all([
        agentsAPI.list(),
        loadAnalytics(),
      ]);
      setAgents(agentData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadAnalytics() {
    try {
      const [data, calls] = await Promise.all([
        analyticsAPI.dashboard(30),
        analyticsAPI.calls({ limit: 6 }),
      ]);
      setAnalytics(data);
      setRecentCalls(calls);
    } catch (_) {}
  }

  async function handleDelete(id, name) {
    if (!confirm(`Delete agent "${name}"? This cannot be undone.`)) return;
    try {
      await agentsAPI.delete(id);
      setAgents(a => a.filter(x => x.id !== id));
    } catch (err) {
      alert('Failed to delete: ' + err.message);
    }
  }

  if (loading) return (
    <div className="loading-container">
      <div className="spinner" />
      <span style={{ color: 'var(--text-muted)', fontSize: '0.84rem' }}>Loading workspace…</span>
    </div>
  );

  const totalKBs   = agents.reduce((s, a) => s + (a.kb_count || 0), 0);
  const langCount  = new Set(agents.map(a => a.language)).size;
  const hasStats   = analytics && typeof analytics.total_calls === 'number';
  const topIntent  = hasStats && analytics.top_intents?.[0]?.intent;

  const STATS = [
    { label: 'Agents',      value: agents.length,  icon: '🤖', delay: 0 },
    { label: 'Languages',   value: langCount,       icon: '🌐', delay: 60 },
    { label: 'KB Docs',     value: totalKBs,        icon: '📚', delay: 120 },
    { label: 'Calls (30d)', value: hasStats ? analytics.total_calls : '—', icon: '📞', delay: 180 },
    { label: 'Avg Duration',value: hasStats ? `${Math.round(analytics.avg_duration_sec)}s` : '—', icon: '⏱️', delay: 240 },
    { label: 'Top Intent',  value: topIntent || (hasStats ? '—' : '—'), icon: '🎯', delay: 300 },
  ];

  return (
    <div style={{ animation: 'pageEnter .4s ease-out' }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Your Agents</h1>
          <p className="page-subtitle">Design, test, and deploy AI voice agents from one command center.</p>
        </div>
        <div className="dashboard-header-actions">
          <div className="view-toggle">
            <button className={`view-toggle-btn ${viewMode === 'compact' ? 'active' : ''}`}
              onClick={() => setViewMode('compact')}>Compact</button>
            <button className={`view-toggle-btn ${viewMode === 'comfortable' ? 'active' : ''}`}
              onClick={() => setViewMode('comfortable')}>Wide</button>
          </div>
          <Link to="/agents/new" className="btn btn-primary">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            Create Agent
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="dashboard-metrics">
        {STATS.map(s => <StatCard key={s.label} {...s} />)}
      </div>

      {error && (
        <div className="toast toast-error" style={{ marginBottom: 'var(--space-lg)' }}>{error}</div>
      )}

      {/* Empty */}
      {agents.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="4" width="18" height="16" rx="3"/>
              <circle cx="9" cy="11" r="1.5"/><circle cx="15" cy="11" r="1.5"/>
              <path d="M9 15.5c1 1 5 1 6 0" strokeLinecap="round"/>
            </svg>
          </div>
          <h2 className="empty-state-title">No agents yet</h2>
          <p className="empty-state-text">
            Create your first AI voice agent to get started. It only takes a minute — no code required.
          </p>
          <Link to="/agents/new" className="btn btn-primary btn-lg">
            + Create your first agent
          </Link>
        </div>
      ) : (
        <div className="dashboard-grid">
          {/* Agent grid */}
          <div>
            <div className={`grid ${viewMode === 'compact' ? 'grid-agents-compact' : 'grid-2'}`}>
              {agents.map((a, i) => (
                <AgentCard key={a.id} agent={a} index={i} onDelete={handleDelete} compact={viewMode === 'compact'} />
              ))}
            </div>
          </div>

          {/* Side panel */}
          <div className="dashboard-side">
            {/* Recent calls */}
            <div className="card activity-card">
              <div className="activity-header">
                <div>
                  <div className="activity-title">Recent Calls</div>
                  <div className="activity-subtitle">Latest conversations</div>
                </div>
                <Link to="/calls" className="btn btn-ghost btn-sm">View all →</Link>
              </div>

              {recentCalls.length === 0 ? (
                <div className="activity-empty">No calls yet. Test your agent to see activity here.</div>
              ) : (
                <div className="activity-list">
                  {recentCalls.map(call => (
                    <div key={call.id} className="activity-item">
                      <div>
                        <div className="activity-name">{call.agent_name || 'Agent'}</div>
                        <div className="activity-meta">
                          {call.intent || 'general'} · {call.sentiment || '—'} · {Math.round(call.duration_sec || 0)}s
                        </div>
                      </div>
                      <span className={`status-pill status-${call.status || 'completed'}`}>
                        {call.status || 'done'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* System status */}
            <div className="card">
              <div className="activity-header">
                <div>
                  <div className="activity-title">System Status</div>
                  <div className="activity-subtitle">Production readiness check</div>
                </div>
              </div>
              <div className="activity-list">
                {[
                  { name: 'Voice agents', meta: `${agents.length} active`, ok: agents.length > 0 },
                  { name: 'Knowledge bases', meta: `${totalKBs} documents`, ok: totalKBs > 0 },
                  { name: 'Analytics pipeline', meta: 'Call tracking', ok: hasStats },
                ].map(item => (
                  <div key={item.name} className="activity-item">
                    <div>
                      <div className="activity-name">{item.name}</div>
                      <div className="activity-meta">{item.meta}</div>
                    </div>
                    <span className={`status-pill ${item.ok ? 'status-completed' : 'status-pending'}`}>
                      {item.ok ? 'ready' : 'setup'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
