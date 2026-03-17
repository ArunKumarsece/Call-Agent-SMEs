import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV_ITEMS = [
    { to: '/', label: 'Dashboard' },
    { to: '/analytics', label: 'Analytics' },
    { to: '/calls', label: 'Call History' },
    { to: '/billing', label: 'Billing' },
    { to: '/settings', label: 'Settings' },
];

export default function Sidebar() {
    const location = useLocation();
    const { company } = useAuth();

    if (!company) return null;

    return (
        <aside className="sidebar">
            <div className="sidebar-brand">
                <span className="sidebar-brand-icon" />
                <div>
                    <div className="sidebar-brand-title">VoiceForge AI</div>
                    <div className="sidebar-brand-subtitle">Operations Studio</div>
                </div>
            </div>

            <div className="sidebar-section">
                <div className="sidebar-label">Main</div>
                <nav className="sidebar-nav">
                    {NAV_ITEMS.map((item) => (
                        <Link
                            key={item.to}
                            to={item.to}
                            className={location.pathname === item.to ? 'sidebar-link active' : 'sidebar-link'}
                        >
                            {item.label}
                        </Link>
                    ))}
                </nav>
            </div>

            <div className="sidebar-section">
                <div className="sidebar-label">Agents</div>
                <div className="sidebar-actions">
                    <Link to="/agents/new" className="btn btn-primary btn-sm">+ Create Agent</Link>
                    <Link to="/" className="btn btn-secondary btn-sm">View Agents</Link>
                </div>
            </div>

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
