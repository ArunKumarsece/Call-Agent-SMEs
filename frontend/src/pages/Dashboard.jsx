import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { agentsAPI } from '../api';

const ROLE_INITIALS = {
    'Customer Support': 'CS',
    'Sales': 'SL',
    'Technical Support': 'TS',
    'Receptionist': 'RC',
    'General Assistant': 'GA',
    'FAQ Bot': 'FQ',
};

const ROLE_COLORS = {
    'Customer Support': ['#6c5ce7', '#a29bfe'],
    'Sales': ['#00cec9', '#55efc4'],
    'Technical Support': ['#fd79a8', '#fab1d0'],
    'Receptionist': ['#fdcb6e', '#ffeaa7'],
    'General Assistant': ['#74b9ff', '#a1cbff'],
    'FAQ Bot': ['#00b894', '#55efc4'],
};

function AgentCardCompact({ agent, index, onDelete }) {
    const colors = ROLE_COLORS[agent.role] || ['#6c5ce7', '#a29bfe'];
    const initials = ROLE_INITIALS[agent.role] || 'AG';

    return (
        <div
            className="card agent-card compact"
            style={{ animation: `slideUp 0.45s ease-out ${index * 60}ms both` }}
        >
            {/* Top gradient accent line */}
            <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                background: `linear-gradient(90deg, ${colors[0]}, ${colors[1]})`,
                borderRadius: '24px 24px 0 0',
            }} />

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                {/* Agent Avatar */}
                <div style={{
                    width: 42, height: 42, borderRadius: 12, flexShrink: 0,
                    background: `linear-gradient(135deg, ${colors[0]}22, ${colors[1]}22)`,
                    border: `1px solid ${colors[0]}33`,
                    display: 'grid', placeItems: 'center', fontSize: 13,
                    fontWeight: 800, color: colors[0], letterSpacing: '-0.02em',
                }}>
                    {initials}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <h3 className="card-title" style={{ fontSize: '0.95rem' }}>{agent.name}</h3>
                        <div style={{
                            width: 8, height: 8, borderRadius: '50%',
                            background: '#00b894',
                            boxShadow: '0 0 8px rgba(0,184,148,0.5)',
                            flexShrink: 0,
                        }} title="Active" />
                    </div>
                    <span className="badge badge-primary" style={{ marginTop: 2 }}>{agent.role}</span>
                </div>
            </div>

            <p className="card-subtitle agent-description line-clamp-3" style={{
                marginTop: 10, marginBottom: 10, fontSize: '0.82rem', lineHeight: 1.5,
            }}>
                {agent.description || 'No description provided'}
            </p>

            {/* Meta pills */}
            <div className="agent-meta-row" style={{
                display: 'flex', gap: 6, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap',
            }}>
                <span className="badge badge-warning" style={{ fontSize: '0.58rem' }}>{agent.voice_id}</span>
                <span className="badge badge-primary" style={{ fontSize: '0.58rem' }}>{agent.kb_count || 0} KB</span>
                <span className="badge badge-success" style={{ fontSize: '0.58rem' }}>{agent.language}</span>
            </div>

            {/* Actions */}
            <div className="agent-actions" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <Link to={`/agents/${agent.id}`} className="btn btn-primary btn-sm" style={{
                    fontSize: '0.68rem', padding: '4px 10px', flex: 1,
                }}>
                    View
                </Link>
                <Link to={`/agents/${agent.id}/edit`} className="btn btn-secondary btn-sm" style={{
                    fontSize: '0.68rem', padding: '4px 10px',
                }}>
                    Edit
                </Link>
                <Link to={`/agents/${agent.id}?tab=test`} className="btn btn-secondary btn-sm" style={{
                    fontSize: '0.68rem', padding: '4px 10px',
                }}>
                    Test
                </Link>
                <button className="btn btn-danger btn-sm" onClick={() => onDelete(agent.id, agent.name)} style={{
                    fontSize: '0.68rem', padding: '4px 8px',
                }}>
                    ✕
                </button>
            </div>
        </div>
    );
}

function AgentCardComfortable({ agent, index, onDelete }) {
    const colors = ROLE_COLORS[agent.role] || ['#6c5ce7', '#a29bfe'];
    const initials = ROLE_INITIALS[agent.role] || 'AG';

    return (
        <div
            className="card agent-card comfortable"
            style={{ animation: `slideUp 0.45s ease-out ${index * 80}ms both` }}
        >
            {/* Top gradient accent */}
            <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                background: `linear-gradient(90deg, ${colors[0]}, ${colors[1]})`,
                borderRadius: '24px 24px 0 0',
            }} />

            <div className="card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{
                        width: 52, height: 52, borderRadius: 14, flexShrink: 0,
                        background: `linear-gradient(135deg, ${colors[0]}25, ${colors[1]}25)`,
                        border: `1px solid ${colors[0]}33`,
                        display: 'grid', placeItems: 'center', fontSize: 15,
                        fontWeight: 800, color: colors[0], letterSpacing: '-0.02em',
                    }}>
                        {initials}
                    </div>
                    <div>
                        <h3 className="card-title">{agent.name}</h3>
                        <span className="badge badge-primary" style={{ marginTop: 3 }}>{agent.role}</span>
                    </div>
                </div>
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '3px 10px', borderRadius: 999,
                    background: 'rgba(0,184,148,0.1)', border: '1px solid rgba(0,184,148,0.2)',
                }}>
                    <div style={{
                        width: 7, height: 7, borderRadius: '50%',
                        background: '#00b894',
                        boxShadow: '0 0 6px rgba(0,184,148,0.5)',
                    }} />
                    <span style={{ fontSize: '0.62rem', fontWeight: 700, color: '#55efc4', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active</span>
                </div>
            </div>

            <p className="card-subtitle agent-description line-clamp-6" style={{
                marginTop: 'var(--space-md)', marginBottom: 'var(--space-lg)',
            }}>
                {agent.description || 'No description provided'}
            </p>

            <div className="agent-meta-row" style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center', marginBottom: 'var(--space-md)', flexWrap: 'wrap' }}>
                <span className="badge badge-warning">{agent.voice_id}</span>
                <span className="badge badge-primary">{agent.kb_count || 0} KB</span>
                <span className="badge badge-success">{agent.language}</span>
            </div>

            <div className="agent-actions" style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
                <Link to={`/agents/${agent.id}`} className="btn btn-primary btn-sm">View Details</Link>
                <Link to={`/agents/${agent.id}/edit`} className="btn btn-secondary btn-sm">Edit</Link>
                <Link to={`/agents/${agent.id}?tab=test`} className="btn btn-secondary btn-sm">Test Call</Link>
                <Link to={`/agents/${agent.id}?tab=sdk`} className="btn btn-secondary btn-sm">SDK</Link>
                <button className="btn btn-danger btn-sm" onClick={() => onDelete(agent.id, agent.name)}>Delete</button>
            </div>
        </div>
    );
}

export default function Dashboard() {
    const [agents, setAgents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [viewMode, setViewMode] = useState('compact');

    useEffect(() => { loadAgents(); }, []);

    async function loadAgents() {
        try {
            setLoading(true);
            const data = await agentsAPI.list();
            setAgents(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    async function handleDelete(id, name) {
        if (!confirm(`Delete agent "${name}"? This cannot be undone.`)) return;
        try {
            await agentsAPI.delete(id);
            setAgents(agents.filter(a => a.id !== id));
        } catch (err) {
            alert('Failed to delete: ' + err.message);
        }
    }

    if (loading) {
        return (
            <div className="loading-container">
                <div className="spinner"></div>
            </div>
        );
    }

    const totalKBs = agents.reduce((sum, a) => sum + (a.kb_count || 0), 0);
    const langCount = new Set(agents.map(a => a.language)).size || 0;

    return (
        <div className="dashboard-page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Your Agents</h1>
                    <p className="page-subtitle">Design, test, and deploy your AI voice agents from one command center.</p>
                </div>
                <div className="dashboard-header-actions">
                    <div className="view-toggle" role="tablist" aria-label="Agent view mode">
                        <button type="button" className={`view-toggle-btn ${viewMode === 'compact' ? 'active' : ''}`}
                            onClick={() => setViewMode('compact')}>Compact</button>
                        <button type="button" className={`view-toggle-btn ${viewMode === 'comfortable' ? 'active' : ''}`}
                            onClick={() => setViewMode('comfortable')}>Comfortable</button>
                    </div>
                    <Link to="/agents/new" className="btn btn-primary btn-lg">
                        + Create Agent
                    </Link>
                </div>
            </div>

            {/* Metrics */}
            <div className="dashboard-metrics">
                {[
                    { label: 'Total Agents', value: agents.length },
                    { label: 'Languages', value: langCount },
                    { label: 'Knowledge Bases', value: totalKBs },
                ].map((m, i) => (
                    <div key={m.label} className="metric-card" style={{ animation: `slideUp 0.4s ease-out ${i * 80}ms both` }}>
                        <span className="metric-label">{m.label}</span>
                        <span className="metric-value">{m.value}</span>
                    </div>
                ))}
            </div>

            {error && (
                <div className="toast toast-error" style={{ position: 'static', marginBottom: 'var(--space-lg)' }}>
                    {error}
                </div>
            )}

            {agents.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" /><path d="M9 16h6" /></svg>
                    </div>
                    <h2 className="empty-state-title">No agents yet</h2>
                    <p className="empty-state-text">
                        Create your first AI voice agent to get started. It only takes a minute!
                    </p>
                    <Link to="/agents/new" className="btn btn-primary btn-lg">
                        + Create Your First Agent
                    </Link>
                </div>
            ) : (
                <div className={`grid ${viewMode === 'compact' ? 'grid-agents-compact' : 'grid-2'}`}>
                    {agents.map((agent, index) =>
                        viewMode === 'compact'
                            ? <AgentCardCompact key={agent.id} agent={agent} index={index} onDelete={handleDelete} />
                            : <AgentCardComfortable key={agent.id} agent={agent} index={index} onDelete={handleDelete} />
                    )}
                </div>
            )}
        </div>
    );
}
