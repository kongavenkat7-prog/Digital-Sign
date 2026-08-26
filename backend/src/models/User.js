const mongoose = require('mongoose');
const { Schema } = mongoose;

const SYSTEM_ROLES = ['Administrator', 'Manager', 'Signer', 'Viewer'];

const userSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  title: { type: String, default: '' },
  role: { type: String, enum: SYSTEM_ROLES, default: 'Signer' },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  lastActiveAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
});

const User = mongoose.model('User', userSchema);

module.exports = { User, SYSTEM_ROLES };
