const { Router } = require('express');
const crypto = require('crypto');
const { SignatureRecord } = require('../models/SignatureRecord');
const { calculateSHA256 } = require('../utils/crypto');
const { uploadToS3, downloadFromS3 } = require('../utils/s3');
const { stampFields, appendAuditCertificatePage, buildAuditPackPdf } = require('../utils/pdfSign');
const { createAuditLog, verifyAuditChain } = require('../utils/audit');
const { sendOtpEmail, sendSignatureRequestEmail, sendCompletionEmail } = require('../utils/mailer');
const { AuditLog } = require('../models/AuditLog');

const router = Router();

// Public, unauthenticated router: every route here is gated by a per-recipient
// magic-link token instead of the admin JWT, mirroring the reference product's
// "recipient never logs in" model. No route here should trust anything except
// the token matching a signer subdocument.

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 20 * 1000;

const findByToken = async (token) => {
  const signatureRecord = await SignatureRecord.findOne({ 'signers.token': token });
  if (!signatureRecord) return { signatureRecord: null, signer: null };
  const signer = signatureRecord.signers.find((s) => s.token === token);
  return { signatureRecord, signer };
};

const isSignersTurn = (signatureRecord, signer) => {
  if (signer.status === 'signed') return false;
  if (!signatureRecord.sequentialRouting) return signer.status === 'pending';
  return signer.status === 'pending';
};

// Resolve a signing link: who is this, what document, what fields are theirs.
router.get('/signing/:token', async (req, res) => {
  try {
    const { signatureRecord, signer } = await findByToken(req.params.token);
    if (!signatureRecord || !signer) {
      return res.status(404).json({ error: 'This signing link is invalid or has expired' });
    }

    await createAuditLog(
      signatureRecord.documentId,
      'Signing Link Opened',
      { recipient: signer.email },
      req,
      { userName: signer.name, documentName: signatureRecord.title || signatureRecord.fileName }
    );

    const myFields = signatureRecord.fields.filter(
      (f) => f.assignedToEmail === signer.email.toLowerCase()
    );

    res.status(200).json({
      success: true,
      data: {
        documentId: signatureRecord.documentId,
        title: signatureRecord.title || signatureRecord.fileName,
        fileName: signatureRecord.fileName,
        requestedByOrg: signatureRecord.requestedBy,
        signer: {
          name: signer.name,
          email: signer.email,
          roleLabel: signer.roleLabel,
          status: signer.status,
          otpVerified: signer.otpVerified,
          identityVerification: signer.identityVerification,
        },
        canActNow: isSignersTurn(signatureRecord, signer),
        fields: myFields,
        totalPages: undefined,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to resolve signing link', message: error.message });
  }
});

// Stream the PDF as it stands right now (earlier recipients' stamps already baked in).
router.get('/signing/:token/preview', async (req, res) => {
  try {
    const { signatureRecord, signer } = await findByToken(req.params.token);
    if (!signatureRecord || !signer) return res.status(404).json({ error: 'Invalid signing link' });

    const key = signatureRecord.s3SignedKey || signatureRecord.s3OriginalKey;
    const pdfBuffer = await downloadFromS3(key);
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Length', pdfBuffer.length.toString());
    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load PDF preview', message: error.message });
  }
});

// Email a fresh one-time passcode to this recipient's own address.
router.post('/signing/:token/request-otp', async (req, res) => {
  try {
    const { signatureRecord, signer } = await findByToken(req.params.token);
    if (!signatureRecord || !signer) return res.status(404).json({ error: 'Invalid signing link' });
    if (signer.status === 'signed') return res.status(400).json({ error: 'You have already signed this document' });

    if (signer.otpLastSentAt && Date.now() - new Date(signer.otpLastSentAt).getTime() < OTP_RESEND_COOLDOWN_MS) {
      const waitMs = OTP_RESEND_COOLDOWN_MS - (Date.now() - new Date(signer.otpLastSentAt).getTime());
      return res.status(429).json({ error: 'Please wait before requesting another code', retryAfterMs: waitMs });
    }

    const code = crypto.randomInt(100000, 999999).toString();
    signer.otpCode = code;
    signer.otpExpiresAt = new Date(Date.now() + OTP_TTL_MS);
    signer.otpLastSentAt = new Date();
    signer.otpVerified = false;
    await signatureRecord.save();

    await sendOtpEmail({ to: signer.email, code });

    await createAuditLog(
      signatureRecord.documentId,
      'OTP Sent',
      { to: signer.email },
      req,
      { userName: signer.name, documentName: signatureRecord.title || signatureRecord.fileName }
    );

    res.status(200).json({ success: true, message: 'Passcode sent', data: { resendInMs: OTP_RESEND_COOLDOWN_MS } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send passcode', message: error.message });
  }
});

// Verify the passcode the recipient just typed in.
router.post('/signing/:token/verify-otp', async (req, res) => {
  try {
    const { code } = req.body;
    const { signatureRecord, signer } = await findByToken(req.params.token);
    if (!signatureRecord || !signer) return res.status(404).json({ error: 'Invalid signing link' });

    if (!signer.otpCode || !signer.otpExpiresAt || new Date() > new Date(signer.otpExpiresAt)) {
      return res.status(400).json({ error: 'Code expired — request a new one' });
    }
    if (String(code).trim() !== signer.otpCode) {
      return res.status(400).json({ error: 'Incorrect code' });
    }

    signer.otpVerified = true;
    signer.otpCode = undefined;
    signer.otpExpiresAt = undefined;
    await signatureRecord.save();

    await createAuditLog(
      signatureRecord.documentId,
      'OTP Verified',
      { recipient: signer.email },
      req,
      { userName: signer.name, documentName: signatureRecord.title || signatureRecord.fileName }
    );

    res.status(200).json({ success: true, message: 'Identity confirmed for this signature' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to verify passcode', message: error.message });
  }
});

// Alternative to OTP for recipients set up with identityVerification: 'account_password' —
// checks the access password set by the envelope's sender at creation time.
router.post('/signing/:token/verify-password', async (req, res) => {
  try {
    const { password } = req.body;
    const { signatureRecord, signer } = await findByToken(req.params.token);
    if (!signatureRecord || !signer) return res.status(404).json({ error: 'Invalid signing link' });

    if (signer.identityVerification !== 'account_password') {
      return res.status(400).json({ error: 'This recipient is not set up for password verification' });
    }
    if (!password || calculateSHA256(password) !== signer.accessPasswordHash) {
      return res.status(400).json({ error: 'Incorrect password' });
    }

    signer.otpVerified = true;
    await signatureRecord.save();

    await createAuditLog(
      signatureRecord.documentId,
      'Password Verified',
      { recipient: signer.email },
      req,
      { userName: signer.name, documentName: signatureRecord.title || signatureRecord.fileName }
    );

    res.status(200).json({ success: true, message: 'Identity confirmed for this signature' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to verify password', message: error.message });
  }
});

// Commit this recipient's field values and, if it was their turn, apply the signature.
router.post('/signing/:token/sign', async (req, res) => {
  try {
    const { values, reason } = req.body;
    const { signatureRecord, signer } = await findByToken(req.params.token);
    if (!signatureRecord || !signer) return res.status(404).json({ error: 'Invalid signing link' });

    if (signer.status === 'signed') {
      return res.status(400).json({ error: 'You have already signed this document' });
    }
    if (!isSignersTurn(signatureRecord, signer)) {
      return res.status(400).json({ error: 'It is not your turn to sign yet' });
    }
    if (!signer.otpVerified) {
      return res.status(400).json({ error: 'Identity not verified — enter the emailed passcode first' });
    }
    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ error: 'A reason is required before signing' });
    }

    const myFields = signatureRecord.fields.filter((f) => f.assignedToEmail === signer.email.toLowerCase());
    const valueMap = new Map((Array.isArray(values) ? values : []).map((v) => [v.fieldId, v.value]));

    const missing = myFields.filter((f) => f.required && !valueMap.get(f.fieldId) && !f.value);
    if (missing.length > 0) {
      return res.status(400).json({
        error: `Missing required field${missing.length > 1 ? 's' : ''}: ${missing.map((f) => f.label || f.type).join(', ')}`,
      });
    }

    for (const field of myFields) {
      const incoming = valueMap.get(field.fieldId);
      if (incoming !== undefined) {
        field.value = incoming;
        field.filledAt = new Date();
      }
    }

    signer.status = 'signed';
    signer.signedAt = new Date();
    signer.ipAddress = req.ip || 'unknown';
    signer.userAgent = req.get('user-agent') || 'unknown';
    signer.reason = reason || '';

    if (signatureRecord.sequentialRouting) {
      const next = signatureRecord.signers.find((s) => s.order === (signer.order ?? 0) + 1);
      if (next) next.status = 'pending';
    }

    const signersByEmail = {};
    for (const s of signatureRecord.signers) {
      signersByEmail[s.email.toLowerCase()] = {
        name: s.name,
        signedAt: s.signedAt,
        ipAddress: s.ipAddress,
        userAgent: s.userAgent,
      };
    }

    const originalPdfBuffer = await downloadFromS3(signatureRecord.s3OriginalKey);
    const signedPdfBuffer = await stampFields(originalPdfBuffer, signatureRecord.fields, signersByEmail);
    const signedPdfHash = calculateSHA256(signedPdfBuffer);
    const signedS3Key = `signed/${signatureRecord.documentId}/${signatureRecord.fileName}`;
    await uploadToS3(signedS3Key, signedPdfBuffer, 'application/pdf');

    signatureRecord.s3SignedKey = signedS3Key;
    signatureRecord.signedPdfHash = signedPdfHash;
    signatureRecord.signedAt = new Date();

    const signAuditId = await createAuditLog(
      signatureRecord.documentId,
      'Recipient Signed',
      { recipient: signer.email, reason: signer.reason },
      req,
      { userName: signer.name, documentName: signatureRecord.title || signatureRecord.fileName }
    );
    signatureRecord.auditTrail.push(signAuditId);

    const allSigned = signatureRecord.signers.every((s) => s.status === 'signed');
    if (allSigned) {
      signatureRecord.status = 'signed';

      const auditLogs = await AuditLog.find({ documentId: signatureRecord.documentId }).sort({ timestamp: 1 });
      const chainValid = auditLogs.length > 0 && verifyAuditChain(auditLogs);

      if (chainValid) {
        const hashChainSummary = auditLogs.map(
          (log, i) => `${i + 1}. ${log.action} — ${new Date(log.timestamp).toISOString()} — hash ${log.hash.slice(0, 16)}…`
        );
        const auditPdfBuffer = await appendAuditCertificatePage(signedPdfBuffer, {
          envelopeId: signatureRecord.documentId,
          documentName: signatureRecord.title || signatureRecord.fileName,
          signers: signatureRecord.signers,
          hashChainSummary,
        });
        const auditS3Key = `signed-with-audit/${signatureRecord.documentId}/${signatureRecord.fileName}`;
        await uploadToS3(auditS3Key, auditPdfBuffer, 'application/pdf');
        signatureRecord.s3AuditPdfKey = auditS3Key;
        signatureRecord.status = 'verified';
        signatureRecord.verifiedAt = new Date();

        const completeAuditId = await createAuditLog(
          signatureRecord.documentId,
          'Envelope Completed',
          { isValid: chainValid, eventCount: auditLogs.length },
          req,
          { userName: 'System', documentName: signatureRecord.title || signatureRecord.fileName }
        );
        signatureRecord.auditTrail.push(completeAuditId);
      } else {
        console.error(`Audit chain failed verification for document ${signatureRecord.documentId} at completion`);
      }

      await signatureRecord.save();

      await Promise.all(
        signatureRecord.signers.map((s) =>
          sendCompletionEmail({
            to: s.email,
            recipientName: s.name,
            documentName: signatureRecord.title || signatureRecord.fileName,
            documentId: signatureRecord.documentId,
          }).catch((error) => console.error('Completion email failed:', error))
        )
      );
    } else {
      await signatureRecord.save();

      if (signatureRecord.sequentialRouting) {
        const next = signatureRecord.signers.find((s) => s.status === 'pending');
        if (next) {
          await sendSignatureRequestEmail({
            to: next.email,
            recipientName: next.name,
            requestedByOrg: signatureRecord.requestedBy,
            documentName: signatureRecord.title || signatureRecord.fileName,
            token: next.token,
          }).catch((error) => console.error('Signature-request email failed:', error));
        }
      }
    }

    res.status(200).json({
      success: true,
      message: 'Signature recorded',
      data: {
        documentId: signatureRecord.documentId,
        signedPdfHash,
        signedAt: signer.signedAt,
        allSigned,
        status: signatureRecord.status,
      },
    });
  } catch (error) {
    console.error('Signing error:', error);
    res.status(500).json({ error: 'Failed to record signature', message: error.message });
  }
});

// Download variants available from the post-sign "Signature recorded" screen.
router.get('/signing/:token/download', async (req, res) => {
  try {
    const { variant } = req.query;
    const { signatureRecord, signer } = await findByToken(req.params.token);
    if (!signatureRecord || !signer) return res.status(404).json({ error: 'Invalid signing link' });
    if (signer.status !== 'signed') {
      return res.status(400).json({ error: 'Sign the document before downloading it' });
    }

    if (variant === 'with-audit') {
      if (!signatureRecord.s3AuditPdfKey) {
        return res.status(400).json({ error: 'Available once every recipient has signed' });
      }
      const buffer = await downloadFromS3(signatureRecord.s3AuditPdfKey);
      res.set('Content-Type', 'application/pdf');
      res.set('Content-Disposition', `attachment; filename="${signatureRecord.fileName}-signed-with-audit.pdf"`);
      return res.send(buffer);
    }

    if (variant === 'audit-pack') {
      const auditLogs = await AuditLog.find({ documentId: signatureRecord.documentId }).sort({ timestamp: 1 });
      const pdfBuffer = await buildAuditPackPdf({
        documentId: signatureRecord.documentId,
        title: signatureRecord.title || signatureRecord.fileName,
        originalHash: signatureRecord.pdfHash,
        signedHash: signatureRecord.signedPdfHash,
        chainValid: auditLogs.length > 0 && verifyAuditChain(auditLogs),
        signers: signatureRecord.signers,
        events: auditLogs,
      });
      res.set('Content-Type', 'application/pdf');
      res.set('Content-Disposition', `attachment; filename="${signatureRecord.documentId}-audit-pack.pdf"`);
      return res.send(pdfBuffer);
    }

    // default: 'without-audit'
    if (!signatureRecord.s3SignedKey) {
      return res.status(400).json({ error: 'Document not ready for download' });
    }
    const buffer = await downloadFromS3(signatureRecord.s3SignedKey);
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `attachment; filename="${signatureRecord.fileName}-signed.pdf"`);
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: 'Failed to download document', message: error.message });
  }
});

module.exports = router;
