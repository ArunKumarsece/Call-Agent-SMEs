// /**
//  * API client for the AI Voice Agent Platform backend.
//  */

// const API_BASE = '/api';

// async function request(path, options = {}) {
//     const url = `${API_BASE}${path}`;
//     const config = {
//         headers: { 'Content-Type': 'application/json', ...options.headers },
//         ...options,
//     };

//     // Remove Content-Type for FormData (file uploads)
//     if (options.body instanceof FormData) {
//         delete config.headers['Content-Type'];
//     }

//     const response = await fetch(url, config);

//     if (!response.ok) {
//         const error = await response.json().catch(() => ({ detail: 'Request failed' }));
//         throw new Error(error.detail || `HTTP ${response.status}`);
//     }

//     return response.json();
// }

// // ─── Agents ──────────────────────────────────────────

// export const agentsAPI = {
//     list: () => request('/agents'),

//     get: (id) => request(`/agents/${id}`),

//     create: (data) => request('/agents/', {
//         method: 'POST',
//         body: JSON.stringify(data),
//     }),

//     update: (id, data) => request(`/agents/${id}`, {
//         method: 'PUT',
//         body: JSON.stringify(data),
//     }),

//     delete: (id) => request(`/agents/${id}`, {
//         method: 'DELETE',
//     }),

//     getSDK: (id) => request(`/agents/${id}/sdk`),

//     chat: (id, message) => request(`/agents/${id}/chat`, {
//         method: 'POST',
//         body: JSON.stringify({ message }),
//     }),
// };

// // ─── Knowledge Bases ─────────────────────────────────

// export const kbAPI = {
//     list: (agentId) => request(`/kb/agent/${agentId}`),

//     get: (kbId) => request(`/kb/${kbId}`),

//     create: (agentId, data) => request(`/kb/?agent_id=${agentId}`, {
//         method: 'POST',
//         body: JSON.stringify(data),
//     }),

//     update: (kbId, data) => request(`/kb/${kbId}`, {
//         method: 'PUT',
//         body: JSON.stringify(data),
//     }),

//     delete: (kbId) => request(`/kb/${kbId}`, {
//         method: 'DELETE',
//     }),

//     uploadFile: (kbId, file) => {
//         const formData = new FormData();
//         formData.append('file', file);
//         return request(`/kb/${kbId}/upload`, {
//             method: 'POST',
//             body: formData,
//         });
//     },

//     addEntry: (kbId, content, source = 'manual') => request(`/kb/${kbId}/entries`, {
//         method: 'POST',
//         body: JSON.stringify({ content, source_file: source }),
//     }),

//     listEntries: (kbId) => request(`/kb/${kbId}/entries`),

//     deleteEntry: (kbId, entryId) => request(`/kb/${kbId}/entries/${entryId}`, {
//         method: 'DELETE',
//     }),

//     sync: (kbId) => request(`/kb/${kbId}/sync`, {
//         method: 'POST',
//     }),
// };

// // ─── Voices ──────────────────────────────────────────

// export const voicesAPI = {
//     list: () => request('/voices'),
// };

// // ─── WebSocket ───────────────────────────────────────

// export function createCallWebSocket(agentId) {
//     const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
//     const host = window.location.host;
//     return new WebSocket(`${protocol}//${host}/ws/call/${agentId}`);
// }


/**
 * API client — automatically injects Bearer token from AuthContext.
 * Handles 401 by attempting a silent token refresh once.
 */

const API_BASE = '/api';

// Module-level token getter — set by AuthProvider on mount
let _getToken = () => localStorage.getItem('vf_access_token');
export function setTokenGetter(fn) { _getToken = fn; }

async function _refreshOnce() {
    try {
        const res = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
        if (!res.ok) return null;
        const data = await res.json();
        localStorage.setItem('vf_access_token', data.access_token);
        return data.access_token;
    } catch { return null; }
}

async function request(path, options = {}, _retry = true) {
    const url    = `${API_BASE}${path}`;
    const token  = _getToken();
    const config = {
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...options.headers,
        },
        ...options,
    };

    if (options.body instanceof FormData) {
        delete config.headers['Content-Type'];
    }

    const res = await fetch(url, config);

    // Silent refresh on 401
    if (res.status === 401 && _retry) {
        const newToken = await _refreshOnce();
        if (newToken) {
            return request(path, options, false);   // retry once
        }
        // Redirect to login if refresh also fails
        window.location.href = '/login';
        throw new Error('Session expired');
    }

    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Request failed' }));
        throw new Error(err.detail || `HTTP ${res.status}`);
    }

    return res.json();
}

// ─── Agents ───────────────────────────────────────────────────────────────────

export const agentsAPI = {
    list:   ()         => request('/agents/'),
    get:    (id)       => request(`/agents/${id}`),
    create: (data)     => request('/agents/', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/agents/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id)       => request(`/agents/${id}`, { method: 'DELETE' }),
    getSDK: (id)       => request(`/agents/${id}/sdk`),
    chat:   (id, msg, history) => request(`/agents/${id}/chat`, {
        method: 'POST', body: JSON.stringify({ message: msg, history: history || [] }),
    }),
};

// ─── Knowledge Bases ──────────────────────────────────────────────────────────

export const kbAPI = {
    list:        (agentId)          => request(`/kb/agent/${agentId}`),
    get:         (kbId)             => request(`/kb/${kbId}`),
    create:      (agentId, data)    => request(`/kb/?agent_id=${agentId}`, { method: 'POST', body: JSON.stringify(data) }),
    update:      (kbId, data)       => request(`/kb/${kbId}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete:      (kbId)             => request(`/kb/${kbId}`, { method: 'DELETE' }),
    uploadFile:  (kbId, file)       => {
        const fd = new FormData(); fd.append('file', file);
        return request(`/kb/${kbId}/upload`, { method: 'POST', body: fd });
    },
    addEntry:    (kbId, content, source = 'manual') => request(`/kb/${kbId}/entries`, {
        method: 'POST', body: JSON.stringify({ content, source_file: source }),
    }),
    listEntries: (kbId)             => request(`/kb/${kbId}/entries`),
    deleteEntry: (kbId, entryId)    => request(`/kb/${kbId}/entries/${entryId}`, { method: 'DELETE' }),
    sync:        (kbId)             => request(`/kb/${kbId}/sync`, { method: 'POST' }),
};

// ─── Voices ───────────────────────────────────────────────────────────────────

export const voicesAPI = {
    list: () => request('/voices'),
};

// ─── WebSocket (auth via query param since WS doesn't support headers) ────────

export function createCallWebSocket(agentId) {
    const token    = _getToken() || '';
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host     = window.location.host;
    return new WebSocket(`${protocol}//${host}/ws/call/${agentId}?token=${token}`);
}
