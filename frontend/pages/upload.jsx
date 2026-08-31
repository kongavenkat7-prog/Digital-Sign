import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { Rnd } from 'react-rnd';
import * as pdfjsLib from 'pdfjs-dist';
import toast from 'react-hot-toast';
import styles from '@/styles/Envelope.module.css';
import { api } from '@/lib/api';
import { useRequireAuth } from '@/lib/auth';
import AppShell from '@/components/AppShell';

if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
}

const ROLE_OPTIONS = ['Initiator', 'Reviewer', 'Approver'];
const IDENTITY_OPTIONS = [
  { value: 'email_otp', label: 'Email link + one-time passcode' },
  { value: 'account_password', label: 'Account login + password' },
];
const FIELD_TYPES = [
  { type: 'signature', label: 'Signature' },
  { type: 'initials', label: 'Initials' },
  { type: 'date', label: 'Date signed' },
  { type: 'text', label: 'Text' },
  { type: 'checkbox', label: 'Checkbox' },
];
const RECIPIENT_COLORS = ['#5865f2', '#16a34a', '#d97706', '#db2777', '#0891b2', '#7c3aed'];

let uid = 0;
const nextId = (prefix) => `${prefix}-${Date.now()}-${uid++}`;

const emptyRecipient = (order) => ({
  clientId: nextId('r'),
  name: '',
  email: '',
  roleLabel: 'Reviewer',
  order,
  identityVerification: 'email_otp',
  accessPassword: '',
});

const UploadPage = () => {
  useRequireAuth();
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // Step 1: Document
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileDataUrl, setFileDataUrl] = useState(null);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sequentialRouting, setSequentialRouting] = useState(true);

  // Step 2: Recipients
  const [recipients, setRecipients] = useState([emptyRecipient(0)]);

  // Step 3: Fields
  const [pdfPages, setPdfPages] = useState([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [fields, setFields] = useState([]);
  const [selectedFieldId, setSelectedFieldId] = useState(null);
  const [activeRecipientEmail, setActiveRecipientEmail] = useState('');
  const [activeFieldType, setActiveFieldType] = useState('signature');
  const canvasWrapRef = useRef(null);

  const handleFileSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file || file.type !== 'application/pdf') {
      toast.error('Please select a valid PDF file');
      return;
    }
    setSelectedFile(file);
    if (!title) setTitle(file.name.replace(/\.pdf$/i, ''));
    const reader = new FileReader();
    reader.onload = (e) => setFileDataUrl(e.target.result);
    reader.readAsDataURL(file);
  };

  const goToStep2 = () => {
    if (!selectedFile) {
      toast.error('Choose a PDF file first');
      return;
    }
    setStep(2);
  };

  const updateRecipient = (clientId, patch) => {
    setRecipients((prev) => prev.map((r) => (r.clientId === clientId ? { ...r, ...patch } : r)));
  };

  const addRecipient = () => {
    setRecipients((prev) => [...prev, emptyRecipient(prev.length)]);
  };

  const removeRecipient = (clientId) => {
    setRecipients((prev) => prev.filter((r) => r.clientId !== clientId));
  };

  // Live duplicate detection for the Recipients step — one recipient (by
  // email) can only appear once per envelope, flagged inline as soon as it
  // collides rather than only when the user clicks Continue.
  const duplicateEmailIds = new Set();
  {
    const byEmail = {};
    recipients.forEach((r) => {
      const email = r.email.trim().toLowerCase();
      if (email) (byEmail[email] ||= []).push(r.clientId);
    });
    Object.values(byEmail).forEach((ids) => ids.length > 1 && ids.forEach((id) => duplicateEmailIds.add(id)));
  }

  const goToStep3 = async () => {
    if (recipients.length === 0) {
      toast.error('Add at least one recipient');
      return;
    }
    if (recipients.some((r) => !r.name.trim() || !r.email.trim())) {
      toast.error('Every recipient needs a full legal name and email');
      return;
    }
    if (duplicateEmailIds.size > 0) {
      toast.error('Each recipient must have a distinct email.');
      return;
    }
    if (recipients.some((r) => r.identityVerification === 'account_password' && !r.accessPassword.trim())) {
      toast.error('Set an access password for every recipient using Account login + password');
      return;
    }

    setActiveRecipientEmail(recipients[0].email.trim().toLowerCase());

    if (pdfPages.length === 0 && fileDataUrl) {
      try {
        const base64 = fileDataUrl.split(',')[1];
        const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
        const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
        const pages = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 1.4 });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
          pages.push(canvas);
        }
        setPdfPages(pages);
      } catch (error) {
        console.error('Failed to render PDF for field placement:', error);
        toast.error('Failed to render PDF preview');
        return;
      }
    }
    setStep(3);
  };

  // The rendered PDF pages are plain <canvas> DOM nodes created once in
  // goToStep3 (not React elements) — they're moved imperatively into a
  // dedicated, React-untouched div so they never conflict with the Rnd
  // field overlays React renders as siblings in the same outer container.
  useEffect(() => {
    if (step === 3 && pdfPages.length > 0 && canvasWrapRef.current) {
      canvasWrapRef.current.innerHTML = '';
      canvasWrapRef.current.appendChild(pdfPages[currentPage]);
    }
  }, [step, pdfPages, currentPage]);

  const recipientColor = (email) => {
    const idx = recipients.findIndex((r) => r.email.trim().toLowerCase() === email);
    return RECIPIENT_COLORS[Math.max(idx, 0) % RECIPIENT_COLORS.length];
  };

  const addField = () => {
    if (!activeRecipientEmail) {
      toast.error('Pick a recipient first');
      return;
    }
    const sameTypeCount = fields.filter((f) => f.pageNumber === currentPage + 1).length;
    const offset = (sameTypeCount % 6) * 3;
    const defaults = {
      signature: { widthPct: 24, heightPct: 5.5, label: 'Signature' },
      initials: { widthPct: 10, heightPct: 4, label: 'Initials' },
      date: { widthPct: 14, heightPct: 3.5, label: 'Date signed' },
      text: { widthPct: 20, heightPct: 3.5, label: 'Text' },
      checkbox: { widthPct: 4, heightPct: 3, label: 'Checkbox' },
    }[activeFieldType];

    const newField = {
      fieldId: nextId('f'),
      type: activeFieldType,
      label: defaults.label,
      assignedToEmail: activeRecipientEmail,
      pageNumber: currentPage + 1,
      leftPct: 40 + offset,
      topPct: 40 + offset,
      widthPct: defaults.widthPct,
      heightPct: defaults.heightPct,
      required: true,
    };
    setFields((prev) => [...prev, newField]);
    setSelectedFieldId(newField.fieldId);
  };

  const updateField = (fieldId, patch) => {
    setFields((prev) => prev.map((f) => (f.fieldId === fieldId ? { ...f, ...patch } : f)));
  };

  const duplicateField = (field) => {
    const copy = { ...field, fieldId: nextId('f'), leftPct: Math.min(field.leftPct + 4, 90), topPct: Math.min(field.topPct + 4, 90) };
    setFields((prev) => [...prev, copy]);
    setSelectedFieldId(copy.fieldId);
  };

  const deleteField = (fieldId) => {
    setFields((prev) => prev.filter((f) => f.fieldId !== fieldId));
    if (selectedFieldId === fieldId) setSelectedFieldId(null);
  };

  const selectedField = fields.find((f) => f.fieldId === selectedFieldId);
  const pageFields = fields.filter((f) => f.pageNumber === currentPage + 1);
  const canvasSize = pdfPages[currentPage] ? { width: pdfPages[currentPage].width, height: pdfPages[currentPage].height } : null;

  const buildEnvelopePayload = (action) => ({
    fileName: selectedFile.name,
    fileData: fileDataUrl,
    title: title || selectedFile.name,
    messageToRecipients: message,
    sequentialRouting,
    recipients: recipients.map((r) => ({
      name: r.name.trim(),
      email: r.email.trim(),
      roleLabel: r.roleLabel,
      order: r.order,
      identityVerification: r.identityVerification,
      accessPassword: r.identityVerification === 'account_password' ? r.accessPassword : undefined,
    })),
    fields: fields.map((f) => ({
      fieldId: f.fieldId,
      type: f.type,
      label: f.label,
      assignedToEmail: f.assignedToEmail,
      pageNumber: f.pageNumber,
      leftPct: f.leftPct,
      topPct: f.topPct,
      widthPct: f.widthPct,
      heightPct: f.heightPct,
      required: f.required,
    })),
    action,
  });

  const handleSubmit = async (action) => {
    if (action === 'send' && fields.length === 0) {
      toast.error('Place at least one field before sending');
      return;
    }
    try {
      setSubmitting(true);
      const response = await api.createEnvelope(buildEnvelopePayload(action));
      toast.success(action === 'draft' ? 'Envelope saved as draft' : 'Envelope sent to recipients');
      router.push(`/documents`);
      void response;
    } catch (error) {
      console.error('Envelope creation failed:', error);
      toast.error(error.response?.data?.error || 'Failed to create envelope');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell active="sign" title="New envelope" subtitle={`Step ${step} of 3`}>
      <div className={styles.tabs}>
        <div className={`${styles.tab} ${step === 1 ? styles.tabActive : ''}`}>1. Document</div>
        <div className={`${styles.tab} ${step === 2 ? styles.tabActive : ''}`}>2. Recipients</div>
        <div className={`${styles.tab} ${step === 3 ? styles.tabActive : ''}`}>3. Fields</div>
      </div>

      {step === 1 && (
        <div className={styles.card}>
          <h2>Document and routing</h2>
          <p className={styles.hint}>The uploaded PDF is hashed on upload; the hash is recorded in the audit trail.</p>

          <label className={styles.label}>PDF document</label>
          <input type="file" accept=".pdf" id="fileInput" onChange={handleFileSelect} style={{ display: 'none' }} />
          <label htmlFor="fileInput" className={styles.fileDrop}>
            📄 {selectedFile ? selectedFile.name : 'Choose a PDF file'}
          </label>

          <label className={styles.label}>Envelope title</label>
          <input className={styles.input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Envelope title" />
          <p className={styles.hint}>Filled from the file name; edit if you need a different title.</p>

          <label className={styles.label}>Message to recipients</label>
          <textarea className={styles.textarea} value={message} onChange={(e) => setMessage(e.target.value)} />

          <div className={styles.toggleRow}>
            <div>
              <div className={styles.toggleLabel}>Sequential routing</div>
              <div className={styles.hint}>Each recipient signs only after the previous one.</div>
            </div>
            <button
              type="button"
              className={`${styles.toggle} ${sequentialRouting ? styles.toggleOn : ''}`}
              onClick={() => setSequentialRouting((v) => !v)}
            >
              <span className={styles.toggleKnob} />
            </button>
          </div>

          <button className={styles.btnPrimary} onClick={goToStep2}>Continue</button>
        </div>
      )}

      {step === 2 && (
        <div className={styles.card}>
          <h2>Recipients</h2>
          <p className={styles.hint}>Each recipient gets a unique emailed link and verifies with a one-time passcode before signing.</p>

          {recipients.map((r, idx) => (
            <div className={styles.recipientRow} key={r.clientId} style={{ borderLeftColor: RECIPIENT_COLORS[idx % RECIPIENT_COLORS.length] }}>
              <div className={styles.recipientGrid}>
                <div>
                  <label className={styles.label}>Full legal name</label>
                  <input className={styles.input} value={r.name} onChange={(e) => updateRecipient(r.clientId, { name: e.target.value })} />
                </div>
                <div>
                  <label className={styles.label}>Email</label>
                  <input
                    className={`${styles.input} ${duplicateEmailIds.has(r.clientId) ? styles.inputError : ''}`}
                    type="email"
                    value={r.email}
                    onChange={(e) => updateRecipient(r.clientId, { email: e.target.value })}
                  />
                  {duplicateEmailIds.has(r.clientId) && (
                    <p className={styles.fieldError}>This email is already used by another recipient — one user, one role.</p>
                  )}
                </div>
                <div>
                  <label className={styles.label}>Role</label>
                  <select
                    className={styles.input}
                    value={r.roleLabel}
                    onChange={(e) => updateRecipient(r.clientId, { roleLabel: e.target.value })}
                  >
                    {ROLE_OPTIONS.map((role) => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={styles.label}>Identity verification</label>
                  <select
                    className={styles.input}
                    value={r.identityVerification}
                    onChange={(e) => updateRecipient(r.clientId, { identityVerification: e.target.value })}
                  >
                    {IDENTITY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={styles.label}>Order</label>
                  <input
                    className={styles.input}
                    type="number"
                    min={0}
                    value={r.order}
                    onChange={(e) => updateRecipient(r.clientId, { order: Number(e.target.value) })}
                  />
                </div>
                {r.identityVerification === 'account_password' && (
                  <div>
                    <label className={styles.label}>Access password</label>
                    <input
                      className={styles.input}
                      type="text"
                      placeholder="Shared with the recipient out of band"
                      value={r.accessPassword}
                      onChange={(e) => updateRecipient(r.clientId, { accessPassword: e.target.value })}
                    />
                  </div>
                )}
              </div>
              {recipients.length > 1 && (
                <button type="button" className={styles.removeBtn} onClick={() => removeRecipient(r.clientId)}>
                  Remove
                </button>
              )}
            </div>
          ))}

          <button type="button" className={styles.btnSecondary} onClick={addRecipient}>+ Add recipient</button>

          <div className={styles.btnRow}>
            <button className={styles.btnGhost} onClick={() => setStep(1)}>Back</button>
            <button
              className={styles.btnPrimary}
              onClick={goToStep3}
              disabled={duplicateEmailIds.size > 0}
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className={styles.fieldsGrid}>
          <div className={styles.pdfPane}>
            <div className={styles.canvasOuter} style={canvasSize ? { width: canvasSize.width, height: canvasSize.height } : undefined}>
              <div ref={canvasWrapRef} className={styles.canvasInner} />
              {canvasSize &&
                pageFields.map((field) => (
                  <Rnd
                    key={field.fieldId}
                    bounds="parent"
                    size={{ width: (field.widthPct / 100) * canvasSize.width, height: (field.heightPct / 100) * canvasSize.height }}
                    position={{ x: (field.leftPct / 100) * canvasSize.width, y: (field.topPct / 100) * canvasSize.height }}
                    onDragStop={(e, d) => {
                      updateField(field.fieldId, {
                        leftPct: (d.x / canvasSize.width) * 100,
                        topPct: (d.y / canvasSize.height) * 100,
                      });
                    }}
                    onResizeStop={(e, dir, ref, delta, pos) => {
                      updateField(field.fieldId, {
                        widthPct: (ref.offsetWidth / canvasSize.width) * 100,
                        heightPct: (ref.offsetHeight / canvasSize.height) * 100,
                        leftPct: (pos.x / canvasSize.width) * 100,
                        topPct: (pos.y / canvasSize.height) * 100,
                      });
                    }}
                    onMouseDown={() => setSelectedFieldId(field.fieldId)}
                    style={{
                      border: `2px solid ${recipientColor(field.assignedToEmail)}`,
                      background: `${recipientColor(field.assignedToEmail)}22`,
                      borderRadius: 4,
                      zIndex: selectedFieldId === field.fieldId ? 5 : 2,
                    }}
                  >
                    <div className={styles.fieldTag} style={{ background: recipientColor(field.assignedToEmail) }}>
                      {field.label || field.type}
                    </div>
                  </Rnd>
                ))}
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
            {!selectedField ? (
              <>
                <h2>Place fields</h2>
                <p className={styles.hint}>Pick a recipient and a type, then add the field to the page — drag and resize it once placed.</p>

                <label className={styles.label}>Recipient</label>
                <select className={styles.input} value={activeRecipientEmail} onChange={(e) => setActiveRecipientEmail(e.target.value)}>
                  {recipients.map((r) => (
                    <option key={r.clientId} value={r.email.trim().toLowerCase()}>{r.name || r.email}</option>
                  ))}
                </select>

                <label className={styles.label} style={{ marginTop: 14 }}>Field type</label>
                <div className={styles.fieldTypeGrid}>
                  {FIELD_TYPES.map((ft) => (
                    <button
                      key={ft.type}
                      type="button"
                      className={`${styles.fieldTypeBtn} ${activeFieldType === ft.type ? styles.fieldTypeBtnActive : ''}`}
                      onClick={() => setActiveFieldType(ft.type)}
                    >
                      {ft.label}
                    </button>
                  ))}
                </div>

                <button type="button" className={styles.btnSecondary} style={{ marginTop: 14 }} onClick={addField}>
                  Add {FIELD_TYPES.find((f) => f.type === activeFieldType)?.label.toLowerCase()} field to this page
                </button>
              </>
            ) : (
              <>
                <label className={styles.label}>Label</label>
                <input className={styles.input} value={selectedField.label} onChange={(e) => updateField(selectedField.fieldId, { label: e.target.value })} />

                <label className={styles.label}>Assigned to</label>
                <select
                  className={styles.input}
                  value={selectedField.assignedToEmail}
                  onChange={(e) => updateField(selectedField.fieldId, { assignedToEmail: e.target.value })}
                >
                  {recipients.map((r) => (
                    <option key={r.clientId} value={r.email.trim().toLowerCase()}>{r.name || r.email}</option>
                  ))}
                </select>

                <div className={styles.recipientGrid} style={{ marginTop: 10 }}>
                  <div>
                    <label className={styles.label}>Left %</label>
                    <input className={styles.input} type="number" value={selectedField.leftPct.toFixed(1)} onChange={(e) => updateField(selectedField.fieldId, { leftPct: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label className={styles.label}>Top %</label>
                    <input className={styles.input} type="number" value={selectedField.topPct.toFixed(1)} onChange={(e) => updateField(selectedField.fieldId, { topPct: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label className={styles.label}>Width %</label>
                    <input className={styles.input} type="number" value={selectedField.widthPct.toFixed(1)} onChange={(e) => updateField(selectedField.fieldId, { widthPct: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label className={styles.label}>Height %</label>
                    <input className={styles.input} type="number" value={selectedField.heightPct.toFixed(1)} onChange={(e) => updateField(selectedField.fieldId, { heightPct: Number(e.target.value) })} />
                  </div>
                </div>

                <div className={styles.toggleRow} style={{ marginTop: 12 }}>
                  <div>
                    <div className={styles.toggleLabel}>Required</div>
                    <div className={styles.hint}>Signer cannot submit without completing it.</div>
                  </div>
                  <button
                    type="button"
                    className={`${styles.toggle} ${selectedField.required ? styles.toggleOn : ''}`}
                    onClick={() => updateField(selectedField.fieldId, { required: !selectedField.required })}
                  >
                    <span className={styles.toggleKnob} />
                  </button>
                </div>

                <div className={styles.btnRow}>
                  <button className={styles.btnGhost} onClick={() => duplicateField(selectedField)}>Duplicate</button>
                  <button className={styles.btnDanger} onClick={() => deleteField(selectedField.fieldId)}>Delete</button>
                </div>
                <button className={styles.btnGhost} style={{ marginTop: 8, width: '100%' }} onClick={() => setSelectedFieldId(null)}>
                  ← Back to field list
                </button>
              </>
            )}

            <button className={styles.btnPrimary} style={{ marginTop: 20 }} disabled={submitting} onClick={() => handleSubmit('send')}>
              {submitting ? 'Sending…' : 'Review and send'}
            </button>
            <button className={styles.btnSecondary} disabled={submitting} onClick={() => handleSubmit('draft')}>Save as draft</button>
            <button className={styles.btnGhost} onClick={() => setStep(2)}>Back</button>
          </div>
        </div>
      )}
    </AppShell>
  );
};

export default UploadPage;
