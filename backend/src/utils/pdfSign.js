const { PDFDocument } = require('pdf-lib');

const decodeImage = (dataUrl) => {
  const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
  const isPng = dataUrl.includes('image/png') || !dataUrl.includes('image/');
  return { bytes: Buffer.from(base64, 'base64'), isPng };
};

/**
 * Embeds the signature image (and a text stamp) into the original PDF so the
 * signed copy is a real, distinct artifact rather than a byte-for-byte clone.
 */
const stampSignature = async (originalPdfBuffer, options) => {
  const pdfDoc = await PDFDocument.load(originalPdfBuffer);
  const pages = pdfDoc.getPages();
  const pageIndex = Math.min(Math.max((options.pageNumber || 1) - 1, 0), pages.length - 1);
  const page = pages[pageIndex];
  const { height } = page.getSize();

  const x = options.signatureX ?? 60;
  const yFromTop = options.signatureY ?? 60;
  const y = height - yFromTop;

  if (options.signatureImage) {
    try {
      const { bytes, isPng } = decodeImage(options.signatureImage);
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

  page.drawText(
    `Digitally signed by ${options.signerName} on ${options.signedAt.toISOString()} — SignVault`,
    {
      x,
      y: Math.max(y - 165, 20),
      size: 8,
    }
  );

  const signedBytes = await pdfDoc.save();
  return Buffer.from(signedBytes);
};

module.exports = { stampSignature };
