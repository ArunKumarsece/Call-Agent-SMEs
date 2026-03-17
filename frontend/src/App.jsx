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
import Sidebar from './components/Sidebar';
import Dashboard    from './pages/Dashboard';
import Analytics    from './pages/Analytics';
import CallHistory  from './pages/CallHistory';
import Billing      from './pages/Billing';
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
        <div className="route-loading-screen">
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

    let pageTitle = 'Dashboard';
    if (location.pathname.startsWith('/agents/new')) pageTitle = 'Create Agent';
    else if (location.pathname.startsWith('/agents/') && location.pathname.endsWith('/edit')) pageTitle = 'Edit Agent';
    else if (location.pathname.startsWith('/agents/')) pageTitle = 'Agent Detail';
    else if (location.pathname.startsWith('/analytics')) pageTitle = 'Analytics';
    else if (location.pathname.startsWith('/calls')) pageTitle = 'Call History';
    else if (location.pathname.startsWith('/billing')) pageTitle = 'Billing';
    else if (location.pathname.startsWith('/settings')) pageTitle = 'Settings';

    return (
        <nav className="navbar">
            <div className="navbar-title">{pageTitle}</div>

            {/* Company pill */}
            <div className="navbar-actions">
                <div className="company-pill">
                    <div className="company-pill-avatar">
                        {company.logo_url ? <img src={company.logo_url} className="company-pill-logo" alt="" /> : <span style={{ fontWeight: 800, fontSize: 11 }}>{(company.company_name || 'C')[0].toUpperCase()}</span>}
                    </div>
                    <span className="company-pill-name">
                        {company.company_name}
                    </span>
                    <span className="company-pill-plan" style={{ color: PLAN_BADGE[company.plan] || '#94a3b8' }}>
                        {company.plan}
                    </span>
                </div>
                <button
                    onClick={logout}
                    className="btn btn-ghost btn-sm"
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
        <div className="app-shell">
            <Sidebar />
            <div className="app-main">
                <Navbar />
                <main className="app-content">
                    <Routes>
                        {/* Public routes */}
                        <Route path="/login"    element={company ? <Navigate to="/" replace /> : <Login />} />
                        <Route path="/register" element={company ? <Navigate to="/" replace /> : <Register />} />

                        {/* Protected routes */}
                        <Route path="/"                  element={<PrivateRoute><Dashboard /></PrivateRoute>} />
                        <Route path="/analytics"          element={<PrivateRoute><Analytics /></PrivateRoute>} />
                        <Route path="/calls"              element={<PrivateRoute><CallHistory /></PrivateRoute>} />
                        <Route path="/billing"            element={<PrivateRoute><Billing /></PrivateRoute>} />
                        <Route path="/agents/new"        element={<PrivateRoute><CreateAgent /></PrivateRoute>} />
                        <Route path="/agents/:id"        element={<PrivateRoute><AgentDetail /></PrivateRoute>} />
                        <Route path="/agents/:id/edit"   element={<PrivateRoute><EditAgent /></PrivateRoute>} />
                        <Route path="/settings"          element={<PrivateRoute><Settings /></PrivateRoute>} />

                        {/* Fallback */}
                        <Route path="*" element={<Navigate to={company ? '/' : '/login'} replace />} />
                    </Routes>
                </main>
            </div>
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
