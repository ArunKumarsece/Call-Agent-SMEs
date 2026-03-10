import { useState, useEffect } from 'react';
import { kbAPI } from '../api';

export default function KnowledgeBaseManager({ agentId }) {
    const [kbs, setKbs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [selectedKb, setSelectedKb] = useState(null);
    const [entries, setEntries] = useState([]);
    const [toast, setToast] = useState(null);

    // Create KB form
    const [newKbName, setNewKbName] = useState('');
    const [newKbType, setNewKbType] = useState('static');
    const [newKbUrl, setNewKbUrl] = useState('');

    // Manual entry
    const [manualText, setManualText] = useState('');
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        loadKBs();
    }, [agentId]);

    async function loadKBs() {
        try {
            setLoading(true);
            const data = await kbAPI.list(agentId);
            setKbs(data);
            if (data.length > 0 && !selectedKb) {
                selectKB(data[0]);
            }
        } catch (err) {
            showToastMsg('Failed to load knowledge bases', 'error');
        } finally {
            setLoading(false);
        }
    }

    async function selectKB(kb) {
        setSelectedKb(kb);
        try {
            const data = await kbAPI.listEntries(kb.id);
            setEntries(data);
        } catch (err) {
            console.error('Failed to load entries:', err);
            setEntries([]);
        }
    }

    function showToastMsg(message, type = 'info') {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    }

    async function handleCreateKB(e) {
        e.preventDefault();
        if (!newKbName.trim()) return;

        try {
            const kb = await kbAPI.create(agentId, {
                name: newKbName,
                kb_type: newKbType,
                source_url: newKbType === 'dynamic' ? newKbUrl : null,
            });
            setKbs([kb, ...kbs]);
            selectKB(kb);
            setShowCreate(false);
            setNewKbName('');
            setNewKbUrl('');
            showToastMsg('Knowledge base created!', 'success');
        } catch (err) {
            showToastMsg('Failed to create KB: ' + err.message, 'error');
        }
    }

    async function handleDeleteKB(kbId) {
        if (!confirm('Delete this knowledge base?')) return;
        try {
            await kbAPI.delete(kbId);
            setKbs(kbs.filter(k => k.id !== kbId));
            if (selectedKb?.id === kbId) {
                setSelectedKb(null);
                setEntries([]);
            }
            showToastMsg('Knowledge base deleted', 'success');
        } catch (err) {
            showToastMsg('Delete failed: ' + err.message, 'error');
        }
    }

    async function handleFileUpload(e) {
        const file = e.target.files[0];
        if (!file || !selectedKb) return;

        setUploading(true);
        try {
            const result = await kbAPI.uploadFile(selectedKb.id, file);
            showToastMsg(`Uploaded: ${result.entries_created} chunks processed`, 'success');
            selectKB(selectedKb);
            loadKBs();
        } catch (err) {
            showToastMsg('Upload failed: ' + err.message, 'error');
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    }

    async function handleAddEntry() {
        if (!manualText.trim() || !selectedKb) return;

        try {
            await kbAPI.addEntry(selectedKb.id, manualText.trim());
            showToastMsg('Entry added!', 'success');
            setManualText('');
            selectKB(selectedKb);
            loadKBs();
        } catch (err) {
            showToastMsg('Failed to add entry: ' + err.message, 'error');
        }
    }

    async function handleDeleteEntry(entryId) {
        if (!selectedKb) return;
        try {
            await kbAPI.deleteEntry(selectedKb.id, entryId);
            setEntries(entries.filter(e => e.id !== entryId));
            loadKBs();
        } catch (err) {
            showToastMsg('Failed to delete entry', 'error');
        }
    }

    async function handleSync() {
        if (!selectedKb) return;
        try {
            setUploading(true);
            const result = await kbAPI.sync(selectedKb.id);
            showToastMsg(`Synced: ${result.entries} entries from Google Sheets`, 'success');
            selectKB(selectedKb);
            loadKBs();
        } catch (err) {
            showToastMsg('Sync failed: ' + err.message, 'error');
        } finally {
            setUploading(false);
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
        <div style={{ animation: 'pageEnter 0.4s ease-out' }}>
            {toast && <div className={`toast toast-${toast.type}`}>{toast.message}</div>}

            <div style={{ display: 'flex', gap: 'var(--space-lg)' }}>
                {/* KB Sidebar */}
                <div style={{
                    width: 280, flexShrink: 0, background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)', borderRadius: 'var(--radius-xl)',
                    padding: 'var(--space-lg)', alignSelf: 'flex-start',
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
                        <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>Knowledge Bases</h3>
                        <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(!showCreate)}>
                            + New
                        </button>
                    </div>

                    {showCreate && (
                        <form onSubmit={handleCreateKB} className="card" style={{ padding: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>
                            <input
                                className="form-input"
                                value={newKbName}
                                onChange={e => setNewKbName(e.target.value)}
                                placeholder="KB Name"
                                style={{ marginBottom: 'var(--space-sm)', fontSize: 'var(--font-sm)' }}
                            />
                            <div style={{ display: 'flex', gap: 'var(--space-xs)', marginBottom: 'var(--space-sm)' }}>
                                <button type="button"
                                    className={`btn btn-sm ${newKbType === 'static' ? 'btn-primary' : 'btn-ghost'}`}
                                    onClick={() => setNewKbType('static')}
                                >Static</button>
                                <button type="button"
                                    className={`btn btn-sm ${newKbType === 'dynamic' ? 'btn-primary' : 'btn-ghost'}`}
                                    onClick={() => setNewKbType('dynamic')}
                                >Dynamic</button>
                            </div>
                            {newKbType === 'dynamic' && (
                                <input
                                    className="form-input"
                                    value={newKbUrl}
                                    onChange={e => setNewKbUrl(e.target.value)}
                                    placeholder="Google Sheets URL"
                                    style={{ marginBottom: 'var(--space-sm)', fontSize: 'var(--font-sm)' }}
                                />
                            )}
                            <button type="submit" className="btn btn-primary btn-sm" style={{ width: '100%' }}>
                                Create KB
                            </button>
                        </form>
                    )}

                    {kbs.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-sm)' }}>
                            No knowledge bases yet. Create one to get started.
                        </p>
                    ) : (
                        kbs.map(kb => (
                            <div
                                key={kb.id}
                                onClick={() => selectKB(kb)}
                                style={{
                                    padding: '10px 12px',
                                    borderRadius: 'var(--radius-md)',
                                    cursor: 'pointer',
                                    marginBottom: 4,
                                    position: 'relative',
                                    background: selectedKb?.id === kb.id ? 'rgba(108,92,231,0.1)' : 'transparent',
                                    border: `1px solid ${selectedKb?.id === kb.id ? 'rgba(108,92,231,0.25)' : 'transparent'}`,
                                    transition: 'all var(--transition-fast)',
                                    borderLeft: selectedKb?.id === kb.id ? '3px solid var(--primary)' : '3px solid transparent',
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontWeight: 600, fontSize: 'var(--font-sm)' }}>{kb.name}</span>
                                    <button
                                        className="btn btn-ghost btn-sm"
                                        onClick={e => { e.stopPropagation(); handleDeleteKB(kb.id); }}
                                        style={{ padding: '2px 6px', fontSize: 'var(--font-xs)' }}
                                    >
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                                    </button>
                                </div>
                                <div style={{ display: 'flex', gap: 'var(--space-xs)', marginTop: 'var(--space-xs)' }}>
                                    <span className={`badge ${kb.kb_type === 'static' ? 'badge-primary' : 'badge-warning'}`}>
                                        {kb.kb_type}
                                    </span>
                                    <span className="badge badge-success">{kb.entry_count || 0} entries</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* KB Content */}
                <div style={{ flex: 1 }}>
                    {selectedKb ? (
                        <div className="card">
                            <div className="card-header">
                                <div>
                                    <h3 className="card-title">{selectedKb.name}</h3>
                                    <div style={{ display: 'flex', gap: 'var(--space-xs)', marginTop: 'var(--space-xs)' }}>
                                        <span className={`badge ${selectedKb.kb_type === 'static' ? 'badge-primary' : 'badge-warning'}`}>
                                            {selectedKb.kb_type === 'static' ? 'Static' : 'Dynamic'}
                                        </span>
                                        <span className="badge badge-success">{entries.length} entries</span>
                                    </div>
                                </div>
                            </div>

                            {/* Upload / Add section */}
                            {selectedKb.kb_type === 'static' && (
                                <div style={{ display: 'flex', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)', flexWrap: 'wrap' }}>
                                    <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                                        {uploading ? 'Uploading...' : 'Upload File'}
                                        <input
                                            type="file"
                                            accept=".csv,.pdf,.xlsx,.xls"
                                            onChange={handleFileUpload}
                                            style={{ display: 'none' }}
                                            disabled={uploading}
                                        />
                                    </label>
                                </div>
                            )}

                            {selectedKb.kb_type === 'dynamic' && (
                                <div style={{ marginBottom: 'var(--space-lg)' }}>
                                    <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-sm)' }}>
                                        Linked to: <a href={selectedKb.source_url} target="_blank" rel="noopener noreferrer">
                                            Google Sheets
                                        </a>
                                    </p>
                                    <button
                                        className="btn btn-secondary btn-sm"
                                        onClick={handleSync}
                                        disabled={uploading}
                                    >
                                        {uploading ? 'Syncing...' : 'Sync Now'}
                                    </button>
                                </div>
                            )}

                            {/* Manual entry */}
                            {selectedKb.kb_type === 'static' && (
                                <div style={{ marginBottom: 'var(--space-xl)' }}>
                                    <label className="form-label">Add Manual Entry</label>
                                    <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                                        <textarea
                                            className="form-textarea"
                                            value={manualText}
                                            onChange={e => setManualText(e.target.value)}
                                            placeholder="Type knowledge content here..."
                                            style={{ minHeight: 60 }}
                                        />
                                        <button className="btn btn-primary" onClick={handleAddEntry} style={{ alignSelf: 'flex-end' }}>
                                            Add
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Entries list */}
                            <h4 style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 'var(--space-md)' }}>
                                Entries ({entries.length})
                            </h4>

                            {entries.length === 0 ? (
                                <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-sm)', textAlign: 'center', padding: 'var(--space-xl)' }}>
                                    No entries yet. Upload files or add manual entries.
                                </p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 400, overflowY: 'auto' }}>
                                    {entries.map(entry => (
                                        <div key={entry.id} style={{
                                            padding: '12px 14px',
                                            background: 'var(--bg-input)',
                                            borderRadius: 'var(--radius-md)',
                                            border: '1px solid var(--border-color)',
                                            fontSize: '0.82rem',
                                            transition: 'border-color 0.2s ease',
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                <p style={{ flex: 1, lineHeight: 1.6 }}>
                                                    {entry.content.length > 200
                                                        ? entry.content.substring(0, 200) + '...'
                                                        : entry.content
                                                    }
                                                </p>
                                                <button
                                                    className="btn btn-ghost btn-sm"
                                                    onClick={() => handleDeleteEntry(entry.id)}
                                                    style={{ marginLeft: 'var(--space-sm)', flexShrink: 0 }}
                                                >
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                                                </button>
                                            </div>
                                            <div style={{ display: 'flex', gap: 'var(--space-xs)', marginTop: 'var(--space-xs)' }}>
                                                <span className="badge badge-primary" style={{ fontSize: '10px' }}>
                                                    {entry.source_file || 'manual'}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="empty-state">
                            <div className="empty-state-icon">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>
                            </div>
                            <h2 className="empty-state-title">Select a Knowledge Base</h2>
                            <p className="empty-state-text">Choose a KB from the sidebar or create a new one.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
