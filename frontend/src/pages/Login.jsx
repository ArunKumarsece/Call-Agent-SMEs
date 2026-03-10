import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
    const { login } = useAuth();
    const navigate  = useNavigate();
    const [form,    setForm]    = useState({ email: '', password: '' });
    const [error,   setError]   = useState('');
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e) {
        e.preventDefault();
        setError(''); setLoading(true);
        try {
            await login(form.email, form.password);
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
                    <p className="auth-kicker">Voice Intelligence Suite</p>
                    <h2 className="auth-brand-title">Build call agents that sound human and scale like software.</h2>
                    <p className="auth-brand-copy">
                        From onboarding scripts to multilingual support, VoiceForge helps teams launch reliable AI voice experiences in minutes.
                    </p>
                    <div className="auth-brand-points">
                        <span>Real-time voice interaction</span>
                        <span>Knowledge-backed responses</span>
                        <span>Deployment-ready SDK widgets</span>
                    </div>
                </div>
            </section>

            <section className="auth-panel auth-panel-form">
                <div className="auth-card-logo">
                    <span className="auth-logo-icon"></span>
                    <span className="auth-logo-text">VoiceForge AI</span>
                </div>
                <h1 className="auth-title">Welcome back</h1>
                <p className="auth-subtitle">Sign in to your company workspace</p>

                {error && <div className="auth-error-box">{error}</div>}

                <form onSubmit={handleSubmit} className="auth-form">
                    <label className="auth-label">Email address</label>
                    <input
                        className="auth-input"
                        type="email" autoComplete="email" required
                        placeholder="you@company.com"
                        value={form.email}
                        onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                    />

                    <label className="auth-label">Password</label>
                    <input
                        className="auth-input"
                        type="password" autoComplete="current-password" required
                        placeholder="••••••••"
                        value={form.password}
                        onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                    />

                    <button type="submit" className="auth-submit-btn" style={{ opacity: loading ? 0.7 : 1 }} disabled={loading}>
                        {loading ? 'Signing in…' : 'Sign in →'}
                    </button>
                </form>

                <p className="auth-switch-text">
                    Don't have an account?{' '}
                    <Link to="/register" className="auth-link">Create one free</Link>
                </p>
            </section>
        </div>
    );
}
