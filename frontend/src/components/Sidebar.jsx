import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// SVG icons inline (no external dep)
const icons = {
  dashboard: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="nav-icon">
      <rect x="2" y="2" width="7" height="7" rx="1.5"/>
      <rect x="11" y="2" width="7" height="7" rx="1.5"/>
      <rect x="2" y="11" width="7" height="7" rx="1.5"/>
      <rect x="11" y="11" width="7" height="7" rx="1.5"/>
    </svg>
  ),
  analytics: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="nav-icon">
      <path d="M2 14l4-5 4 3 4-7 4 4" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M2 18h16" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
    </svg>
  ),
  calls: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="nav-icon">
      <path d="M4 2h3l1.5 4-2 1.5c1 2 3 4 5 5l1.5-2L17 12v3a1 1 0 01-1 1A13 13 0 013 3a1 1 0 011-1z"/>
    </svg>
  ),
  billing: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="nav-icon">
      <rect x="2" y="5" width="16" height="12" rx="2"/>
      <path d="M2 9h16" strokeLinecap="round"/>
      <path d="M6 13h2M10 13h4" strokeLinecap="round"/>
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="nav-icon">
      <circle cx="10" cy="10" r="2.5"/>
      <path d="M10 2.5A1.5 1.5 0 0011.5 4c.55 0 1.02-.29 1.28-.72l.55-.95a7.5 7.5 0 012.34 1.35l-.53 1a1.5 1.5 0 000 2.64l1 .53a7.5 7.5 0 010 2.7l-1 .53a1.5 1.5 0 000 2.64l.53 1a7.5 7.5 0 01-2.34 1.35l-.55-.95A1.5 1.5 0 0010 17.5a1.5 1.5 0 00-1.28.72l-.55.95a7.5 7.5 0 01-2.34-1.35l.53-1a1.5 1.5 0 000-2.64l-1-.53a7.5 7.5 0 010-2.7l1-.53a1.5 1.5 0 000-2.64l-.53-1A7.5 7.5 0 018.17 3.27l.55.95A1.5 1.5 0 0010 2.5z"/>
    </svg>
  ),
  create: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="nav-icon">
      <circle cx="10" cy="10" r="8"/>
      <path d="M10 6v8M6 10h8" strokeLinecap="round"/>
    </svg>
  ),
};

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: 'dashboard', exact: true },
  { to: '/analytics', label: 'Analytics', icon: 'analytics' },
  { to: '/calls', label: 'Call History', icon: 'calls' },
  { to: '/billing', label: 'Billing', icon: 'billing' },
  { to: '/settings', label: 'Settings', icon: 'settings' },
];

export default function Sidebar() {
  const location = useLocation();
  const { company } = useAuth();

  if (!company) return null;

  const isActive = (item) =>
    item.exact ? location.pathname === item.to : location.pathname.startsWith(item.to);

  return (
    <aside className="sidebar">
      {/* Brand */}
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon" />
        <div>
          <div className="sidebar-brand-title">VoiceForge AI</div>
          <div className="sidebar-brand-subtitle">Operations Studio</div>
        </div>
      </div>

      {/* Main nav */}
      <div className="sidebar-section">
        <div className="sidebar-label">Main</div>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={isActive(item) ? 'sidebar-link active' : 'sidebar-link'}
              title={item.label}
            >
              {icons[item.icon]}
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      </div>

      {/* Agents quick access */}
      <div className="sidebar-section">
        <div className="sidebar-label">Agents</div>
        <nav className="sidebar-nav">
          <Link
            to="/agents/new"
            className={location.pathname === '/agents/new' ? 'sidebar-link active' : 'sidebar-link'}
            title="Create Agent"
          >
            {icons.create}
            <span>Create Agent</span>
          </Link>
        </nav>
      </div>

      <div className="sidebar-spacer" />

      {/* Footer — company info */}
      <div className="sidebar-footer">
        <div className="sidebar-company">
          <div className="sidebar-company-avatar">
            {company.logo_url
              ? <img src={company.logo_url} alt="" />
              : <span>{(company.company_name || 'C')[0].toUpperCase()}</span>
            }
          </div>
          <div className="sidebar-company-meta">
            <div className="sidebar-company-name">{company.company_name}</div>
            <div className="sidebar-company-plan">{company.plan}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
