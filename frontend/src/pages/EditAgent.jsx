import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { agentsAPI, voicesAPI } from '../api';

const PERSONA_HEADER = '--- Persona Profile ---';
const PERSONA_FOOTER = '--- End Persona ---';

export default function EditAgent() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [voices, setVoices] = useState([]);
    const [toast, setToast] = useState(null);
    const [personaEnabled, setPersonaEnabled] = useState(false);
    const [form, setForm] = useState({
        name: '',
        role: '',
        description: '',
        system_prompt: '',
        voice_id: 'Puck',
        language: 'tanglish',
    });

    const [persona, setPersona] = useState({
        tone: 'friendly',
        pace: 'normal',
        empathy: 0.8,
        humor: 0.3,
        assertiveness: 0.6,
        backstory: '',
        signature_phrases: '',
        avoid_topics: '',
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

    function handlePersonaChange(e) {
        const { name, value } = e.target;
        setPersona({ ...persona, [name]: value });
    }

    function buildPersonaPrompt(p) {
        return [
            PERSONA_HEADER,
            `Tone: ${p.tone}`,
            `Speaking pace: ${p.pace}`,
            `Empathy: ${p.empathy}`,
            `Humor: ${p.humor}`,
            `Assertiveness: ${p.assertiveness}`,
            p.backstory ? `Backstory: ${p.backstory}` : null,
            p.signature_phrases ? `Signature phrases: ${p.signature_phrases}` : null,
            p.avoid_topics ? `Avoid topics: ${p.avoid_topics}` : null,
            PERSONA_FOOTER,
        ].filter(Boolean).join('\n');
    }

    function applyPersonaPrompt(basePrompt, personaBlock) {
        const cleaned = basePrompt
            .replace(new RegExp(`${PERSONA_HEADER}[\s\S]*?${PERSONA_FOOTER}`, 'g'), '')
            .trim();
        return personaBlock ? `${cleaned}\n\n${personaBlock}` : cleaned;
    }

    async function handleSubmit(e) {
        e.preventDefault();
        if (!form.name.trim()) {
            setToast({ message: 'Agent name is required', type: 'error' });
            return;
        }

        setSaving(true);
        try {
            const personaBlock = personaEnabled ? buildPersonaPrompt(persona) : '';
            const systemPrompt = personaEnabled
                ? applyPersonaPrompt(form.system_prompt, personaBlock)
                : form.system_prompt;
            await agentsAPI.update(id, { ...form, system_prompt: systemPrompt });
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
        <div style={{ animation: 'pageEnter 0.5s ease-out' }}>
            {toast && (
                <div className={`toast toast-${toast.type}`}>{toast.message}</div>
            )}

            <div className="page-header">
                <div>
                    <Link to={`/agents/${id}`} className="btn btn-ghost btn-sm" style={{ marginBottom: 'var(--space-sm)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
                        Back to Agent
                    </Link>
                    <h1 className="page-title">Edit Agent</h1>
                    <p className="page-subtitle">Update your agent's configuration and behavior</p>
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

                    <div className="form-group persona-panel">
                        <div className="form-row">
                            <div>
                                <label className="form-label">Persona Builder</label>
                                <p className="form-helper">Shape how the agent sounds and behaves.</p>
                            </div>
                            <label className="switch">
                                <input
                                    className="switch-input"
                                    type="checkbox"
                                    checked={personaEnabled}
                                    onChange={() => setPersonaEnabled(!personaEnabled)}
                                />
                                <span className="switch-track" />
                            </label>
                        </div>

                        {personaEnabled && (
                            <div className="persona-grid">
                                <div className="form-group">
                                    <label className="form-label">Tone</label>
                                    <select className="form-select" name="tone" value={persona.tone} onChange={handlePersonaChange}>
                                        <option value="friendly">Friendly</option>
                                        <option value="professional">Professional</option>
                                        <option value="casual">Casual</option>
                                        <option value="formal">Formal</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Pace</label>
                                    <select className="form-select" name="pace" value={persona.pace} onChange={handlePersonaChange}>
                                        <option value="slow">Slow</option>
                                        <option value="normal">Normal</option>
                                        <option value="fast">Fast</option>
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Empathy</label>
                                    <input className="range-input" type="range" min="0" max="1" step="0.1" name="empathy" value={persona.empathy} onChange={handlePersonaChange} />
                                    <div className="range-label">{persona.empathy}</div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Humor</label>
                                    <input className="range-input" type="range" min="0" max="1" step="0.1" name="humor" value={persona.humor} onChange={handlePersonaChange} />
                                    <div className="range-label">{persona.humor}</div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Assertiveness</label>
                                    <input className="range-input" type="range" min="0" max="1" step="0.1" name="assertiveness" value={persona.assertiveness} onChange={handlePersonaChange} />
                                    <div className="range-label">{persona.assertiveness}</div>
                                </div>

                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                    <label className="form-label">Backstory</label>
                                    <textarea className="form-textarea" name="backstory" value={persona.backstory} onChange={handlePersonaChange} style={{ minHeight: 80 }} />
                                </div>
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                    <label className="form-label">Signature Phrases</label>
                                    <input className="form-input" name="signature_phrases" value={persona.signature_phrases} onChange={handlePersonaChange} />
                                </div>
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                    <label className="form-label">Avoid Topics</label>
                                    <input className="form-input" name="avoid_topics" value={persona.avoid_topics} onChange={handlePersonaChange} />
                                </div>
                            </div>
                        )}
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
                                <option value="hindi_mix">Hinglish (Hindi + English)</option>
                                <option value="kannada_mix">Kannada + English</option>
                                <option value="telugu_mix">Telugu + English</option>
                                <option value="malayalam_mix">Malayalam + English</option>
                                <option value="pure_english">Pure English</option>
                            </select>
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-xl)' }}>
                        <Link to={`/agents/${id}`} className="btn btn-secondary">Cancel</Link>
                        <button type="submit" className="btn btn-primary" disabled={saving}>
                            {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
}
