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
  login: (email: string, password: string) =>
    apiClient.post('/api/auth/login', { email, password }),


  // Documents
  listDocuments: (params?: { status?: string; limit?: number }) =>
    apiClient.get('/api/documents', { params }),

  getDocument: (documentId: string) => apiClient.get(`/api/documents/${documentId}`),

  uploadDocument: (fileName: string, fileData: string, extra?: { requestedBy?: string; dueDate?: string; signers?: any[] }) =>
    apiClient.post('/api/documents/upload', { fileName, fileData, ...extra }),

  previewDocument: (documentId: string) =>
    apiClient.get(`/api/documents/${documentId}/preview`, { responseType: 'arraybuffer' }),

  getDocumentStatus: (documentId: string) =>
    apiClient.get(`/api/documents/${documentId}/status`),

  setSigners: (documentId: string, signers: any[]) =>
    apiClient.post(`/api/documents/${documentId}/signers`, { signers }),

  declineDocument: (documentId: string, reason?: string) =>
    apiClient.post(`/api/documents/${documentId}/decline`, { reason }),

  requestChanges: (documentId: string, comments?: string) =>
    apiClient.post(`/api/documents/${documentId}/request-changes`, { comments }),

  // Signatures
  placeSignature: (documentId: string, signatureImage: string, signatureX: number, signatureY: number, pageNumber: number) =>
    apiClient.post('/api/signatures/place', { documentId, signatureImage, signatureX, signatureY, pageNumber }),

  reviewDocument: (documentId: string, approved: boolean, comments: string) =>
    apiClient.post(`/api/signatures/${documentId}/review`, { approved, comments }),

  signDocument: (documentId: string, signerName?: string) =>
    apiClient.post(`/api/signatures/${documentId}/sign`, { signerName }),

  // Audit (per document)
  getAuditRecords: (documentId: string) =>
    apiClient.get(`/api/documents/${documentId}/audit-records`),

  verifyAudit: (documentId: string) =>
    apiClient.post(`/api/documents/${documentId}/verify-audit`),

  completeAudit: (documentId: string) =>
    apiClient.post(`/api/documents/${documentId}/complete-audit`),

  // Global audit logs
  listAuditLogs: (params?: { from?: string; to?: string; actionType?: string; search?: string }) =>
    apiClient.get('/api/audit-logs', { params }),

  exportAuditLogsUrl: (params?: { from?: string; to?: string; actionType?: string }) => {
    const search = new URLSearchParams(params as Record<string, string>).toString();
    return `${apiClient.defaults.baseURL}/api/audit-logs/export${search ? `?${search}` : ''}`;
  },

  // Downloads
  downloadSigned: (documentId: string) =>
    apiClient.get(`/api/documents/${documentId}/download-signed`, { responseType: 'blob' }),

  downloadOriginal: (documentId: string) =>
    apiClient.get(`/api/documents/${documentId}/download-original`, { responseType: 'blob' }),

  // Users
  listUsers: (params?: { search?: string; role?: string; status?: string }) =>
    apiClient.get('/api/users', { params }),

  createUser: (data: { name: string; email: string; title?: string; role?: string }) =>
    apiClient.post('/api/users', data),

  updateUser: (id: string, data: Partial<{ name: string; email: string; title: string; role: string; status: string }>) =>
    apiClient.put(`/api/users/${id}`, data),

  // Roles
  getRolePermissions: () => apiClient.get('/api/roles/permissions'),

  updateRolePermissions: (permissions: any[]) =>
    apiClient.put('/api/roles/permissions', { permissions }),

  // Dashboard
  getDashboardStats: () => apiClient.get('/api/dashboard/stats'),

  // Auth
  getCurrentUser: () => apiClient.get('/api/auth/me'),
};

export default apiClient;
