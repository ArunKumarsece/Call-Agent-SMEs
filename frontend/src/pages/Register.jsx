import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Register() {
    const { register } = useAuth();
    const navigate     = useNavigate();
    const [form, setForm]       = useState({ company_name: '', full_name: '', email: '', password: '', confirm: '' });
    const [error, setError]     = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const set = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

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
                full_name:    form.full_name,
                email:        form.email,
                password:     form.password,
            });
            navigate('/', { replace: true });
        } catch (err) {
            setError(err.message);
            setLoading(false);
        }
    }

    const strength = getPasswordStrength();

    return (
        <div className="auth-shell">
            <div className="auth-backdrop">
                <div className="auth-glow-1"></div>
                <div className="auth-glow-2"></div>
            </div>

            <section className="auth-panel auth-panel-brand">
                <div className="auth-brand-inner">
                    <p className="auth-kicker">Launch in Minutes</p>
                    <h2 className="auth-brand-title">Create your workspace and deploy your first voice agent today.</h2>
                    <p className="auth-brand-copy">
                        Centralize company knowledge, tune personality, and power customer conversations with production-grade reliability.
                    </p>
                    <div className="auth-brand-points">
                        <div className="auth-brand-point">
                            <span className="auth-point-icon"></span>
                            <span>Setup-ready templates</span>
                        </div>
                        <div className="auth-brand-point">
                            <span className="auth-point-icon"></span>
                            <span>Secure multi-tenant architecture</span>
                        </div>
                        <div className="auth-brand-point">
                            <span className="auth-point-icon"></span>
                            <span>Fast embeddable widget</span>
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
                    <h1 className="auth-title">Create your account</h1>
                    <p className="auth-subtitle">Set up your company workspace for free</p>

                    {error && <div className="auth-error-box" role="alert">
                        <span className="auth-error-icon"></span>
                        <span>{error}</span>
                    </div>}

                    <form onSubmit={handleSubmit} className="auth-form">
                        <div className="auth-field-group">
                            <label className="auth-label">
                                Company name <span className="auth-required">*</span>
                            </label>
                            <div className="auth-input-wrapper">
                                <input 
                                    className="auth-input" 
                                    required 
                                    placeholder="Acme Corp" 
                                    value={form.company_name} 
                                    onChange={set('company_name')} 
                                />
                                <div className="auth-input-focus-ring"></div>
                            </div>
                        </div>

                        <div className="auth-field-group">
                            <label className="auth-label">Your full name</label>
                            <div className="auth-input-wrapper">
                                <input 
                                    className="auth-input" 
                                    placeholder="Jane Smith" 
                                    value={form.full_name} 
                                    onChange={set('full_name')} 
                                />
                                <div className="auth-input-focus-ring"></div>
                            </div>
                        </div>

                        <div className="auth-field-group">
                            <label className="auth-label">
                                Work email <span className="auth-required">*</span>
                            </label>
                            <div className="auth-input-wrapper">
                                <input 
                                    className="auth-input" 
                                    type="email" 
                                    required 
                                    autoComplete="email" 
                                    placeholder="jane@acme.com" 
                                    value={form.email} 
                                    onChange={set('email')} 
                                />
                                <div className="auth-input-focus-ring"></div>
                            </div>
                        </div>

                        <div className="auth-password-grid">
                            <div className="auth-field-group">
                                <label className="auth-label">
                                    Password <span className="auth-required">*</span>
                                </label>
                                <div className="auth-input-wrapper auth-password-wrapper">
                                    <input 
                                        className="auth-input" 
                                        type={showPassword ? 'text' : 'password'} 
                                        required 
                                        autoComplete="new-password" 
                                        placeholder="Min 8 chars" 
                                        value={form.password} 
                                        onChange={set('password')} 
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

                            <div className="auth-field-group">
                                <label className="auth-label">Confirm password</label>
                                <div className="auth-input-wrapper auth-password-wrapper">
                                    <input 
                                        className="auth-input" 
                                        type={showConfirm ? 'text' : 'password'} 
                                        required 
                                        placeholder="Repeat" 
                                        value={form.confirm} 
                                        onChange={set('confirm')} 
                                    />
                                    <button
                                        type="button"
                                        className="auth-password-toggle"
                                        onClick={() => setShowConfirm(!showConfirm)}
                                        aria-label={showConfirm ? 'Hide password' : 'Show password'}
                                    >
                                        {showConfirm ? '✕' : '○'}
                                    </button>
                                    <div className="auth-input-focus-ring"></div>
                                </div>
                            </div>
                        </div>

                        {form.password && (
                            <div className="auth-password-strength">
                                <div className="auth-strength-bar">
                                    <div className="auth-strength-fill" style={{ width: `${strength.width}%`, backgroundColor: strength.color }} />
                                </div>
                                <span className="auth-strength-label">{strength.label}</span>
                            </div>
                        )}

                        <button type="submit" className="auth-submit-btn" disabled={loading}>
                            {loading ? (
                                <>
                                    <span className="auth-btn-spinner"></span>
                                    Creating account…
                                </>
                            ) : (
                                <>Create account<span className="auth-btn-arrow">→</span></>
                            )}
                        </button>
                    </form>

                    <p className="auth-terms">
                        By registering you agree to our Terms of Service and Privacy Policy.
                    </p>
                    <p className="auth-switch-text">
                        Already have an account?{' '}
                        <Link to="/login" className="auth-link">Sign in</Link>
                    </p>
                </div>
            </section>
        </div>
    );
}
