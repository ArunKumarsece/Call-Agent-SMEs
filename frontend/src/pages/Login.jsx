import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
    const { login } = useAuth();
    const navigate  = useNavigate();
    const [form,    setForm]    = useState({ email: '', password: '' });
    const [error,   setError]   = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [focusedField, setFocusedField] = useState(null);

    async function handleSubmit(e) {
        e.preventDefault();
        setError(''); setLoading(true);
        try {
            await login(form.email, form.password);
            navigate('/', { replace: true });
        } catch (err) {
            setError(err.message);
            setLoading(false);
        }
    }

    return (
        <div className="auth-shell">
            <div className="auth-backdrop">
                <div className="auth-glow-1"></div>
                <div className="auth-glow-2"></div>
            </div>

            <section className="auth-panel auth-panel-brand">
                <div className="auth-brand-inner">
                    <p className="auth-kicker">Voice Intelligence Suite</p>
                    <h2 className="auth-brand-title">Build call agents that sound human and scale like software.</h2>
                    <p className="auth-brand-copy">
                        From onboarding scripts to multilingual support, VoiceForge helps teams launch reliable AI voice experiences in minutes.
                    </p>
                    
                    <div className="auth-brand-points">
                        <div className="auth-brand-point">
                            <span className="auth-point-icon"></span>
                            <span>Real-time voice interaction</span>
                        </div>
                        <div className="auth-brand-point">
                            <span className="auth-point-icon"></span>
                            <span>Knowledge-backed responses</span>
                        </div>
                        <div className="auth-brand-point">
                            <span className="auth-point-icon"></span>
                            <span>Deployment-ready SDK widgets</span>
                        </div>
                    </div>
                </div>
            </section>

            <section className="auth-panel auth-panel-form">
                <div className="auth-form-wrapper">
                    <div className="auth-card-logo">
                        <div className="auth-logo-icon"></div>
                        <span className="auth-logo-text">VoiceForge AI</span>
                    </div>
                    
                    <h1 className="auth-title">Welcome back</h1>
                    <p className="auth-subtitle">Sign in to your company workspace</p>

                    {error && <div className="auth-error-box" role="alert">
                        <span className="auth-error-icon"></span>
                        <span>{error}</span>
                    </div>}

                    <form onSubmit={handleSubmit} className="auth-form">
                        <div className="auth-field-group">
                            <label className="auth-label">Email address</label>
                            <div className="auth-input-wrapper">
                                <input
                                    className="auth-input"
                                    type="email" autoComplete="email" required
                                    placeholder="you@company.com"
                                    value={form.email}
                                    onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                                    onFocus={() => setFocusedField('email')}
                                    onBlur={() => setFocusedField(null)}
                                />
                                <div className="auth-input-focus-ring"></div>
                            </div>
                        </div>

                        <div className="auth-field-group">
                            <label className="auth-label">Password</label>
                            <div className="auth-input-wrapper auth-password-wrapper">
                                <input
                                    className="auth-input"
                                    type={showPassword ? 'text' : 'password'}
                                    autoComplete="current-password" required
                                    placeholder="••••••••"
                                    value={form.password}
                                    onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                                    onFocus={() => setFocusedField('password')}
                                    onBlur={() => setFocusedField(null)}
                                />
                                <button
                                    type="button"
                                    className="auth-password-toggle"
                                    onClick={() => setShowPassword(!showPassword)}
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                >
                                    {showPassword ? '✕' : '○'}
                                </button>
                                <div className="auth-input-focus-ring"></div>
                            </div>
                        </div>

                        <button type="submit" className="auth-submit-btn" style={{ opacity: loading ? 0.7 : 1 }} disabled={loading}>
                            {loading ? (
                                <>
                                    <span className="auth-btn-spinner"></span>
                                    Signing in…
                                </>
                            ) : (
                                <>Sign in<span className="auth-btn-arrow">→</span></>
                            )}
                        </button>
                    </form>

                    <p className="auth-switch-text">
                        Don't have an account?{' '}
                        <Link to="/register" className="auth-link">Create one free</Link>
                    </p>
                </div>
            </section>
        </div>
    );
}
