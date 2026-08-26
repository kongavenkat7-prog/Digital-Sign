import axios from 'axios';

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  headers: {
    'Content-Type': 'application/json',
  },
});

export const api = {
  // Documents
  uploadDocument: (fileName: string, fileData: string) =>
    apiClient.post('/api/documents/upload', { fileName, fileData }),
  
  previewDocument: (documentId: string) =>
    apiClient.get(`/api/documents/${documentId}/preview`, { responseType: 'arraybuffer' }),
  
  getDocumentStatus: (documentId: string) =>
    apiClient.get(`/api/documents/${documentId}/status`),
  
  // Signatures
  placeSignature: (documentId: string, signatureImage: string, signatureX: number, signatureY: number, pageNumber: number) =>
    apiClient.post('/api/signatures/place', { documentId, signatureImage, signatureX, signatureY, pageNumber }),
  
  reviewDocument: (documentId: string, approved: boolean, comments: string) =>
    apiClient.post(`/api/signatures/${documentId}/review`, { approved, comments }),
  
  signDocument: (documentId: string) =>
    apiClient.post(`/api/signatures/${documentId}/sign`),
  
  // Audit
  getAuditRecords: (documentId: string) =>
    apiClient.get(`/api/documents/${documentId}/audit-records`),
  
  verifyAudit: (documentId: string) =>
    apiClient.post(`/api/documents/${documentId}/verify-audit`),
  
  completeAudit: (documentId: string) =>
    apiClient.post(`/api/documents/${documentId}/complete-audit`),
  
  // Downloads
  downloadSigned: (documentId: string) =>
    apiClient.get(`/api/documents/${documentId}/download-signed`, { responseType: 'blob' }),
  
  downloadOriginal: (documentId: string) =>
    apiClient.get(`/api/documents/${documentId}/download-original`, { responseType: 'blob' }),
};

export default apiClient;
