export type SystemRole = 'Administrator' | 'Manager' | 'Signer' | 'Viewer';
export type UserStatus = 'active' | 'inactive';
export type DocumentStatus = 'pending' | 'signed' | 'verified' | 'declined';
export type SignerStatus = 'signed' | 'pending' | 'awaiting' | 'declined';

export interface AppUser {
  _id: string;
  name: string;
  email: string;
  title?: string;
  role: SystemRole;
  status: UserStatus;
  lastActiveAt: string;
  createdAt: string;
}

export interface Signer {
  name: string;
  email?: string;
  roleLabel?: string;
  order: number;
  status: SignerStatus;
  signedAt?: string;
  ipAddress?: string;
}

export interface SignatureRecordDto {
  _id: string;
  documentId: string;
  fileName: string;
  fileSize?: number;
  requestedBy?: string;
  dueDate?: string;
  signers: Signer[];
  status: DocumentStatus;
  signatureImage?: string;
  approved?: boolean;
  pdfHash?: string;
  signedPdfHash?: string;
  createdAt: string;
  signedAt?: string;
  verifiedAt?: string;
}

export interface RolePermissionDto {
  _id: string;
  key: string;
  label: string;
  description: string;
  order: number;
  roles: Record<SystemRole, boolean>;
}

export interface AuditLogDto {
  _id: string;
  documentId?: string;
  documentName?: string;
  userName: string;
  action: string;
  timestamp: string;
  details: Record<string, any>;
  ipAddress?: string;
  hash?: string;
}

export interface DashboardStats {
  awaitingSignatureCount: number;
  pendingApprovalsCount: number;
  recentlySignedCount: number;
  totalDocuments: number;
  statusAllocation: {
    pendingSignature: number;
    fullySigned: number;
    declined: number;
  };
  awaitingSignature: SignatureRecordDto[];
  recentlyCompleted: SignatureRecordDto[];
}

export const ACTION_TYPES = [
  'All Activities',
  'Document Created',
  'Document Viewed',
  'Signature Placed',
  'Document Reviewed',
  'Document Signed',
  'Signed Copy Generated',
  'Audit Chain Verified',
  'Audit Completed',
  'Document Downloaded',
  'Document Declined',
  'Changes Requested',
  'User Added',
  'User Updated',
  'Privilege Changed',
];
