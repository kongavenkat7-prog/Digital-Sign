import { Router, Request, Response } from 'express';
import { User } from '../models/User';

const router = Router();

/**
 * SignVault has no login screen in the current design (the mockups show a
 * single fixed identity in the sidebar), so the "signed-in" user is the
 * first Administrator in the Users collection, seeded as Sarah Jenkins.
 * Swap this out for real session/JWT auth before handling untrusted users.
 */
export const CURRENT_USER = {
  name: 'Sarah Jenkins',
  email: 'sarah@signvault.com',
  title: 'Compliance Officer',
  role: 'Administrator' as const,
};

router.get('/me', async (req: Request, res: Response) => {
  try {
    const user = await User.findOne({ email: CURRENT_USER.email });
    res.status(200).json({ success: true, data: user || CURRENT_USER });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load current user', message: (error as any).message });
  }
});

export default router;
