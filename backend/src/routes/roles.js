const { Router } = require('express');
const { RolePermission } = require('../models/RolePermission');
const { createAuditLog } = require('../utils/audit');
const { CURRENT_USER } = require('./auth');

const router = Router();

router.get('/permissions', async (req, res) => {
  try {
    const permissions = await RolePermission.find().sort({ order: 1 });
    res.status(200).json({ success: true, data: permissions });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load role permissions', message: error.message });
  }
});

router.put('/permissions', async (req, res) => {
  try {
    const { permissions } = req.body;
    if (!Array.isArray(permissions)) {
      return res.status(400).json({ error: 'permissions must be an array' });
    }

    const updates = await Promise.all(
      permissions.map((p) =>
        RolePermission.findOneAndUpdate(
          { key: p.key },
          { $set: { roles: p.roles } },
          { new: true }
        )
      )
    );

    await createAuditLog(
      null,
      'Privilege Changed',
      { changedPermissions: permissions.map((p) => p.key) },
      req,
      { userName: CURRENT_USER.name }
    );

    res.status(200).json({ success: true, data: updates.filter(Boolean) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update role permissions', message: error.message });
  }
});

module.exports = router;
