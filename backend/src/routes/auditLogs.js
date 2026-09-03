const { Router } = require('express');
const { AuditLog } = require('../models/AuditLog');
const { verifyAuditChain } = require('../utils/audit');

const router = Router();

const buildQuery = (req) => {
  const { from, to, actionType, search, actor, documentId } = req.query;
  const query = {};

  if (from || to) {
    query.timestamp = {};
    if (from) query.timestamp.$gte = new Date(String(from));
    if (to) query.timestamp.$lte = new Date(String(to));
  }
  if (actionType && actionType !== 'All Activities') {
    query.action = actionType;
  }
  if (actor && actor !== 'All Actors') {
    query.userName = actor;
  }
  if (documentId && documentId !== 'All Envelopes') {
    query.documentId = documentId;
  }
  if (search) {
    const term = String(search);
    query.$or = [
      { userName: { $regex: term, $options: 'i' } },
      { documentName: { $regex: term, $options: 'i' } },
      { action: { $regex: term, $options: 'i' } },
      { documentId: { $regex: term, $options: 'i' } },
    ];
  }
  return query;
};

router.get('/', async (req, res) => {
  try {
    const query = buildQuery(req);
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 200;
    const logs = await AuditLog.find(query).sort({ timestamp: -1 }).limit(limit);
    res.status(200).json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load audit logs', message: error.message });
  }
});

router.get('/export', async (req, res) => {
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
    res.status(500).json({ error: 'Failed to export audit logs', message: error.message });
  }
});

// Lists distinct actors/envelopes so the filter dropdowns can be populated
// without shipping every log row to the client.
router.get('/filters', async (req, res) => {
  try {
    const [actors, envelopes] = await Promise.all([
      AuditLog.distinct('userName'),
      AuditLog.distinct('documentId'),
    ]);
    res.status(200).json({
      success: true,
      data: {
        actors: actors.filter(Boolean).sort(),
        envelopes: envelopes.filter(Boolean).sort(),
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load audit filters', message: error.message });
  }
});

// Re-derives every document's hash chain (plus the documentId-less/system
// chain) from stored fields and checks it against the committed hash —
// "Verify chain integrity" from the Audit Trail screen.
router.post('/verify-all', async (req, res) => {
  try {
    const allLogs = await AuditLog.find({}).sort({ timestamp: 1 });

    const chains = new Map();
    for (const log of allLogs) {
      const key = log.documentId || '__system__';
      if (!chains.has(key)) chains.set(key, []);
      chains.get(key).push(log);
    }

    let validChains = 0;
    const invalidChains = [];
    for (const [key, logs] of chains.entries()) {
      if (verifyAuditChain(logs)) {
        validChains += 1;
      } else {
        invalidChains.push(key);
      }
    }

    res.status(200).json({
      success: true,
      data: {
        totalChains: chains.size,
        totalRecords: allLogs.length,
        validChains,
        invalidChains,
        intact: invalidChains.length === 0,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to verify audit chain', message: error.message });
  }
});

module.exports = router;
