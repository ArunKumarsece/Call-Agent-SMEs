import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { agentsAPI, kbAPI, createCallWebSocket } from '../api';
import VoiceCallWidget from '../components/VoiceCallWidget';
import KnowledgeBaseManager from '../components/KnowledgeBaseManager';
import SDKCodeBlock from '../components/SDKCodeBlock';

const ROLE_INITIALS = {
    'Customer Support': 'CS', 'Sales': 'SL', 'Technical Support': 'TS',
    'Receptionist': 'RC', 'General Assistant': 'GA', 'FAQ Bot': 'FQ',
};
const ROLE_COLORS = {
    'Customer Support': ['#6c5ce7', '#a29bfe'], 'Sales': ['#00cec9', '#55efc4'],
    'Technical Support': ['#fd79a8', '#fab1d0'], 'Receptionist': ['#fdcb6e', '#ffeaa7'],
    'General Assistant': ['#74b9ff', '#a1cbff'], 'FAQ Bot': ['#00b894', '#55efc4'],
};

export default function AgentDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [agent, setAgent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'overview');
    const [toast, setToast] = useState(null);

    useEffect(() => { loadAgent(); }, [id]);
    useEffect(() => { const tab = searchParams.get('tab'); if (tab) setActiveTab(tab); }, [searchParams]);

    async function loadAgent() {
        try {
            setLoading(true);
            const data = await agentsAPI.get(id);
            setAgent(data);
        } catch (err) {
            setToast({ message: err.message, type: 'error' });
        } finally {
            setLoading(false);
        }
    }

    async function handleDelete() {
        if (!confirm(`Delete agent "${agent.name}"? This will remove all knowledge bases and cannot be undone.`)) return;
        try {
            await agentsAPI.delete(id);
            navigate('/');
        } catch (err) {
            setToast({ message: 'Failed to delete: ' + err.message, type: 'error' });
        }
    }

    if (loading) {
        return <div className="loading-container"><div className="spinner"></div></div>;
    }

    if (!agent) {
        return (
            <div className="empty-state">
                <div className="empty-state-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M15 9l-6 6M9 9l6 6" /></svg>
                </div>
                <h2 className="empty-state-title">Agent not found</h2>
                <Link to="/" className="btn btn-primary">← Back to Dashboard</Link>
            </div>
        );
    }

    const initials = ROLE_INITIALS[agent.role] || 'AG';
    const colors = ROLE_COLORS[agent.role] || ['#6c5ce7', '#a29bfe'];

    const tabs = [
        { id: 'overview', label: 'Overview' },
        { id: 'kb', label: 'Knowledge Base' },
        { id: 'test', label: 'Test Call' },
        { id: 'sdk', label: 'SDK Code' },
    ];

    const detailFields = [
        { label: 'Voice', value: agent.voice_id },
        { label: 'Language', value: agent.language },
        { label: 'Knowledge Bases', value: `${agent.kb_count || 0} entries` },
        { label: 'Created', value: new Date(agent.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) },
    ];

    return (
        <div style={{ animation: 'pageEnter 0.5s ease-out' }}>
            {toast && <div className={`toast toast-${toast.type}`}>{toast.message}</div>}

            {/* Hero Header */}
            <div style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-xl)',
                padding: '2rem',
                marginBottom: '1.5rem',
                position: 'relative',
                overflow: 'hidden',
                backdropFilter: 'blur(16px)',
            }}>
                {/* Accent line */}
                <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                    background: `linear-gradient(90deg, ${colors[0]}, ${colors[1]})`,
                }} />

                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                    <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                        <Link to="/" className="btn btn-ghost btn-sm" style={{ marginRight: 4 }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
                        </Link>
                        <div style={{
                            width: 56, height: 56, borderRadius: 16,
                            background: `linear-gradient(135deg, ${colors[0]}25, ${colors[1]}25)`,
                            border: `1px solid ${colors[0]}33`,
                            display: 'grid', placeItems: 'center', fontSize: 18,
                            fontWeight: 800, color: colors[0], flexShrink: 0,
                        }}>
                            {initials}
                        </div>
                        <div>
                            <h1 className="page-title" style={{ fontSize: 'clamp(1.4rem, 2vw, 1.8rem)' }}>{agent.name}</h1>
                            <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                                <span className="badge badge-primary">{agent.role}</span>
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: 5,
                                    padding: '2px 10px', borderRadius: 999,
                                    background: 'rgba(0,184,148,0.1)', border: '1px solid rgba(0,184,148,0.2)',
                                }}>
                                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#00b894', boxShadow: '0 0 6px rgba(0,184,148,0.5)' }} />
                                    <span style={{ fontSize: '0.6rem', fontWeight: 700, color: '#55efc4', textTransform: 'uppercase' }}>Active</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                        <Link to={`/agents/${id}/edit`} className="btn btn-secondary">Edit</Link>
                        <button className="btn btn-danger" onClick={handleDelete}>Delete</button>
                    </div>
                </div>

                {/* Quick stats row */}
                <div style={{
                    display: 'flex', gap: 24, marginTop: 20, paddingTop: 16,
                    borderTop: '1px solid var(--border-color)', flexWrap: 'wrap',
                }}>
                    {detailFields.map(f => (
                        <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--primary)', flexShrink: 0 }} />
                            <div>
                                <div style={{ fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', fontWeight: 700 }}>{f.label}</div>
                                <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>{f.value}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Tabs */}
            <div className="tabs">
                {tabs.map(tab => (
                    <button key={tab.id} className={`tab ${activeTab === tab.id ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab.id)}>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div style={{ animation: 'fadeInUp 0.3s ease-out' }}>
                {activeTab === 'overview' && (
                    <div className="grid grid-2">
                        <div className="card">
                            <h3 className="card-title" style={{ marginBottom: 'var(--space-lg)', fontSize: '1rem' }}>Agent Details</h3>
                            {[
                                ['Name', agent.name],
                                ['Role', agent.role],
                                ['Description', agent.description || 'No description'],
                                ['Voice', agent.voice_id],
                                ['Language', agent.language],
                                ['Created', new Date(agent.created_at).toLocaleString()],
                            ].map(([label, val]) => (
                                <div key={label} style={{ marginBottom: 14 }}>
                                    <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', fontWeight: 700, marginBottom: 3 }}>{label}</div>
                                    <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                                        {label === 'Role' ? <span className="badge badge-primary">{val}</span> : val}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="card">
                            <h3 className="card-title" style={{ marginBottom: 'var(--space-lg)', fontSize: '1rem' }}>System Prompt</h3>
                            <div className="code-block">
                                <pre>{agent.system_prompt || 'No system prompt configured'}</pre>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'kb' && <KnowledgeBaseManager agentId={id} />}
                {activeTab === 'test' && <VoiceCallWidget agentId={id} agentName={agent.name} agent={agent} />}
                {activeTab === 'sdk' && <SDKCodeBlock agentId={id} />}
            </div>
        </div>
    );
}