import mongoose, { Schema } from 'mongoose';

export const SYSTEM_ROLES = ['Administrator', 'Manager', 'Signer', 'Viewer'] as const;
export type SystemRole = (typeof SYSTEM_ROLES)[number];

const userSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  title: { type: String, default: '' },
  role: { type: String, enum: SYSTEM_ROLES, default: 'Signer' },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  lastActiveAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
});

export const User = mongoose.model('User', userSchema);
