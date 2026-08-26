import mongoose, { Schema } from 'mongoose';

export const AUDIT_ACTION_TYPES = [
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
] as const;

const auditLogSchema = new Schema({
  documentId: { type: String, index: true },
  documentName: String,
  userName: { type: String, default: 'System' },
  action: { type: String, required: true, index: true },
  timestamp: { type: Date, default: Date.now, index: true },
  details: Schema.Types.Mixed,
  ipAddress: String,
  userAgent: String,
  // Hash-chain fields: each entry commits to the previous entry's hash so the
  // trail can be re-verified rather than just trusted (see verify-audit route).
  prevHash: String,
  hash: String,
});

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
