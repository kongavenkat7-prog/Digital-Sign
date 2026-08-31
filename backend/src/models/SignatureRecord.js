const mongoose = require('mongoose');
const { Schema } = mongoose;

const signerSchema = new Schema(
  {
    name: { type: String, required: true },
    email: String,
    roleLabel: { type: String, default: '' },
    order: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['signed', 'pending', 'awaiting', 'declined'],
      default: 'awaiting',
    },
    signedAt: Date,
    ipAddress: String,
    userAgent: String,
    reason: { type: String, default: '' },

    // Magic-link + email-OTP identity verification for the public,
    // no-login signing page (routes/signing.js).
    token: { type: String, index: true },
    identityVerification: { type: String, enum: ['email_otp', 'account_password'], default: 'email_otp' },
    otpCode: String,
    otpExpiresAt: Date,
    // Set true once the recipient has proven their identity — via OTP or,
    // for identityVerification: 'account_password', the access password —
    // gating the final Sign step regardless of which method was used.
    otpVerified: { type: Boolean, default: false },
    otpLastSentAt: Date,
    accessPasswordHash: String,
  },
  { _id: false }
);

const placementSchema = new Schema(
  {
    signatureImage: { type: String, required: true },
    signatureX: { type: Number, required: true },
    signatureY: { type: Number, required: true },
    pageNumber: { type: Number, default: 1 },
  },
  { _id: false }
);

// Generalizes placementSchema: any field type an envelope's Fields step can
// place on the PDF, assigned to one recipient by email.
const fieldSchema = new Schema(
  {
    fieldId: { type: String, required: true },
    type: { type: String, enum: ['signature', 'initials', 'date', 'text', 'checkbox'], default: 'signature' },
    label: { type: String, default: '' },
    assignedToEmail: { type: String, default: '' },
    pageNumber: { type: Number, default: 1 },
    leftPct: { type: Number, default: 10 },
    topPct: { type: Number, default: 10 },
    widthPct: { type: Number, default: 20 },
    heightPct: { type: Number, default: 5 },
    required: { type: Boolean, default: true },
    value: { type: String, default: '' },
    filledAt: Date,
  },
  { _id: false }
);

const signatureRecordSchema = new Schema({
  documentId: { type: String, required: true, unique: true, index: true },
  fileName: String,
  fileSize: Number,
  requestedBy: { type: String, default: '' },
  dueDate: Date,

  // Envelope metadata (New Envelope wizard, Document step)
  title: { type: String, default: '' },
  messageToRecipients: { type: String, default: '' },
  sequentialRouting: { type: Boolean, default: true },

  signers: { type: [signerSchema], default: [] },
  fields: { type: [fieldSchema], default: [] },

  // Legacy single-admin signing flow (preview/review/sign pages) — kept
  // so existing envelopes/documents created before the token-based
  // recipient flow keep working unchanged.
  signaturePlacements: { type: [placementSchema], default: [] },
  approved: { type: Boolean, default: false },

  s3OriginalKey: String,
  s3SignedKey: String,
  s3AuditPdfKey: String,
  pdfHash: String,
  signedPdfHash: String,
  auditTrail: [String],
  status: {
    type: String,
    enum: ['draft', 'pending', 'signed', 'verified', 'declined'],
    default: 'pending',
  },
  createdAt: { type: Date, default: Date.now },
  signedAt: Date,
  verifiedAt: Date,

  // Retention / lifecycle — admin-only (set from the Dashboard, never by a
  // recipient on the public signing page): how long the document binary is
  // kept before purge, and an optional hold that suspends that purge.
  retentionDays: { type: Number, default: 90 },
  legalHold: { type: Boolean, default: false },
  retentionReason: { type: String, default: '' },
});

const SignatureRecord = mongoose.model('SignatureRecord', signatureRecordSchema);

module.exports = { SignatureRecord };
