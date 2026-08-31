const { Router } = require('express');
const { AppSettings } = require('../models/AppSettings');

const router = Router();

router.get('/password-permissions', async (req, res) => {
  try {
    const settings = await AppSettings.findOneAndUpdate(
      { key: 'password-permissions' },
      { $setOnInsert: { key: 'password-permissions' } },
      { upsert: true, new: true }
    );
    res.status(200).json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load password permissions', message: error.message });
  }
});

router.put('/password-permissions', async (req, res) => {
  try {
    const { allowEmailOtp, allowAccountPassword, minPasswordLength, requireOtpForAdmins } = req.body;
    if (allowEmailOtp === false && allowAccountPassword === false) {
      return res.status(400).json({ error: 'At least one identity verification method must stay enabled' });
    }
    const settings = await AppSettings.findOneAndUpdate(
      { key: 'password-permissions' },
      {
        $set: {
          ...(allowEmailOtp !== undefined && { allowEmailOtp: Boolean(allowEmailOtp) }),
          ...(allowAccountPassword !== undefined && { allowAccountPassword: Boolean(allowAccountPassword) }),
          ...(minPasswordLength !== undefined && { minPasswordLength: Number(minPasswordLength) }),
          ...(requireOtpForAdmins !== undefined && { requireOtpForAdmins: Boolean(requireOtpForAdmins) }),
          updatedAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );
    res.status(200).json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update password permissions', message: error.message });
  }
});

module.exports = router;
