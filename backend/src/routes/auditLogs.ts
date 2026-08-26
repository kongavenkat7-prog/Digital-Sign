import { Router, Request, Response } from 'express';
import { AuditLog } from '../models/AuditLog';

const router = Router();

const buildQuery = (req: Request) => {
  const { from, to, actionType, search } = req.query;
  const query: Record<string, any> = {};

  if (from || to) {
    query.timestamp = {};
    if (from) query.timestamp.$gte = new Date(String(from));
    if (to) query.timestamp.$lte = new Date(String(to));
  }
  if (actionType && actionType !== 'All Activities') {
    query.action = actionType;
  }
  if (search) {
    const term = String(search);
    query.$or = [
      { userName: { $regex: term, $options: 'i' } },
      { documentName: { $regex: term, $options: 'i' } },
      { action: { $regex: term, $options: 'i' } },
    ];
  }
  return query;
};

router.get('/', async (req: Request, res: Response) => {
  try {
    const query = buildQuery(req);
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 200;
    const logs = await AuditLog.find(query).sort({ timestamp: -1 }).limit(limit);
    res.status(200).json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load audit logs', message: (error as any).message });
  }
});

router.get('/export', async (req: Request, res: Response) => {
  try {
    const query = buildQuery(req);
    const logs = await AuditLog.find(query).sort({ timestamp: -1 }).limit(5000);

    const header = 'Timestamp,User,Action Type,Resource,IP Address,Verified\n';
    const rows = logs
      .map((log) => {
        const cells = [
          new Date(log.timestamp).toISOString(),
          log.userName || '',
          log.action,
          log.documentName || log.documentId || '',
          log.ipAddress || '',
          log.hash ? 'Verified' : 'Unverified',
        ];
        return cells.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',');
      })
      .join('\n');

    res.set('Content-Type', 'text/csv');
    res.set('Content-Disposition', 'attachment; filename="signvault-audit-logs.csv"');
    res.send(header + rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to export audit logs', message: (error as any).message });
  }
});

export default router;
