import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { agentsAPI, kbAPI, voicesAPI } from '../api';

const DEFAULT_PROMPT = `You are a helpful customer support agent.
Answer questions based on the knowledge base provided.
Be friendly, professional, and concise.
If you don't know something, honestly say so and offer to help find the answer.`;

const ROLES = [
  { value: 'Customer Support', icon: '🎧', desc: 'Handle customer queries & issues' },
  { value: 'Sales', icon: '💼', desc: 'Convert leads and pitch products' },
  { value: 'Technical Support', icon: '🔧', desc: 'Debug and fix technical problems' },
  { value: 'Receptionist', icon: '📞', desc: 'Greet and route callers' },
  { value: 'General Assistant', icon: '🤖', desc: 'Multi-purpose digital assistant' },
  { value: 'FAQ Bot', icon: '❓', desc: 'Answer frequently asked questions' },
];

const LANGUAGES = [
  { value: 'tanglish',     label: 'Tanglish',  flag: '🇮🇳', desc: 'Tamil + English' },
  { value: 'hindi_mix',   label: 'Hinglish',  flag: '🇮🇳', desc: 'Hindi + English' },
  { value: 'kannada_mix', label: 'Kannada',   flag: '🇮🇳', desc: 'Kannada + English' },
  { value: 'telugu_mix',  label: 'Telugu',    flag: '🇮🇳', desc: 'Telugu + English' },
  { value: 'pure_english',label: 'English',   flag: '🌐', desc: 'Pure English' },
];

const PERSONA_HEADER = '--- Persona Profile ---';
const PERSONA_FOOTER = '--- End Persona ---';

// ─── Step indicator ────────────────────────────────────────────
function StepBar({ current, total = 3 }) {
  const labels = ['Agent Details', 'Knowledge Base', 'Review & Launch'];
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, marginBottom: 'var(--space-2xl)' }}>
      {labels.map((label, i) => {
        const num = i + 1;
        const done = current > num;
        const active = current === num;
        return (
          <div key={num} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 16px', borderRadius: 999,
              background: active ? 'linear-gradient(135deg, var(--accent), #a78bfa)'
                : done ? 'var(--teal-dim)' : 'var(--bg-input)',
              color: active || done ? '#fff' : 'var(--text-muted)',
              fontWeight: 700, fontSize: '0.78rem',
              boxShadow: active ? '0 4px 16px var(--accent-glow)' : 'none',
              transition: 'all .3s ease',
            }}>
              <span style={{
                width: 20, height: 20, borderRadius: '50%',
                background: 'rgba(255,255,255,.2)',
                display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 800,
              }}>
                {done
                  ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>
                  : num
                }
              </span>
              {label}
            </div>
            {i < total - 1 && (
              <div style={{
                width: 36, height: 2, margin: '0 2px',
                background: current > num ? 'var(--teal)' : 'var(--border)',
                borderRadius: 2, transition: 'background .3s',
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Role card ────────────────────────────────────────────────
function RoleCard({ option, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(option.value)}
      style={{
        padding: '14px 12px', borderRadius: 'var(--r-md)', textAlign: 'left',
        background: selected ? 'var(--accent-soft)' : 'var(--bg-elevated)',
        border: `1.5px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
        cursor: 'pointer', transition: 'all .18s ease',
        boxShadow: selected ? '0 0 0 4px var(--accent-glow)' : 'none',
      }}
    >
      <div style={{ fontSize: '1.4rem', marginBottom: 6 }}>{option.icon}</div>
      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>{option.value}</div>
      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>{option.desc}</div>
    </button>
  );
}

// ─── Voice card ───────────────────────────────────────────────
function VoiceCard({ voice, selected, onSelect }) {
  const styles = { Male: '🎙️', Female: '🎤' };
  return (
    <button
      type="button"
      onClick={() => onSelect(voice.id)}
      style={{
        padding: '12px 10px', borderRadius: 'var(--r-md)', textAlign: 'left',
        background: selected ? 'var(--accent-soft)' : 'var(--bg-elevated)',
        border: `1.5px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
        cursor: 'pointer', transition: 'all .18s ease',
        boxShadow: selected ? '0 0 0 4px var(--accent-glow)' : 'none',
      }}
    >
      <div style={{ fontSize: '1.2rem' }}>{styles[voice.gender] || '🎙️'}</div>
      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 }}>{voice.name}</div>
      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 1 }}>{voice.style}</div>
    </button>
  );
}

// ─── Slider control ───────────────────────────────────────────
function SliderField({ label, name, value, onChange }) {
  const pct = Math.round(value * 100);
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{label}</label>
        <span style={{
          fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent)',
          background: 'var(--accent-soft)', padding: '1px 7px', borderRadius: 99,
        }}>{pct}%</span>
      </div>
      <input type="range" min="0" max="1" step="0.1" name={name} value={value}
        onChange={onChange}
        style={{ width: '100%', accentColor: 'var(--accent)' }} />
    </div>
  );
}

// ─── Review row ───────────────────────────────────────────────
function ReviewRow({ label, value, badge }) {
  return (
    <div style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</span>
      {badge
        ? <span className="badge badge-primary">{value}</span>
        : <span style={{ fontSize: '0.87rem', fontWeight: 600, color: 'var(--text-primary)', textAlign: 'right', maxWidth: '60%' }}>{value || '—'}</span>
      }
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────
export default function CreateAgent() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [voices, setVoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [personaEnabled, setPersonaEnabled] = useState(false);

  const [form, setForm] = useState({
    name: '', role: 'Customer Support', description: '',
    system_prompt: DEFAULT_PROMPT, voice_id: 'Puck', language: 'tanglish',
    hospital_config: null,
  });

  const [persona, setPersona] = useState({
    tone: 'friendly', pace: 'normal',
    empathy: 0.8, humor: 0.3, assertiveness: 0.6,
    backstory: '', signature_phrases: '', avoid_topics: '',
  });

  const [kbType, setKbType] = useState('static');
  const [kbName, setKbName] = useState('Default Knowledge Base');
  const [uploadFiles, setUploadFiles] = useState([]);
  const [manualEntries, setManualEntries] = useState(['']);
  const [sheetsUrl, setSheetsUrl] = useState('');
  
  // Hospital Configuration
  const [hospitalEnabled, setHospitalEnabled] = useState(false);
  const [hospitalConfig, setHospitalConfig] = useState({
    sheet_id_1: '', // Master data sheet
    sheet_id_2: '', // Booking schedule sheet
    credentials_json: '',
  });

  useEffect(() => { loadVoices(); }, []);

  async function loadVoices() {
    try {
      const data = await voicesAPI.list();
      setVoices(data.voices || []);
    } catch {
      setVoices([
        { id: 'Puck', name: 'Puck', gender: 'Male', style: 'Friendly' },
        { id: 'Charon', name: 'Charon', gender: 'Male', style: 'Professional' },
        { id: 'Kore', name: 'Kore', gender: 'Female', style: 'Warm' },
        { id: 'Fenrir', name: 'Fenrir', gender: 'Male', style: 'Deep' },
        { id: 'Aoede', name: 'Aoede', gender: 'Female', style: 'Clear' },
      ]);
    }
  }

  function showToast(msg, type = 'info') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  function buildPersonaBlock(p) {
    return [
      PERSONA_HEADER,
      `Tone: ${p.tone}`, `Speaking pace: ${p.pace}`,
      `Empathy: ${p.empathy}`, `Humor: ${p.humor}`, `Assertiveness: ${p.assertiveness}`,
      p.backstory ? `Backstory: ${p.backstory}` : null,
      p.signature_phrases ? `Signature phrases: ${p.signature_phrases}` : null,
      p.avoid_topics ? `Avoid topics: ${p.avoid_topics}` : null,
      PERSONA_FOOTER,
    ].filter(Boolean).join('\n');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) { showToast('Agent name is required', 'error'); return; }
    setLoading(true);
    try {
      const personaBlock = personaEnabled ? buildPersonaBlock(persona) : '';
      const sysPrompt = personaBlock
        ? form.system_prompt.replace(new RegExp(`${PERSONA_HEADER}[\\s\\S]*?${PERSONA_FOOTER}`, 'g'), '').trim() + '\n\n' + personaBlock
        : form.system_prompt;

      const agent = await agentsAPI.create({ 
        ...form, 
        system_prompt: sysPrompt,
        hospital_config: hospitalEnabled ? hospitalConfig : null,
      });
      const kb = await kbAPI.create(agent.id, { name: kbName || 'Default KB', kb_type: kbType, source_url: kbType === 'dynamic' ? sheetsUrl : null });

      if (kbType === 'static') {
        for (const f of uploadFiles) {
          try { await kbAPI.uploadFile(kb.id, f); } catch {}
        }
        for (const entry of manualEntries) {
          if (entry.trim()) try { await kbAPI.addEntry(kb.id, entry.trim()); } catch {}
        }
      }

      navigate(`/agents/${agent.id}`);
    } catch (err) {
      showToast('Failed to create: ' + err.message, 'error');
    } finally { setLoading(false); }
  }

  const selectedLang = LANGUAGES.find(l => l.value === form.language);

  return (
    <div style={{ animation: 'pageEnter .4s ease-out', maxWidth: 760, margin: '0 auto' }}>
      {toast && (
        <div className={`toast toast-${toast.type}`} style={{ position: 'fixed', top: 80, right: 24, zIndex: 1000, minWidth: 260 }}>
          {toast.msg}
        </div>
      )}

      <div className="page-header" style={{ marginBottom: 'var(--space-lg)' }}>
        <div>
          <h1 className="page-title">Create Agent</h1>
          <p className="page-subtitle">Deploy your AI voice agent in 3 steps.</p>
        </div>
      </div>

      <StepBar current={step} />

      <form onSubmit={handleSubmit}>
        {/* ── STEP 1: Agent Details ── */}
        {step === 1 && (
          <div style={{ animation: 'slideUp .3s ease-out', display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>

            {/* Name */}
            <div className="card">
              <div className="card-title" style={{ marginBottom: 'var(--space-md)' }}>
                <span style={{ marginRight: 8 }}>🤖</span>Identity
              </div>
              <div className="form-field">
                <label>Agent Name <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g., Mark, Priya, SupportBot"
                  required
                  autoFocus
                />
              </div>
              <div className="form-field" style={{ marginTop: 'var(--space-sm)' }}>
                <label>Description <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span></label>
                <textarea
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="Briefly describe what this agent does…"
                  style={{ minHeight: 68 }}
                />
              </div>
            </div>

            {/* Role */}
            <div className="card">
              <div className="card-title" style={{ marginBottom: 'var(--space-md)' }}>
                <span style={{ marginRight: 8 }}>🎭</span>Role
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {ROLES.map(r => (
                  <RoleCard key={r.value} option={r} selected={form.role === r.value}
                    onSelect={v => setForm({ ...form, role: v })} />
                ))}
              </div>
            </div>

            {/* Voice + Language */}
            <div className="card">
              <div className="card-title" style={{ marginBottom: 'var(--space-md)' }}>
                <span style={{ marginRight: 8 }}>🎙️</span>Voice & Language
              </div>
              <div className="form-field">
                <label>Choose a voice</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 8, marginTop: 4 }}>
                  {voices.map(v => (
                    <VoiceCard key={v.id} voice={v} selected={form.voice_id === v.id}
                      onSelect={id => setForm({ ...form, voice_id: id })} />
                  ))}
                </div>
              </div>
              <div className="form-field" style={{ marginTop: 'var(--space-md)' }}>
                <label>Conversation Language</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                  {LANGUAGES.map(l => (
                    <button key={l.value} type="button"
                      onClick={() => setForm({ ...form, language: l.value })}
                      style={{
                        padding: '6px 12px', borderRadius: 'var(--r-pill)',
                        background: form.language === l.value ? 'var(--accent-soft)' : 'var(--bg-elevated)',
                        border: `1.5px solid ${form.language === l.value ? 'var(--accent)' : 'var(--border)'}`,
                        color: form.language === l.value ? 'var(--accent)' : 'var(--text-muted)',
                        cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, transition: 'all .18s',
                      }}>
                      {l.flag} {l.label}
                    </button>
                  ))}
                </div>
                {selectedLang && (
                  <span className="form-hint">{selectedLang.desc}</span>
                )}
              </div>
            </div>

            {/* System Prompt */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-md)' }}>
                <div>
                  <div className="card-title"><span style={{ marginRight: 8 }}>🧠</span>System Prompt</div>
                  <div className="card-subtitle">Instructions the AI follows on every call.</div>
                </div>
              </div>
              <div className="form-field">
                <textarea
                  value={form.system_prompt}
                  onChange={e => setForm({ ...form, system_prompt: e.target.value })}
                  style={{ minHeight: 120, fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}
                  placeholder="You are a helpful agent…"
                />
              </div>
            </div>

            {/* Persona */}
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: personaEnabled ? 'var(--space-lg)' : 0 }}>
                <div>
                  <div className="card-title"><span style={{ marginRight: 8 }}>✨</span>Persona Builder</div>
                  <div className="card-subtitle">Fine-tune your agent's personality.</div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{personaEnabled ? 'On' : 'Off'}</span>
                  <div
                    onClick={() => setPersonaEnabled(!personaEnabled)}
                    style={{
                      width: 42, height: 22, borderRadius: 11,
                      background: personaEnabled ? 'var(--accent)' : 'var(--bg-input)',
                      border: `1px solid ${personaEnabled ? 'var(--accent)' : 'var(--border)'}`,
                      position: 'relative', cursor: 'pointer', transition: 'all .25s',
                    }}>
                    <div style={{
                      position: 'absolute', top: 2, left: personaEnabled ? 22 : 2,
                      width: 16, height: 16, borderRadius: '50%',
                      background: 'white', transition: 'left .25s',
                      boxShadow: '0 1px 4px rgba(0,0,0,.3)',
                    }} />
                  </div>
                </label>
              </div>

              {personaEnabled && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', animation: 'slideUp .2s ease-out' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                    <div className="form-field">
                      <label>Tone</label>
                      <select value={persona.tone} name="tone"
                        onChange={e => setPersona({ ...persona, tone: e.target.value })}>
                        {['friendly', 'professional', 'casual', 'formal'].map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div className="form-field">
                      <label>Pace</label>
                      <select value={persona.pace} name="pace"
                        onChange={e => setPersona({ ...persona, pace: e.target.value })}>
                        {['slow', 'normal', 'fast'].map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-md)' }}>
                    {[['Empathy', 'empathy'], ['Humor', 'humor'], ['Assertiveness', 'assertiveness']].map(([label, key]) => (
                      <SliderField key={key} label={label} name={key} value={persona[key]}
                        onChange={e => setPersona({ ...persona, [key]: Number(e.target.value) })} />
                    ))}
                  </div>
                  <div className="form-field">
                    <label>Backstory <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.7rem' }}>(optional)</span></label>
                    <textarea value={persona.backstory} style={{ minHeight: 68 }}
                      onChange={e => setPersona({ ...persona, backstory: e.target.value })}
                      placeholder="Give your agent a background story…" />
                  </div>
                  <div className="form-field">
                    <label>Signature Phrases</label>
                    <input value={persona.signature_phrases}
                      onChange={e => setPersona({ ...persona, signature_phrases: e.target.value })}
                      placeholder="e.g., 'Absolutely!, 'Let me check that for you'" />
                  </div>
                  <div className="form-field">
                    <label>Avoid Topics</label>
                    <input value={persona.avoid_topics}
                      onChange={e => setPersona({ ...persona, avoid_topics: e.target.value })}
                      placeholder="e.g., competitor names, sensitive pricing" />
                  </div>
                </div>
              )}
            </div>

            {/* Hospital Booking Configuration */}
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
                <div>
                  <div className="card-title"><span style={{ marginRight: 8 }}>🏥</span>Hospital Booking (Optional)</div>
                  <div className="card-subtitle">Enable appointment booking with Google Sheets</div>
                </div>
                <button
                  type="button"
                  onClick={() => setHospitalEnabled(!hospitalEnabled)}
                  style={{
                    padding: '6px 12px', borderRadius: 'var(--r-pill)',
                    background: hospitalEnabled ? 'var(--teal)' : 'var(--bg-input)',
                    color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer', fontSize: '0.75rem',
                    transition: 'all .2s',
                  }}>
                  {hospitalEnabled ? '✓ Enabled' : 'Disabled'}
                </button>
              </div>

              {hospitalEnabled && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                  <div style={{ background: 'var(--bg-input)', padding: 'var(--space-md)', borderRadius: 'var(--r-md)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    📋 <strong>Sheet 1 (Master):</strong> Doctor names, specializations, available times<br/>
                    📅 <strong>Sheet 2 (Bookings):</strong> Agent maintains appointment schedule, prevents double-booking
                  </div>
                  
                  <div className="form-field">
                    <label>Google Sheets ID #1 (Doctor Master Data)</label>
                    <input
                      value={hospitalConfig.sheet_id_1}
                      onChange={e => setHospitalConfig({ ...hospitalConfig, sheet_id_1: e.target.value })}
                      placeholder="e.g., 1a2b3c4d5e6f7g8h9i0j"
                    />
                    <span className="form-hint">Get from the URL: docs.google.com/spreadsheets/d/<strong>SHEET_ID</strong>/</span>
                  </div>

                  <div className="form-field">
                    <label>Google Sheets ID #2 (Booking Schedule)</label>
                    <input
                      value={hospitalConfig.sheet_id_2}
                      onChange={e => setHospitalConfig({ ...hospitalConfig, sheet_id_2: e.target.value })}
                      placeholder="e.g., 1k2l3m4n5o6p7q8r9s0t"
                    />
                    <span className="form-hint">Sheet 2 will be auto-populated with booking records</span>
                  </div>

                  <div className="form-field">
                    <label>Google Service Account JSON (Optional)</label>
                    <textarea
                      value={hospitalConfig.credentials_json}
                      onChange={e => setHospitalConfig({ ...hospitalConfig, credentials_json: e.target.value })}
                      placeholder="Paste your Google Service Account JSON here for API access"
                      style={{ minHeight: 80, fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}
                    />
                    <span className="form-hint">Leave empty for user-shared sheets. Service account required for reliable write access.</span>
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-primary btn-lg"
                onClick={() => { if (!form.name.trim()) { showToast('Agent name is required', 'error'); return; } setStep(2); }}>
                Next: Knowledge Base →
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Knowledge Base ── */}
        {step === 2 && (
          <div style={{ animation: 'slideUp .3s ease-out', display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>

            <div className="card">
              <div className="card-title" style={{ marginBottom: 'var(--space-md)' }}>📚 Knowledge Base</div>
              <div className="form-field">
                <label>KB Name</label>
                <input value={kbName} onChange={e => setKbName(e.target.value)}
                  placeholder="e.g., Product FAQ, Support Docs" />
              </div>

              {/* Type selector */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 'var(--space-md)' }}>
                {[
                  { val: 'static', icon: '📁', title: 'Static', desc: 'Upload files or type manually' },
                  { val: 'dynamic', icon: '🔄', title: 'Dynamic', desc: 'Syncs from Google Sheets' },
                ].map(t => (
                  <button key={t.val} type="button"
                    onClick={() => setKbType(t.val)}
                    style={{
                      padding: 'var(--space-md)', borderRadius: 'var(--r-md)', textAlign: 'left',
                      background: kbType === t.val ? 'var(--accent-soft)' : 'var(--bg-elevated)',
                      border: `1.5px solid ${kbType === t.val ? 'var(--accent)' : 'var(--border)'}`,
                      cursor: 'pointer', transition: 'all .18s',
                    }}>
                    <div style={{ fontSize: '1.4rem', marginBottom: 4 }}>{t.icon}</div>
                    <div style={{ fontWeight: 700, fontSize: '0.87rem', color: 'var(--text-primary)' }}>{t.title}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{t.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {kbType === 'static' && (
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
                {/* Drop zone */}
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 10 }}>
                    Upload Files <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(CSV, PDF, Excel)</span>
                  </label>
                  <div
                    onClick={() => document.getElementById('file-input').click()}
                    onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--accent)'; }}
                    onDragLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                    onDrop={e => {
                      e.preventDefault(); e.currentTarget.style.borderColor = 'var(--border)';
                      setUploadFiles([...uploadFiles, ...Array.from(e.dataTransfer.files)]);
                    }}
                    style={{
                      border: '2px dashed var(--border)', borderRadius: 'var(--r-md)',
                      padding: 'var(--space-xl)', textAlign: 'center', cursor: 'pointer',
                      transition: 'border-color .2s, background .2s',
                    }}
                  >
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.4" style={{ marginBottom: 8 }}>
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                      <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    <div style={{ fontSize: '0.87rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Click or drag files here</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>Supports CSV, PDF, Excel (.xlsx)</div>
                  </div>
                  <input id="file-input" type="file" multiple accept=".csv,.pdf,.xlsx,.xls"
                    style={{ display: 'none' }}
                    onChange={e => setUploadFiles([...uploadFiles, ...Array.from(e.target.files)])} />

                  {uploadFiles.length > 0 && (
                    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {uploadFiles.map((f, i) => (
                        <div key={i} style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '8px 12px', background: 'var(--bg-input)', borderRadius: 'var(--r-sm)',
                          fontSize: '0.8rem',
                        }}>
                          <span>📄 {f.name} <span style={{ color: 'var(--text-muted)' }}>({(f.size / 1024).toFixed(1)} KB)</span></span>
                          <button type="button" className="btn btn-ghost btn-sm"
                            onClick={() => setUploadFiles(uploadFiles.filter((_, j) => j !== i))}>✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Manual entries */}
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>
                    Manual Text Entries
                  </label>
                  {manualEntries.map((entry, i) => (
                    <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                      <textarea value={entry} className="form-field"
                        style={{ flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '10px 12px', color: 'var(--text-primary)', resize: 'vertical', minHeight: 72, fontSize: '0.84rem', fontFamily: 'inherit', outline: 'none' }}
                        placeholder="Type or paste knowledge content here…"
                        onChange={e => {
                          const u = [...manualEntries]; u[i] = e.target.value; setManualEntries(u);
                        }} />
                      {manualEntries.length > 1 && (
                        <button type="button" className="btn btn-ghost btn-sm"
                          onClick={() => setManualEntries(manualEntries.filter((_, j) => j !== i))}>✕</button>
                      )}
                    </div>
                  ))}
                  <button type="button" className="btn btn-ghost btn-sm"
                    onClick={() => setManualEntries([...manualEntries, ''])}>+ Add entry</button>
                </div>
              </div>
            )}

            {kbType === 'dynamic' && (
              <div className="card">
                <div className="form-field">
                  <label>Google Sheets URL</label>
                  <input value={sheetsUrl} onChange={e => setSheetsUrl(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/…" />
                  <span className="form-hint">Make sure the sheet has "Anyone with the link can view" access.</span>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setStep(1)}>← Back</button>
              <button type="button" className="btn btn-primary" onClick={() => setStep(3)}>Next: Review →</button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Review & Create ── */}
        {step === 3 && (
          <div style={{ animation: 'slideUp .3s ease-out', display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>

            {/* Preview card */}
            <div className="card" style={{ position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, var(--accent), var(--teal))' }} />
              <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 'var(--space-lg)' }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 'var(--r-md)', background: 'var(--accent-soft)',
                  border: '1px solid var(--border-accent)', display: 'grid', placeItems: 'center',
                  fontSize: '1.4rem',
                }}>
                  {ROLES.find(r => r.value === form.role)?.icon || '🤖'}
                </div>
                <div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>{form.name || '—'}</div>
                  <span className="badge badge-primary" style={{ marginTop: 4 }}>{form.role}</span>
                </div>
              </div>

              <ReviewRow label="Voice" value={form.voice_id} />
              <ReviewRow label="Language" value={selectedLang?.desc || form.language} />
              <ReviewRow label="Knowledge Base" value={`${kbType === 'static' ? '📁 Static' : '🔄 Dynamic'} · ${kbName}`} />
              {kbType === 'static' && uploadFiles.length > 0 && (
                <ReviewRow label="Files" value={`${uploadFiles.length} file(s) queued`} />
              )}
              <ReviewRow label="Persona" value={personaEnabled ? `${persona.tone} · ${persona.pace}` : 'Default'} />
              {form.description && <ReviewRow label="Description" value={form.description} />}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setStep(2)}>← Back</button>
              <button type="submit" className="btn btn-primary btn-lg" disabled={loading}
                style={{ minWidth: 200 }}>
                {loading
                  ? <><span className="btn-spinner" /> Creating agent…</>
                  : '🚀 Launch Agent'
                }
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
