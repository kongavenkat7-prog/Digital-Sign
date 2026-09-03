const { Router } = require('express');
const jwt = require('jsonwebtoken');
const { User } = require('../models/User');
const { requireAuth, JWT_SECRET } = require('../middleware/auth');

const router = Router();

/**
 * SignVault has a single gated account rather than open registration.
 * Credentials are configurable via env so they aren't hardcoded in prod,
 * but default to the account this app was set up for.
 */
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'konga.venkat7@gmail.com').toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Venkat@123';

const CURRENT_USER = {
  name: 'Sarah Jenkins',
  email: ADMIN_EMAIL,
  title: 'Compliance Officer',
  role: 'Administrator',
};

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (String(email).toLowerCase() !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const payload = { email: ADMIN_EMAIL, name: CURRENT_USER.name, role: CURRENT_USER.role };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' });

    await User.findOneAndUpdate(
      { email: ADMIN_EMAIL },
      { $set: { lastActiveAt: new Date() } },
      { upsert: false }
    ).catch(() => undefined);

    res.status(200).json({ success: true, data: { token, user: payload } });
  } catch (error) {
    res.status(500).json({ error: 'Login failed', message: error.message });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await User.findOne({ email: ADMIN_EMAIL });
    res.status(200).json({ success: true, data: user || CURRENT_USER });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load current user', message: error.message });
  }
});

// Update the logged-in admin's own display name / avatar (not other users —
// that's User Management, this is "my profile" from the sidebar menu).
router.put('/me', requireAuth, async (req, res) => {
  try {
    const { name, avatarDataUrl } = req.body;
    if (name !== undefined && !String(name).trim()) {
      return res.status(400).json({ error: 'Name cannot be empty' });
    }

    const set = {};
    if (name !== undefined) set.name = String(name).trim();
    if (avatarDataUrl !== undefined) set.avatarDataUrl = avatarDataUrl;

    const setOnInsert = { email: ADMIN_EMAIL, role: CURRENT_USER.role, title: CURRENT_USER.title };
    if (!set.name) setOnInsert.name = CURRENT_USER.name;

    const user = await User.findOneAndUpdate(
      { email: ADMIN_EMAIL },
      { $set: set, $setOnInsert: setOnInsert },
      { upsert: true, new: true }
    );
    res.status(200).json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update profile', message: error.message });
  }
});

module.exports = router;
module.exports.CURRENT_USER = CURRENT_USER;
