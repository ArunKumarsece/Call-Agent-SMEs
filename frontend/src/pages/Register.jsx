import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Register() {
    const { register } = useAuth();
    const navigate = useNavigate();
    const [form, setForm] = useState({ company_name: '', full_name: '', email: '', password: '', confirm: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const getPasswordStrength = () => {
        const len = form.password.length;
        if (len < 8) return { width: Math.min(len / 8 * 100, 40), color: '#ef4444', label: 'Too short' };
        if (len < 12) return { width: 70, color: '#f59e0b', label: 'Good' };
        return { width: 100, color: '#22c55e', label: 'Strong' };
    };

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        if (form.password.length < 8) { setError('Password must be at least 8 characters'); return; }
        if (form.password !== form.confirm) { setError('Passwords do not match'); return; }

        setLoading(true);
        try {
            await register({
                company_name: form.company_name,
                full_name: form.full_name,
                email: form.email,
                password: form.password,
            });
            navigate('/', { replace: true });
        } catch (err) {
            setError(err.message);
            setLoading(false);
        }
    }

    const strength = getPasswordStrength();

    return (
        <div className="login-page">
            {/* Left Panel - Branding */}
            <div className="login-brand-panel">
                <div className="login-brand-content">
                    <div className="login-brand-logo">
                        <div className="logo-box"></div>
                        <span>VoiceForge</span>
                    </div>
                    <h1>Launch Your Voice Agent</h1>
                    <p>Create your workspace and deploy your first AI voice agent in minutes with no setup hassle.</p>
                    <ul className="login-features">
                        <li>Setup-ready templates</li>
                        <li>Secure multi-tenant workspace</li>
                        <li>Fast embeddable widget</li>
                    </ul>
                </div>
            </div>

            {/* Right Panel - Form */}
            <div className="login-form-panel">
                <div className="login-form-container">
                    <div className="login-header">
                        <h2>Create account</h2>
                        <p>Free workspace for your team</p>
                    </div>

                    {error && (
                        <div className="login-error">
                            <span className="error-icon">⚠</span>
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label>Company name</label>
                            <input
                                type="text"
                                placeholder="Acme Corp"
                                value={form.company_name}
                                onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label>Full name</label>
                            <input
                                type="text"
                                placeholder="Jane Smith"
                                value={form.full_name}
                                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                            />
                        </div>

                        <div className="form-group">
                            <label>Email</label>
                            <input
                                type="email"
                                placeholder="jane@acme.com"
                                value={form.email}
                                onChange={(e) => setForm({ ...form, email: e.target.value })}
                                required
                                autoComplete="email"
                            />
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>Password</label>
                                <div className="password-field">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="Min 8 chars"
                                        value={form.password}
                                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                                        required
                                        autoComplete="new-password"
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

                            <div className="form-group">
                                <label>Confirm</label>
                                <div className="password-field">
                                    <input
                                        type={showConfirm ? 'text' : 'password'}
                                        placeholder="Repeat"
                                        value={form.confirm}
                                        onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                                        required
                                    />
                                    <button
                                        type="button"
                                        className="toggle-password"
                                        onClick={() => setShowConfirm(!showConfirm)}
                                    >
                                        {showConfirm ? '✕' : '○'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {form.password && (
                            <div className="password-strength">
                                <div className="strength-bar">
                                    <div className="strength-fill" style={{ width: `${strength.width}%`, backgroundColor: strength.color }} />
                                </div>
                                <span className="strength-label">{strength.label}</span>
                            </div>
                        )}

                        <button type="submit" className="login-button" disabled={loading}>
                            {loading ? (
                                <>
                                    <span className="spinner"></span>
                                    Creating...
                                </>
                            ) : (
                                <>Create account</>
                            )}
                        </button>
                    </form>

                    <div className="login-footer">
                        <span>Already have an account? <Link to="/login">Sign in</Link></span>
                    </div>
                </div>
            </div>
        </div>
    );
}
