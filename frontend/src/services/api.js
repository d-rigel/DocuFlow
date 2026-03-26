// Centralised Axios instance. Automatically attaches JWT from Zustand store.

import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:1337';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT to every request if present
api.interceptors.request.use((config) => {
  // Import lazily to avoid circular deps
  const token = localStorage.getItem('collabdoc_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 globally → clear auth and redirect
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('collabdoc_token');
      localStorage.removeItem('collabdoc_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
export const authAPI = {
  login: (identifier, password) =>
    api.post('/auth/local', { identifier, password }),
  register: (username, email, password) =>
    api.post('/auth/local/register', { username, email, password }),
  me: () => api.get('/users/me'),
};

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------
export const documentsAPI = {
  list: () =>
    api.get('/documents', {
      params: { populate: ['owner', 'collaborators'], sort: 'updatedAt:desc' },
    }),

  get: (id) =>
    api.get(`/documents/${id}`, {
      params: { populate: ['owner', 'collaborators'] },
    }),

  create: (data) => api.post('/documents', { data }),

  update: (id, data) => api.put(`/documents/${id}`, { data }),

  delete: (id) => api.delete(`/documents/${id}`),

  share: (id, email) => api.post(`/documents/${id}/share`, { email }),
};

export default api;
