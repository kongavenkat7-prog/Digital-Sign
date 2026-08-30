import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import * as pdfjsLib from 'pdfjs-dist';
import toast from 'react-hot-toast';
import AppShell from '@/components/AppShell';
import Badge, { statusTone } from '@/components/Badge';
import styles from '@/styles/Audit.module.css';
import { api } from '@/lib/api';

if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
}

const ACTION_ICONS = {
  'Document Created': '📄',
  'Document Viewed': '👁️',
  'Signature Placed': '✍️',
  'Document Reviewed': '📝',
  'Document Signed': '✅',
  'Signed Copy Generated': '📑',
  'Audit Chain Verified': '🛡️',
  'Audit Completed': '🏁',
  'Document Downloaded': '⬇️',
  'Document Declined': '🚫',
  'Changes Requested': '✏️',
  'Signature Request Sent': '📨',
  'Signing Link Opened': '🔗',
  'OTP Sent': '🔐',
  'OTP Verified': '🔓',
  'Password Verified': '🔑',
  'Recipient Signed': '✅',
  'Envelope Completed': '🏁',
};

const AuditPage = () => {
  const router = useRouter();
  const { documentId } = router.query;
  const canvasRef = useRef(null);

  const [doc, setDoc] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pdfPages, setPdfPages] = useState([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [openEvents, setOpenEvents] = useState({});
  const [isVerified, setIsVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    if (!documentId) return;

    const fetchAll = async () => {
      try {
        setLoading(true);
        const [docRes, auditRes] = await Promise.all([api.getDocument(documentId), api.getAuditRecords(documentId)]);
        setDoc(docRes.data.data);
        setAuditLogs(auditRes.data.data.auditTrail || []);
      } catch (error) {
        console.error('Audit page load error:', error);
        toast.error('Failed to load audit trail');
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [documentId]);

  useEffect(() => {
    if (!documentId || !doc) return;
    (async () => {
      try {
        const hasSignedCopy = Boolean(doc.s3SignedKey);
        const response = hasSignedCopy ? await api.previewSignedDocument(documentId) : await api.previewDocument(documentId);
        const pdf = await pdfjsLib.getDocument({ data: response.data }).promise;
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
        setPdfPages(pages);
      } catch (error) {
        console.error('Audit page PDF preview failed:', error);
      }
    })();
  }, [documentId, doc]);

  useEffect(() => {
    if (pdfPages.length > 0 && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      const pageCanvas = pdfPages[currentPage];
      canvasRef.current.width = pageCanvas.width;
      canvasRef.current.height = pageCanvas.height;
      ctx.drawImage(pageCanvas, 0, 0);
    }
  }, [pdfPages, currentPage]);

  const toggleEvent = (id) => {
    setOpenEvents((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleVerifyAudit = async () => {
    if (!documentId) return;
    try {
      setVerifying(true);
      const response = await api.verifyAudit(documentId);
      setIsVerified(response.data.data.isValid);
      toast.success('Audit chain verified successfully');
    } catch (error) {
      console.error('Verify audit error:', error);
      toast.error('Failed to verify audit chain');
    } finally {
      setVerifying(false);
    }
  };

  const handleCompleteAudit = async () => {
    if (!documentId) return;
    try {
      setCompleting(true);
      await api.completeAudit(documentId);
      toast.success('Audit completed successfully');
      router.push(`/download/${documentId}`);
    } catch (error) {
      console.error('Complete audit error:', error);
      toast.error('Failed to complete audit');
    } finally {
      setCompleting(false);
    }
  };

  if (loading) {
    return (
      <AppShell active="audit" title="Audit Trail" subtitle="Loading document…">
        <div className={styles.loading}>Loading audit trail…</div>
      </AppShell>
    );
  }

  if (!doc) {
    return (
      <AppShell active="audit" title="Audit Trail">
        <div className={styles.loading}>Document not found.</div>
      </AppShell>
    );
  }

  const approvalPending = !doc.approved;
  const readyToComplete = isVerified && !approvalPending && doc.status === 'signed';

  return (
    <AppShell
      active="audit"
      title={doc.title || doc.fileName}
      subtitle="Inspect the document alongside its hash-chained audit history."
      actions={
        <Badge tone={statusTone(doc.status)} withDot>
          {doc.status}
        </Badge>
      }
    >
      {approvalPending && (
        <div className={styles.approvalBanner}>
          <span className={styles.approvalIcon}>⏳</span>
          <span>
            <strong>Approval Pending</strong> — the assigned reviewer hasn't approved this document yet. It can't be
            signed, its audit can't be completed, and it can't be downloaded until they do.
          </span>
        </div>
      )}
      <div className={styles.grid}>
        <div className={styles.docCard}>
          <div className={styles.docTopRow}>
            <span>
              PAGE {currentPage + 1} OF {pdfPages.length || 1}
            </span>
            <span>CONFIDENTIAL</span>
          </div>

          {pdfPages.length > 0 ? (
            <>
              <div className={styles.pdfCanvasWrap}>
                <canvas ref={canvasRef} />
              </div>
              {pdfPages.length > 1 && (
                <div className={styles.docPagination}>
                  <button onClick={() => setCurrentPage((p) => Math.max(0, p - 1))} disabled={currentPage === 0}>
                    ← Previous
                  </button>
                  <span>
                    Page {currentPage + 1} of {pdfPages.length}
                  </span>
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
            <div className={styles.loadingBox}>PDF preview unavailable.</div>
          )}
        </div>

        <div className={styles.sidePanel}>
          <div className={styles.accordionCard}>
            <h2>Audit Records ({auditLogs.length} events)</h2>
            {auditLogs.length === 0 ? (
              <div className={styles.emptyState}>No audit records found</div>
            ) : (
              <div className={styles.accordion}>
                {auditLogs.map((log, index) => {
                  const isOpen = Boolean(openEvents[log._id]);
                  const hasDetails = log.details && Object.keys(log.details).length > 0;
                  return (
                    <div key={log._id} className={styles.accordionItem}>
                      <button
                        type="button"
                        className={styles.accordionHeader}
                        onClick={() => hasDetails && toggleEvent(log._id)}
                        aria-expanded={isOpen}
                      >
                        <span className={styles.accordionNumber}>{ACTION_ICONS[log.action] || index + 1}</span>
                        <span className={styles.accordionTitle}>
                          <span className={styles.accordionAction}>{log.action}</span>
                          <span className={styles.accordionTimestamp}>
                            {log.userName ? `${log.userName} · ` : ''}
                            {new Date(log.timestamp).toLocaleString()}
                          </span>
                        </span>
                        {hasDetails && <span className={styles.accordionChevron}>{isOpen ? '▾' : '▸'}</span>}
                      </button>
                      {isOpen && hasDetails && (
                        <div className={styles.accordionBody}>
                          <pre>{JSON.stringify(log.details, null, 2)}</pre>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className={styles.finalizeCard}>
            <h2>Finalize</h2>

            <div className={styles.finalizeStep}>
              <div className={`${styles.finalizeStepNum} ${isVerified ? styles.finalizeStepDone : ''}`}>
                {isVerified ? '✓' : '1'}
              </div>
              <div className={styles.finalizeStepBody}>
                <div className={styles.finalizeStepTitle}>Verify audit chain</div>
                <p>Recompute and confirm the hash chain hasn't been tampered with.</p>
                <button onClick={handleVerifyAudit} disabled={verifying || isVerified} className={styles.btnPrimary}>
                  {isVerified ? 'Verified' : verifying ? 'Verifying…' : 'Verify Audit Chain'}
                </button>
              </div>
            </div>

            <div className={styles.finalizeStep}>
              <div className={`${styles.finalizeStepNum} ${readyToComplete ? styles.finalizeStepReady : ''}`}>2</div>
              <div className={styles.finalizeStepBody}>
                <div className={styles.finalizeStepTitle}>Complete audit</div>
                <p>
                  {approvalPending
                    ? 'Waiting on reviewer approval.'
                    : doc.status !== 'signed'
                    ? 'Waiting on all signatures.'
                    : !isVerified
                    ? 'Verify the chain above first.'
                    : 'All steps completed — ready to finalize.'}
                </p>
                <button onClick={handleCompleteAudit} disabled={completing || !readyToComplete} className={styles.btnSuccess}>
                  {completing
                    ? 'Completing…'
                    : approvalPending
                    ? 'Approval Pending'
                    : doc.status !== 'signed'
                    ? 'Awaiting Signatures'
                    : !isVerified
                    ? 'Verify Chain First'
                    : '✓ Complete Audit & Download'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
};

export default AuditPage;
