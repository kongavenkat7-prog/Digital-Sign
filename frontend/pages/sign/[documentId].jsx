import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import * as pdfjsLib from 'pdfjs-dist';
import toast from 'react-hot-toast';
import AppShell from '@/components/AppShell';
import styles from '@/styles/Sign.module.css';
import { api } from '@/lib/api';

if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
}

const statusMeta = {
  signed: { icon: '✓', iconClass: styles.iconSigned, label: 'Signed', textClass: styles.statusSigned },
  pending: { icon: '⏱', iconClass: styles.iconPending, label: 'Signature Pending', textClass: styles.statusPending },
  awaiting: { icon: '•', iconClass: styles.iconAwaiting, label: 'Awaiting prior steps', textClass: styles.statusAwaiting },
  declined: { icon: '✕', iconClass: styles.iconDeclined, label: 'Declined', textClass: styles.statusDeclined },
};

const SignPage = () => {
  const router = useRouter();
  const { documentId } = router.query;
  const canvasRef = useRef(null);

  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pdfPages, setPdfPages] = useState([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [signing, setSigning] = useState(false);
  const [hashes, setHashes] = useState(null);
  const [downloading, setDownloading] = useState(null);
  const [previewError, setPreviewError] = useState(null);

  const loadDocument = async (id) => {
    try {
      const res = await api.getDocument(id);
      setDoc(res.data.data);
    } catch (error) {
      toast.error('Document not found');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (documentId) loadDocument(documentId);
  }, [documentId]);

  const hasSignedCopy = Boolean(doc && doc.s3SignedKey);

  const renderPdf = async (arrayBuffer) => {
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 1.3 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const context = canvas.getContext('2d');
      await page.render({ canvasContext: context, viewport }).promise;
      pages.push(canvas);
    }
    return pages;
  };

  useEffect(() => {
    if (!documentId || !doc) return;
    (async () => {
      setPreviewError(null);
      // Prefer the signed copy once it exists; if rendering it fails for any
      // reason, fall back to the original rather than leaving the preview
      // blank, and surface the real error on-screen (not just the console).
      if (hasSignedCopy) {
        try {
          const response = await api.previewSignedDocument(documentId);
          setPdfPages(await renderPdf(response.data));
          return;
        } catch (error) {
          console.error('Signed PDF preview failed, falling back to original:', error);
          setPreviewError('Could not render the signed copy — showing the original instead.');
        }
      }
      try {
        const response = await api.previewDocument(documentId);
        setPdfPages(await renderPdf(response.data));
      } catch (error) {
        console.error('Sign page PDF preview failed:', error);
        setPreviewError(error.message || 'Failed to load the PDF preview.');
      }
    })();
  }, [documentId, doc, hasSignedCopy]);

  useEffect(() => {
    if (pdfPages.length > 0 && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      const pageCanvas = pdfPages[currentPage];
      canvasRef.current.width = pageCanvas.width;
      canvasRef.current.height = pageCanvas.height;
      ctx.drawImage(pageCanvas, 0, 0);
    }
  }, [pdfPages, currentPage]);

  const handleSign = async () => {
    if (!documentId) return;
    try {
      setSigning(true);
      const response = await api.signDocument(documentId);
      setHashes({ original: response.data.data.originalHash, signed: response.data.data.signedPdfHash });
      toast.success('Document signed successfully');
      await loadDocument(documentId);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to sign document');
    } finally {
      setSigning(false);
    }
  };

  const handleDecline = async () => {
    if (!documentId) return;
    try {
      await api.declineDocument(documentId);
      toast.success('Document declined');
      await loadDocument(documentId);
    } catch {
      toast.error('Failed to decline document');
    }
  };

  const handleRequestChanges = async () => {
    if (!documentId) return;
    try {
      await api.requestChanges(documentId);
      toast.success('Changes requested');
    } catch {
      toast.error('Failed to request changes');
    }
  };

  const handleDownload = async (type) => {
    if (!documentId || !doc) return;
    try {
      setDownloading(type);
      const response = type === 'signed' ? await api.downloadSigned(documentId) : await api.downloadOriginal(documentId);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', type === 'signed' ? `${doc.fileName}-signed.pdf` : doc.fileName);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      toast.success(`${type === 'signed' ? 'Signed' : 'Original'} PDF downloaded`);
    } catch {
      toast.error('Failed to download PDF');
    } finally {
      setDownloading(null);
    }
  };

  if (loading) {
    return (
      <AppShell active="sign" title="Document Sign" subtitle="Loading document…">
        <div className={styles.loadingBox}>Loading document…</div>
      </AppShell>
    );
  }

  if (!doc) {
    return (
      <AppShell active="sign" title="Document Sign">
        <div className={styles.notReady}>Document not found.</div>
      </AppShell>
    );
  }

  const readyToSign = Boolean(doc.signaturePlacements && doc.signaturePlacements.length > 0) && Boolean(doc.approved);
  const allSigned = doc.signers.length > 0 && doc.signers.every((s) => s.status === 'signed');

  return (
    <AppShell
      active="sign"
      title={doc.fileName}
      subtitle="Review terms carefully, inspect previous signatures, and digitally sign below."
    >
      <div className={styles.certBanner}>
        <span>🛡️ Digital Certificate Secured: SHA-256 (SignVault CA)</span>
        <span className={styles.certId}>ID: sv_cert_{doc.documentId.slice(0, 8)}</span>
      </div>

      <div className={styles.grid}>
        <div className={styles.docCard}>
          <div className={styles.docTopRow}>
            <span>PAGE {currentPage + 1} OF {pdfPages.length || 1}</span>
            <span>CONFIDENTIAL</span>
          </div>

          {pdfPages.length > 0 ? (
            <>
              <div className={styles.pdfCanvasWrap}>
                <canvas ref={canvasRef} />
              </div>
              {pdfPages.length > 1 && (
                <div className={styles.pagination}>
                  <button onClick={() => setCurrentPage((p) => Math.max(0, p - 1))} disabled={currentPage === 0}>
                    ← Previous
                  </button>
                  <span>Page {currentPage + 1} of {pdfPages.length}</span>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(pdfPages.length - 1, p + 1))}
                    disabled={currentPage === pdfPages.length - 1}
                  >
                    Next →
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className={styles.loadingBox}>{previewError || 'PDF preview unavailable.'}</div>
          )}
          {pdfPages.length > 0 && previewError && (
            <p className={styles.notReady} style={{ marginTop: 12 }}>
              {previewError}
            </p>
          )}

          {!readyToSign && (
            <div className={styles.notReady} style={{ marginTop: 16 }}>
              This document still needs a signature placed and review approval.{' '}
              <a onClick={() => router.push(`/preview/${doc.documentId}`)} style={{ cursor: 'pointer' }}>
                Go to Preview & Sign
              </a>
            </div>
          )}
        </div>

        <div className={styles.pipelineCard}>
          <h3>Signer Pipeline</h3>
          {doc.signers.length === 0 && (
            <p style={{ fontSize: 13, color: 'var(--sv-text-secondary)' }}>No signer pipeline configured for this document.</p>
          )}
          {doc.signers.map((signer) => {
            const meta = statusMeta[signer.status];
            return (
              <div key={`${signer.name}-${signer.order}`} className={styles.signerRow}>
                <span className={`${styles.signerIcon} ${meta.iconClass}`}>{meta.icon}</span>
                <div>
                  <div className={styles.signerName}>
                    {signer.name}
                    {signer.roleLabel ? ` (${signer.roleLabel})` : ''}
                  </div>
                  <div className={`${styles.signerStatus} ${meta.textClass}`}>
                    {signer.status === 'signed' && signer.signedAt
                      ? `Signed ${new Date(signer.signedAt).toLocaleString()}`
                      : meta.label}
                  </div>
                </div>
              </div>
            );
          })}

          <div className={styles.actions}>
            <button className={styles.btnPrimary} onClick={handleSign} disabled={!readyToSign || signing || allSigned}>
              {signing ? 'Signing…' : allSigned ? 'Fully Signed' : '✓ Sign Document'}
            </button>
            <div className={styles.btnRow}>
              <button className={styles.btnSecondary} onClick={handleRequestChanges}>
                Req. Changes
              </button>
              <button className={styles.btnDanger} onClick={handleDecline}>
                Decline
              </button>
            </div>
          </div>

          {hashes && (
            <div className={styles.hashesSection}>
              <h4>SHA-256 Hash Verification</h4>
              <div className={styles.hashRow}>
                <label>Original PDF Hash</label>
                <code>{hashes.original}</code>
              </div>
              <div className={styles.hashRow}>
                <label>Signed PDF Hash</label>
                <code>{hashes.signed}</code>
              </div>
            </div>
          )}

          {hasSignedCopy && (
            <div className={styles.hashesSection}>
              <h4>Download</h4>
              <div className={styles.btnRow}>
                <button
                  className={styles.btnSecondary}
                  onClick={() => handleDownload('original')}
                  disabled={downloading !== null}
                >
                  {downloading === 'original' ? 'Downloading…' : '⬇ Original'}
                </button>
                <button
                  className={styles.btnSecondary}
                  onClick={() => handleDownload('signed')}
                  disabled={downloading !== null}
                >
                  {downloading === 'signed' ? 'Downloading…' : '⬇ Signed'}
                </button>
              </div>
              <button
                className={styles.btnSecondary}
                style={{ width: '100%', marginTop: 10 }}
                onClick={() => router.push(`/download/${doc.documentId}`)}
              >
                Open Full Download Page →
              </button>
            </div>
          )}

          {allSigned && (
            <div className={styles.btnRow} style={{ marginTop: 14 }}>
              <button className={styles.btnSecondary} onClick={() => router.push(`/audit/${doc.documentId}`)}>
                View Audit Trail →
              </button>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
};

export default SignPage;
