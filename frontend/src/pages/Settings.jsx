import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getAPIBase } from '../api';

const TABS = [
  { id: 'profile',  label: '👤 Profile' },
  { id: 'security', label: '🔒 Security' },
  { id: 'danger',   label: '⚠️ Danger Zone' },
];

export default function Settings() {
  const { company, token, updateCompany, logout } = useAuth();
  const [tab, setTab]       = useState('profile');
  const [toast, setToast]   = useState(null);
  const [saving, setSaving] = useState(false);

  const [profile, setProfile] = useState({
    company_name: company?.company_name || '',
    logo_url:     company?.logo_url || '',
  });
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm: '' });
  const [pwError, setPwError] = useState('');

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  async function saveProfile(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`${getAPIBase()}/auth/me`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ company_name: profile.company_name, logo_url: profile.logo_url || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail);
      updateCompany(data);
      showToast('Profile updated successfully ✓');
    } catch (err) {
      showToast(err.message, 'error');
    } finally { setSaving(false); }
  }

  async function changePassword(e) {
    e.preventDefault();
    setPwError('');
    if (pwForm.new_password.length < 8) { setPwError('New password must be at least 8 characters'); return; }
    if (pwForm.new_password !== pwForm.confirm) { setPwError('Passwords do not match'); return; }
    setSaving(true);
    try {
      const res = await fetch(`${getAPIBase()}/auth/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ current_password: pwForm.current_password, new_password: pwForm.new_password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail);
      setPwForm({ current_password: '', new_password: '', confirm: '' });
      showToast('Password changed ✓');
    } catch (err) {
      setPwError(err.message);
    } finally { setSaving(false); }
  }

  return (
    <div style={{ animation: 'pageEnter .4s ease-out', maxWidth: 740 }}>
      {toast && (
        <div className={`toast toast-${toast.type}`} style={{ marginBottom: 'var(--space-lg)', position: 'fixed', top: 80, right: 24, zIndex: 100, minWidth: 280 }}>
          {toast.msg}
        </div>
      )}

      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Manage your company profile and account security.</p>
        </div>
      </div>

      {/* Company info banner */}
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)', background: 'linear-gradient(135deg, var(--bg-card), var(--bg-elevated))' }}>
        <div style={{
          width: 52, height: 52, borderRadius: 'var(--r-md)', flexShrink: 0,
          background: 'linear-gradient(135deg, var(--accent-dim), var(--teal-dim))',
          display: 'grid', placeItems: 'center', fontSize: '1.2rem', fontWeight: 800, color: '#fff',
        }}>
          {company?.logo_url
            ? <img src={company.logo_url} style={{ width: '100%', height: '100%', borderRadius: 'inherit', objectFit: 'cover' }} alt="" />
            : (company?.company_name || 'C')[0].toUpperCase()
          }
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>{company?.company_name}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{company?.email}</div>
        </div>
        <span className="badge badge-primary" style={{ fontSize: '0.72rem' }}>{company?.plan || 'free'} plan</span>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {TABS.map(t => (
          <button key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Profile */}
      {tab === 'profile' && (
        <form onSubmit={saveProfile} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <div>
            <div className="settings-section-title">Company Profile</div>
            <div className="settings-section-desc">Update your company name and logo URL.</div>
          </div>
          <div className="form-field">
            <label>Company Name</label>
            <input value={profile.company_name}
              onChange={e => setProfile(p => ({ ...p, company_name: e.target.value }))} required />
          </div>
          <div className="form-field">
            <label>Logo URL <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
            <input placeholder="https://yourdomain.com/logo.png" value={profile.logo_url}
              onChange={e => setProfile(p => ({ ...p, logo_url: e.target.value }))} />
          </div>
          <div className="form-field">
            <label>Email Address</label>
            <input value={company?.email} disabled style={{ opacity: 0.5 }} />
            <span className="form-hint">Email cannot be changed after registration.</span>
          </div>
          <div>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <><span className="btn-spinner" /> Saving…</> : 'Save changes'}
            </button>
          </div>
        </form>
      )}

      {/* Security */}
      {tab === 'security' && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <div>
            <div className="settings-section-title">Change Password</div>
            <div className="settings-section-desc">Choose a strong password with at least 8 characters.</div>
          </div>
          {pwError && <div className="toast toast-error">{pwError}</div>}
          <form onSubmit={changePassword} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            <div className="form-field">
              <label>Current Password</label>
              <input type="password" required value={pwForm.current_password}
                onChange={e => setPwForm(p => ({ ...p, current_password: e.target.value }))} />
            </div>
            <div className="form-field">
              <label>New Password</label>
              <input type="password" required placeholder="Min 8 characters" value={pwForm.new_password}
                onChange={e => setPwForm(p => ({ ...p, new_password: e.target.value }))} />
            </div>
            <div className="form-field">
              <label>Confirm New Password</label>
              <input type="password" required value={pwForm.confirm}
                onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))} />
            </div>
            <div>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? <><span className="btn-spinner" /> Updating…</> : 'Update password'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Danger Zone */}
      {tab === 'danger' && (
        <div className="card" style={{ borderColor: 'rgba(244,63,94,0.3)' }}>
          <div className="settings-section-title" style={{ color: 'var(--danger)' }}>⚠️ Danger Zone</div>
          <div className="settings-section-desc">These actions are permanent and cannot be reversed.</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-md)', borderRadius: 'var(--r-md)', border: '1px solid rgba(244,63,94,0.2)', background: 'var(--danger-soft)', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3 }}>Sign out of all sessions</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Immediately revokes all active refresh tokens.</div>
            </div>
            <button onClick={logout} className="btn btn-danger">Sign out everywhere</button>
          </div>
        </div>
      )}
    </div>
  );
}
