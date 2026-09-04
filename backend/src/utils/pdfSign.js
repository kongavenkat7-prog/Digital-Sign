const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

// Shared visual language for the generated audit documents (certificate page
// + audit pack), so both read as one branded report instead of plain text.
const COLORS = {
  brand: rgb(0.345, 0.396, 0.949), // SignVault indigo
  brandDark: rgb(0.235, 0.271, 0.816),
  success: rgb(0.086, 0.639, 0.290),
  danger: rgb(0.863, 0.149, 0.149),
  text: rgb(0.11, 0.11, 0.13),
  textMuted: rgb(0.42, 0.44, 0.5),
  cardBg: rgb(0.965, 0.967, 0.98),
  border: rgb(0.87, 0.88, 0.92),
  white: rgb(1, 1, 1),
};

/** Full-width brand header band; returns the y coordinate to start content below it. */
const drawHeaderBand = (page, { title, subtitle }, pageWidth, pageHeight, boldFont, font) => {
  const bandHeight = 72;
  page.drawRectangle({ x: 0, y: pageHeight - bandHeight, width: pageWidth, height: bandHeight, color: COLORS.brand });
  page.drawText('SignVault', { x: 50, y: pageHeight - 30, size: 11, font: boldFont, color: COLORS.white });
  page.drawText(title, { x: 50, y: pageHeight - 52, size: 18, font: boldFont, color: COLORS.white });
  if (subtitle) {
    page.drawText(subtitle, { x: 50, y: pageHeight - 66, size: 9, font, color: rgb(0.88, 0.89, 0.98) });
  }
  return pageHeight - bandHeight - 26;
};

/** Section heading with a small brand accent bar. */
const drawSectionHeading = (page, text, x, y, boldFont) => {
  page.drawRectangle({ x, y: y - 1, width: 3, height: 13, color: COLORS.brand });
  page.drawText(text, { x: x + 10, y, size: 12.5, font: boldFont, color: COLORS.text });
};

/** Small filled status pill (VALID / NOT YET VALID, etc). Returns the pill's rendered width. */
const drawStatusPill = (page, { x, y, label, tone, font }) => {
  const paddingX = 8;
  const textWidth = font.widthOfTextAtSize(label, 9);
  const pillWidth = textWidth + paddingX * 2;
  page.drawRectangle({ x, y: y - 3, width: pillWidth, height: 15, color: tone });
  page.drawText(label, { x: x + paddingX, y, size: 9, font, color: COLORS.white });
  return pillWidth;
};

const drawFooter = (page, pageNumber, font) => {
  page.drawText(`SignVault · Tamper-evident audit record · Page ${pageNumber}`, {
    x: 50,
    y: 24,
    size: 7.5,
    font,
    color: COLORS.textMuted,
  });
};

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
/** Attribution block (who/when/where/why) drawn under any stamped field, not just signatures. */
const drawFieldCaption = (page, font, x, y, signer) => {
  if (!signer) return;
  const captionSize = 6.5;
  let captionY = y - captionSize - 2;
  const lines = [
    `Digitally signed by ${signer.name}`,
    signer.signedAt ? `Date: ${new Date(signer.signedAt).toISOString()}` : null,
    [signer.ipAddress ? `IP ${signer.ipAddress}` : null, describeUserAgent(signer.userAgent)].filter(Boolean).join(' | ') || null,
    signer.reason ? `Reason: ${signer.reason}` : null,
  ].filter(Boolean);
  for (const line of lines) {
    page.drawText(line, { x, y: captionY, size: captionSize, font });
    captionY -= captionSize + 2;
  }
};

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
    const signer = signersByEmail[field.assignedToEmail];

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
        drawFieldCaption(page, font, x, y, signer);
      } else if (field.type === 'checkbox') {
        if (field.value === 'true') {
          page.drawText('X', { x: x + 2, y: y + 2, size: Math.min(boxHeight * 0.8, 14), font });
          drawFieldCaption(page, font, x, y, signer);
        }
      } else {
        // date / text
        page.drawText(String(field.value), { x, y: y + boxHeight * 0.25, size: Math.min(boxHeight * 0.7, 12), font });
        drawFieldCaption(page, font, x, y, signer);
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
  const monoFont = await pdfDoc.embedFont(StandardFonts.Courier);
  const [pageWidth, pageHeight] = [612, 792];
  const margin = 50;
  const page = pdfDoc.addPage([pageWidth, pageHeight]);

  let y = drawHeaderBand(page, { title: 'Audit Certificate', subtitle: documentName }, pageWidth, pageHeight, boldFont, font);
  page.drawText(`Envelope ID: ${envelopeId}`, { x: margin, y, size: 8.5, font: monoFont, color: COLORS.textMuted });
  y -= 28;

  drawSectionHeading(page, 'Signers', margin, y, boldFont);
  y -= 20;
  for (const s of signers || []) {
    if (y < 110) break;
    page.drawText(`${s.name}  ·  ${s.email}${s.roleLabel ? `  ·  ${s.roleLabel}` : ''}`, {
      x: margin + 6,
      y,
      size: 10,
      font: boldFont,
      color: COLORS.text,
    });
    y -= 15;
    const pillTone = s.status === 'signed' ? COLORS.success : s.status === 'declined' ? COLORS.danger : COLORS.textMuted;
    const pillWidth = drawStatusPill(page, { x: margin + 6, y, label: s.status.toUpperCase(), tone: pillTone, font: boldFont });
    if (s.signedAt) {
      page.drawText(`Signed ${new Date(s.signedAt).toISOString()}`, {
        x: margin + 6 + pillWidth + 8,
        y,
        size: 8.5,
        font,
        color: COLORS.textMuted,
      });
    }
    y -= 16;
    if (s.ipAddress) {
      page.drawText(`IP ${s.ipAddress}`, { x: margin + 6, y, size: 8, font: monoFont, color: COLORS.textMuted });
      y -= 14;
    }
    page.drawLine({
      start: { x: margin, y: y + 4 },
      end: { x: pageWidth - margin, y: y + 4 },
      thickness: 0.5,
      color: COLORS.border,
    });
    y -= 12;
  }

  y -= 12;
  if (y > 70) {
    drawSectionHeading(page, 'Hash Chain', margin, y, boldFont);
    y -= 20;
    for (const line of (hashChainSummary || []).slice(0, 16)) {
      if (y < 45) break;
      page.drawText(line, { x: margin + 6, y, size: 7.5, font: monoFont, color: COLORS.textMuted });
      y -= 12;
    }
  }

  drawFooter(page, 1, font);
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
  const monoFont = await pdfDoc.embedFont(StandardFonts.Courier);
  const margin = 50;
  const [pageWidth, pageHeight] = [612, 792];

  let pageNumber = 1;
  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = drawHeaderBand(page, { title: 'SignVault Audit Pack', subtitle: title }, pageWidth, pageHeight, boldFont, font);
  drawFooter(page, pageNumber, font);

  const newPage = () => {
    pageNumber += 1;
    page = pdfDoc.addPage([pageWidth, pageHeight]);
    y = pageHeight - margin;
    drawFooter(page, pageNumber, font);
  };

  const ensureRoom = (needed) => {
    if (y - needed < margin + 20) newPage();
  };

  const writeLine = (text, { size = 10, bold = false, mono = false, gap = 14, color = COLORS.text } = {}) => {
    ensureRoom(gap);
    page.drawText(text, { x: margin, y, size, font: mono ? monoFont : bold ? boldFont : font, color });
    y -= gap;
  };

  writeLine(`Envelope ID: ${documentId}`, { size: 8.5, mono: true, color: COLORS.textMuted, gap: 16 });
  writeLine(`Original hash: ${originalHash || '—'}`, { size: 8, mono: true, color: COLORS.textMuted, gap: 12 });
  writeLine(`Signed hash: ${signedHash || '—'}`, { size: 8, mono: true, color: COLORS.textMuted, gap: 20 });

  ensureRoom(20);
  drawStatusPill(page, {
    x: margin,
    y,
    label: chainValid ? 'HASH CHAIN VALID' : 'HASH CHAIN NOT YET VALID',
    tone: chainValid ? COLORS.success : COLORS.textMuted,
    font: boldFont,
  });
  y -= 30;

  drawSectionHeading(page, 'Signers', margin, y, boldFont);
  y -= 20;
  for (const s of signers || []) {
    ensureRoom(42);
    writeLine(`${s.name}  ·  ${s.email}${s.roleLabel ? `  ·  ${s.roleLabel}` : ''}`, { size: 10, bold: true, gap: 15 });
    const pillTone = s.status === 'signed' ? COLORS.success : s.status === 'declined' ? COLORS.danger : COLORS.textMuted;
    const pillWidth = drawStatusPill(page, { x: margin, y, label: s.status.toUpperCase(), tone: pillTone, font: boldFont });
    if (s.signedAt) {
      page.drawText(`Signed ${new Date(s.signedAt).toISOString()}`, {
        x: margin + pillWidth + 8,
        y,
        size: 8.5,
        font,
        color: COLORS.textMuted,
      });
    }
    y -= 16;
    if (s.ipAddress) writeLine(`IP ${s.ipAddress}`, { size: 8, mono: true, color: COLORS.textMuted, gap: 14 });
    page.drawLine({ start: { x: margin, y: y + 4 }, end: { x: pageWidth - margin, y: y + 4 }, thickness: 0.5, color: COLORS.border });
    y -= 12;
  }

  y -= 8;
  ensureRoom(20);
  drawSectionHeading(page, 'Audit Trail', margin, y, boldFont);
  y -= 20;
  (events || []).forEach((log, index) => {
    ensureRoom(38);
    writeLine(`${index + 1}. ${log.action}  —  ${new Date(log.timestamp).toISOString()}`, { size: 9.5, bold: true, gap: 13 });
    if (log.userName) {
      writeLine(`By: ${log.userName}${log.ipAddress ? `  ·  IP ${log.ipAddress}` : ''}`, { size: 8, color: COLORS.textMuted, gap: 12 });
    }
    writeLine(`hash ${log.hash}`, { size: 7, mono: true, color: COLORS.textMuted, gap: 14 });
  });

  return Buffer.from(await pdfDoc.save());
};

module.exports = { stampSignature, stampFields, appendAuditCertificatePage, buildAuditPackPdf };
