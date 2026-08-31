import axios from 'axios';
import { getToken, clearToken } from './auth';

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      clearToken();
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const api = {
  // Auth
  login: (email, password) => apiClient.post('/api/auth/login', { email, password }),

  // Documents
  listDocuments: (params) => apiClient.get('/api/documents', { params }),

  getDocument: (documentId) => apiClient.get(`/api/documents/${documentId}`),

  uploadDocument: (fileName, fileData, extra) =>
    apiClient.post('/api/documents/upload', { fileName, fileData, ...extra }),

  // New Envelope wizard (Document -> Recipients -> Fields), multi-recipient,
  // token-based signing — distinct from the legacy single-admin uploadDocument above.
  createEnvelope: (payload) => apiClient.post('/api/documents/envelope', payload),

  previewDocument: (documentId) =>
    apiClient.get(`/api/documents/${documentId}/preview`, { responseType: 'arraybuffer' }),

  previewSignedDocument: (documentId) =>
    apiClient.get(`/api/documents/${documentId}/preview-signed`, { responseType: 'arraybuffer' }),

  getDocumentStatus: (documentId) => apiClient.get(`/api/documents/${documentId}/status`),

  setSigners: (documentId, signers) =>
    apiClient.post(`/api/documents/${documentId}/signers`, { signers }),

  updateRetention: (documentId, payload) =>
    apiClient.post(`/api/documents/${documentId}/retention`, payload),

  declineDocument: (documentId, reason) =>
    apiClient.post(`/api/documents/${documentId}/decline`, { reason }),

  requestChanges: (documentId, comments) =>
    apiClient.post(`/api/documents/${documentId}/request-changes`, { comments }),

  // Signatures
  placeSignatures: (documentId, placements) =>
    apiClient.post('/api/signatures/place', { documentId, placements }),

  reviewDocument: (documentId, approved, comments) =>
    apiClient.post(`/api/signatures/${documentId}/review`, { approved, comments }),

  signDocument: (documentId, signerName) =>
    apiClient.post(`/api/signatures/${documentId}/sign`, { signerName }),

  // Audit (per document)
  getAuditRecords: (documentId) => apiClient.get(`/api/documents/${documentId}/audit-records`),

  verifyAudit: (documentId) => apiClient.post(`/api/documents/${documentId}/verify-audit`),

  completeAudit: (documentId) => apiClient.post(`/api/documents/${documentId}/complete-audit`),

  // Global audit logs
  listAuditLogs: (params) => apiClient.get('/api/audit-logs', { params }),

  exportAuditLogsUrl: (params) => {
    const search = new URLSearchParams(params).toString();
    return `${apiClient.defaults.baseURL}/api/audit-logs/export${search ? `?${search}` : ''}`;
  },

  // Downloads
  downloadSigned: (documentId) =>
    apiClient.get(`/api/documents/${documentId}/download-signed`, { responseType: 'blob' }),

  downloadOriginal: (documentId) =>
    apiClient.get(`/api/documents/${documentId}/download-original`, { responseType: 'blob' }),

  // Users
  listUsers: (params) => apiClient.get('/api/users', { params }),

  createUser: (data) => apiClient.post('/api/users', data),

  updateUser: (id, data) => apiClient.put(`/api/users/${id}`, data),

  // Roles
  getRolePermissions: () => apiClient.get('/api/roles/permissions'),

  updateRolePermissions: (permissions) => apiClient.put('/api/roles/permissions', { permissions }),

  // Dashboard
  getDashboardStats: () => apiClient.get('/api/dashboard/stats'),

  // Integrations
  listApiKeys: () => apiClient.get('/api/integrations/api-keys'),
  createApiKey: (name) => apiClient.post('/api/integrations/api-keys', { name }),
  revokeApiKey: (id) => apiClient.delete(`/api/integrations/api-keys/${id}`),
  listWebhooks: () => apiClient.get('/api/integrations/webhooks'),
  createWebhook: (url, events) => apiClient.post('/api/integrations/webhooks', { url, events }),
  removeWebhook: (id) => apiClient.delete(`/api/integrations/webhooks/${id}`),
  listDeliveryLogs: () => apiClient.get('/api/integrations/delivery-logs'),

  // Settings
  getPasswordPermissions: () => apiClient.get('/api/settings/password-permissions'),
  updatePasswordPermissions: (payload) => apiClient.put('/api/settings/password-permissions', payload),

  // Auth
  getCurrentUser: () => apiClient.get('/api/auth/me'),

  // Public, token-gated recipient signing (no login) — routes/signing.js
  resolveSigningToken: (token) => apiClient.get(`/api/signing/${token}`),

  previewSigningDocument: (token) =>
    apiClient.get(`/api/signing/${token}/preview`, { responseType: 'arraybuffer' }),

  requestOtp: (token) => apiClient.post(`/api/signing/${token}/request-otp`),

  verifyOtp: (token, code) => apiClient.post(`/api/signing/${token}/verify-otp`, { code }),

  verifyPassword: (token, password) => apiClient.post(`/api/signing/${token}/verify-password`, { password }),

  submitSignature: (token, values, reason) =>
    apiClient.post(`/api/signing/${token}/sign`, { values, reason }),

  downloadSigningVariant: (token, variant) =>
    apiClient.get(`/api/signing/${token}/download`, { params: { variant }, responseType: 'blob' }),
};

export default apiClient;
