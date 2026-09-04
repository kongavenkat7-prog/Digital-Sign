import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import * as pdfjsLib from 'pdfjs-dist';
import toast from 'react-hot-toast';
import styles from '@/styles/Signing.module.css';
import { api } from '@/lib/api';

if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
}

const STAGES = ['review', 'fields', 'authenticate', 'sign'];
const STAGE_LABELS = { review: 'Review', fields: 'Complete fields', authenticate: 'Authenticate', sign: 'Sign' };

// Reason options mirror the recipient's role assigned when the envelope was
// created (Initiator/Reviewer/Approver) so the recipient doesn't have to
// retype what their role already says — "Other" covers anything else.
const ROLE_REASON_LABELS = {
  Initiator: 'I am the Initiator of this document',
  Reviewer: 'I am the Reviewer of this document',
  Approver: 'I am the Approver / Signer of this document',
};

const formatTimestamp = (value) => `${new Date(value).toISOString().replace('T', ' ').slice(0, 19)} UTC`;

// Draw / Type / Upload composer for signature & initials fields — the same
// three creation methods as the legacy preview page's signature step.
const SignatureComposer = ({ onChange, fieldId }) => {
  const [tab, setTab] = useState('draw');
  const [typedText, setTypedText] = useState('');
  const [previewSrc, setPreviewSrc] = useState('');
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const drawing = useRef(false);

  useEffect(() => {
    if (tab !== 'draw' || !canvasRef.current) return;
    const canvas = canvasRef.current;
    canvas.width = canvas.offsetWidth;
    canvas.height = 120;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, [tab]);

  const emit = (dataUrl) => {
    setPreviewSrc(dataUrl);
    onChange(dataUrl);
  };

  const start = (e) => {
    drawing.current = true;
    const rect = canvasRef.current.getBoundingClientRect();
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };
  const move = (e) => {
    if (!drawing.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };
  const stop = () => {
    if (!drawing.current) return;
    drawing.current = false;
    emit(canvasRef.current.toDataURL());
  };
  const clearDraw = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    emit('');
  };

  const handleTypedChange = (value) => {
    setTypedText(value);
    if (!value.trim()) {
      emit('');
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 120;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#1a1a1a';
    ctx.font = 'italic 44px cursive';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(value, canvas.width / 2, canvas.height / 2);
    emit(canvas.toDataURL());
  };

  const handleUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => emit(ev.target.result);
    reader.readAsDataURL(file);
  };

  const switchTab = (next) => {
    setTab(next);
    setTypedText('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    emit('');
  };

  return (
    <div className={styles.composer}>
      <div className={styles.composerTabs}>
        <button type="button" className={`${styles.composerTab} ${tab === 'draw' ? styles.composerTabActive : ''}`} onClick={() => switchTab('draw')}>✏️ Draw</button>
        <button type="button" className={`${styles.composerTab} ${tab === 'type' ? styles.composerTabActive : ''}`} onClick={() => switchTab('type')}>📝 Type</button>
        <button type="button" className={`${styles.composerTab} ${tab === 'upload' ? styles.composerTabActive : ''}`} onClick={() => switchTab('upload')}>📤 Upload</button>
      </div>

      {tab === 'draw' && (
        <div>
          <canvas
            ref={canvasRef}
            className={styles.signaturePad}
            onMouseDown={start}
            onMouseMove={move}
            onMouseUp={stop}
            onMouseLeave={stop}
          />
          <button type="button" className={styles.linkBtn} onClick={clearDraw}>Clear</button>
        </div>
      )}

      {tab === 'type' && (
        <div>
          <input
            type="text"
            className={styles.input}
            placeholder="Type your name"
            value={typedText}
            onChange={(e) => handleTypedChange(e.target.value)}
          />
          {previewSrc && <img src={previewSrc} alt="Typed signature preview" className={styles.composerPreview} />}
        </div>
      )}

      {tab === 'upload' && (
        <div>
          <input ref={fileInputRef} type="file" accept="image/*" className={styles.input} onChange={handleUpload} id={`upload-${fieldId}`} />
          {previewSrc && <img src={previewSrc} alt="Uploaded signature preview" className={styles.composerPreview} />}
        </div>
      )}
    </div>
  );
};

const SigningPage = () => {
  const router = useRouter();
  const { token } = router.query;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [info, setInfo] = useState(null);
  const [stage, setStage] = useState('review');
  const [pdfPages, setPdfPages] = useState([]);
  const [currentPage, setCurrentPage] = useState(0);
  const canvasRef = useRef(null);

  const [values, setValues] = useState({});
  const [reasonRole, setReasonRole] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpVerified, setOtpVerified] = useState(false);
  const [resendInMs, setResendInMs] = useState(0);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [signResult, setSignResult] = useState(null);
  const [downloading, setDownloading] = useState(null);

  const [signedPdfPages, setSignedPdfPages] = useState([]);
  const [signedCurrentPage, setSignedCurrentPage] = useState(0);
  const [signedPreviewLoading, setSignedPreviewLoading] = useState(false);
  const signedCanvasRef = useRef(null);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        setLoading(true);
        const res = await api.resolveSigningToken(token);
        setInfo(res.data.data);
        setOtpVerified(Boolean(res.data.data.signer.otpVerified));
        const role = res.data.data.signer.roleLabel;
        setReasonRole(ROLE_REASON_LABELS[role] ? role : 'Other');
        toast.success('Identity confirmed');
      } catch (error) {
        setLoadError(error.response?.data?.error || 'This signing link is invalid or has expired');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  useEffect(() => {
    if (!token || !info) return;
    (async () => {
      try {
        const res = await api.previewSigningDocument(token);
        const pdf = await pdfjsLib.getDocument({ data: res.data }).promise;
        const pages = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 1.3 });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
          pages.push(canvas);
        }
        setPdfPages(pages);
      } catch (error) {
        console.error('Signing page PDF preview failed:', error);
      }
    })();
  }, [token, info]);

  useEffect(() => {
    if (pdfPages.length > 0 && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      const pageCanvas = pdfPages[currentPage];
      canvasRef.current.width = pageCanvas.width;
      canvasRef.current.height = pageCanvas.height;
      ctx.drawImage(pageCanvas, 0, 0);
    }
  }, [pdfPages, currentPage]);

  // Once signed, re-fetch the same preview endpoint — it now serves the
  // actual stamped PDF (s3SignedKey) instead of the in-progress original —
  // so the recipient can review exactly what they signed before downloading.
  useEffect(() => {
    if (stage !== 'signed' || !token || signedPdfPages.length > 0) return;
    (async () => {
      try {
        setSignedPreviewLoading(true);
        const res = await api.previewSigningDocument(token);
        const pdf = await pdfjsLib.getDocument({ data: res.data }).promise;
        const pages = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 1.3 });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
          pages.push(canvas);
        }
        setSignedPdfPages(pages);
      } catch (error) {
        console.error('Signed PDF preview failed to load:', error);
      } finally {
        setSignedPreviewLoading(false);
      }
    })();
  }, [stage, token, signedPdfPages.length]);

  useEffect(() => {
    if (signedPdfPages.length > 0 && signedCanvasRef.current) {
      const ctx = signedCanvasRef.current.getContext('2d');
      const pageCanvas = signedPdfPages[signedCurrentPage];
      signedCanvasRef.current.width = pageCanvas.width;
      signedCanvasRef.current.height = pageCanvas.height;
      ctx.drawImage(pageCanvas, 0, 0);
    }
  }, [signedPdfPages, signedCurrentPage]);

  useEffect(() => {
    if (resendInMs <= 0) return;
    const id = setInterval(() => setResendInMs((v) => Math.max(0, v - 1000)), 1000);
    return () => clearInterval(id);
  }, [resendInMs]);

  const reason = reasonRole === 'Other' ? customReason.trim() : ROLE_REASON_LABELS[reasonRole] || '';

  if (loading) return <div className={styles.centered}>Loading…</div>;
  if (loadError) return <div className={styles.centered}>{loadError}</div>;
  if (!info) return null;

  if (info.signer.status === 'signed' && !signResult) {
    return (
      <div className={styles.centered}>
        <div className={styles.doneCard}>
          <div className={styles.doneIcon}>✓</div>
          <h2>Already signed</h2>
          <p>You've already signed "{info.title}". No further action is needed.</p>
        </div>
      </div>
    );
  }

  if (!info.canActNow && !signResult) {
    return (
      <div className={styles.centered}>
        <div className={styles.doneCard}>
          <div className={styles.doneIcon}>⏳</div>
          <h2>Not your turn yet</h2>
          <p>"{info.title}" is waiting on an earlier recipient to sign first. You'll get a new email when it's your turn.</p>
        </div>
      </div>
    );
  }

  const requiredFields = info.fields.filter((f) => f.required);
  const allRequiredFilled = requiredFields.every((f) => (values[f.fieldId] ?? f.value) && String(values[f.fieldId] ?? f.value).length > 0);

  const setFieldValue = (fieldId, value) => setValues((prev) => ({ ...prev, [fieldId]: value }));

  const handleRequestOtp = async () => {
    try {
      setBusy(true);
      const res = await api.requestOtp(token);
      setOtpSent(true);
      setResendInMs(res.data.data?.resendInMs || 20000);
      toast.success('Passcode emailed to you');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to send passcode');
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyOtp = async () => {
    try {
      setBusy(true);
      await api.verifyOtp(token, otpCode);
      setOtpVerified(true);
      toast.success('Identity confirmed for this signature');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Incorrect or expired code');
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyPassword = async () => {
    try {
      setBusy(true);
      await api.verifyPassword(token, password);
      setOtpVerified(true);
      toast.success('Identity confirmed for this signature');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Incorrect password');
    } finally {
      setBusy(false);
    }
  };

  const handleSign = async () => {
    try {
      setBusy(true);
      const payload = Object.entries(values).map(([fieldId, value]) => ({ fieldId, value }));
      const res = await api.submitSignature(token, payload, reason);
      setSignResult(res.data.data);
      setStage('signed');
      toast.success('Signature recorded');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to sign document');
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = async (variant) => {
    try {
      setDownloading(variant);
      const res = await api.downloadSigningVariant(token, variant);
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const suffix = variant === 'with-audit' ? '-signed-with-audit.pdf' : variant === 'audit-pack' ? '-audit-pack.pdf' : '-signed.pdf';
      link.setAttribute('download', `${info.fileName.replace(/\.pdf$/i, '')}${suffix}`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Download not available yet');
    } finally {
      setDownloading(null);
    }
  };

  if (stage === 'signed' && signResult) {
    const signedSigField = info.fields.find((f) => f.type === 'signature' && values[f.fieldId]);
    const reviewReady = !signedPreviewLoading && signedPdfPages.length > 0;
    return (
      <div className={styles.page}>
        <div className={styles.topBar}>
          <div className={styles.brand}>
            <strong>SignVault</strong>
            <span>{info.requestedByOrg}</span>
          </div>
        </div>

        <div className={styles.grid}>
          <div className={styles.pdfCard}>
            <div className={styles.canvasWrap}>
              {signedPreviewLoading && <p className={styles.hint} style={{ padding: 24 }}>Loading your signed document…</p>}
              <canvas ref={signedCanvasRef} />
            </div>
            {signedPdfPages.length > 1 && (
              <div className={styles.pagination}>
                <button onClick={() => setSignedCurrentPage((p) => Math.max(0, p - 1))} disabled={signedCurrentPage === 0}>
                  Previous
                </button>
                <span>
                  Page {signedCurrentPage + 1} / {signedPdfPages.length}
                </span>
                <button
                  onClick={() => setSignedCurrentPage((p) => Math.min(signedPdfPages.length - 1, p + 1))}
                  disabled={signedCurrentPage === signedPdfPages.length - 1}
                >
                  Next
                </button>
              </div>
            )}
          </div>

          <div className={styles.sidePanel}>
            <h2>Review your signed document</h2>
            <p className={styles.hint}>
              Check that your signature and fields landed correctly before downloading. Your identity and the exact
              timestamp have been written to the tamper-evident audit trail.
            </p>

            {signedSigField && (
              <div className={styles.appearanceBox} style={{ textAlign: 'left' }}>
                <div className={styles.appearanceLabel}>Your signature</div>
                <img src={values[signedSigField.fieldId]} alt="Your signature" className={styles.appearanceImg} />
                <div className={styles.appearanceMeta}>
                  Digitally signed by {info.signer.name}
                  <br />
                  Date: {formatTimestamp(signResult.signedAt || Date.now())}
                  <br />
                  Signed hash: {signResult.signedPdfHash?.slice(0, 24)}…
                </div>
              </div>
            )}

            <div className={styles.appearanceBox} style={{ textAlign: 'left' }}>
              <div className={styles.appearanceLabel}>Reason for signing</div>
              <div className={styles.appearanceMeta}>{reason}</div>
            </div>

            <div className={styles.checklist}>
              <div className={reviewReady ? styles.checkDone : ''}>
                {reviewReady ? '✓' : '○'} Signed document loaded for review
              </div>
            </div>

            <button
              className={styles.btnPrimaryFull}
              style={{ marginTop: 12 }}
              disabled={!reviewReady}
              onClick={() => setStage('done')}
            >
              {reviewReady ? 'This is correct — Continue to Download →' : 'Loading your signed document…'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (stage === 'done' && signResult) {
    return (
      <div className={styles.centered}>
        <div className={styles.doneCard}>
          <div className={styles.doneIcon}>⬇</div>
          <h2>Download your document</h2>
          <p>
            Once every recipient has signed, the sealed PDF with its audit certificate page is generated.
          </p>

          <div className={styles.downloadsLabel}>DOWNLOADS</div>
          <button className={styles.btnPrimaryFull} disabled={downloading !== null} onClick={() => handleDownload('with-audit')}>
            {downloading === 'with-audit' ? 'Downloading…' : `Signed ${info.title} with audit page`}
          </button>
          <button className={styles.btnSecondaryFull} disabled={downloading !== null} onClick={() => handleDownload('without-audit')}>
            {downloading === 'without-audit' ? 'Downloading…' : `Signed ${info.title} without audit page`}
          </button>
          <button className={styles.btnSecondaryFull} disabled={downloading !== null} onClick={() => handleDownload('audit-pack')}>
            {downloading === 'audit-pack' ? 'Downloading…' : 'Download audit pack'}
          </button>
          <p className={styles.hint}>
            Both copies carry the flattened signatures, the envelope ID footer and the tamper-evident seal. Only the
            first copy has the audit certificate page attached (available once every recipient has signed).
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <div className={styles.brand}>
          <strong>SignVault</strong>
          <span>{info.requestedByOrg}</span>
        </div>
        <div className={styles.stepper}>
          {STAGES.map((s) => (
            <span key={s} className={`${styles.step} ${stage === s ? styles.stepActive : ''}`}>
              {STAGE_LABELS[s]}
            </span>
          ))}
        </div>
      </div>

      <div className={styles.grid}>
        <div className={styles.pdfCard}>
          <div className={styles.canvasWrap}>
            <canvas ref={canvasRef} />
          </div>
          {pdfPages.length > 1 && (
            <div className={styles.pagination}>
              <button onClick={() => setCurrentPage((p) => Math.max(0, p - 1))} disabled={currentPage === 0}>Previous</button>
              <span>Page {currentPage + 1} / {pdfPages.length}</span>
              <button onClick={() => setCurrentPage((p) => Math.min(pdfPages.length - 1, p + 1))} disabled={currentPage === pdfPages.length - 1}>Next</button>
            </div>
          )}
        </div>

        <div className={styles.sidePanel}>
          {stage === 'review' && (
            <>
              <h2>Review</h2>
              <p className={styles.hint}>Read through "{info.title}" before completing your fields.</p>
              <button className={styles.btnPrimaryFull} onClick={() => setStage('fields')}>Continue to fields →</button>
            </>
          )}

          {stage === 'fields' && (
            <>
              <h2>Complete fields</h2>
              {info.fields.length === 0 && <p className={styles.hint}>No fields were assigned to you on this document.</p>}
              {info.fields.map((field) => (
                <div key={field.fieldId} className={styles.fieldRow}>
                  <label className={styles.label}>
                    {field.label || field.type} {field.required && <span className={styles.required}>*</span>}
                  </label>
                  {(field.type === 'signature' || field.type === 'initials') && (
                    <SignatureComposer fieldId={field.fieldId} onChange={(dataUrl) => setFieldValue(field.fieldId, dataUrl)} />
                  )}
                  {field.type === 'date' && (
                    <input
                      type="date"
                      className={styles.input}
                      defaultValue={new Date().toISOString().slice(0, 10)}
                      onChange={(e) => setFieldValue(field.fieldId, e.target.value)}
                    />
                  )}
                  {field.type === 'text' && (
                    <input type="text" className={styles.input} onChange={(e) => setFieldValue(field.fieldId, e.target.value)} />
                  )}
                  {field.type === 'checkbox' && (
                    <label className={styles.checkboxRow}>
                      <input type="checkbox" onChange={(e) => setFieldValue(field.fieldId, e.target.checked ? 'true' : 'false')} />
                      <span>Confirm</span>
                    </label>
                  )}
                </div>
              ))}
              <div className={styles.btnRow}>
                <button className={styles.btnGhost} onClick={() => setStage('review')}>Back</button>
                <button
                  className={styles.btnPrimaryFull}
                  disabled={!allRequiredFilled}
                  onClick={() => setStage('authenticate')}
                >
                  Continue to authenticate →
                </button>
              </div>
            </>
          )}

          {stage === 'authenticate' && (
            <>
              <h2>Authenticate</h2>
              <label className={styles.label}>
                Reason <span className={styles.required}>*</span>
              </label>
              <select
                className={styles.input}
                value={reasonRole}
                onChange={(e) => setReasonRole(e.target.value)}
              >
                <option value="" disabled>
                  Select a reason…
                </option>
                {Object.entries(ROLE_REASON_LABELS).map(([role, label]) => (
                  <option key={role} value={role}>
                    {label}
                  </option>
                ))}
                <option value="Other">Other (please specify)</option>
              </select>
              {reasonRole === 'Other' && (
                <textarea
                  className={styles.textarea}
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="Why are you signing this document?"
                />
              )}
              {!reason.trim() && <p className={styles.fieldError}>A reason is required before you can sign.</p>}

              {info.signer.identityVerification === 'account_password' ? (
                <div className={styles.otpBox}>
                  <div className={styles.otpHeader}>
                    <strong>Account login</strong>
                    {otpVerified && <span className={styles.verifiedBadge}>✓ Verified</span>}
                  </div>
                  <p className={styles.hint}>
                    Sign in as {info.signer.email} with the access password shared with you for this envelope.
                  </p>
                  <input type="email" className={styles.input} value={info.signer.email} disabled />
                  <div className={styles.otpRow}>
                    <input
                      type="password"
                      className={styles.input}
                      style={{ marginBottom: 0 }}
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={otpVerified}
                    />
                    <button className={styles.btnSecondary} disabled={busy || otpVerified || !password} onClick={handleVerifyPassword}>
                      {otpVerified ? 'Verified' : 'Verify'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className={styles.otpBox}>
                  <div className={styles.otpHeader}>
                    <strong>One-time passcode</strong>
                    {otpVerified && <span className={styles.verifiedBadge}>✓ Verified</span>}
                  </div>
                  <p className={styles.hint}>
                    Sent to {info.signer.email}. This code is the second identification component before your signature is applied.
                  </p>
                  {!otpSent ? (
                    <button className={styles.btnSecondaryFull} disabled={busy} onClick={handleRequestOtp}>
                      Send passcode
                    </button>
                  ) : (
                    <div className={styles.otpRow}>
                      <input
                        className={styles.input}
                        style={{ marginBottom: 0 }}
                        placeholder="123456"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value)}
                        disabled={otpVerified}
                      />
                      <button className={styles.btnSecondary} disabled={busy || otpVerified || !otpCode} onClick={handleVerifyOtp}>
                        {otpVerified ? 'Verified' : 'Verify'}
                      </button>
                    </div>
                  )}
                  {otpSent && !otpVerified && (
                    <button className={styles.linkBtn} disabled={resendInMs > 0 || busy} onClick={handleRequestOtp}>
                      {resendInMs > 0 ? `Resend in ${Math.ceil(resendInMs / 1000)}s` : 'Resend code'}
                    </button>
                  )}
                </div>
              )}

              <div className={styles.btnRow}>
                <button className={styles.btnGhost} onClick={() => setStage('fields')}>Back</button>
                <button className={styles.btnPrimaryFull} disabled={!otpVerified || !reason.trim()} onClick={() => setStage('sign')}>
                  Continue to sign →
                </button>
              </div>
            </>
          )}

          {stage === 'sign' && (
            <>
              <h2>Sign</h2>
              <div className={styles.appearanceBox}>
                <div className={styles.appearanceLabel}>Signature appearance</div>
                {(() => {
                  const sigField = info.fields.find((f) => f.type === 'signature' && values[f.fieldId]);
                  return sigField ? <img src={values[sigField.fieldId]} alt="Signature" className={styles.appearanceImg} /> : null;
                })()}
                <div className={styles.appearanceMeta}>
                  Digitally signed by {info.signer.name}
                  <br />
                  Date: {formatTimestamp(Date.now())}
                  <br />
                  Signed via SignVault
                  <br />
                  Reason: {reason}
                </div>
              </div>

              <div className={styles.checklist}>
                <div className={allRequiredFilled ? styles.checkDone : ''}>
                  {allRequiredFilled ? '✓' : '○'} All required fields are complete
                </div>
                <div className={otpVerified ? styles.checkDone : ''}>
                  {otpVerified ? '✓' : '○'} Enter the emailed passcode and press Verify
                </div>
              </div>

              <p className={styles.hint}>
                By signing you confirm this electronic signature is the legally binding equivalent of your handwritten signature.
              </p>

              <button className={styles.btnPrimaryFull} disabled={busy || !otpVerified || !allRequiredFilled} onClick={handleSign}>
                {busy ? 'Signing…' : 'Sign document'}
              </button>
              <button className={styles.btnGhost} onClick={() => setStage('authenticate')}>Back</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SigningPage;
