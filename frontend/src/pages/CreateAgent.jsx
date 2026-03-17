import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { agentsAPI, kbAPI, voicesAPI } from '../api';

const DEFAULT_SYSTEM_PROMPT = `You are a helpful customer support agent. 
Answer questions based on the knowledge base provided.
Be friendly, professional, and concise.
If you don't know something, honestly say so and offer to help find the answer.`;

const PERSONA_HEADER = '--- Persona Profile ---';
const PERSONA_FOOTER = '--- End Persona ---';

export default function CreateAgent() {
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [voices, setVoices] = useState([]);
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState(null);
    const [personaEnabled, setPersonaEnabled] = useState(true);

    // Agent form state
    const [form, setForm] = useState({
        name: '',
        role: 'Customer Support',
        description: '',
        system_prompt: DEFAULT_SYSTEM_PROMPT,
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

    // KB form state
    const [kbType, setKbType] = useState('static');
    const [kbName, setKbName] = useState('Default Knowledge Base');
    const [uploadFiles, setUploadFiles] = useState([]);
    const [manualEntries, setManualEntries] = useState(['']);
    const [sheetsUrl, setSheetsUrl] = useState('');

    useEffect(() => {
        loadVoices();
    }, []);

    async function loadVoices() {
        try {
            const data = await voicesAPI.list();
            setVoices(data.voices || []);
        } catch (err) {
            console.error('Failed to load voices:', err);
            setVoices([
                { id: 'Puck', name: 'Puck', gender: 'Male', style: 'Friendly' },
                { id: 'Charon', name: 'Charon', gender: 'Male', style: 'Professional' },
                { id: 'Kore', name: 'Kore', gender: 'Female', style: 'Warm' },
                { id: 'Fenrir', name: 'Fenrir', gender: 'Male', style: 'Deep' },
                { id: 'Aoede', name: 'Aoede', gender: 'Female', style: 'Clear' },
            ]);
        }
    }

    function showToast(message, type = 'info') {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
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
            showToast('Agent name is required', 'error');
            return;
        }

        setLoading(true);
        try {
            // Step 1: Create agent
            const personaBlock = personaEnabled ? buildPersonaPrompt(persona) : '';
            const systemPrompt = personaEnabled
                ? applyPersonaPrompt(form.system_prompt, personaBlock)
                : form.system_prompt;
            const agent = await agentsAPI.create({ ...form, system_prompt: systemPrompt });
            showToast('Agent created!', 'success');

            // Step 2: Create knowledge base
            const kb = await kbAPI.create(agent.id, {
                name: kbName || 'Default KB',
                kb_type: kbType,
                source_url: kbType === 'dynamic' ? sheetsUrl : null,
            });

            // Step 3: Upload files if static
            if (kbType === 'static') {
                for (const file of uploadFiles) {
                    try {
                        await kbAPI.uploadFile(kb.id, file);
                    } catch (err) {
                        console.error(`File upload failed: ${file.name}`, err);
                    }
                }

                // Add manual entries
                for (const entry of manualEntries) {
                    if (entry.trim()) {
                        try {
                            await kbAPI.addEntry(kb.id, entry.trim());
                        } catch (err) {
                            console.error('Manual entry failed:', err);
                        }
                    }
                }
            }

            navigate(`/agents/${agent.id}`);
        } catch (err) {
            showToast('Failed to create agent: ' + err.message, 'error');
        } finally {
            setLoading(false);
        }
    }

    const steps = [
        { num: 1, label: 'Agent Details' },
        { num: 2, label: 'Knowledge Base' },
        { num: 3, label: 'Review & Create' },
    ];

    return (
        <div style={{ animation: 'pageEnter 0.5s ease-out' }}>
            {toast && (
                <div className={`toast toast-${toast.type}`}>{toast.message}</div>
            )}

            <div className="page-header">
                <div>
                    <h1 className="page-title">Create New Agent</h1>
                    <p className="page-subtitle">Set up your AI voice call agent in 3 easy steps</p>
                </div>
            </div>

            {/* Step progress */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 0, marginBottom: 'var(--space-2xl)', padding: '0 var(--space-lg)',
            }}>
                {steps.map((s, i) => (
                    <div key={s.num} style={{ display: 'flex', alignItems: 'center' }}>
                        <button
                            type="button"
                            onClick={() => { if (s.num < step) setStep(s.num); }}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px',
                                borderRadius: 999, border: 'none', cursor: s.num <= step ? 'pointer' : 'default',
                                background: step === s.num
                                    ? 'linear-gradient(135deg, var(--primary), var(--accent))'
                                    : step > s.num ? 'rgba(0,184,148,0.15)' : 'var(--bg-input)',
                                color: step >= s.num ? '#fff' : 'var(--text-muted)',
                                fontWeight: 700, fontSize: '0.78rem', transition: 'all 0.3s ease',
                                boxShadow: step === s.num ? '0 4px 16px rgba(108,92,231,0.35)' : 'none',
                            }}
                        >
                            <span style={{
                                width: 22, height: 22, borderRadius: '50%',
                                background: step > s.num ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.15)',
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 12, fontWeight: 800,
                            }}>
                                {step > s.num ? (
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5" /></svg>
                                ) : s.num}
                            </span>
                            {s.label}
                        </button>
                        {i < steps.length - 1 && (
                            <div style={{
                                width: 40, height: 2, margin: '0 4px',
                                background: step > s.num ? 'var(--accent)' : 'var(--border-color)',
                                borderRadius: 2, transition: 'background 0.3s ease',
                            }} />
                        )}
                    </div>
                ))}
            </div>

            <form onSubmit={handleSubmit}>
                <div className="card" style={{ maxWidth: 800, margin: '0 auto', padding: 'var(--space-2xl)' }}>

                    {/* Step 1: Agent Details */}
                    {step === 1 && (
                        <div style={{ animation: 'slideUp 0.3s ease-out' }}>
                            <h2 style={{ fontSize: 'var(--font-xl)', fontWeight: 700, marginBottom: 'var(--space-xl)' }}>
                                Agent Details
                            </h2>

                            <div className="form-group">
                                <label className="form-label">Agent Name *</label>
                                <input
                                    className="form-input"
                                    name="name"
                                    value={form.name}
                                    onChange={handleChange}
                                    placeholder="e.g., SupportBot, CustomerHelper"
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Role *</label>
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
                                <textarea
                                    className="form-textarea"
                                    name="description"
                                    value={form.description}
                                    onChange={handleChange}
                                    placeholder="Describe what this agent does..."
                                    style={{ minHeight: 80 }}
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">System Prompt</label>
                                <textarea
                                    className="form-textarea"
                                    name="system_prompt"
                                    value={form.system_prompt}
                                    onChange={handleChange}
                                    placeholder="Instructions for the AI agent..."
                                    style={{ minHeight: 150 }}
                                />
                                <p className="form-helper">
                                    This prompt instructs the AI how to behave. The Tanglish response mode is automatically applied.
                                </p>
                            </div>

                            <div className="form-group persona-panel">
                                <div className="form-row">
                                    <div>
                                        <label className="form-label">Persona Builder</label>
                                        <p className="form-helper">
                                            Craft a distinct voice and personality for this agent.
                                        </p>
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
                                            <textarea className="form-textarea" name="backstory" value={persona.backstory} onChange={handlePersonaChange} placeholder="Where was this agent created?" style={{ minHeight: 80 }} />
                                        </div>
                                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                            <label className="form-label">Signature Phrases</label>
                                            <input className="form-input" name="signature_phrases" value={persona.signature_phrases} onChange={handlePersonaChange} placeholder="e.g., 'Absolutely!', 'Let me check that'" />
                                        </div>
                                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                            <label className="form-label">Avoid Topics</label>
                                            <input className="form-input" name="avoid_topics" value={persona.avoid_topics} onChange={handlePersonaChange} placeholder="e.g., competitor names, sensitive pricing" />
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

                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-xl)' }}>
                                <button type="button" className="btn btn-primary" onClick={() => {
                                    if (!form.name.trim()) { showToast('Agent name is required', 'error'); return; }
                                    setStep(2);
                                }}>
                                    Next: Knowledge Base →
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Knowledge Base */}
                    {step === 2 && (
                        <div style={{ animation: 'slideUp 0.3s ease-out' }}>
                            <h2 style={{ fontSize: 'var(--font-xl)', fontWeight: 700, marginBottom: 'var(--space-xl)' }}>
                                Knowledge Base
                            </h2>

                            <div className="form-group">
                                <label className="form-label">KB Name</label>
                                <input
                                    className="form-input"
                                    value={kbName}
                                    onChange={e => setKbName(e.target.value)}
                                    placeholder="e.g., Product FAQ, Support Docs"
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">KB Type</label>
                                <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
                                    <button
                                        type="button"
                                        className={`btn ${kbType === 'static' ? 'btn-primary' : 'btn-secondary'}`}
                                        onClick={() => setKbType('static')}
                                    >
                                        Static (Files & Manual)
                                    </button>
                                    <button
                                        type="button"
                                        className={`btn ${kbType === 'dynamic' ? 'btn-primary' : 'btn-secondary'}`}
                                        onClick={() => setKbType('dynamic')}
                                    >
                                        Dynamic (Google Sheets)
                                    </button>
                                </div>
                            </div>

                            {kbType === 'static' && (
                                <>
                                    <div className="form-group">
                                        <label className="form-label">Upload Files (CSV, PDF, Excel)</label>
                                        <div
                                            style={{
                                                border: '2px dashed var(--border-color)',
                                                borderRadius: 'var(--radius-md)',
                                                padding: 'var(--space-xl)',
                                                textAlign: 'center',
                                                cursor: 'pointer',
                                                transition: 'all var(--transition-fast)',
                                            }}
                                            onClick={() => document.getElementById('file-input').click()}
                                            onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--primary)'; }}
                                            onDragLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; }}
                                            onDrop={e => {
                                                e.preventDefault();
                                                e.currentTarget.style.borderColor = 'var(--border-color)';
                                                setUploadFiles([...uploadFiles, ...Array.from(e.dataTransfer.files)]);
                                            }}
                                        >
                                            <div style={{ fontSize: 32, marginBottom: 'var(--space-sm)', color: 'var(--text-muted)' }}>
                                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                                            </div>
                                            <p>Click or drag files here</p>
                                            <p className="form-helper">Supports CSV, PDF, Excel (.xlsx)</p>
                                        </div>
                                        <input
                                            id="file-input"
                                            type="file"
                                            multiple
                                            accept=".csv,.pdf,.xlsx,.xls"
                                            style={{ display: 'none' }}
                                            onChange={e => setUploadFiles([...uploadFiles, ...Array.from(e.target.files)])}
                                        />

                                        {uploadFiles.length > 0 && (
                                            <div style={{ marginTop: 'var(--space-md)' }}>
                                                {uploadFiles.map((f, i) => (
                                                    <div key={i} style={{
                                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                        padding: 'var(--space-sm) var(--space-md)',
                                                        background: 'var(--bg-input)',
                                                        borderRadius: 'var(--radius-sm)',
                                                        marginBottom: 'var(--space-xs)',
                                                        fontSize: 'var(--font-sm)',
                                                    }}>
                                                        <span>{f.name} ({(f.size / 1024).toFixed(1)} KB)</span>
                                                        <button
                                                            type="button"
                                                            className="btn btn-ghost btn-sm"
                                                            onClick={() => setUploadFiles(uploadFiles.filter((_, idx) => idx !== i))}
                                                        >
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label">Manual Entries</label>
                                        {manualEntries.map((entry, i) => (
                                            <div key={i} style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-sm)' }}>
                                                <textarea
                                                    className="form-textarea"
                                                    value={entry}
                                                    onChange={e => {
                                                        const updated = [...manualEntries];
                                                        updated[i] = e.target.value;
                                                        setManualEntries(updated);
                                                    }}
                                                    placeholder="Type or paste knowledge content here..."
                                                    style={{ minHeight: 80 }}
                                                />
                                                {manualEntries.length > 1 && (
                                                    <button
                                                        type="button"
                                                        className="btn btn-ghost btn-sm"
                                                        onClick={() => setManualEntries(manualEntries.filter((_, idx) => idx !== i))}
                                                    >
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                        <button
                                            type="button"
                                            className="btn btn-ghost btn-sm"
                                            onClick={() => setManualEntries([...manualEntries, ''])}
                                        >+ Add Another Entry</button>
                                    </div>
                                </>
                            )}

                            {kbType === 'dynamic' && (
                                <div className="form-group">
                                    <label className="form-label">Google Sheets URL</label>
                                    <input
                                        className="form-input"
                                        value={sheetsUrl}
                                        onChange={e => setSheetsUrl(e.target.value)}
                                        placeholder="https://docs.google.com/spreadsheets/d/..."
                                    />
                                    <p className="form-helper">
                                        Make sure the spreadsheet has view access (anyone with the link).
                                        Data will auto-sync to keep the knowledge base updated.
                                    </p>
                                </div>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-xl)' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setStep(1)}>
                                    ← Back
                                </button>
                                <button type="button" className="btn btn-primary" onClick={() => setStep(3)}>
                                    Next: Review →
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Review & Create */}
                    {step === 3 && (
                        <div style={{ animation: 'slideUp 0.3s ease-out' }}>
                            <h2 style={{ fontSize: 'var(--font-xl)', fontWeight: 700, marginBottom: 'var(--space-xl)' }}>
                                Review & Create
                            </h2>

                            <div style={{
                                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16,
                                background: 'var(--bg-input)', borderRadius: 'var(--radius-lg)',
                                padding: 'var(--space-xl)', border: '1px solid var(--border-color)',
                            }}>
                                {[
                                    { label: 'Agent Name', val: form.name || '—' },
                                    { label: 'Role', val: form.role, badge: true },
                                    { label: 'Voice', val: form.voice_id },
                                    { label: 'Language', val: form.language },
                                ].map(f => (
                                    <div key={f.label} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                                        <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--primary)', marginTop: 6, flexShrink: 0 }} />
                                        <div>
                                            <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', fontWeight: 700, marginBottom: 2 }}>{f.label}</div>
                                            {f.badge ? <span className="badge badge-primary">{f.val}</span> : <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{f.val}</div>}
                                        </div>
                                    </div>
                                ))}
                                <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--primary)', marginTop: 6, flexShrink: 0 }} />
                                    <div>
                                        <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', fontWeight: 700, marginBottom: 2 }}>Description</div>
                                        <div style={{ color: 'var(--text-primary)' }}>{form.description || '—'}</div>
                                    </div>
                                </div>
                                <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--primary)', marginTop: 6, flexShrink: 0 }} />
                                    <div>
                                        <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', fontWeight: 700, marginBottom: 2 }}>Knowledge Base</div>
                                        <div>
                                            <span className="badge badge-warning">{kbType === 'static' ? 'Static' : 'Dynamic'}</span>
                                            {' '}{kbName}
                                            {kbType === 'static' && uploadFiles.length > 0 && (
                                                <span style={{ color: 'var(--text-muted)' }}> — {uploadFiles.length} file(s)</span>
                                            )}
                                            {kbType === 'dynamic' && sheetsUrl && (
                                                <span style={{ color: 'var(--text-muted)' }}> — Google Sheets linked</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-2xl)' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setStep(2)}>
                                    ← Back
                                </button>
                                <button type="submit" className="btn btn-primary btn-lg" disabled={loading}
                                    style={{ minWidth: 180, fontSize: '1rem' }}>
                                    {loading ? (
                                        <><div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }}></div> Creating...</>
                                    ) : (
                                        'Create Agent'
                                    )}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </form>
        </div>
    );
}
