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

module.exports = { createAuditLog, verifyAuditChain };
