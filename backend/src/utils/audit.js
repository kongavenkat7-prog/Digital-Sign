const { AuditLog } = require('../models/AuditLog');
const { calculateSHA256 } = require('./crypto');

const GENESIS_HASH = '0'.repeat(64);

const createAuditLog = async (documentId, action, details, req, options = {}) => {
  try {
    const previous = documentId
      ? await AuditLog.findOne({ documentId }).sort({ timestamp: -1 })
      : await AuditLog.findOne().sort({ timestamp: -1 });
    const prevHash = (previous && previous.hash) || GENESIS_HASH;
    const timestamp = new Date();
    const hash = calculateSHA256(
      `${prevHash}|${documentId || ''}|${action}|${timestamp.toISOString()}|${JSON.stringify(details)}`
    );

    const auditLog = new AuditLog({
      documentId: documentId || undefined,
      documentName: options.documentName,
      userName: options.userName || 'System',
      action,
      details,
      timestamp,
      ipAddress: req.ip || 'unknown',
      userAgent: req.get('user-agent') || 'unknown',
      prevHash,
      hash,
    });
    await auditLog.save();
    return auditLog._id.toString();
  } catch (error) {
    console.error('Audit log creation error:', error);
    throw error;
  }
};

/** Recomputes the hash chain for a document's audit trail and checks it matches what was stored. */
const verifyAuditChain = (logs) => {
  let expectedPrevHash = GENESIS_HASH;
  for (const log of logs) {
    const expectedHash = calculateSHA256(
      `${expectedPrevHash}|${log.documentId || ''}|${log.action}|${new Date(log.timestamp).toISOString()}|${JSON.stringify(log.details)}`
    );
    if (log.prevHash !== expectedPrevHash || log.hash !== expectedHash) {
      return false;
    }
    expectedPrevHash = expectedHash;
  }
  return true;
};

/**
 * Verifies the *entire* audit trail across every document at once.
 *
 * createAuditLog chains a documentId-scoped entry onto the previous entry for
 * that same documentId, but chains a documentless (system-level) entry onto
 * whatever the single most-recently-inserted entry was overall, regardless of
 * its documentId. So the real trail isn't "one chain per document" — it's a
 * per-document chain for documented entries, plus a separate global chain
 * that documentless entries link into. This replays that exact construction
 * over every log (oldest first) to check each entry against its real
 * predecessor, instead of just grouping rows by documentId.
 */
const verifyFullAuditTrail = (allLogsSortedAsc) => {
  let lastGlobalHash = GENESIS_HASH;
  const lastHashByDoc = new Map();
  const failures = [];

  for (const log of allLogsSortedAsc) {
    const doc = log.documentId || null;
    const expectedPrevHash = doc ? lastHashByDoc.get(doc) || GENESIS_HASH : lastGlobalHash;
    const expectedHash = calculateSHA256(
      `${expectedPrevHash}|${doc || ''}|${log.action}|${new Date(log.timestamp).toISOString()}|${JSON.stringify(log.details)}`
    );

    if (log.prevHash !== expectedPrevHash || log.hash !== expectedHash) {
      failures.push({
        id: log._id.toString(),
        documentId: doc,
        action: log.action,
        timestamp: log.timestamp,
      });
    }

    // Advance from the *stored* hash, not the recomputed one, so a single
    // tampered row doesn't cascade into every later row also reporting broken.
    const nextHash = log.hash || expectedHash;
    if (doc) lastHashByDoc.set(doc, nextHash);
    lastGlobalHash = nextHash;
  }

  return { valid: failures.length === 0, totalRecords: allLogsSortedAsc.length, failures };
};

module.exports = { createAuditLog, verifyAuditChain, verifyFullAuditTrail };
