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
        <div style={styles.page}>
            <div style={styles.card}>
                {/* Logo */}
                <div style={styles.logoRow}>
                    <span style={styles.logoIcon}>🤖</span>
                    <span style={styles.logoText}>VoiceForge AI</span>
                </div>
                <h1 style={styles.title}>Welcome back</h1>
                <p style={styles.subtitle}>Sign in to your company account</p>

                {error && <div style={styles.errorBox}>{error}</div>}

                <form onSubmit={handleSubmit} style={styles.form}>
                    <label style={styles.label}>Email address</label>
                    <input
                        style={styles.input}
                        type="email" autoComplete="email" required
                        placeholder="you@company.com"
                        value={form.email}
                        onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                    />

                    <label style={styles.label}>Password</label>
                    <input
                        style={styles.input}
                        type="password" autoComplete="current-password" required
                        placeholder="••••••••"
                        value={form.password}
                        onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                    />

                    <button type="submit" style={{ ...styles.btn, opacity: loading ? 0.7 : 1 }} disabled={loading}>
                        {loading ? 'Signing in…' : 'Sign in →'}
                    </button>
                </form>

                <p style={styles.switchText}>
                    Don't have an account?{' '}
                    <Link to="/register" style={styles.link}>Create one free</Link>
                </p>
            </div>
        </div>
    );
}

const styles = {
    page: {
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg-primary)', padding: '1rem',
    },
    card: {
        width: '100%', maxWidth: 420,
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: 20,
        padding: '2.5rem 2rem',
        boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
    },
    logoRow: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 },
    logoIcon: { fontSize: 28 },
    logoText: { fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px' },
    title: { fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 },
    subtitle: { fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24 },
    errorBox: {
        background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
        borderRadius: 8, padding: '10px 14px', marginBottom: 16,
        fontSize: 13, color: '#ef4444',
    },
    form: { display: 'flex', flexDirection: 'column', gap: 4 },
    label: { fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, marginTop: 12 },
    input: {
        background: 'var(--bg-input)', border: '1px solid var(--border-color)',
        borderRadius: 10, padding: '11px 14px', color: 'var(--text-primary)',
        fontSize: 14, outline: 'none', width: '100%',
        transition: 'border-color 0.2s',
    },
    btn: {
        marginTop: 20, width: '100%', padding: '13px',
        background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
        color: 'white', border: 'none', borderRadius: 10,
        fontSize: 15, fontWeight: 700, cursor: 'pointer',
        boxShadow: '0 4px 16px rgba(108,99,255,0.4)',
        transition: 'all 0.2s',
    },
    switchText: { textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--text-secondary)' },
    link: { color: 'var(--primary-light)', fontWeight: 600, textDecoration: 'none' },
};
