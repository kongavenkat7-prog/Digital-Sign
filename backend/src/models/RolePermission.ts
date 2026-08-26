import mongoose, { Schema } from 'mongoose';
import { SYSTEM_ROLES } from './User';

const roleFlags: Record<string, { type: BooleanConstructor; default: boolean }> = {};
SYSTEM_ROLES.forEach((role) => {
  roleFlags[role] = { type: Boolean, default: false };
});

const rolePermissionSchema = new Schema({
  key: { type: String, required: true, unique: true },
  label: { type: String, required: true },
  description: { type: String, default: '' },
  order: { type: Number, default: 0 },
  roles: {
    type: new Schema(roleFlags, { _id: false }),
    default: () => ({}),
  },
});

export const RolePermission = mongoose.model('RolePermission', rolePermissionSchema);
