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
                    <h1>Create Account</h1>
                    <p>Launch your VoiceForge workspace today</p>
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
                        <label>Company Name</label>
                        <input
                            type="text"
                            placeholder="Your company"
                            value={form.company_name}
                            onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                            required
                        />
                    </div>

                    <div className="form-field">
                        <label>Full Name</label>
                        <input
                            type="text"
                            placeholder="Your name"
                            value={form.full_name}
                            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                            required
                        />
                    </div>

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
                                placeholder="Min 8 characters"
                                value={form.password}
                                onChange={(e) => setForm({ ...form, password: e.target.value })}
                                required
                                autoComplete="new-password"
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
                        {form.password && (
                            <div className="password-strength-meter">
                                <div className="strength-bar">
                                    <div className="strength-fill" style={{ width: `${strength.width}%`, backgroundColor: strength.color }} />
                                </div>
                                <span className="strength-text">{strength.label}</span>
                            </div>
                        )}
                    </div>

                    <div className="form-field">
                        <label>Confirm Password</label>
                        <div className="password-input-wrapper">
                            <input
                                type={showConfirm ? 'text' : 'password'}
                                placeholder="Repeat password"
                                value={form.confirm}
                                onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                                required
                                autoComplete="new-password"
                            />
                            <button
                                type="button"
                                className="pwd-toggle"
                                onClick={() => setShowConfirm(!showConfirm)}
                                title={showConfirm ? 'Hide' : 'Show'}
                            >
                                {showConfirm ? '👁️' : '👁️‍🗨️'}
                            </button>
                        </div>
                    </div>

                    <button type="submit" className="auth-btn" disabled={loading}>
                        {loading ? (
                            <>
                                <span className="btn-spinner"></span>
                                Creating account...
                            </>
                        ) : (
                            'Create Account'
                        )}
                    </button>
                </form>

                {/* Footer */}
                <div className="auth-footer">
                    <p>Already have an account? <Link to="/login">Sign in</Link></p>
                </div>
            </div>
        </div>
    );
}
