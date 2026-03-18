import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getAPIBase } from '../api';

export default function Settings() {
    const { company, token, updateCompany, logout } = useAuth();
    const [tab, setTab]         = useState('profile');
    const [toast, setToast]     = useState(null);
    const [saving, setSaving]   = useState(false);

    const [profile, setProfile] = useState({
        company_name: company?.company_name || '',
        logo_url:     company?.logo_url || '',
    });
    const [pwForm, setPwForm]   = useState({ current_password: '', new_password: '', confirm: '' });
    const [pwError, setPwError] = useState('');

    function showToast(msg, type = 'success') {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    }

    async function saveProfile(e) {
        e.preventDefault(); setSaving(true);
        const API_BASE = getAPIBase();
        try {
            const res = await fetch(`${API_BASE}/auth/me`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ company_name: profile.company_name, logo_url: profile.logo_url || null }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail);
            updateCompany(data);
            showToast('Profile updated successfully');
        } catch (err) {
            showToast(err.message, 'error');
        } finally { setSaving(false); }
    }

    async function changePassword(e) {
        e.preventDefault(); setPwError('');
        const API_BASE = getAPIBase();
        if (pwForm.new_password.length < 8) { setPwError('New password must be at least 8 characters'); return; }
        if (pwForm.new_password !== pwForm.confirm) { setPwError('Passwords do not match'); return; }
        setSaving(true);
        try {
            const res = await fetch(`${API_BASE}/auth/password`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ current_password: pwForm.current_password, new_password: pwForm.new_password }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail);
            setPwForm({ current_password: '', new_password: '', confirm: '' });
            showToast('Password changed successfully');
        } catch (err) {
            setPwError(err.message);
        } finally { setSaving(false); }
    }

    const PLAN_COLORS = { free: '#94a3b8', pro: '#6c63ff', enterprise: '#f59e0b' };

    return (
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '2rem 1rem', animation: 'pageEnter 0.5s ease-out' }}>
            {toast && (
                <div className={`toast toast-${toast.type}`}>
                    {toast.msg}
                </div>
            )}

            <div style={{ marginBottom: 32 }}>
                <h1 className="page-title" style={{ fontSize: 26, marginBottom: 4 }}>
                    Settings
                </h1>
                <p className="page-subtitle">
                    Manage your company account and security
                </p>
            </div>

            {/* Company info card */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 16, padding: '20px 24px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                    {company?.logo_url ? <img src={company.logo_url} style={{ width: 40, height: 40, borderRadius: 10, objectFit: 'cover' }} alt="" /> : <span style={{ color: 'white', fontWeight: 800, fontSize: 16 }}>{(company?.company_name || 'C')[0].toUpperCase()}</span>}
                </div>
                <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>{company?.company_name}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{company?.email}</div>
                </div>
                <span style={{ background: PLAN_COLORS[company?.plan] + '22', color: PLAN_COLORS[company?.plan], borderRadius: 20, padding: '4px 14px', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
                    {company?.plan}
                </span>
            </div>

            {/* Tab bar */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--bg-secondary)', borderRadius: 10, padding: 4 }}>
                {[['profile', 'Profile'], ['security', 'Security'], ['danger', 'Danger Zone']].map(([id, label]) => (
                    <button key={id} onClick={() => setTab(id)} style={{
                        flex: 1, padding: '8px 12px', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                        background: tab === id ? 'var(--bg-card)' : 'transparent',
                        color: tab === id ? 'var(--text-primary)' : 'var(--text-secondary)',
                        boxShadow: tab === id ? '0 2px 8px rgba(0,0,0,0.2)' : 'none',
                    }}>
                        {label}
                    </button>
                ))}
            </div>

            {/* Profile tab */}
            {tab === 'profile' && (
                <form onSubmit={saveProfile} style={styles.section}>
                    <h2 style={styles.sectionTitle}>Company Profile</h2>
                    <label style={styles.label}>Company name</label>
                    <input style={styles.input} value={profile.company_name} onChange={e => setProfile(p => ({ ...p, company_name: e.target.value }))} required />
                    <label style={styles.label}>Logo URL (optional)</label>
                    <input style={styles.input} placeholder="https://..." value={profile.logo_url} onChange={e => setProfile(p => ({ ...p, logo_url: e.target.value }))} />
                    <label style={styles.label}>Email address</label>
                    <input style={{ ...styles.input, opacity: 0.6 }} value={company?.email} disabled />
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Email cannot be changed after registration</div>
                    <button type="submit" style={styles.btnPrimary} disabled={saving}>
                        {saving ? 'Saving…' : 'Save changes'}
                    </button>
                </form>
            )}

            {/* Security tab */}
            {tab === 'security' && (
                <div style={styles.section}>
                    <h2 style={styles.sectionTitle}>Change Password</h2>
                    {pwError && <div style={styles.errorBox}>{pwError}</div>}
                    <form onSubmit={changePassword}>
                        <label style={styles.label}>Current password</label>
                        <input style={styles.input} type="password" required value={pwForm.current_password} onChange={e => setPwForm(p => ({ ...p, current_password: e.target.value }))} />
                        <label style={styles.label}>New password</label>
                        <input style={styles.input} type="password" required placeholder="Min 8 characters" value={pwForm.new_password} onChange={e => setPwForm(p => ({ ...p, new_password: e.target.value }))} />
                        <label style={styles.label}>Confirm new password</label>
                        <input style={styles.input} type="password" required value={pwForm.confirm} onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))} />
                        <button type="submit" style={styles.btnPrimary} disabled={saving}>
                            {saving ? 'Updating…' : 'Update password'}
                        </button>
                    </form>
                </div>
            )}

            {/* Danger Zone */}
            {tab === 'danger' && (
                <div style={styles.section}>
                    <h2 style={{ ...styles.sectionTitle, color: '#ef4444' }}>Danger Zone</h2>
                    <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20 }}>
                        These actions are irreversible. Please be certain.
                    </p>
                    <div style={{ border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12, padding: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                        <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Sign out of all sessions</div>
                            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Revokes all refresh tokens immediately</div>
                        </div>
                        <button onClick={logout} style={{ background: 'none', border: '1px solid rgba(239,68,68,0.5)', color: '#ef4444', borderRadius: 8, padding: '8px 18px', cursor: 'pointer', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap' }}>
                            Sign out
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

const styles = {
    section: { background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 16, padding: '24px' },
    sectionTitle: { fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 20 },
    label: { display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, marginTop: 16 },
    input: { width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 10, padding: '11px 14px', color: 'var(--text-primary)', fontSize: 14, outline: 'none' },
    btnPrimary: { marginTop: 20, padding: '11px 24px', background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))', color: 'white', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer' },
    errorBox: { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#ef4444' },
};
