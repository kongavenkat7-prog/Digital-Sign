import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import AppShell from '@/components/AppShell';
import styles from '@/styles/Dashboard.module.css';
import { api } from '@/lib/api';

const Donut = ({ pending, signed, declined, total }) => {
  const r = 52;
  const c = 2 * Math.PI * r;
  const segs = [
    { value: pending, color: 'var(--sv-primary)' },
    { value: signed, color: 'var(--sv-success)' },
    { value: declined, color: 'var(--sv-danger)' },
  ];
  let offset = 0;

  return (
    <svg width="140" height="140" viewBox="0 0 140 140">
      <circle cx="70" cy="70" r={r} fill="none" stroke="var(--sv-border)" strokeWidth="16" />
      {segs.map((seg, i) => {
        const dash = (seg.value / 100) * c;
        const circle = (
          <circle
            key={i}
            cx="70"
            cy="70"
            r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth="16"
            strokeDasharray={`${dash} ${c - dash}`}
            strokeDashoffset={-offset}
            transform="rotate(-90 70 70)"
          />
        );
        offset += dash;
        return circle;
      })}
      <text x="70" y="66" textAnchor="middle" fontSize="20" fontWeight="700" fill="var(--sv-text)">
        {total}
      </text>
      <text x="70" y="84" textAnchor="middle" fontSize="10" fill="var(--sv-text-secondary)">
        Total Docs
      </text>
    </svg>
  );
};

const statusMeta = {
  draft: { label: 'DRAFT', tone: styles.badgeGray },
  sent: { label: 'SENT', tone: styles.badgeIndigo },
  inProgress: { label: 'IN PROGRESS', tone: styles.badgeAmber },
  completed: { label: 'COMPLETED', tone: styles.badgeGreen },
  declined: { label: 'DECLINED', tone: styles.badgeRed },
};

const deriveStatus = (doc) => {
  if (doc.status === 'declined') return statusMeta.declined;
  if (doc.status === 'signed' || doc.status === 'verified') return statusMeta.completed;
  if (doc.status === 'draft') return statusMeta.draft;
  const anySigned = (doc.signers || []).some((s) => s.status === 'signed');
  return anySigned ? statusMeta.inProgress : statusMeta.sent;
};

const purgeDateFor = (doc) => {
  if (doc.legalHold) return 'On legal hold';
  const days = doc.retentionDays ?? 90;
  const created = new Date(doc.createdAt);
  const purge = new Date(created.getTime() + days * 24 * 60 * 60 * 1000);
  return purge.toLocaleDateString();
};

const RetentionPanel = ({ doc, onClose, onSaved }) => {
  const [retentionDays, setRetentionDays] = useState(doc.retentionDays ?? 90);
  const [legalHold, setLegalHold] = useState(Boolean(doc.legalHold));
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const handleApply = async () => {
    try {
      setSaving(true);
      const res = await api.updateRetention(doc.documentId, { retentionDays, legalHold, reason });
      toast.success('Retention updated');
      onSaved(res.data.data);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to update retention');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.retentionPanel}>
      <div className={styles.retentionHeader}>
        <strong>Retention — {doc.title || doc.fileName}</strong>
        <button className={styles.linkBtn} onClick={onClose}>Close</button>
      </div>
      <p className={styles.retentionHint}>Document binary purges on {purgeDateFor(doc)}</p>

      <label className={styles.retentionLabel}>Override retention (days)</label>
      <input
        type="number"
        min={1}
        className={styles.retentionInput}
        value={retentionDays}
        onChange={(e) => setRetentionDays(Number(e.target.value))}
      />

      <div className={styles.retentionToggleRow}>
        <div>
          <div className={styles.retentionToggleLabel}>Legal hold</div>
          <div className={styles.retentionHint}>Suspends automatic purge.</div>
        </div>
        <button
          type="button"
          className={`${styles.toggle} ${legalHold ? styles.toggleOn : ''}`}
          onClick={() => setLegalHold((v) => !v)}
        >
          <span className={styles.toggleKnob} />
        </button>
      </div>

      <label className={styles.retentionLabel}>Reason (recorded in audit)</label>
      <input
        type="text"
        className={styles.retentionInput}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />

      <button className={styles.btnPrimary} style={{ width: '100%' }} disabled={saving} onClick={handleApply}>
        {saving ? 'Applying…' : '🛡️ Apply retention change'}
      </button>
    </div>
  );
};

const DashboardPage = () => {
  const router = useRouter();
  const [stats, setStats] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('queue');
  const [search, setSearch] = useState('');
  const [retentionDocId, setRetentionDocId] = useState(null);

  const load = () => {
    setLoading(true);
    Promise.all([api.getDashboardStats(), api.listDocuments({ limit: 200 })])
      .then(([statsRes, docsRes]) => {
        setStats(statsRes.data.data);
        setDocuments(docsRes.data.data);
      })
      .catch(() => toast.error('Failed to load dashboard'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const alloc = stats?.statusAllocation || { pendingSignature: 0, fullySigned: 0, declined: 0 };

  const awaitingCount = documents.filter((d) => d.status === 'pending').length;
  const createdCount = documents.length;
  const completedCount = documents.filter((d) => d.status === 'signed' || d.status === 'verified').length;

  const filtered = useMemo(() => {
    let list = documents;
    if (tab === 'queue') list = list.filter((d) => d.status === 'pending');
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (d) =>
          (d.title || d.fileName || '').toLowerCase().includes(q) ||
          (d.signers || []).some((s) => s.email.toLowerCase().includes(q) || s.name.toLowerCase().includes(q))
      );
    }
    return list;
  }, [documents, tab, search]);

  const retentionDoc = documents.find((d) => d.documentId === retentionDocId);

  return (
    <AppShell active="dashboard" title="Envelopes" subtitle="Rynovate" actions={
      <button className={styles.btnPrimary} onClick={() => router.push('/upload')}>+ New envelope</button>
    }>
      <div className={styles.tileRow}>
        <div className={styles.tile}>
          <div className={styles.tileLabel}>⏱ Awaiting me</div>
          <div className={styles.tileValue}>{loading ? '—' : awaitingCount}</div>
        </div>
        <div className={styles.tile}>
          <div className={styles.tileLabel}>📄 Created by me</div>
          <div className={styles.tileValue}>{loading ? '—' : createdCount}</div>
        </div>
        <div className={styles.tile}>
          <div className={styles.tileLabel}>🛡 Completed</div>
          <div className={styles.tileValue}>{loading ? '—' : completedCount}</div>
        </div>
      </div>

      <div className={styles.mainGrid}>
        <div>
          <div className={styles.toolbar}>
            <div className={styles.tabs}>
              <button className={`${styles.tab} ${tab === 'queue' ? styles.tabActive : ''}`} onClick={() => setTab('queue')}>
                Approval queue ({awaitingCount})
              </button>
              <button className={`${styles.tab} ${tab === 'mine' ? styles.tabActive : ''}`} onClick={() => setTab('mine')}>
                Created by me ({createdCount})
              </button>
              <button className={`${styles.tab} ${tab === 'all' ? styles.tabActive : ''}`} onClick={() => setTab('all')}>
                All visible ({createdCount})
              </button>
            </div>
            <input
              className={styles.searchInput}
              placeholder="Search title or recipient…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className={styles.tableCard}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>TITLE</th>
                  <th>STATUS</th>
                  <th>RECIPIENTS</th>
                  <th>PURGE AFTER</th>
                  <th>CREATED</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className={styles.empty}>No envelopes match this view.</td>
                  </tr>
                )}
                {filtered.map((doc) => {
                  const meta = deriveStatus(doc);
                  const signedCount = (doc.signers || []).filter((s) => s.status === 'signed').length;
                  return (
                    <React.Fragment key={doc.documentId}>
                      <tr>
                        <td className={styles.titleCell} onClick={() => router.push(`/audit/${doc.documentId}`)}>
                          {doc.title || doc.fileName}
                        </td>
                        <td><span className={`${styles.badge} ${meta.tone}`}>{meta.label}</span></td>
                        <td>{signedCount}/{doc.signers?.length || 0} signed</td>
                        <td>{purgeDateFor(doc)}</td>
                        <td>{new Date(doc.createdAt).toLocaleDateString()}</td>
                        <td>
                          <button
                            className={styles.linkBtn}
                            onClick={() => setRetentionDocId(retentionDocId === doc.documentId ? null : doc.documentId)}
                          >
                            Retention
                          </button>
                        </td>
                      </tr>
                      {retentionDocId === doc.documentId && (
                        <tr>
                          <td colSpan={6} style={{ padding: 0 }}>
                            <RetentionPanel
                              doc={doc}
                              onClose={() => setRetentionDocId(null)}
                              onSaved={(updated) => {
                                setDocuments((prev) => prev.map((d) => (d.documentId === updated.documentId ? updated : d)));
                                setRetentionDocId(null);
                              }}
                            />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <div className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <h3>Document Status Allocation</h3>
            </div>
            <div className={styles.donutWrap}>
              <Donut
                pending={alloc.pendingSignature}
                signed={alloc.fullySigned}
                declined={alloc.declined}
                total={stats?.totalDocuments ?? 0}
              />
              <div className={styles.legend}>
                <div className={styles.legendRow}>
                  <span className={styles.legendDot} style={{ background: 'var(--sv-primary)' }} />
                  Pending Signature ({alloc.pendingSignature}%)
                </div>
                <div className={styles.legendRow}>
                  <span className={styles.legendDot} style={{ background: 'var(--sv-success)' }} />
                  Fully Signed ({alloc.fullySigned}%)
                </div>
                <div className={styles.legendRow}>
                  <span className={styles.legendDot} style={{ background: 'var(--sv-danger)' }} />
                  Declined ({alloc.declined}%)
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
};

export default DashboardPage;
