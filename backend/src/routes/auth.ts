import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { requireAuth, AuthedRequest, JWT_SECRET } from '../middleware/auth';

const router = Router();

/**
 * SignVault has a single gated account rather than open registration.
 * Credentials are configurable via env so they aren't hardcoded in prod,
 * but default to the account this app was set up for.
 */
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'konga.venkat7@gmail.com').toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Venkat@123';

export const CURRENT_USER = {
  name: 'Sarah Jenkins',
  email: ADMIN_EMAIL,
  title: 'Compliance Officer',
  role: 'Administrator' as const,
};

router.post('/login', async (req: Request, res: Response) => {
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
    res.status(500).json({ error: 'Login failed', message: (error as any).message });
  }
});

router.get('/me', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const user = await User.findOne({ email: ADMIN_EMAIL });
    res.status(200).json({ success: true, data: user || CURRENT_USER });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load current user', message: (error as any).message });
  }
});

export default router;
