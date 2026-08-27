const { Router } = require('express');
const { User, SYSTEM_ROLES } = require('../models/User');
const { createAuditLog } = require('../utils/audit');
const { CURRENT_USER } = require('./auth');

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { search, role, status } = req.query;
    const query = {};

    if (role && role !== 'All Roles') query.role = role;
    if (status && status !== 'All') query.status = status;
    if (search) {
      const term = String(search);
      query.$or = [
        { name: { $regex: term, $options: 'i' } },
        { email: { $regex: term, $options: 'i' } },
      ];
    }

    const users = await User.find(query).sort({ createdAt: 1 });
    res.status(200).json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ error: 'Failed to list users', message: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, email, title, role } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: 'Missing required fields: name, email' });
    }
    if (role && !SYSTEM_ROLES.includes(role)) {
      return res.status(400).json({ error: `role must be one of: ${SYSTEM_ROLES.join(', ')}` });
    }

    const user = new User({ name, email, title, role: role || 'Lead' });
    await user.save();

    await createAuditLog(
      null,
      'User Added',
      { name: user.name, email: user.email, role: user.role },
      req,
      { userName: CURRENT_USER.name }
    );

    res.status(201).json({ success: true, data: user });
  } catch (error) {
    if (error && error.code === 11000) {
      return res.status(409).json({ error: 'A user with this email already exists' });
    }
    res.status(500).json({ error: 'Failed to create user', message: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, title, role, status } = req.body;

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const previousRole = user.role;
    if (name !== undefined) user.name = name;
    if (email !== undefined) user.email = email;
    if (title !== undefined) user.title = title;
    if (status !== undefined) user.status = status;
    if (role !== undefined) {
      if (!SYSTEM_ROLES.includes(role)) {
        return res.status(400).json({ error: `role must be one of: ${SYSTEM_ROLES.join(', ')}` });
      }
      user.role = role;
    }
    user.lastActiveAt = new Date();
    await user.save();

    if (role !== undefined && role !== previousRole) {
      await createAuditLog(
        null,
        'Privilege Changed',
        { user: user.name, from: previousRole, to: user.role },
        req,
        { userName: CURRENT_USER.name }
      );
    } else {
      await createAuditLog(
        null,
        'User Updated',
        { user: user.name },
        req,
        { userName: CURRENT_USER.name }
      );
    }

    res.status(200).json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user', message: error.message });
  }
});

module.exports = router;
