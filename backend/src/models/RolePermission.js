const mongoose = require('mongoose');
const { Schema } = mongoose;
const { SYSTEM_ROLES } = require('./User');

const roleFlags = {};
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

const RolePermission = mongoose.model('RolePermission', rolePermissionSchema);

module.exports = { RolePermission };
