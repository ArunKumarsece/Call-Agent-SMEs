import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [form, setForm] = useState({ email: '', password: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await login(form.email, form.password);
            navigate('/', { replace: true });
        } catch (err) {
            setError(err.message);
            setLoading(false);
        }
    }

    return (
        <div className="login-page">
            {/* Left Panel - Branding */}
            <div className="login-brand-panel">
                <div className="login-brand-content">
                    <div className="login-brand-logo">
                        <div className="logo-box"></div>
                        <span>VoiceForge</span>
                    </div>
                    <h1>Build Call Agents That Sound Human</h1>
                    <p>From onboarding scripts to multilingual support, launch reliable AI voice experiences in minutes.</p>
                    <ul className="login-features">
                        <li>Real-time voice interaction</li>
                        <li>Knowledge-backed responses</li>
                        <li>Production-ready widgets</li>
                    </ul>
                </div>
            </div>

            {/* Right Panel - Form */}
            <div className="login-form-panel">
                <div className="login-form-container">
                    <div className="login-header">
                        <h2>Welcome back</h2>
                        <p>Sign in to your workspace</p>
                    </div>

                    {error && (
                        <div className="login-error">
                            <span className="error-icon">⚠</span>
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label>Email</label>
                            <input
                                type="email"
                                placeholder="you@company.com"
                                value={form.email}
                                onChange={(e) => setForm({ ...form, email: e.target.value })}
                                required
                                autoComplete="email"
                            />
                        </div>

                        <div className="form-group">
                            <label>Password</label>
                            <div className="password-field">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="••••••••"
                                    value={form.password}
                                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                                    required
                                    autoComplete="current-password"
                                />
                                <button
                                    type="button"
                                    className="toggle-password"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? '✕' : '○'}
                                </button>
                            </div>
                        </div>

                        <button type="submit" className="login-button" disabled={loading}>
                            {loading ? (
                                <>
                                    <span className="spinner"></span>
                                    Signing in...
                                </>
                            ) : (
                                <>Sign in</>
                            )}
                        </button>
                    </form>

                    <div className="login-footer">
                        <span>Don't have an account? <Link to="/register">Create one</Link></span>
                    </div>
                </div>
            </div>
        </div>
    );
}
