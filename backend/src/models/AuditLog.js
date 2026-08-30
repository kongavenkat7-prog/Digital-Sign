const mongoose = require('mongoose');
const { Schema } = mongoose;

const AUDIT_ACTION_TYPES = [
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
  'Signature Request Sent',
  'Signing Link Opened',
  'OTP Sent',
  'OTP Verified',
  'Recipient Signed',
  'Envelope Completed',
];

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

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

module.exports = { AuditLog, AUDIT_ACTION_TYPES };
