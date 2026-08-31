const { Router } = require('express');
const { v4: uuidv4 } = require('uuid');
const { SignatureRecord } = require('../models/SignatureRecord');
const { AuditLog } = require('../models/AuditLog');
const { calculateSHA256 } = require('../utils/crypto');
const { uploadToS3, downloadFromS3 } = require('../utils/s3');
const { stampSignature } = require('../utils/pdfSign');
const crypto = require('crypto');
const { createAuditLog, verifyAuditChain } = require('../utils/audit');
const { sendReviewerAssignedEmail, sendSignatureRequestEmail } = require('../utils/mailer');
const { CURRENT_USER } = require('./auth');

const router = Router();

// List documents (backs the Dashboard's "Awaiting Your Signature" / "Recently Completed" widgets)
router.get('/documents', async (req, res) => {
  try {
    const { status, limit } = req.query;
    const query = {};
    if (status) query.status = status;

    const records = await SignatureRecord.find(query)
      .sort({ createdAt: -1 })
      .limit(limit ? parseInt(limit, 10) : 50);

    res.status(200).json({ success: true, data: records });
  } catch (error) {
    res.status(500).json({ error: 'Failed to list documents', message: error.message });
  }
});

// Upload PDF
router.post('/documents/upload', async (req, res) => {
  try {
    const { fileName, fileData, requestedBy, dueDate, signers } = req.body;

    if (!fileName || !fileData) {
      return res.status(400).json({ error: 'Missing required fields: fileName, fileData' });
    }

    if (!Array.isArray(signers) || signers.length === 0) {
      return res.status(400).json({ error: 'At least one reviewer/signer must be assigned' });
    }
    if (signers.some((s) => !s.email)) {
      return res.status(400).json({ error: 'Every assigned reviewer must have an email' });
    }
    const emails = signers.map((s) => s.email.trim().toLowerCase());
    if (new Set(emails).size !== emails.length) {
      return res.status(400).json({ error: 'Each assigned reviewer must have a distinct email' });
    }

    const documentId = uuidv4();
    const s3Key = `originals/${documentId}/${fileName}`;

    const base64Data = fileData.includes(',') ? fileData.split(',')[1] : fileData;
    const fileBuffer = Buffer.from(base64Data, 'base64');
    const pdfHash = calculateSHA256(fileBuffer);

    const s3Url = await uploadToS3(s3Key, fileBuffer, 'application/pdf');

    const signatureRecord = new SignatureRecord({
      documentId,
      fileName,
      fileSize: fileBuffer.length,
      requestedBy: requestedBy || CURRENT_USER.name,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      signers: Array.isArray(signers)
        ? signers.map((s, index) => ({
            name: s.name,
            email: s.email,
            roleLabel: s.roleLabel,
            order: index,
            status: index === 0 ? 'pending' : 'awaiting',
          }))
        : [],
      s3OriginalKey: s3Key,
      pdfHash,
      status: 'pending',
      auditTrail: [],
    });

    await signatureRecord.save();

    const auditLogId = await createAuditLog(
      documentId,
      'Document Created',
      { fileName, fileSize: fileBuffer.length, pdfHash },
      req,
      { userName: requestedBy || CURRENT_USER.name, documentName: fileName }
    );

    signatureRecord.auditTrail.push(auditLogId);
    await signatureRecord.save();

    // Best-effort: a reviewer/signer being assigned shouldn't fail the upload
    // if SMTP isn't configured or the send fails.
    await Promise.all(
      signatureRecord.signers.map((signer) =>
        sendReviewerAssignedEmail({
          to: signer.email,
          reviewerName: signer.name,
          roleLabel: signer.roleLabel,
          documentName: fileName,
          documentId,
        }).catch((error) => console.error('Reviewer-assignment email failed:', error))
      )
    );

    res.status(201).json({
      success: true,
      documentId,
      message: 'PDF uploaded successfully',
      data: { documentId, fileName, pdfHash, s3Url },
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed', message: error.message });
  }
});

// Create an envelope (New Envelope wizard: Document -> Recipients -> Fields).
// Distinct from /documents/upload (the legacy single-admin flow): this route
// creates a full multi-recipient, token-based, field-typed envelope, and
// optionally emails the first recipient(s) their signing link immediately.
router.post('/documents/envelope', async (req, res) => {
  try {
    const {
      fileName,
      fileData,
      title,
      messageToRecipients,
      sequentialRouting,
      recipients,
      fields,
      action, // 'send' | 'draft'
    } = req.body;

    if (!fileName || !fileData) {
      return res.status(400).json({ error: 'Missing required fields: fileName, fileData' });
    }
    if (!Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ error: 'At least one recipient is required' });
    }
    if (recipients.some((r) => !r.name || !r.email)) {
      return res.status(400).json({ error: 'Every recipient needs a name and email' });
    }
    const emails = recipients.map((r) => r.email.trim().toLowerCase());
    if (new Set(emails).size !== emails.length) {
      return res.status(400).json({ error: 'Each recipient must have a distinct email' });
    }
    if (recipients.some((r) => r.identityVerification === 'account_password' && !r.accessPassword)) {
      return res.status(400).json({ error: 'An access password is required for recipients using Account login + password' });
    }

    const documentId = uuidv4();
    const s3Key = `originals/${documentId}/${fileName}`;

    const base64Data = fileData.includes(',') ? fileData.split(',')[1] : fileData;
    const fileBuffer = Buffer.from(base64Data, 'base64');
    const pdfHash = calculateSHA256(fileBuffer);

    const isSend = action !== 'draft';
    const isSequential = sequentialRouting !== false;

    const orderedRecipients = [...recipients].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const signers = orderedRecipients.map((r, index) => ({
      name: r.name,
      email: r.email,
      roleLabel: r.roleLabel || '',
      order: r.order ?? index,
      status: !isSend ? 'awaiting' : isSequential ? (index === 0 ? 'pending' : 'awaiting') : 'pending',
      token: crypto.randomBytes(24).toString('hex'),
      identityVerification: r.identityVerification === 'account_password' ? 'account_password' : 'email_otp',
      accessPasswordHash: r.identityVerification === 'account_password' ? calculateSHA256(r.accessPassword) : undefined,
    }));

    const fieldDocs = (Array.isArray(fields) ? fields : []).map((f) => ({
      fieldId: f.fieldId || crypto.randomBytes(8).toString('hex'),
      type: f.type || 'signature',
      label: f.label || '',
      assignedToEmail: (f.assignedToEmail || '').trim().toLowerCase(),
      pageNumber: f.pageNumber || 1,
      leftPct: f.leftPct ?? 10,
      topPct: f.topPct ?? 10,
      widthPct: f.widthPct ?? 20,
      heightPct: f.heightPct ?? 5,
      required: f.required !== false,
    }));

    const s3Url = await uploadToS3(s3Key, fileBuffer, 'application/pdf');

    const signatureRecord = new SignatureRecord({
      documentId,
      fileName,
      fileSize: fileBuffer.length,
      requestedBy: CURRENT_USER.name,
      title: title || fileName,
      messageToRecipients: messageToRecipients || '',
      sequentialRouting: isSequential,
      signers,
      fields: fieldDocs,
      s3OriginalKey: s3Key,
      pdfHash,
      status: isSend ? 'pending' : 'draft',
      auditTrail: [],
    });

    await signatureRecord.save();

    const auditLogId = await createAuditLog(
      documentId,
      'Document Created',
      { fileName, fileSize: fileBuffer.length, pdfHash, recipientCount: signers.length, sequentialRouting: isSequential },
      req,
      { userName: CURRENT_USER.name, documentName: signatureRecord.title }
    );
    signatureRecord.auditTrail.push(auditLogId);
    await signatureRecord.save();

    if (isSend) {
      const toNotify = signatureRecord.signers.filter((s) => s.status === 'pending');
      await Promise.all(
        toNotify.map(async (signer) => {
          await sendSignatureRequestEmail({
            to: signer.email,
            recipientName: signer.name,
            requestedByOrg: CURRENT_USER.name,
            documentName: signatureRecord.title,
            token: signer.token,
          }).catch((error) => console.error('Signature-request email failed:', error));
          const notifyAuditId = await createAuditLog(
            documentId,
            'Signature Request Sent',
            { to: signer.email },
            req,
            { userName: CURRENT_USER.name, documentName: signatureRecord.title }
          );
          signatureRecord.auditTrail.push(notifyAuditId);
        })
      );
      await signatureRecord.save();
    }

    res.status(201).json({
      success: true,
      documentId,
      message: isSend ? 'Envelope sent' : 'Envelope saved as draft',
      data: { documentId, fileName, pdfHash, s3Url, status: signatureRecord.status },
    });
  } catch (error) {
    console.error('Envelope creation error:', error);
    res.status(500).json({ error: 'Failed to create envelope', message: error.message });
  }
});

// Update retention/legal-hold — admin-only (this router sits behind
// requireAuth), never exposed on the public token-based signing routes.
router.post('/documents/:documentId/retention', async (req, res) => {
  try {
    const { documentId } = req.params;
    const { retentionDays, legalHold, reason } = req.body;

    const signatureRecord = await SignatureRecord.findOne({ documentId });
    if (!signatureRecord) return res.status(404).json({ error: 'Document not found' });

    if (retentionDays !== undefined) {
      const days = Number(retentionDays);
      if (!Number.isFinite(days) || days < 1) {
        return res.status(400).json({ error: 'retentionDays must be a positive number' });
      }
      signatureRecord.retentionDays = days;
    }
    if (legalHold !== undefined) signatureRecord.legalHold = Boolean(legalHold);
    signatureRecord.retentionReason = reason || '';
    await signatureRecord.save();

    const auditLogId = await createAuditLog(
      documentId,
      'Retention Updated',
      { retentionDays: signatureRecord.retentionDays, legalHold: signatureRecord.legalHold, reason: signatureRecord.retentionReason },
      req,
      { userName: CURRENT_USER.name, documentName: signatureRecord.title || signatureRecord.fileName }
    );
    signatureRecord.auditTrail.push(auditLogId);
    await signatureRecord.save();

    res.status(200).json({ success: true, data: signatureRecord });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update retention', message: error.message });
  }
});

// Preview PDF
router.get('/documents/:documentId/preview', async (req, res) => {
  try {
    const { documentId } = req.params;
    const signatureRecord = await SignatureRecord.findOne({ documentId });
    if (!signatureRecord) return res.status(404).json({ error: 'Document not found' });

    const pdfBuffer = await downloadFromS3(signatureRecord.s3OriginalKey);

    await createAuditLog(
      documentId,
      'Document Viewed',
      { fileName: signatureRecord.fileName },
      req,
      { userName: CURRENT_USER.name, documentName: signatureRecord.fileName }
    );

    res.set('Content-Type', 'application/pdf');
    res.set('Content-Length', pdfBuffer.length.toString());
    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({ error: 'Failed to preview PDF', message: error.message });
  }
});

// Preview the signed copy (with the embedded signature) once it exists
router.get('/documents/:documentId/preview-signed', async (req, res) => {
  try {
    const { documentId } = req.params;
    const signatureRecord = await SignatureRecord.findOne({ documentId });
    if (!signatureRecord || !signatureRecord.s3SignedKey) {
      return res.status(400).json({ error: 'No signed copy exists for this document yet' });
    }

    const pdfBuffer = await downloadFromS3(signatureRecord.s3SignedKey);

    res.set('Content-Type', 'application/pdf');
    res.set('Content-Length', pdfBuffer.length.toString());
    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({ error: 'Failed to preview signed PDF', message: error.message });
  }
});

// Get single document (full detail incl. signer pipeline)
router.get('/documents/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params;
    const signatureRecord = await SignatureRecord.findOne({ documentId });
    if (!signatureRecord) return res.status(404).json({ error: 'Document not found' });
    res.status(200).json({ success: true, data: signatureRecord });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get document', message: error.message });
  }
});

// Legacy alias
router.get('/documents/:documentId/status', async (req, res) => {
  try {
    const { documentId } = req.params;
    const signatureRecord = await SignatureRecord.findOne({ documentId });
    if (!signatureRecord) return res.status(404).json({ error: 'Document not found' });
    res.status(200).json({ success: true, data: signatureRecord });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get document status', message: error.message });
  }
});

// Set / replace the signer pipeline
router.post('/documents/:documentId/signers', async (req, res) => {
  try {
    const { documentId } = req.params;
    const { signers } = req.body;
    if (!Array.isArray(signers) || signers.length === 0) {
      return res.status(400).json({ error: 'signers must be a non-empty array' });
    }
    if (signers.some((s) => !s.email)) {
      return res.status(400).json({ error: 'Every assigned reviewer must have an email' });
    }
    const emails = signers.map((s) => s.email.trim().toLowerCase());
    if (new Set(emails).size !== emails.length) {
      return res.status(400).json({ error: 'Each assigned reviewer must have a distinct email' });
    }

    const signatureRecord = await SignatureRecord.findOne({ documentId });
    if (!signatureRecord) return res.status(404).json({ error: 'Document not found' });

    signatureRecord.signers = signers.map((s, index) => ({
      name: s.name,
      email: s.email,
      roleLabel: s.roleLabel || '',
      order: index,
      status: index === 0 ? 'pending' : 'awaiting',
    }));
    await signatureRecord.save();

    await Promise.all(
      signatureRecord.signers.map((signer) =>
        sendReviewerAssignedEmail({
          to: signer.email,
          reviewerName: signer.name,
          roleLabel: signer.roleLabel,
          documentName: signatureRecord.fileName,
          documentId,
        }).catch((error) => console.error('Reviewer-assignment email failed:', error))
      )
    );

    res.status(200).json({ success: true, data: signatureRecord });
  } catch (error) {
    res.status(500).json({ error: 'Failed to set signers', message: error.message });
  }
});

// Place Signature(s) — replaces the full set of placements for this document,
// so a signer can stamp the same signature into several spots (and pages).
router.post('/signatures/place', async (req, res) => {
  try {
    const { documentId, placements } = req.body;

    if (!documentId || !Array.isArray(placements) || placements.length === 0) {
      return res.status(400).json({ error: 'Missing required fields: documentId, placements' });
    }
    if (placements.some((p) => !p.signatureImage || p.signatureX === undefined || p.signatureY === undefined)) {
      return res.status(400).json({ error: 'Every placement needs signatureImage, signatureX, signatureY' });
    }

    const signatureRecord = await SignatureRecord.findOne({ documentId });
    if (!signatureRecord) return res.status(404).json({ error: 'Document not found' });

    signatureRecord.signaturePlacements = placements.map((p) => ({
      signatureImage: p.signatureImage,
      signatureX: p.signatureX,
      signatureY: p.signatureY,
      pageNumber: p.pageNumber || 1,
    }));
    await signatureRecord.save();

    const auditLogId = await createAuditLog(
      documentId,
      'Signature Placed',
      { placementCount: placements.length, pages: [...new Set(placements.map((p) => p.pageNumber || 1))] },
      req,
      { userName: CURRENT_USER.name, documentName: signatureRecord.fileName }
    );
    signatureRecord.auditTrail.push(auditLogId);
    await signatureRecord.save();

    res.status(200).json({
      success: true,
      message: 'Signature(s) placed successfully',
      data: { documentId, placements: signatureRecord.signaturePlacements },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to place signature', message: error.message });
  }
});

// Review & Confirm
router.post('/signatures/:documentId/review', async (req, res) => {
  try {
    const { documentId } = req.params;
    const { approved, comments } = req.body;

    const signatureRecord = await SignatureRecord.findOne({ documentId });
    if (!signatureRecord) return res.status(404).json({ error: 'Document not found' });

    signatureRecord.approved = Boolean(approved);

    const auditLogId = await createAuditLog(
      documentId,
      'Document Reviewed',
      { approved, comments },
      req,
      { userName: CURRENT_USER.name, documentName: signatureRecord.fileName }
    );
    signatureRecord.auditTrail.push(auditLogId);
    await signatureRecord.save();

    res.status(200).json({
      success: true,
      message: 'Document reviewed',
      data: { documentId, approved, reviewDate: new Date() },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to review document', message: error.message });
  }
});

// Sign PDF — advances the next pending signer in the pipeline
router.post('/signatures/:documentId/sign', async (req, res) => {
  try {
    const { documentId } = req.params;
    const { signerName } = req.body;

    const signatureRecord = await SignatureRecord.findOne({ documentId });
    if (!signatureRecord || signatureRecord.signaturePlacements.length === 0) {
      return res.status(400).json({ error: 'Document not ready for signing' });
    }
    if (!signatureRecord.approved) {
      return res.status(400).json({ error: 'Document must be reviewed and approved before signing' });
    }

    const currentSigner =
      signatureRecord.signers.find((s) => s.status === 'pending') || signatureRecord.signers[0];
    const effectiveSignerName = signerName || (currentSigner && currentSigner.name) || CURRENT_USER.name;

    const originalPdfBuffer = await downloadFromS3(signatureRecord.s3OriginalKey);
    const signedAt = new Date();
    const signedPdfBuffer = await stampSignature(originalPdfBuffer, {
      placements: signatureRecord.signaturePlacements,
      signerName: effectiveSignerName,
      signedAt,
    });

    const signedPdfHash = calculateSHA256(signedPdfBuffer);
    const signedS3Key = `signed/${documentId}/${signatureRecord.fileName}`;
    const s3Url = await uploadToS3(signedS3Key, signedPdfBuffer, 'application/pdf');

    signatureRecord.s3SignedKey = signedS3Key;
    signatureRecord.signedPdfHash = signedPdfHash;
    signatureRecord.signedAt = signedAt;

    if (currentSigner) {
      currentSigner.status = 'signed';
      currentSigner.signedAt = signedAt;
      currentSigner.ipAddress = req.ip || 'unknown';
      const next = signatureRecord.signers.find((s) => s.order === (currentSigner.order ?? 0) + 1);
      if (next) next.status = 'pending';
    }

    const allSigned = signatureRecord.signers.every((s) => s.status === 'signed');
    if (allSigned || signatureRecord.signers.length === 0) {
      signatureRecord.status = 'signed';
    }

    const signAuditId = await createAuditLog(
      documentId,
      'Document Signed',
      { signerName: effectiveSignerName, timestamp: signedAt },
      req,
      { userName: effectiveSignerName, documentName: signatureRecord.fileName }
    );
    const generateAuditId = await createAuditLog(
      documentId,
      'Signed Copy Generated',
      { s3Location: s3Url, fileSize: signedPdfBuffer.length, originalHash: signatureRecord.pdfHash, signedHash: signedPdfHash },
      req,
      { userName: effectiveSignerName, documentName: signatureRecord.fileName }
    );

    signatureRecord.auditTrail.push(signAuditId, generateAuditId);
    await signatureRecord.save();

    res.status(200).json({
      success: true,
      message: 'PDF signed successfully',
      data: {
        documentId,
        signedPdfHash,
        s3SignedUrl: s3Url,
        originalHash: signatureRecord.pdfHash,
        signedAt: signatureRecord.signedAt,
        status: signatureRecord.status,
        signers: signatureRecord.signers,
      },
    });
  } catch (error) {
    console.error('Signing error:', error);
    res.status(500).json({ error: 'Failed to sign PDF', message: error.message });
  }
});

// Decline
router.post('/documents/:documentId/decline', async (req, res) => {
  try {
    const { documentId } = req.params;
    const { reason } = req.body;
    const signatureRecord = await SignatureRecord.findOne({ documentId });
    if (!signatureRecord) return res.status(404).json({ error: 'Document not found' });

    signatureRecord.status = 'declined';
    const currentSigner = signatureRecord.signers.find((s) => s.status === 'pending');
    if (currentSigner) currentSigner.status = 'declined';

    const auditLogId = await createAuditLog(
      documentId,
      'Document Declined',
      { reason: reason || '' },
      req,
      { userName: CURRENT_USER.name, documentName: signatureRecord.fileName }
    );
    signatureRecord.auditTrail.push(auditLogId);
    await signatureRecord.save();

    res.status(200).json({ success: true, data: signatureRecord });
  } catch (error) {
    res.status(500).json({ error: 'Failed to decline document', message: error.message });
  }
});

// Request changes
router.post('/documents/:documentId/request-changes', async (req, res) => {
  try {
    const { documentId } = req.params;
    const { comments } = req.body;
    const signatureRecord = await SignatureRecord.findOne({ documentId });
    if (!signatureRecord) return res.status(404).json({ error: 'Document not found' });

    const auditLogId = await createAuditLog(
      documentId,
      'Changes Requested',
      { comments: comments || '' },
      req,
      { userName: CURRENT_USER.name, documentName: signatureRecord.fileName }
    );
    signatureRecord.auditTrail.push(auditLogId);
    await signatureRecord.save();

    res.status(200).json({ success: true, data: signatureRecord });
  } catch (error) {
    res.status(500).json({ error: 'Failed to request changes', message: error.message });
  }
});

// Get Audit Records for a document
router.get('/documents/:documentId/audit-records', async (req, res) => {
  try {
    const { documentId } = req.params;
    const signatureRecord = await SignatureRecord.findOne({ documentId });
    if (!signatureRecord) return res.status(404).json({ error: 'Document not found' });

    const auditLogs = await AuditLog.find({ documentId }).sort({ timestamp: 1 });

    res.status(200).json({
      success: true,
      data: { documentId, totalEvents: auditLogs.length, auditTrail: auditLogs },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve audit records', message: error.message });
  }
});

// Verify Audit Chain — recomputes the hash chain rather than trusting a flag
router.post('/documents/:documentId/verify-audit', async (req, res) => {
  try {
    const { documentId } = req.params;
    const signatureRecord = await SignatureRecord.findOne({ documentId });
    if (!signatureRecord) return res.status(404).json({ error: 'Document not found' });

    const auditLogs = await AuditLog.find({ documentId }).sort({ timestamp: 1 });
    const isValid = auditLogs.length > 0 && verifyAuditChain(auditLogs);

    const auditChainDetails = auditLogs.map((log, index) => ({
      sequence: index + 1,
      timestamp: log.timestamp,
      action: log.action,
      details: log.details,
    }));

    const verifyAuditId = await createAuditLog(
      documentId,
      'Audit Chain Verified',
      { isValid, eventCount: auditLogs.length },
      req,
      { userName: CURRENT_USER.name, documentName: signatureRecord.fileName }
    );
    signatureRecord.auditTrail.push(verifyAuditId);
    await signatureRecord.save();

    res.status(200).json({
      success: true,
      data: { documentId, isValid, auditChain: auditChainDetails, verificationDate: new Date() },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to verify audit chain', message: error.message });
  }
});

// Complete Audit
router.post('/documents/:documentId/complete-audit', async (req, res) => {
  try {
    const { documentId } = req.params;
    const signatureRecord = await SignatureRecord.findOne({ documentId });
    if (!signatureRecord) return res.status(404).json({ error: 'Document not found' });

    if (!signatureRecord.approved) {
      return res.status(400).json({
        error: 'Approval pending — the assigned reviewer must approve this document before its audit can be completed',
      });
    }
    if (signatureRecord.status !== 'signed') {
      return res.status(400).json({ error: 'Document must be fully signed before its audit can be completed' });
    }

    signatureRecord.status = 'verified';
    signatureRecord.verifiedAt = new Date();

    const auditCompleteId = await createAuditLog(
      documentId,
      'Audit Completed',
      { status: 'verified', completionDate: signatureRecord.verifiedAt },
      req,
      { userName: CURRENT_USER.name, documentName: signatureRecord.fileName }
    );
    signatureRecord.auditTrail.push(auditCompleteId);
    await signatureRecord.save();

    res.status(200).json({
      success: true,
      message: 'Audit completed successfully',
      data: { documentId, status: signatureRecord.status, verifiedAt: signatureRecord.verifiedAt },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to complete audit', message: error.message });
  }
});

// Download Signed PDF
router.get('/documents/:documentId/download-signed', async (req, res) => {
  try {
    const { documentId } = req.params;
    const signatureRecord = await SignatureRecord.findOne({ documentId });
    if (!signatureRecord || !signatureRecord.s3SignedKey) {
      return res.status(400).json({ error: 'Document not ready for download' });
    }
    if (signatureRecord.status !== 'verified') {
      return res.status(400).json({ error: 'The audit must be completed before the signed document can be downloaded' });
    }

    const signedPdfBuffer = await downloadFromS3(signatureRecord.s3SignedKey);

    await createAuditLog(
      documentId,
      'Document Downloaded',
      { fileName: signatureRecord.fileName, variant: 'signed' },
      req,
      { userName: CURRENT_USER.name, documentName: signatureRecord.fileName }
    );

    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `attachment; filename="${signatureRecord.fileName}-signed.pdf"`);
    res.set('Content-Length', signedPdfBuffer.length.toString());
    res.send(signedPdfBuffer);
  } catch (error) {
    res.status(500).json({ error: 'Failed to download signed PDF', message: error.message });
  }
});

// Download Original PDF
router.get('/documents/:documentId/download-original', async (req, res) => {
  try {
    const { documentId } = req.params;
    const signatureRecord = await SignatureRecord.findOne({ documentId });
    if (!signatureRecord) return res.status(404).json({ error: 'Document not found' });
    if (signatureRecord.status !== 'verified') {
      return res.status(400).json({ error: 'The audit must be completed before this document can be downloaded' });
    }

    const originalPdfBuffer = await downloadFromS3(signatureRecord.s3OriginalKey);

    await createAuditLog(
      documentId,
      'Document Downloaded',
      { fileName: signatureRecord.fileName, variant: 'original' },
      req,
      { userName: CURRENT_USER.name, documentName: signatureRecord.fileName }
    );

    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `attachment; filename="${signatureRecord.fileName}"`);
    res.set('Content-Length', originalPdfBuffer.length.toString());
    res.send(originalPdfBuffer);
  } catch (error) {
    res.status(500).json({ error: 'Failed to download original PDF', message: error.message });
  }
});

module.exports = router;
