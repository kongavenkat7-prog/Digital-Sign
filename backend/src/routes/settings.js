const { Router } = require('express');
const { AppSettings } = require('../models/AppSettings');

const router = Router();

const getOrCreate = async (key) =>
  AppSettings.findOneAndUpdate({ key }, { $setOnInsert: { key } }, { upsert: true, new: true });

// ---- Password permissions & policy ----
router.get('/password-permissions', async (req, res) => {
  try {
    res.status(200).json({ success: true, data: await getOrCreate('password-permissions') });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load password permissions', message: error.message });
  }
});

router.put('/password-permissions', async (req, res) => {
  try {
    const {
      allowEmailOtp,
      allowAccountPassword,
      requireOtpForAdmins,
      minPasswordLength,
      passwordExpiresAfterDays,
      requireUppercase,
      requireLowercase,
      requireNumber,
      requireSymbol,
      resetAtFirstLogin,
    } = req.body;

    if (allowEmailOtp === false && allowAccountPassword === false) {
      return res.status(400).json({ error: 'At least one identity verification method must stay enabled' });
    }

    const set = { updatedAt: new Date() };
    if (allowEmailOtp !== undefined) set.allowEmailOtp = Boolean(allowEmailOtp);
    if (allowAccountPassword !== undefined) set.allowAccountPassword = Boolean(allowAccountPassword);
    if (requireOtpForAdmins !== undefined) set.requireOtpForAdmins = Boolean(requireOtpForAdmins);
    if (minPasswordLength !== undefined) set.minPasswordLength = Number(minPasswordLength);
    if (passwordExpiresAfterDays !== undefined) set.passwordExpiresAfterDays = Number(passwordExpiresAfterDays);
    if (requireUppercase !== undefined) set.requireUppercase = Boolean(requireUppercase);
    if (requireLowercase !== undefined) set.requireLowercase = Boolean(requireLowercase);
    if (requireNumber !== undefined) set.requireNumber = Boolean(requireNumber);
    if (requireSymbol !== undefined) set.requireSymbol = Boolean(requireSymbol);
    if (resetAtFirstLogin !== undefined) set.resetAtFirstLogin = Boolean(resetAtFirstLogin);

    const settings = await AppSettings.findOneAndUpdate(
      { key: 'password-permissions' },
      { $set: set, $setOnInsert: { key: 'password-permissions' } },
      { upsert: true, new: true }
    );
    res.status(200).json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update password permissions', message: error.message });
  }
});

// ---- Branding (company name + logo) ----
router.get('/branding', async (req, res) => {
  try {
    res.status(200).json({ success: true, data: await getOrCreate('branding') });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load branding', message: error.message });
  }
});

router.put('/branding', async (req, res) => {
  try {
    const { companyName, logoDataUrl } = req.body;
    if (companyName !== undefined && !String(companyName).trim()) {
      return res.status(400).json({ error: 'Company name cannot be empty' });
    }
    const set = { updatedAt: new Date() };
    if (companyName !== undefined) set.companyName = String(companyName).trim();
    if (logoDataUrl !== undefined) set.logoDataUrl = logoDataUrl;

    const settings = await AppSettings.findOneAndUpdate(
      { key: 'branding' },
      { $set: set, $setOnInsert: { key: 'branding' } },
      { upsert: true, new: true }
    );
    res.status(200).json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update branding', message: error.message });
  }
});

// ---- Retention & security policy ----
router.get('/retention-security', async (req, res) => {
  try {
    res.status(200).json({ success: true, data: await getOrCreate('retention-security') });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load retention & security policy', message: error.message });
  }
});

router.put('/retention-security', async (req, res) => {
  try {
    const { workspaceTimezone, documentRetentionDays, signingSessionTimeoutMinutes, maxFailedAuthAttempts } = req.body;

    const set = { updatedAt: new Date() };
    if (workspaceTimezone !== undefined) set.workspaceTimezone = String(workspaceTimezone);
    if (documentRetentionDays !== undefined) {
      const days = Number(documentRetentionDays);
      if (!Number.isFinite(days) || days < 1) return res.status(400).json({ error: 'documentRetentionDays must be a positive number' });
      set.documentRetentionDays = days;
    }
    if (signingSessionTimeoutMinutes !== undefined) {
      const mins = Number(signingSessionTimeoutMinutes);
      if (!Number.isFinite(mins) || mins < 1) return res.status(400).json({ error: 'signingSessionTimeoutMinutes must be a positive number' });
      set.signingSessionTimeoutMinutes = mins;
    }
    if (maxFailedAuthAttempts !== undefined) {
      const attempts = Number(maxFailedAuthAttempts);
      if (!Number.isFinite(attempts) || attempts < 1) return res.status(400).json({ error: 'maxFailedAuthAttempts must be a positive number' });
      set.maxFailedAuthAttempts = attempts;
    }

    const settings = await AppSettings.findOneAndUpdate(
      { key: 'retention-security' },
      { $set: set, $setOnInsert: { key: 'retention-security' } },
      { upsert: true, new: true }
    );
    res.status(200).json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update retention & security policy', message: error.message });
  }
});

module.exports = router;
