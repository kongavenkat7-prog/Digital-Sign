const mongoose = require('mongoose');
const { Schema } = mongoose;

// Singleton document (findOneAndUpdate with upsert) — app-wide settings that
// don't belong to any single envelope or user.
const appSettingsSchema = new Schema({
  key: { type: String, default: 'password-permissions', unique: true },
  allowEmailOtp: { type: Boolean, default: true },
  allowAccountPassword: { type: Boolean, default: true },
  minPasswordLength: { type: Number, default: 8 },
  requireOtpForAdmins: { type: Boolean, default: true },
  updatedAt: { type: Date, default: Date.now },
});

const AppSettings = mongoose.model('AppSettings', appSettingsSchema);

module.exports = { AppSettings };
