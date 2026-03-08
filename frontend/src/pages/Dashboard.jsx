import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { agentsAPI } from '../api';

export default function Dashboard() {
    const [agents, setAgents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadAgents();
    }, []);

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

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Your Agents</h1>
                    <p className="page-subtitle">Manage your AI voice call agents</p>
                </div>
                <Link to="/agents/new" className="btn btn-primary btn-lg">
                    ✨ Create New Agent
                </Link>
            </div>

            {error && (
                <div className="toast toast-error" style={{ position: 'static', marginBottom: 'var(--space-lg)' }}>
                    ⚠️ {error}
                </div>
            )}

            {agents.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">🤖</div>
                    <h2 className="empty-state-title">No agents yet</h2>
                    <p className="empty-state-text">
                        Create your first AI voice agent to get started. It only takes a minute!
                    </p>
                    <Link to="/agents/new" className="btn btn-primary btn-lg">
                        ✨ Create Your First Agent
                    </Link>
                </div>
            ) : (
                <div className="grid grid-2">
                    {agents.map((agent, index) => (
                        <div
                            key={agent.id}
                            className="card"
                            style={{ animationDelay: `${index * 100}ms`, animation: `slideUp 0.4s ease-out ${index * 80}ms both` }}
                        >
                            <div className="card-header">
                                <div>
                                    <h3 className="card-title">{agent.name}</h3>
                                    <span className="badge badge-primary">{agent.role}</span>
                                </div>
                                <span className="badge badge-success">Active</span>
                            </div>

                            <p className="card-subtitle" style={{ marginTop: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
                                {agent.description || 'No description provided'}
                            </p>

                            <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
                                <span className="badge badge-warning">🎤 {agent.voice_id}</span>
                                <span className="badge badge-primary">📚 {agent.kb_count || 0} KB</span>
                                <span className="badge badge-success">🌐 {agent.language}</span>
                            </div>

                            <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
                                <Link to={`/agents/${agent.id}`} className="btn btn-primary btn-sm">
                                    👁️ View
                                </Link>
                                <Link to={`/agents/${agent.id}/edit`} className="btn btn-secondary btn-sm">
                                    ✏️ Edit
                                </Link>
                                <Link to={`/agents/${agent.id}?tab=test`} className="btn btn-secondary btn-sm">
                                    🧪 Test
                                </Link>
                                <Link to={`/agents/${agent.id}?tab=sdk`} className="btn btn-secondary btn-sm">
                                    📋 SDK
                                </Link>
                                <button
                                    className="btn btn-danger btn-sm"
                                    onClick={() => handleDelete(agent.id, agent.name)}
                                >
                                    🗑️ Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
