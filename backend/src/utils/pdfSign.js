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

/**
 * Envelope flow: renders every filled field (any type) onto the PDF using
 * percentage-based coordinates captured by the Fields editor — leftPct/topPct
 * are measured from the page's top-left, matching how the browser reports
 * drag position, so they're converted into pdf-lib's bottom-left origin here.
 */
const stampFields = async (pdfBuffer, fields) => {
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

module.exports = { stampSignature, stampFields, appendAuditCertificatePage };
