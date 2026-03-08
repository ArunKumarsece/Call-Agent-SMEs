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
                <div className="empty-state-icon">⚠️</div>
                <h2 className="empty-state-title">SDK not available</h2>
                <p className="empty-state-text">Could not generate SDK code. Please try again.</p>
            </div>
        );
    }

    return (
        <div>
            <div className="card" style={{ maxWidth: 900 }}>
                <h3 className="card-title" style={{ marginBottom: 'var(--space-xs)' }}>
                    📋 Embed This Agent on Your Website
                </h3>
                <p className="card-subtitle" style={{ marginBottom: 'var(--space-xl)' }}>
                    Copy the code below and paste it into your website to add the AI voice agent widget.
                </p>

                {/* View Tabs */}
                <div className="tabs" style={{ marginBottom: 'var(--space-lg)' }}>
                    {[
                        { id: 'html', label: '🌐 HTML Snippet' },
                        { id: 'config', label: '⚙️ JS Config' },
                        { id: 'instructions', label: '📖 Instructions' },
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
                                {copied === 'html' ? '✅ Copied!' : '📋 Copy'}
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
                                {copied === 'config' ? '✅ Copied!' : '📋 Copy'}
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
                                {copied === 'instructions' ? '✅ Copied!' : '📋 Copy'}
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
