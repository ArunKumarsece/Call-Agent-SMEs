// import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
// import Dashboard from './pages/Dashboard';
// import CreateAgent from './pages/CreateAgent';
// import AgentDetail from './pages/AgentDetail';
// import EditAgent from './pages/EditAgent';

// function Navbar() {
//     const location = useLocation();

//     return (
//         <nav className="navbar">
//             <Link to="/" className="navbar-brand">
//                 <span className="brand-icon">🤖</span>
//                 VoiceForge AI
//             </Link>
//             <div className="navbar-links">
//                 <Link to="/" className={location.pathname === '/' ? 'active' : ''}>
//                     Dashboard
//                 </Link>
//                 <Link to="/agents/new" className={location.pathname === '/agents/new' ? 'active' : ''}>
//                     Create Agent
//                 </Link>
//             </div>
//         </nav>
//     );
// }

// function App() {
//     return (
//         <Router>
//             <div className="app-layout">
//                 <Navbar />
//                 <main className="app-content">
//                     <Routes>
//                         <Route path="/" element={<Dashboard />} />
//                         <Route path="/agents/new" element={<CreateAgent />} />
//                         <Route path="/agents/:id" element={<AgentDetail />} />
//                         <Route path="/agents/:id/edit" element={<EditAgent />} />
//                     </Routes>
//                 </main>
//             </div>
//         </Router>
//     );
// }

// export default App;


import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { setTokenGetter } from './api';
import Dashboard    from './pages/Dashboard';
import CreateAgent  from './pages/CreateAgent';
import AgentDetail  from './pages/AgentDetail';
import EditAgent    from './pages/EditAgent';
import Login        from './pages/Login';
import Register     from './pages/Register';
import Settings     from './pages/Settings';

// ─── Wire token getter into api.js ────────────────────────────────────────────
function TokenWirer() {
    const { getToken } = useAuth();
    useEffect(() => { setTokenGetter(getToken); }, [getToken]);
    return null;
}

// ─── Route guard ──────────────────────────────────────────────────────────────
function PrivateRoute({ children }) {
    const { company, loading } = useAuth();
    if (loading) return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="spinner" />
        </div>
    );
    return company ? children : <Navigate to="/login" replace />;
}

// ─── Navbar ───────────────────────────────────────────────────────────────────
function Navbar() {
    const location        = useLocation();
    const { company, logout } = useAuth();
    const isAuth = !!company;

    if (!isAuth) return null;

    const PLAN_BADGE = { free: '#94a3b8', pro: '#6c63ff', enterprise: '#f59e0b' };

    return (
        <nav className="navbar">
            <Link to="/" className="navbar-brand">
                <span className="brand-icon">🤖</span>
                VoiceForge AI
            </Link>

            <div className="navbar-links">
                <Link to="/" className={location.pathname === '/' ? 'active' : ''}>Dashboard</Link>
                <Link to="/agents/new" className={location.pathname === '/agents/new' ? 'active' : ''}>
                    Create Agent
                </Link>
                <Link to="/settings" className={location.pathname === '/settings' ? 'active' : ''}>
                    Settings
                </Link>
            </div>

            {/* Company pill */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 20, padding: '5px 14px 5px 8px' }}>
                    <div style={{ width: 26, height: 26, borderRadius: 8, background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>
                        {company.logo_url ? <img src={company.logo_url} style={{ width: 24, height: 24, borderRadius: 6, objectFit: 'cover' }} alt="" /> : '🏢'}
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {company.company_name}
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: PLAN_BADGE[company.plan] || '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        {company.plan}
                    </span>
                </div>
                <button
                    onClick={logout}
                    style={{ background: 'none', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 13, fontWeight: 600, transition: 'all 0.2s' }}
                    title="Sign out"
                >
                    Sign out
                </button>
            </div>
        </nav>
    );
}

// ─── App ──────────────────────────────────────────────────────────────────────
function AppRoutes() {
    const { company } = useAuth();
    return (
        <div className="app-layout">
            <Navbar />
            <main className="app-content">
                <Routes>
                    {/* Public routes */}
                    <Route path="/login"    element={company ? <Navigate to="/" replace /> : <Login />} />
                    <Route path="/register" element={company ? <Navigate to="/" replace /> : <Register />} />

                    {/* Protected routes */}
                    <Route path="/"                  element={<PrivateRoute><Dashboard /></PrivateRoute>} />
                    <Route path="/agents/new"        element={<PrivateRoute><CreateAgent /></PrivateRoute>} />
                    <Route path="/agents/:id"        element={<PrivateRoute><AgentDetail /></PrivateRoute>} />
                    <Route path="/agents/:id/edit"   element={<PrivateRoute><EditAgent /></PrivateRoute>} />
                    <Route path="/settings"          element={<PrivateRoute><Settings /></PrivateRoute>} />

                    {/* Fallback */}
                    <Route path="*" element={<Navigate to={company ? '/' : '/login'} replace />} />
                </Routes>
            </main>
        </div>
    );
}

export default function App() {
    return (
        <AuthProvider>
            <Router>
                <TokenWirer />
                <AppRoutes />
            </Router>
        </AuthProvider>
    );
}
