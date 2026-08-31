const { Router } = require('express');
const crypto = require('crypto');
const { ApiKey, Webhook } = require('../models/ApiKey');
const { calculateSHA256 } = require('../utils/crypto');

const router = Router();

// API keys — the generated key is shown once (on creation) and never again;
// only its SHA-256 hash and a short display prefix are stored.
router.get('/api-keys', async (req, res) => {
  try {
    const keys = await ApiKey.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: keys });
  } catch (error) {
    res.status(500).json({ error: 'Failed to list API keys', message: error.message });
  }
});

router.post('/api-keys', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'A name is required for the API key' });

    const rawKey = `sv_live_${crypto.randomBytes(24).toString('hex')}`;
    const apiKey = await ApiKey.create({
      name,
      keyPrefix: rawKey.slice(0, 12),
      keyHash: calculateSHA256(rawKey),
    });

    res.status(201).json({ success: true, data: { ...apiKey.toObject(), key: rawKey } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create API key', message: error.message });
  }
});

router.delete('/api-keys/:id', async (req, res) => {
  try {
    await ApiKey.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to revoke API key', message: error.message });
  }
});

// Webhooks — HMAC-SHA256 signed with the stored secret (delivery itself
// isn't wired to any event source yet, so this manages endpoints only).
router.get('/webhooks', async (req, res) => {
  try {
    const webhooks = await Webhook.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: webhooks });
  } catch (error) {
    res.status(500).json({ error: 'Failed to list webhooks', message: error.message });
  }
});

router.post('/webhooks', async (req, res) => {
  try {
    const { url, events } = req.body;
    if (!url) return res.status(400).json({ error: 'A URL is required' });
    const secret = `whsec_${crypto.randomBytes(16).toString('hex')}`;
    const webhook = await Webhook.create({ url, secret, events: Array.isArray(events) && events.length ? events : undefined });
    res.status(201).json({ success: true, data: webhook });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create webhook', message: error.message });
  }
});

router.delete('/webhooks/:id', async (req, res) => {
  try {
    await Webhook.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove webhook', message: error.message });
  }
});

// Delivery logs and embedded signing aren't wired to a live event pipeline
// in this build — reported empty/static rather than fabricated.
router.get('/delivery-logs', async (req, res) => {
  res.status(200).json({ success: true, data: [] });
});

module.exports = router;
