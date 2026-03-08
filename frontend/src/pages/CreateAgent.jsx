import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { agentsAPI, kbAPI, voicesAPI } from '../api';

const DEFAULT_SYSTEM_PROMPT = `You are a helpful customer support agent. 
Answer questions based on the knowledge base provided.
Be friendly, professional, and concise.
If you don't know something, honestly say so and offer to help find the answer.`;

export default function CreateAgent() {
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [voices, setVoices] = useState([]);
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState(null);

    // Agent form state
    const [form, setForm] = useState({
        name: '',
        role: 'Customer Support',
        description: '',
        system_prompt: DEFAULT_SYSTEM_PROMPT,
        voice_id: 'Puck',
        language: 'tanglish',
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

    async function handleSubmit(e) {
        e.preventDefault();
        if (!form.name.trim()) {
            showToast('Agent name is required', 'error');
            return;
        }

        setLoading(true);
        try {
            // Step 1: Create agent
            const agent = await agentsAPI.create(form);
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

    return (
        <div>
            {toast && (
                <div className={`toast toast-${toast.type}`}>{toast.message}</div>
            )}

            <div className="page-header">
                <div>
                    <h1 className="page-title">Create New Agent</h1>
                    <p className="page-subtitle">Set up your AI voice call agent in 3 easy steps</p>
                </div>
            </div>

            {/* Step indicators */}
            <div style={{
                display: 'flex', gap: 'var(--space-md)', marginBottom: 'var(--space-2xl)',
                justifyContent: 'center'
            }}>
                {[
                    { num: 1, label: 'Agent Details' },
                    { num: 2, label: 'Knowledge Base' },
                    { num: 3, label: 'Review & Create' },
                ].map(s => (
                    <button
                        key={s.num}
                        className={`btn ${step >= s.num ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                        onClick={() => { if (s.num < step) setStep(s.num); }}
                        style={{ cursor: s.num <= step ? 'pointer' : 'default', minWidth: 160 }}
                    >
                        {step > s.num ? '✅' : `${s.num}.`} {s.label}
                    </button>
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
                                        📄 Static (Files & Manual)
                                    </button>
                                    <button
                                        type="button"
                                        className={`btn ${kbType === 'dynamic' ? 'btn-primary' : 'btn-secondary'}`}
                                        onClick={() => setKbType('dynamic')}
                                    >
                                        📊 Dynamic (Google Sheets)
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
                                            <div style={{ fontSize: 32, marginBottom: 'var(--space-sm)' }}>📁</div>
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
                                                        <span>📎 {f.name} ({(f.size / 1024).toFixed(1)} KB)</span>
                                                        <button
                                                            type="button"
                                                            className="btn btn-ghost btn-sm"
                                                            onClick={() => setUploadFiles(uploadFiles.filter((_, idx) => idx !== i))}
                                                        >❌</button>
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
                                                    >❌</button>
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

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-lg)' }}>
                                <div>
                                    <h4 style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-xs)', textTransform: 'uppercase', marginBottom: 'var(--space-xs)' }}>Agent Name</h4>
                                    <p style={{ fontWeight: 600 }}>{form.name || '—'}</p>
                                </div>
                                <div>
                                    <h4 style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-xs)', textTransform: 'uppercase', marginBottom: 'var(--space-xs)' }}>Role</h4>
                                    <p><span className="badge badge-primary">{form.role}</span></p>
                                </div>
                                <div>
                                    <h4 style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-xs)', textTransform: 'uppercase', marginBottom: 'var(--space-xs)' }}>Voice</h4>
                                    <p>{form.voice_id}</p>
                                </div>
                                <div>
                                    <h4 style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-xs)', textTransform: 'uppercase', marginBottom: 'var(--space-xs)' }}>Language</h4>
                                    <p>{form.language}</p>
                                </div>
                                <div style={{ gridColumn: '1 / -1' }}>
                                    <h4 style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-xs)', textTransform: 'uppercase', marginBottom: 'var(--space-xs)' }}>Description</h4>
                                    <p>{form.description || '—'}</p>
                                </div>
                                <div style={{ gridColumn: '1 / -1' }}>
                                    <h4 style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-xs)', textTransform: 'uppercase', marginBottom: 'var(--space-xs)' }}>Knowledge Base</h4>
                                    <p>
                                        <span className="badge badge-warning">{kbType === 'static' ? '📄 Static' : '📊 Dynamic'}</span>
                                        {' '}{kbName}
                                        {kbType === 'static' && uploadFiles.length > 0 && (
                                            <span className="text-muted"> — {uploadFiles.length} file(s)</span>
                                        )}
                                        {kbType === 'dynamic' && sheetsUrl && (
                                            <span className="text-muted"> — Google Sheets linked</span>
                                        )}
                                    </p>
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-2xl)' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setStep(2)}>
                                    ← Back
                                </button>
                                <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
                                    {loading ? (
                                        <><div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }}></div> Creating...</>
                                    ) : (
                                        '🚀 Create Agent'
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
