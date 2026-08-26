import { Router, Request, Response } from 'express';
import { SignatureRecord } from '../models/SignatureRecord';

const router = Router();

router.get('/stats', async (req: Request, res: Response) => {
  try {
    const [pending, verified, signed, declined, all] = await Promise.all([
      SignatureRecord.countDocuments({ status: 'pending' }),
      SignatureRecord.countDocuments({ status: 'verified' }),
      SignatureRecord.countDocuments({ status: 'signed' }),
      SignatureRecord.countDocuments({ status: 'declined' }),
      SignatureRecord.countDocuments({}),
    ]);

    const awaitingSignature = await SignatureRecord.find({ status: 'pending' })
      .sort({ dueDate: 1 })
      .limit(10);

    const recentlyCompleted = await SignatureRecord.find({ status: { $in: ['signed', 'verified'] } })
      .sort({ signedAt: -1 })
      .limit(10);

    const totalDocs = all || 1;
    res.status(200).json({
      success: true,
      data: {
        awaitingSignatureCount: pending,
        pendingApprovalsCount: pending,
        recentlySignedCount: signed + verified,
        totalDocuments: all,
        statusAllocation: {
          pendingSignature: Math.round((pending / totalDocs) * 100),
          fullySigned: Math.round(((signed + verified) / totalDocs) * 100),
          declined: Math.round((declined / totalDocs) * 100),
        },
        awaitingSignature,
        recentlyCompleted,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load dashboard stats', message: (error as any).message });
  }
});

export default router;
