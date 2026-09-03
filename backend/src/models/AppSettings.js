const mongoose = require('mongoose');
const { Schema } = mongoose;

// Singleton documents (findOneAndUpdate with upsert), one per `key` — app-wide
// settings that don't belong to any single envelope or user. All fields for
// every settings "page" live on one flat schema since each key only ever
// populates its own subset.
const appSettingsSchema = new Schema({
  key: { type: String, unique: true, required: true },

  // key: 'password-permissions'
  allowEmailOtp: { type: Boolean, default: true },
  allowAccountPassword: { type: Boolean, default: true },
  requireOtpForAdmins: { type: Boolean, default: true },
  minPasswordLength: { type: Number, default: 12 },
  passwordExpiresAfterDays: { type: Number, default: 90 },
  requireUppercase: { type: Boolean, default: true },
  requireLowercase: { type: Boolean, default: true },
  requireNumber: { type: Boolean, default: true },
  requireSymbol: { type: Boolean, default: true },
  resetAtFirstLogin: { type: Boolean, default: true },

  // key: 'branding'
  companyName: { type: String, default: 'Rynovate' },
  logoDataUrl: { type: String, default: '' },

  // key: 'retention-security'
  workspaceTimezone: { type: String, default: 'UTC' },
  documentRetentionDays: { type: Number, default: 90 },
  signingSessionTimeoutMinutes: { type: Number, default: 30 },
  maxFailedAuthAttempts: { type: Number, default: 5 },

  updatedAt: { type: Date, default: Date.now },
});

const AppSettings = mongoose.model('AppSettings', appSettingsSchema);

module.exports = { AppSettings };
