const { PDFDocument, StandardFonts } = require('pdf-lib');

const decodeImage = (dataUrl) => {
  const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
  const isPng = dataUrl.includes('image/png') || !dataUrl.includes('image/');
  return { bytes: Buffer.from(base64, 'base64'), isPng };
};

/**
 * Embeds every signature placement (and a text stamp on the last one) into the
 * original PDF so the signed copy is a real, distinct artifact rather than a
 * byte-for-byte clone. Accepts one or many placements so a document can be
 * signed in several spots across one or more pages.
 *
 * Legacy: used by the single-admin signing flow (routes/documents.js
 * `/signatures/:documentId/sign`). The multi-recipient envelope flow uses
 * stampFields() below instead.
 */
const stampSignature = async (originalPdfBuffer, options) => {
  const pdfDoc = await PDFDocument.load(originalPdfBuffer);
  const pages = pdfDoc.getPages();
  const placements = Array.isArray(options.placements) ? options.placements : [options];

  for (const placement of placements) {
    const pageIndex = Math.min(Math.max((placement.pageNumber || 1) - 1, 0), pages.length - 1);
    const page = pages[pageIndex];
    const { height } = page.getSize();

    const x = placement.signatureX ?? 60;
    const yFromTop = placement.signatureY ?? 60;
    const y = height - yFromTop;

    if (placement.signatureImage) {
      try {
        const { bytes, isPng } = decodeImage(placement.signatureImage);
        const image = isPng ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
        const scale = 150 / image.width;
        page.drawImage(image, {
          x,
          y: y - image.height * scale,
          width: image.width * scale,
          height: image.height * scale,
        });
      } catch (error) {
        console.error('Failed to embed signature image, falling back to text stamp:', error);
      }
    }
  }

  const lastPlacement = placements[placements.length - 1];
  if (lastPlacement) {
    const pageIndex = Math.min(Math.max((lastPlacement.pageNumber || 1) - 1, 0), pages.length - 1);
    const page = pages[pageIndex];
    const { height } = page.getSize();
    const x = lastPlacement.signatureX ?? 60;
    const y = height - (lastPlacement.signatureY ?? 60);
    page.drawText(
      `Digitally signed by ${options.signerName} on ${options.signedAt.toISOString()} — SignVault`,
      {
        x,
        y: Math.max(y - 165, 20),
        size: 8,
      }
    );
  }

  const signedBytes = await pdfDoc.save();
  return Buffer.from(signedBytes);
};

/** Best-effort "Chrome on macOS" style label from a raw User-Agent string. */
const describeUserAgent = (ua) => {
  if (!ua) return '';
  let browser = 'Unknown browser';
  if (/edg\//i.test(ua)) browser = 'Edge';
  else if (/chrome\//i.test(ua)) browser = 'Chrome';
  else if (/firefox\//i.test(ua)) browser = 'Firefox';
  else if (/safari\//i.test(ua)) browser = 'Safari';

  let os = 'Unknown OS';
  if (/windows/i.test(ua)) os = 'Windows';
  else if (/mac os x/i.test(ua)) os = 'macOS';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/iphone|ipad/i.test(ua)) os = 'iOS';
  else if (/linux/i.test(ua)) os = 'Linux';

  return `${browser} on ${os}`;
};

/**
 * Envelope flow: renders every filled field (any type) onto the PDF using
 * percentage-based coordinates captured by the Fields editor — leftPct/topPct
 * are measured from the page's top-left, matching how the browser reports
 * drag position, so they're converted into pdf-lib's bottom-left origin here.
 * signersByEmail supplies each recipient's name/timestamp/IP/user-agent so a
 * signature or initials field gets a caption underneath it, the same way the
 * reference product stamps "Digitally signed by X ... Signed from IP | UA".
 */
const stampFields = async (pdfBuffer, fields, signersByEmail = {}) => {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const pages = pdfDoc.getPages();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  for (const field of fields || []) {
    if (!field.value) continue;
    const pageIndex = Math.min(Math.max((field.pageNumber || 1) - 1, 0), pages.length - 1);
    const page = pages[pageIndex];
    const { width, height } = page.getSize();

    const x = (field.leftPct / 100) * width;
    const boxWidth = (field.widthPct / 100) * width;
    const boxHeight = (field.heightPct / 100) * height;
    const yTop = height - (field.topPct / 100) * height;
    const y = yTop - boxHeight;

    try {
      if (field.type === 'signature' || field.type === 'initials') {
        const { bytes, isPng } = decodeImage(field.value);
        const image = isPng ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
        const scale = Math.min(boxWidth / image.width, boxHeight / image.height);
        page.drawImage(image, {
          x,
          y,
          width: image.width * scale,
          height: image.height * scale,
        });

        const signer = signersByEmail[field.assignedToEmail];
        if (signer) {
          const captionSize = 6.5;
          let captionY = y - captionSize - 2;
          const lines = [
            `Digitally signed by ${signer.name}`,
            signer.signedAt ? `Date: ${new Date(signer.signedAt).toISOString()}` : null,
            [signer.ipAddress ? `IP ${signer.ipAddress}` : null, describeUserAgent(signer.userAgent)].filter(Boolean).join(' | ') || null,
          ].filter(Boolean);
          for (const line of lines) {
            page.drawText(line, { x, y: captionY, size: captionSize, font });
            captionY -= captionSize + 2;
          }
        }
      } else if (field.type === 'checkbox') {
        if (field.value === 'true') {
          page.drawText('X', { x: x + 2, y: y + 2, size: Math.min(boxHeight * 0.8, 14), font });
        }
      } else {
        // date / text
        page.drawText(String(field.value), { x, y: y + boxHeight * 0.25, size: Math.min(boxHeight * 0.7, 12), font });
      }
    } catch (error) {
      console.error(`Failed to stamp field ${field.fieldId} (${field.type}):`, error);
    }
  }

  return Buffer.from(await pdfDoc.save());
};

/**
 * Appends a certificate-of-completion page summarizing the envelope's
 * signers and audit hash chain, for the "with audit page" download variant.
 */
const appendAuditCertificatePage = async (pdfBuffer, { envelopeId, documentName, signers, hashChainSummary }) => {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const page = pdfDoc.addPage([612, 792]);
  let y = 740;

  page.drawText('Audit Certificate', { x: 50, y, size: 20, font: boldFont });
  y -= 30;
  page.drawText(`Document: ${documentName}`, { x: 50, y, size: 11, font });
  y -= 16;
  page.drawText(`Envelope ID: ${envelopeId}`, { x: 50, y, size: 11, font });
  y -= 24;

  page.drawText('Signers', { x: 50, y, size: 13, font: boldFont });
  y -= 18;
  for (const s of signers || []) {
    if (y < 90) break;
    page.drawText(`${s.name} <${s.email}> — ${s.roleLabel || ''}`, { x: 50, y, size: 10, font });
    y -= 14;
    const statusLine = `  Status: ${s.status}${s.signedAt ? ` · Signed ${new Date(s.signedAt).toISOString()}` : ''}`;
    page.drawText(statusLine, { x: 50, y, size: 9, font });
    y -= 12;
    if (s.ipAddress) {
      page.drawText(`  IP: ${s.ipAddress}`, { x: 50, y, size: 9, font });
      y -= 14;
    }
  }

  y -= 10;
  if (y > 60) {
    page.drawText('Hash Chain', { x: 50, y, size: 13, font: boldFont });
    y -= 18;
    for (const line of (hashChainSummary || []).slice(0, 20)) {
      if (y < 50) break;
      page.drawText(line, { x: 50, y, size: 8, font });
      y -= 11;
    }
  }

  return Buffer.from(await pdfDoc.save());
};

/**
 * Standalone "audit pack" PDF: every audit-trail event plus signer summary
 * and hash chain, for the recipient's post-sign download screen — a full
 * paginated report rather than the single certificate page appended to the
 * signed document itself.
 */
const buildAuditPackPdf = async ({ documentId, title, originalHash, signedHash, chainValid, signers, events }) => {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const margin = 50;
  const pageSize = [612, 792];

  let page = pdfDoc.addPage(pageSize);
  let y = pageSize[1] - margin;

  const ensureRoom = (needed) => {
    if (y - needed < margin) {
      page = pdfDoc.addPage(pageSize);
      y = pageSize[1] - margin;
    }
  };

  const writeLine = (text, { size = 10, bold = false, gap = 14 } = {}) => {
    ensureRoom(gap);
    page.drawText(text, { x: margin, y, size, font: bold ? boldFont : font });
    y -= gap;
  };

  writeLine('SignVault Audit Pack', { size: 20, bold: true, gap: 28 });
  writeLine(`Document: ${title}`, { size: 11 });
  writeLine(`Envelope ID: ${documentId}`, { size: 11 });
  writeLine(`Original hash: ${originalHash || '—'}`, { size: 9 });
  writeLine(`Signed hash: ${signedHash || '—'}`, { size: 9 });
  writeLine(`Hash chain: ${chainValid ? 'VALID' : 'NOT YET VALID'}`, { size: 11, bold: true, gap: 22 });

  writeLine('Signers', { size: 13, bold: true, gap: 18 });
  for (const s of signers || []) {
    writeLine(`${s.name} <${s.email}> — ${s.roleLabel || ''}`, { size: 10 });
    writeLine(`  Status: ${s.status}${s.signedAt ? ` · Signed ${new Date(s.signedAt).toISOString()}` : ''}`, { size: 9, gap: 12 });
    if (s.ipAddress) writeLine(`  IP: ${s.ipAddress}`, { size: 9, gap: 12 });
  }

  y -= 8;
  writeLine('Audit Trail', { size: 13, bold: true, gap: 18 });
  (events || []).forEach((log, index) => {
    writeLine(`${index + 1}. ${log.action} — ${new Date(log.timestamp).toISOString()}`, { size: 9, gap: 12 });
    if (log.userName) writeLine(`   By: ${log.userName}${log.ipAddress ? ` · IP ${log.ipAddress}` : ''}`, { size: 8, gap: 11 });
    writeLine(`   hash ${log.hash}`, { size: 7.5, gap: 13 });
  });

  return Buffer.from(await pdfDoc.save());
};

module.exports = { stampSignature, stampFields, appendAuditCertificatePage, buildAuditPackPdf };
