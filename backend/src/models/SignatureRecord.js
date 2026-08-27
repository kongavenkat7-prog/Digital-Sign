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

const signatureRecordSchema = new Schema({
  documentId: { type: String, required: true, unique: true, index: true },
  fileName: String,
  fileSize: Number,
  requestedBy: { type: String, default: '' },
  dueDate: Date,
  signers: { type: [signerSchema], default: [] },
  signaturePlacements: { type: [placementSchema], default: [] },
  approved: { type: Boolean, default: false },
  s3OriginalKey: String,
  s3SignedKey: String,
  pdfHash: String,
  signedPdfHash: String,
  auditTrail: [String],
  status: {
    type: String,
    enum: ['pending', 'signed', 'verified', 'declined'],
    default: 'pending',
  },
  createdAt: { type: Date, default: Date.now },
  signedAt: Date,
  verifiedAt: Date,
});

const SignatureRecord = mongoose.model('SignatureRecord', signatureRecordSchema);

module.exports = { SignatureRecord };
