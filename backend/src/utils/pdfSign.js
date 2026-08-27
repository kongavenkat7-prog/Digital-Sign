const { PDFDocument } = require('pdf-lib');

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

module.exports = { stampSignature };
