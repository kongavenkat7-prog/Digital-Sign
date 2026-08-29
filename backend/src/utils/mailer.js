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

const sendReviewerAssignedEmail = async ({ to, reviewerName, roleLabel, documentName, documentId }) => {
  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const subject = `SignVault: You've been assigned to review "${documentName}"`;
  const text = `Hi ${reviewerName},

You have been assigned as ${roleLabel} to review and sign "${documentName}" on SignVault.

Open it here: ${appUrl}/sign/${documentId}

— SignVault`;

  const mailer = getTransporter();
  if (!mailer) {
    console.warn(
      `✉️  SMTP not configured — skipping reviewer-assignment email to ${to}. ` +
        `Set SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS in .env to enable it. Would have sent: "${subject}"`
    );
    return { sent: false };
  }

  try {
    await mailer.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to, subject, text });
    console.log(`✉️  Reviewer-assignment email sent to ${to}`);
    return { sent: true };
  } catch (error) {
    console.error(`Failed to send reviewer-assignment email to ${to}:`, error.message);
    return { sent: false, error: error.message };
  }
};

module.exports = { sendReviewerAssignedEmail };
