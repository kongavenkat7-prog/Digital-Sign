const nodemailer = require('nodemailer');

let transporter;

/**
 * SMTP is optional in dev — without it we log what would have been sent
 * instead of throwing, the same graceful-degradation pattern used for S3.
 */
const getTransporter = () => {
  if (transporter !== undefined) return transporter;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    transporter = null;
    return transporter;
  }
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return transporter;
};

const sendMail = async ({ to, subject, text }) => {
  const mailer = getTransporter();
  if (!mailer) {
    console.warn(
      `✉️  SMTP not configured — skipping email to ${to}. ` +
        `Set SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS in .env to enable it. Would have sent: "${subject}"\n${text}`
    );
    return { sent: false };
  }
  try {
    await mailer.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to, subject, text });
    console.log(`✉️  Email sent to ${to}: "${subject}"`);
    return { sent: true };
  } catch (error) {
    console.error(`Failed to send email to ${to}:`, error.message);
    return { sent: false, error: error.message };
  }
};

// Legacy: still used by the admin-only signer-assignment flow (routes/documents.js).
const sendReviewerAssignedEmail = ({ to, reviewerName, roleLabel, documentName, documentId }) => {
  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  return sendMail({
    to,
    subject: `SignVault: You've been assigned to review "${documentName}"`,
    text: `Hi ${reviewerName},

You have been assigned as ${roleLabel} to review and sign "${documentName}" on SignVault.

Open it here: ${appUrl}/sign/${documentId}

— SignVault`,
  });
};

// Envelope flow: emailed to a recipient when it's their turn to sign.
const sendSignatureRequestEmail = ({ to, recipientName, requestedByOrg, documentName, token }) => {
  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const signLink = `${appUrl}/signing/${token}`;
  return sendMail({
    to,
    subject: `Signature requested: ${documentName}`,
    text: `${requestedByOrg || 'SignVault'} requested your signature

Hello ${recipientName},

"${documentName}" is ready for your review and signature.

Review and sign: ${signLink}

This link is unique to you. Identity is verified before any signature is applied, and every action is recorded in the audit trail.

— SignVault`,
  });
};

// Envelope flow: one-time passcode, the second identification factor before a signature is applied.
const sendOtpEmail = ({ to, code }) => {
  return sendMail({
    to,
    subject: `Your SignVault passcode: ${code}`,
    text: `Your one-time passcode is: ${code}

This code is the second identification component required before your signature is applied. It expires in 10 minutes.

If you didn't request this, you can ignore this email.

— SignVault`,
  });
};

// Envelope flow: sent once every recipient has signed.
const sendCompletionEmail = ({ to, recipientName, documentName, documentId }) => {
  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  return sendMail({
    to,
    subject: `Completed: ${documentName}`,
    text: `All signatures are complete

Hello ${recipientName},

"${documentName}" has been signed by every recipient. The sealed PDF now carries its generated audit certificate page, and is available to download from the link below.

Download the signed copy: ${appUrl}/download/${documentId}

Document binaries are retained for 90 days by default. The audit record and its hash chain are retained for 30 years.

— SignVault`,
  });
};

module.exports = {
  sendReviewerAssignedEmail,
  sendSignatureRequestEmail,
  sendOtpEmail,
  sendCompletionEmail,
};
