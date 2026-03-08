// import { useState, useEffect, useRef } from 'react';
// import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
// import { agentsAPI, kbAPI, createCallWebSocket } from '../api';
// import VoiceCallWidget from '../components/VoiceCallWidget';
// import KnowledgeBaseManager from '../components/KnowledgeBaseManager';
// import SDKCodeBlock from '../components/SDKCodeBlock';

// export default function AgentDetail() {
//     const { id } = useParams();
//     const navigate = useNavigate();
//     const [searchParams] = useSearchParams();
//     const [agent, setAgent] = useState(null);
//     const [loading, setLoading] = useState(true);
//     const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'overview');
//     const [toast, setToast] = useState(null);

//     useEffect(() => {
//         loadAgent();
//     }, [id]);

//     useEffect(() => {
//         const tab = searchParams.get('tab');
//         if (tab) setActiveTab(tab);
//     }, [searchParams]);

//     async function loadAgent() {
//         try {
//             setLoading(true);
//             const data = await agentsAPI.get(id);
//             setAgent(data);
//         } catch (err) {
//             setToast({ message: err.message, type: 'error' });
//         } finally {
//             setLoading(false);
//         }
//     }

//     async function handleDelete() {
//         if (!confirm(`Delete agent "${agent.name}"? This will remove all knowledge bases and cannot be undone.`)) return;
//         try {
//             await agentsAPI.delete(id);
//             navigate('/');
//         } catch (err) {
//             setToast({ message: 'Failed to delete: ' + err.message, type: 'error' });
//         }
//     }

//     if (loading) {
//         return (
//             <div className="loading-container">
//                 <div className="spinner"></div>
//             </div>
//         );
//     }

//     if (!agent) {
//         return (
//             <div className="empty-state">
//                 <div className="empty-state-icon">❌</div>
//                 <h2 className="empty-state-title">Agent not found</h2>
//                 <Link to="/" className="btn btn-primary">← Back to Dashboard</Link>
//             </div>
//         );
//     }

//     const tabs = [
//         { id: 'overview', label: '📋 Overview' },
//         { id: 'kb', label: '📚 Knowledge Base' },
//         { id: 'test', label: '🧪 Test Call' },
//         { id: 'sdk', label: '📋 SDK Code' },
//     ];

//     return (
//         <div>
//             {toast && (
//                 <div className={`toast toast-${toast.type}`}>
//                     {toast.message}
//                 </div>
//             )}

//             <div className="page-header">
//                 <div>
//                     <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: 'var(--space-sm)' }}>
//                         <Link to="/" className="btn btn-ghost btn-sm">← Back</Link>
//                     </div>
//                     <h1 className="page-title">{agent.name}</h1>
//                     <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-sm)', flexWrap: 'wrap' }}>
//                         <span className="badge badge-primary">{agent.role}</span>
//                         <span className="badge badge-warning">🎤 {agent.voice_id}</span>
//                         <span className="badge badge-success">🌐 {agent.language}</span>
//                         <span className="badge badge-primary">📚 {agent.kb_count || 0} KB</span>
//                     </div>
//                 </div>
//                 <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
//                     <Link to={`/agents/${id}/edit`} className="btn btn-secondary">
//                         ✏️ Edit
//                     </Link>
//                     <button className="btn btn-danger" onClick={handleDelete}>
//                         🗑️ Delete
//                     </button>
//                 </div>
//             </div>

//             {/* Tabs */}
//             <div className="tabs">
//                 {tabs.map(tab => (
//                     <button
//                         key={tab.id}
//                         className={`tab ${activeTab === tab.id ? 'active' : ''}`}
//                         onClick={() => setActiveTab(tab.id)}
//                     >
//                         {tab.label}
//                     </button>
//                 ))}
//             </div>

//             {/* Tab Content */}
//             <div style={{ animation: 'fadeIn 0.2s ease-out' }}>
//                 {activeTab === 'overview' && (
//                     <div className="grid grid-2">
//                         <div className="card">
//                             <h3 className="card-title" style={{ marginBottom: 'var(--space-lg)' }}>Agent Details</h3>
//                             <div className="form-group">
//                                 <label className="form-label">Name</label>
//                                 <p>{agent.name}</p>
//                             </div>
//                             <div className="form-group">
//                                 <label className="form-label">Role</label>
//                                 <p><span className="badge badge-primary">{agent.role}</span></p>
//                             </div>
//                             <div className="form-group">
//                                 <label className="form-label">Description</label>
//                                 <p>{agent.description || 'No description'}</p>
//                             </div>
//                             <div className="form-group">
//                                 <label className="form-label">Voice</label>
//                                 <p>{agent.voice_id}</p>
//                             </div>
//                             <div className="form-group">
//                                 <label className="form-label">Language</label>
//                                 <p>{agent.language}</p>
//                             </div>
//                             <div className="form-group">
//                                 <label className="form-label">Created</label>
//                                 <p>{new Date(agent.created_at).toLocaleString()}</p>
//                             </div>
//                         </div>

//                         <div className="card">
//                             <h3 className="card-title" style={{ marginBottom: 'var(--space-lg)' }}>System Prompt</h3>
//                             <div className="code-block">
//                                 <pre>{agent.system_prompt || 'No system prompt configured'}</pre>
//                             </div>
//                         </div>
//                     </div>
//                 )}

//                 {activeTab === 'kb' && (
//                     <KnowledgeBaseManager agentId={id} />
//                 )}

//                 {activeTab === 'test' && (
//                     <VoiceCallWidget agentId={id} agentName={agent.name} agent={agent} />
//                 )}

//                 {activeTab === 'sdk' && (
//                     <SDKCodeBlock agentId={id} />
//                 )}
//             </div>
//         </div>
//     );
// }


import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { agentsAPI, kbAPI, createCallWebSocket } from '../api';
import VoiceCallWidget from '../components/VoiceCallWidget';
import KnowledgeBaseManager from '../components/KnowledgeBaseManager';
import SDKCodeBlock from '../components/SDKCodeBlock';

export default function AgentDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [agent, setAgent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'overview');
    const [toast, setToast] = useState(null);

    useEffect(() => {
        loadAgent();
    }, [id]);

    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab) setActiveTab(tab);
    }, [searchParams]);

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
        return (
            <div className="loading-container">
                <div className="spinner"></div>
            </div>
        );
    }

    if (!agent) {
        return (
            <div className="empty-state">
                <div className="empty-state-icon">❌</div>
                <h2 className="empty-state-title">Agent not found</h2>
                <Link to="/" className="btn btn-primary">← Back to Dashboard</Link>
            </div>
        );
    }

    const tabs = [
        { id: 'overview', label: '📋 Overview' },
        { id: 'kb', label: '📚 Knowledge Base' },
        { id: 'test', label: '🧪 Test Call' },
        { id: 'sdk', label: '📋 SDK Code' },
    ];

    return (
        <div>
            {toast && (
                <div className={`toast toast-${toast.type}`}>
                    {toast.message}
                </div>
            )}

            <div className="page-header">
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: 'var(--space-sm)' }}>
                        <Link to="/" className="btn btn-ghost btn-sm">← Back</Link>
                    </div>
                    <h1 className="page-title">{agent.name}</h1>
                    <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-sm)', flexWrap: 'wrap' }}>
                        <span className="badge badge-primary">{agent.role}</span>
                        <span className="badge badge-warning">🎤 {agent.voice_id}</span>
                        <span className="badge badge-success">🌐 {agent.language}</span>
                        <span className="badge badge-primary">📚 {agent.kb_count || 0} KB</span>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                    <Link to={`/agents/${id}/edit`} className="btn btn-secondary">
                        ✏️ Edit
                    </Link>
                    <button className="btn btn-danger" onClick={handleDelete}>
                        🗑️ Delete
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="tabs">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        className={`tab ${activeTab === tab.id ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div style={{ animation: 'fadeIn 0.2s ease-out' }}>
                {activeTab === 'overview' && (
                    <div className="grid grid-2">
                        <div className="card">
                            <h3 className="card-title" style={{ marginBottom: 'var(--space-lg)' }}>Agent Details</h3>
                            <div className="form-group">
                                <label className="form-label">Name</label>
                                <p>{agent.name}</p>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Role</label>
                                <p><span className="badge badge-primary">{agent.role}</span></p>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Description</label>
                                <p>{agent.description || 'No description'}</p>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Voice</label>
                                <p>{agent.voice_id}</p>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Language</label>
                                <p>{agent.language}</p>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Created</label>
                                <p>{new Date(agent.created_at).toLocaleString()}</p>
                            </div>
                        </div>

                        <div className="card">
                            <h3 className="card-title" style={{ marginBottom: 'var(--space-lg)' }}>System Prompt</h3>
                            <div className="code-block">
                                <pre>{agent.system_prompt || 'No system prompt configured'}</pre>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'kb' && (
                    <KnowledgeBaseManager agentId={id} />
                )}

                {activeTab === 'test' && (
                    <VoiceCallWidget agentId={id} agentName={agent.name} agent={agent} />
                )}

                {activeTab === 'sdk' && (
                    <SDKCodeBlock agentId={id} />
                )}
            </div>
        </div>
    );
}