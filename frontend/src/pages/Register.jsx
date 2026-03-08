import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Register() {
    const { register } = useAuth();
    const navigate     = useNavigate();
    const [form, setForm]       = useState({ company_name: '', full_name: '', email: '', password: '', confirm: '' });
    const [error, setError]     = useState('');
    const [loading, setLoading] = useState(false);

    const set = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

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
        } finally {
            setLoading(false);
        }
    }

    return (
        <div style={styles.page}>
            <div style={styles.card}>
                <div style={styles.logoRow}>
                    <span style={styles.logoIcon}>🤖</span>
                    <span style={styles.logoText}>VoiceForge AI</span>
                </div>
                <h1 style={styles.title}>Create your account</h1>
                <p style={styles.subtitle}>Set up your company workspace — free to start</p>

                {error && <div style={styles.errorBox}>{error}</div>}

                <form onSubmit={handleSubmit} style={styles.form}>
                    <label style={styles.label}>Company name <span style={{ color: '#ef4444' }}>*</span></label>
                    <input style={styles.input} required placeholder="Acme Corp" value={form.company_name} onChange={set('company_name')} />

                    <label style={styles.label}>Your full name</label>
                    <input style={styles.input} placeholder="Jane Smith" value={form.full_name} onChange={set('full_name')} />

                    <label style={styles.label}>Work email <span style={{ color: '#ef4444' }}>*</span></label>
                    <input style={styles.input} type="email" required autoComplete="email" placeholder="jane@acme.com" value={form.email} onChange={set('email')} />

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                            <label style={styles.label}>Password <span style={{ color: '#ef4444' }}>*</span></label>
                            <input style={styles.input} type="password" required autoComplete="new-password" placeholder="Min 8 chars" value={form.password} onChange={set('password')} />
                        </div>
                        <div>
                            <label style={styles.label}>Confirm password</label>
                            <input style={styles.input} type="password" required placeholder="Repeat" value={form.confirm} onChange={set('confirm')} />
                        </div>
                    </div>

                    {/* Password strength bar */}
                    {form.password && (
                        <div style={{ marginTop: 4 }}>
                            <div style={{ height: 3, borderRadius: 2, background: 'var(--border-color)', overflow: 'hidden' }}>
                                <div style={{
                                    height: '100%', borderRadius: 2, transition: 'width 0.3s',
                                    width: `${Math.min(form.password.length / 12 * 100, 100)}%`,
                                    background: form.password.length < 8 ? '#ef4444' : form.password.length < 12 ? '#f59e0b' : '#22c55e',
                                }} />
                            </div>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                                {form.password.length < 8 ? 'Too short' : form.password.length < 12 ? 'Good' : 'Strong'}
                            </span>
                        </div>
                    )}

                    <button type="submit" style={{ ...styles.btn, opacity: loading ? 0.7 : 1 }} disabled={loading}>
                        {loading ? 'Creating account…' : 'Create account →'}
                    </button>
                </form>

                <p style={styles.terms}>
                    By registering you agree to our Terms of Service and Privacy Policy.
                </p>
                <p style={styles.switchText}>
                    Already have an account?{' '}
                    <Link to="/login" style={styles.link}>Sign in</Link>
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
        width: '100%', maxWidth: 480,
        background: 'var(--bg-card)', border: '1px solid var(--border-color)',
        borderRadius: 20, padding: '2.5rem 2rem',
        boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
    },
    logoRow: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 },
    logoIcon: { fontSize: 28 },
    logoText: { fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px' },
    title: { fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 },
    subtitle: { fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24 },
    errorBox: {
        background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
        borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#ef4444',
    },
    form: { display: 'flex', flexDirection: 'column', gap: 4 },
    label: { fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, marginTop: 12 },
    input: {
        background: 'var(--bg-input)', border: '1px solid var(--border-color)',
        borderRadius: 10, padding: '11px 14px', color: 'var(--text-primary)',
        fontSize: 14, outline: 'none', width: '100%',
    },
    btn: {
        marginTop: 20, width: '100%', padding: '13px',
        background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
        color: 'white', border: 'none', borderRadius: 10,
        fontSize: 15, fontWeight: 700, cursor: 'pointer',
        boxShadow: '0 4px 16px rgba(108,99,255,0.4)',
    },
    terms: { fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginTop: 14 },
    switchText: { textAlign: 'center', marginTop: 10, fontSize: 13, color: 'var(--text-secondary)' },
    link: { color: 'var(--primary-light)', fontWeight: 600, textDecoration: 'none' },
};
