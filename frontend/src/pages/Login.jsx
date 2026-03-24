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
        <div className="auth-page">
            {/* Animated background elements */}
            <div className="auth-bg-shapes">
                <div className="shape-1"></div>
                <div className="shape-2"></div>
                <div className="shape-3"></div>
            </div>

            {/* Main card */}
            <div className="auth-card">
                {/* Header with logo */}
                <div className="auth-card-header">
                    <div className="auth-logo">
                        <span className="logo-icon">◆</span>
                    </div>
                    <h1>Welcome Back</h1>
                    <p>Sign in to your VoiceForge workspace</p>
                </div>

                {/* Error message */}
                {error && (
                    <div className="auth-alert auth-alert-error">
                        <span className="alert-icon">!</span>
                        <span>{error}</span>
                    </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} className="auth-form">
                    <div className="form-field">
                        <label>Email Address</label>
                        <input
                            type="email"
                            placeholder="name@company.com"
                            value={form.email}
                            onChange={(e) => setForm({ ...form, email: e.target.value })}
                            required
                            autoComplete="email"
                        />
                    </div>

                    <div className="form-field">
                        <label>Password</label>
                        <div className="password-input-wrapper">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                placeholder="Enter your password"
                                value={form.password}
                                onChange={(e) => setForm({ ...form, password: e.target.value })}
                                required
                                autoComplete="current-password"
                            />
                            <button
                                type="button"
                                className="pwd-toggle"
                                onClick={() => setShowPassword(!showPassword)}
                                title={showPassword ? 'Hide' : 'Show'}
                            >
                                {showPassword ? '👁️' : '👁️‍🗨️'}
                            </button>
                        </div>
                    </div>

                    <button type="submit" className="auth-btn" disabled={loading}>
                        {loading ? (
                            <>
                                <span className="btn-spinner"></span>
                                Signing in...
                            </>
                        ) : (
                            'Sign In'
                        )}
                    </button>
                </form>

                {/* Footer */}
                <div className="auth-footer">
                    <p>Don't have an account? <Link to="/register">Create one</Link></p>
                </div>
            </div>
        </div>
    );
}
