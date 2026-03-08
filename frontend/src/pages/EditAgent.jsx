import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { agentsAPI, voicesAPI } from '../api';

export default function EditAgent() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [voices, setVoices] = useState([]);
    const [toast, setToast] = useState(null);
    const [form, setForm] = useState({
        name: '',
        role: '',
        description: '',
        system_prompt: '',
        voice_id: 'Puck',
        language: 'tanglish',
    });

    useEffect(() => {
        loadData();
    }, [id]);

    async function loadData() {
        try {
            setLoading(true);
            const [agent, voiceData] = await Promise.all([
                agentsAPI.get(id),
                voicesAPI.list().catch(() => ({ voices: [] })),
            ]);
            setForm({
                name: agent.name,
                role: agent.role,
                description: agent.description || '',
                system_prompt: agent.system_prompt || '',
                voice_id: agent.voice_id,
                language: agent.language,
            });
            setVoices(voiceData.voices || [
                { id: 'Puck', name: 'Puck', gender: 'Male', style: 'Friendly' },
                { id: 'Charon', name: 'Charon', gender: 'Male', style: 'Professional' },
                { id: 'Kore', name: 'Kore', gender: 'Female', style: 'Warm' },
                { id: 'Fenrir', name: 'Fenrir', gender: 'Male', style: 'Deep' },
                { id: 'Aoede', name: 'Aoede', gender: 'Female', style: 'Clear' },
            ]);
        } catch (err) {
            setToast({ message: err.message, type: 'error' });
        } finally {
            setLoading(false);
        }
    }

    function handleChange(e) {
        setForm({ ...form, [e.target.name]: e.target.value });
    }

    async function handleSubmit(e) {
        e.preventDefault();
        if (!form.name.trim()) {
            setToast({ message: 'Agent name is required', type: 'error' });
            return;
        }

        setSaving(true);
        try {
            await agentsAPI.update(id, form);
            setToast({ message: 'Agent updated!', type: 'success' });
            setTimeout(() => navigate(`/agents/${id}`), 1000);
        } catch (err) {
            setToast({ message: 'Failed to update: ' + err.message, type: 'error' });
        } finally {
            setSaving(false);
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
            {toast && (
                <div className={`toast toast-${toast.type}`}>{toast.message}</div>
            )}

            <div className="page-header">
                <div>
                    <Link to={`/agents/${id}`} className="btn btn-ghost btn-sm" style={{ marginBottom: 'var(--space-sm)', display: 'inline-flex' }}>
                        ← Back to Agent
                    </Link>
                    <h1 className="page-title">Edit Agent</h1>
                </div>
            </div>

            <form onSubmit={handleSubmit}>
                <div className="card" style={{ maxWidth: 800, margin: '0 auto', padding: 'var(--space-2xl)' }}>
                    <div className="form-group">
                        <label className="form-label">Agent Name *</label>
                        <input className="form-input" name="name" value={form.name} onChange={handleChange} required />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Role</label>
                        <select className="form-select" name="role" value={form.role} onChange={handleChange}>
                            <option value="Customer Support">Customer Support</option>
                            <option value="Sales">Sales</option>
                            <option value="Technical Support">Technical Support</option>
                            <option value="Receptionist">Receptionist</option>
                            <option value="General Assistant">General Assistant</option>
                            <option value="FAQ Bot">FAQ Bot</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Description</label>
                        <textarea className="form-textarea" name="description" value={form.description} onChange={handleChange} style={{ minHeight: 80 }} />
                    </div>

                    <div className="form-group">
                        <label className="form-label">System Prompt</label>
                        <textarea className="form-textarea" name="system_prompt" value={form.system_prompt} onChange={handleChange} style={{ minHeight: 150 }} />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-lg)' }}>
                        <div className="form-group">
                            <label className="form-label">Voice</label>
                            <select className="form-select" name="voice_id" value={form.voice_id} onChange={handleChange}>
                                {voices.map(v => (
                                    <option key={v.id} value={v.id}>
                                        {v.name} ({v.gender} — {v.style})
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Language</label>
                            <select className="form-select" name="language" value={form.language} onChange={handleChange}>
                                <option value="tanglish">Tanglish (Tamil + English)</option>
                                <option value="english">English</option>
                                <option value="tamil">Tamil</option>
                            </select>
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-xl)' }}>
                        <Link to={`/agents/${id}`} className="btn btn-secondary">Cancel</Link>
                        <button type="submit" className="btn btn-primary" disabled={saving}>
                            {saving ? 'Saving...' : '💾 Save Changes'}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
}
