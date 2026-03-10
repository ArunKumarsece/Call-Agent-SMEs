import { useState, useEffect } from 'react';
import { agentsAPI } from '../api';

export default function SDKCodeBlock({ agentId }) {
    const [sdk, setSdk] = useState(null);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState('');
    const [activeView, setActiveView] = useState('html');

    useEffect(() => {
        loadSDK();
    }, [agentId]);

    async function loadSDK() {
        try {
            setLoading(true);
            const data = await agentsAPI.getSDK(agentId);
            setSdk(data);
        } catch (err) {
            console.error('Failed to load SDK:', err);
        } finally {
            setLoading(false);
        }
    }

    function copyToClipboard(text, label) {
        navigator.clipboard.writeText(text).then(() => {
            setCopied(label);
            setTimeout(() => setCopied(''), 2000);
        });
    }

    if (loading) {
        return (
            <div className="loading-container">
                <div className="spinner"></div>
            </div>
        );
    }

    if (!sdk) {
        return (
            <div className="empty-state">
                <div className="empty-state-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                </div>
                <h2 className="empty-state-title">SDK not available</h2>
                <p className="empty-state-text">Could not generate SDK code. Please try again.</p>
            </div>
        );
    }

    return (
        <div style={{ animation: 'pageEnter 0.4s ease-out' }}>
            <div className="card" style={{ maxWidth: 900 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                    <div style={{
                        width: 40, height: 40, borderRadius: 12,
                        background: 'linear-gradient(135deg, rgba(108,92,231,0.15), rgba(0,206,201,0.15))',
                        border: '1px solid rgba(108,92,231,0.2)',
                        display: 'grid', placeItems: 'center',
                    }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6c5ce7" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
                    </div>
                    <div>
                        <h3 className="card-title" style={{ marginBottom: 2 }}>
                            Embed This Agent on Your Website
                        </h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                            Copy the code below and paste it into your website to add the AI voice agent widget.
                        </p>
                    </div>
                </div>

                {/* View Tabs */}
                <div className="tabs" style={{ marginBottom: 'var(--space-lg)' }}>
                    {[
                        { id: 'html', label: 'HTML Snippet' },
                        { id: 'config', label: 'JS Config' },
                        { id: 'instructions', label: 'Instructions' },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            className={`tab ${activeView === tab.id ? 'active' : ''}`}
                            onClick={() => setActiveView(tab.id)}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* HTML Snippet */}
                {activeView === 'html' && (
                    <div>
                        <div className="code-block-header">
                            <span style={{
                                fontWeight: 600,
                                fontSize: 'var(--font-sm)',
                                color: 'var(--text-secondary)',
                            }}>
                                HTML — Paste before &lt;/body&gt;
                            </span>
                            <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => copyToClipboard(sdk.html_snippet, 'html')}
                            >
                                {copied === 'html' ? 'Copied' : 'Copy'}
                            </button>
                        </div>
                        <div className="code-block">
                            <pre>{sdk.html_snippet}</pre>
                        </div>
                    </div>
                )}

                {/* JS Config */}
                {activeView === 'config' && (
                    <div>
                        <div className="code-block-header">
                            <span style={{
                                fontWeight: 600,
                                fontSize: 'var(--font-sm)',
                                color: 'var(--text-secondary)',
                            }}>
                                JavaScript Configuration
                            </span>
                            <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => copyToClipboard(sdk.js_config, 'config')}
                            >
                                {copied === 'config' ? 'Copied' : 'Copy'}
                            </button>
                        </div>
                        <div className="code-block">
                            <pre>{sdk.js_config}</pre>
                        </div>
                    </div>
                )}

                {/* Instructions */}
                {activeView === 'instructions' && (
                    <div>
                        <div className="code-block-header">
                            <span style={{
                                fontWeight: 600,
                                fontSize: 'var(--font-sm)',
                                color: 'var(--text-secondary)',
                            }}>
                                Integration Guide
                            </span>
                            <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => copyToClipboard(sdk.instructions, 'instructions')}
                            >
                                {copied === 'instructions' ? 'Copied' : 'Copy'}
                            </button>
                        </div>
                        <div className="code-block" style={{ whiteSpace: 'pre-wrap' }}>
                            <pre>{sdk.instructions}</pre>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
