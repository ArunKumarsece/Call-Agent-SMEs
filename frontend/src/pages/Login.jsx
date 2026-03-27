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
      {/* Left panel — branding */}
      <div className="auth-left">
        <div className="auth-bg-orb auth-bg-orb-1" />
        <div className="auth-bg-orb auth-bg-orb-2" />
        <div className="auth-left-content">
          <div className="auth-left-logo">
            <div className="auth-left-logo-icon">◈</div>
            <span className="auth-left-logo-text">VoiceForge AI</span>
          </div>
          <h1 className="auth-left-heading">
            Build AI agents that<br /><span>speak your language</span>
          </h1>
          <p className="auth-left-sub">
            Deploy intelligent voice agents for your business in minutes — multilingual, context-aware, always available.
          </p>
          <div className="auth-features">
            {[
              { icon: '🎙️', text: 'Real-time Tanglish voice with Sarvam & Deepgram STT' },
              { icon: '🧠', text: 'Gemini 2.5 Live API — native audio understanding' },
              { icon: '📊', text: 'Analytics dashboard with intent & sentiment tracking' },
              { icon: '🔌', text: 'Embed anywhere via SDK widget' },
            ].map(f => (
              <div className="auth-feature" key={f.text}>
                <div className="auth-feature-icon">{f.icon}</div>
                <span>{f.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="auth-right">
        <div className="auth-right-inner">
          <div className="auth-form-header">
            <h2 className="auth-form-title">Welcome back</h2>
            <p className="auth-form-sub">Sign in to your workspace to continue</p>
          </div>

          {error && (
            <div className="auth-alert auth-alert-error" style={{ marginBottom: '16px' }}>
              <span className="alert-icon">!</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-field">
              <label htmlFor="login-email">Email address</label>
              <input
                id="login-email"
                type="email"
                placeholder="you@company.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                autoComplete="email"
              />
            </div>

            <div className="form-field">
              <label htmlFor="login-password">Password</label>
              <div className="password-input-wrapper">
                <input
                  id="login-password"
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
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <button type="submit" className="auth-btn" disabled={loading}>
              {loading ? (
                <><span className="btn-spinner" /> Signing in…</>
              ) : 'Sign In →'}
            </button>
          </form>

          <div className="auth-footer">
            <p>Don't have an account? <Link to="/register">Create one free</Link></p>
          </div>
        </div>
      </div>
    </div>
  );
}
