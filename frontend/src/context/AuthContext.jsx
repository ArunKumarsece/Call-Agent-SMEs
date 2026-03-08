import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);
const TOKEN_KEY   = 'vf_access_token';
const COMPANY_KEY = 'vf_company';

export function AuthProvider({ children }) {
    const [company, setCompany] = useState(() => {
        try { return JSON.parse(localStorage.getItem(COMPANY_KEY)); } catch { return null; }
    });
    const [token, setToken]     = useState(() => localStorage.getItem(TOKEN_KEY));
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY);
    }, [token]);

    useEffect(() => {
        company ? localStorage.setItem(COMPANY_KEY, JSON.stringify(company)) : localStorage.removeItem(COMPANY_KEY);
    }, [company]);

    // On mount — verify stored token or silent-refresh via cookie
    useEffect(() => {
        (async () => {
            if (!token) { setLoading(false); return; }
            try {
                const res = await fetch('/api/auth/me', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.ok) {
                    setCompany(await res.json());
                } else {
                    const ok = await _silentRefresh();
                    if (!ok) { setToken(null); setCompany(null); }
                }
            } catch {
                const ok = await _silentRefresh();
                if (!ok) { setToken(null); setCompany(null); }
            } finally {
                setLoading(false);
            }
        })();
    }, []);  // eslint-disable-line

    async function _silentRefresh() {
        try {
            const res = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
            if (!res.ok) return false;
            const data = await res.json();
            setToken(data.access_token);
            setCompany(data.company);
            return true;
        } catch { return false; }
    }

    const login = useCallback(async (email, password) => {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Login failed');
        setToken(data.access_token);
        setCompany(data.company);
    }, []);

    const register = useCallback(async (payload) => {
        const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Registration failed');
        setToken(data.access_token);
        setCompany(data.company);
    }, []);

    const logout = useCallback(async () => {
        try {
            await fetch('/api/auth/logout', {
                method: 'POST', credentials: 'include',
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
        } catch (_) {}
        setToken(null);
        setCompany(null);
    }, [token]);

    const updateCompany = useCallback((updated) => setCompany(p => ({ ...p, ...updated })), []);
    const getToken      = useCallback(() => token, [token]);

    return (
        <AuthContext.Provider value={{ company, token, loading, login, register, logout, updateCompany, getToken }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be inside AuthProvider');
    return ctx;
}
