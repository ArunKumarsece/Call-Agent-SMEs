import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Register() {
    const { register } = useAuth();
    const navigate     = useNavigate();
    const [form, setForm]       = useState({ company_name: '', full_name: '', email: '', password: '', confirm: '' });
    const [error, setError]     = useState('');
    const [loading, setLoading] = useState(false);

    const set = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        if (form.password.length < 8) { setError('Password must be at least 8 characters'); return; }
        if (form.password !== form.confirm) { setError('Passwords do not match'); return; }

        setLoading(true);
        try {
            await register({
                company_name: form.company_name,
                full_name:    form.full_name,
                email:        form.email,
                password:     form.password,
            });
            navigate('/', { replace: true });
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="auth-shell">
            <div className="auth-backdrop" />

            <section className="auth-panel auth-panel-brand">
                <div className="auth-brand-inner">
                    <p className="auth-kicker">Launch in Minutes</p>
                    <h2 className="auth-brand-title">Create your workspace and deploy your first voice agent today.</h2>
                    <p className="auth-brand-copy">
                        Centralize company knowledge, tune personality, and power customer conversations with production-grade reliability.
                    </p>
                    <div className="auth-brand-points">
                        <span>Setup-ready templates</span>
                        <span>Secure multi-tenant architecture</span>
                        <span>Fast embeddable widget</span>
                    </div>
                </div>
            </section>

            <section className="auth-panel auth-panel-form">
                <div className="auth-card-logo">
                    <span className="auth-logo-icon"></span>
                    <span className="auth-logo-text">VoiceForge AI</span>
                </div>
                <h1 className="auth-title">Create your account</h1>
                <p className="auth-subtitle">Set up your company workspace for free</p>

                {error && <div className="auth-error-box">{error}</div>}

                <form onSubmit={handleSubmit} className="auth-form">
                    <label className="auth-label">Company name <span style={{ color: '#e6492d' }}>*</span></label>
                    <input className="auth-input" required placeholder="Acme Corp" value={form.company_name} onChange={set('company_name')} />

                    <label className="auth-label">Your full name</label>
                    <input className="auth-input" placeholder="Jane Smith" value={form.full_name} onChange={set('full_name')} />

                    <label className="auth-label">Work email <span style={{ color: '#e6492d' }}>*</span></label>
                    <input className="auth-input" type="email" required autoComplete="email" placeholder="jane@acme.com" value={form.email} onChange={set('email')} />

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                            <label className="auth-label">Password <span style={{ color: '#e6492d' }}>*</span></label>
                            <input className="auth-input" type="password" required autoComplete="new-password" placeholder="Min 8 chars" value={form.password} onChange={set('password')} />
                        </div>
                        <div>
                            <label className="auth-label">Confirm password</label>
                            <input className="auth-input" type="password" required placeholder="Repeat" value={form.confirm} onChange={set('confirm')} />
                        </div>
                    </div>

                    {/* Password strength bar */}
                    {form.password && (
                        <div style={{ marginTop: 4 }}>
                            <div style={{ height: 4, borderRadius: 999, background: 'var(--border-color)', overflow: 'hidden' }}>
                                <div style={{
                                    height: '100%', borderRadius: 999, transition: 'width 0.3s',
                                    width: `${Math.min(form.password.length / 12 * 100, 100)}%`,
                                    background: form.password.length < 8 ? '#e6492d' : form.password.length < 12 ? '#d89b00' : '#16a34a',
                                }} />
                            </div>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'inline-block' }}>
                                {form.password.length < 8 ? 'Too short' : form.password.length < 12 ? 'Good' : 'Strong'}
                            </span>
                        </div>
                    )}

                    <button type="submit" className="auth-submit-btn" style={{ opacity: loading ? 0.7 : 1 }} disabled={loading}>
                        {loading ? 'Creating account…' : 'Create account →'}
                    </button>
                </form>

                <p className="auth-terms">
                    By registering you agree to our Terms of Service and Privacy Policy.
                </p>
                <p className="auth-switch-text">
                    Already have an account?{' '}
                    <Link to="/login" className="auth-link">Sign in</Link>
                </p>
            </section>
        </div>
    );
}
