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

  const getStrength = () => {
    const len = form.password.length;
    if (len < 8) return { pct: Math.min(len / 8 * 100, 40), color: '#f43f5e', label: 'Too short' };
    if (len < 12) return { pct: 70, color: '#fbbf24', label: 'Good' };
    return { pct: 100, color: '#22d3a0', label: 'Strong' };
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (form.password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (form.password !== form.confirm) { setError('Passwords do not match'); return; }
    setLoading(true);
    try {
      await register({ company_name: form.company_name, full_name: form.full_name, email: form.email, password: form.password });
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  const strength = getStrength();

  return (
    <div className="auth-page">
      {/* Left */}
      <div className="auth-left">
        <div className="auth-bg-orb auth-bg-orb-1" />
        <div className="auth-bg-orb auth-bg-orb-2" />
        <div className="auth-left-content">
          <div className="auth-left-logo">
            <div className="auth-left-logo-icon">◈</div>
            <span className="auth-left-logo-text">VoiceForge AI</span>
          </div>
          <h1 className="auth-left-heading">
            Your AI voice team<br /><span>starts here</span>
          </h1>
          <p className="auth-left-sub">
            Create your workspace and start deploying intelligent voice agents in under 5 minutes. Free to start, no credit card required.
          </p>
          <div className="auth-features">
            {[
              { icon: '🚀', text: 'Go live in minutes — no coding required' },
              { icon: '🌐', text: 'Multilingual support: Tamil, English, Tanglish' },
              { icon: '🔒', text: 'Enterprise-grade security & data privacy' },
              { icon: '💡', text: 'RAG-powered knowledge base, always accurate' },
            ].map(f => (
              <div className="auth-feature" key={f.text}>
                <div className="auth-feature-icon">{f.icon}</div>
                <span>{f.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right */}
      <div className="auth-right" style={{ overflowY: 'auto' }}>
        <div className="auth-right-inner">
          <div className="auth-form-header">
            <h2 className="auth-form-title">Create account</h2>
            <p className="auth-form-sub">Launch your VoiceForge workspace today</p>
          </div>

          {error && (
            <div className="auth-alert auth-alert-error" style={{ marginBottom: '16px' }}>
              <span className="alert-icon">!</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-row">
              <div className="form-field">
                <label>Company Name</label>
                <input type="text" placeholder="Acme Corp" value={form.company_name}
                  onChange={e => setForm({ ...form, company_name: e.target.value })} required />
              </div>
              <div className="form-field">
                <label>Your Name</label>
                <input type="text" placeholder="Jane Smith" value={form.full_name}
                  onChange={e => setForm({ ...form, full_name: e.target.value })} required />
              </div>
            </div>

            <div className="form-field">
              <label>Email Address</label>
              <input type="email" placeholder="you@company.com" value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })} required autoComplete="email" />
            </div>

            <div className="form-field">
              <label>Password</label>
              <div className="password-input-wrapper">
                <input type={showPassword ? 'text' : 'password'} placeholder="Min 8 characters"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })} required autoComplete="new-password" />
                <button type="button" className="pwd-toggle" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
              {form.password && (
                <div className="password-strength-meter">
                  <div className="strength-bar">
                    <div className="strength-fill" style={{ width: `${strength.pct}%`, backgroundColor: strength.color }} />
                  </div>
                  <span className="strength-text" style={{ color: strength.color }}>{strength.label}</span>
                </div>
              )}
            </div>

            <div className="form-field">
              <label>Confirm Password</label>
              <input type="password" placeholder="Repeat password" value={form.confirm}
                onChange={e => setForm({ ...form, confirm: e.target.value })} required autoComplete="new-password" />
            </div>

            <button type="submit" className="auth-btn" disabled={loading}>
              {loading ? <><span className="btn-spinner" /> Creating account…</> : 'Create Account →'}
            </button>
          </form>

          <div className="auth-footer">
            <p>Already have an account? <Link to="/login">Sign in</Link></p>
          </div>
        </div>
      </div>
    </div>
  );
}
