import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import AppShell from '@/components/AppShell';
import styles from '@/styles/Dashboard.module.css';
import { api } from '@/lib/api';
import { DashboardStats, SignatureRecordDto } from '@/lib/types';

const formatDue = (dueDate?: string) => {
  if (!dueDate) return 'No due date';
  const diffMs = new Date(dueDate).getTime() - Date.now();
  if (diffMs <= 0) return 'Due now';
  const hours = Math.round(diffMs / 3_600_000);
  if (hours < 24) return `Due in ${hours} hour${hours === 1 ? '' : 's'}`;
  return `Due in ${Math.round(hours / 24)} day${Math.round(hours / 24) === 1 ? '' : 's'}`;
};

const formatSize = (bytes?: number) => {
  if (!bytes) return '';
  return bytes > 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
};

const Donut: React.FC<{ pending: number; signed: number; declined: number; total: number }> = ({
  pending,
  signed,
  declined,
  total,
}) => {
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

const DashboardPage: React.FC = () => {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getDashboardStats()
      .then((res) => setStats(res.data.data))
      .catch(() => toast.error('Failed to load dashboard stats'))
      .finally(() => setLoading(false));
  }, []);

  const alloc = stats?.statusAllocation || { pendingSignature: 0, fullySigned: 0, declined: 0 };

  return (
    <AppShell active="dashboard" title="Dashboard" subtitle="Review signature requests, pending tasks, and recent vault status.">
      <div className={styles.statsRow}>
        <div className={styles.card}>
          <div className={styles.statCard}>
            <div className={styles.statTop}>
              Awaiting Signature <span>✍️</span>
            </div>
            <div className={styles.statValue}>{stats?.awaitingSignatureCount ?? '—'}</div>
            <div className={styles.statFootGreen}>Documents needing your signature</div>
          </div>
        </div>
        <div className={styles.card}>
          <div className={styles.statCard}>
            <div className={styles.statTop}>
              Pending Approvals <span>⏱️</span>
            </div>
            <div className={styles.statValue}>{stats?.pendingApprovalsCount ?? '—'}</div>
            <div className={styles.statFoot}>Average turnaround: 4.2 hours</div>
          </div>
        </div>
        <div className={styles.card}>
          <div className={styles.statCard}>
            <div className={styles.statTop}>
              Recently Signed <span>✅</span>
            </div>
            <div className={styles.statValue}>{stats?.recentlySignedCount ?? '—'}</div>
            <div className={styles.statFootIndigo}>Across all vault documents</div>
          </div>
        </div>
        <div className={`${styles.card} ${styles.quickActions}`}>
          <h4>Quick Actions</h4>
          <button className={styles.btnPrimary} onClick={() => router.push('/upload')}>
            Upload New Document
          </button>
          <button className={styles.btnSecondary} onClick={() => router.push('/documents')}>
            Start Signing Workflow
          </button>
        </div>
      </div>

      <div className={styles.mainGrid}>
        <div>
          <div className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <h3>Awaiting Your Signature</h3>
              <a onClick={() => router.push('/documents')}>View All ({stats?.awaitingSignatureCount ?? 0})</a>
            </div>
            {loading && <p className={styles.empty}>Loading…</p>}
            {!loading && (stats?.awaitingSignature.length ?? 0) === 0 && (
              <p className={styles.empty}>Nothing waiting on a signature right now.</p>
            )}
            {stats?.awaitingSignature.map((doc: SignatureRecordDto) => (
              <div key={doc.documentId} className={styles.docRow}>
                <div className={styles.docInfo}>
                  <div className={styles.docIcon}>📄</div>
                  <div>
                    <div className={styles.docName}>{doc.fileName}</div>
                    <div className={styles.docMeta}>
                      {formatSize(doc.fileSize)} • Requested by {doc.requestedBy || 'SignVault'}
                    </div>
                  </div>
                </div>
                <div className={styles.docRight}>
                  <span className={styles.dueLabel}>{formatDue(doc.dueDate)}</span>
                  <button className={styles.btnSignNow} onClick={() => router.push(`/sign/${doc.documentId}`)}>
                    Sign Now
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <h3>Recently Completed</h3>
            </div>
            {!loading && (stats?.recentlyCompleted.length ?? 0) === 0 && (
              <p className={styles.empty}>No completed documents yet.</p>
            )}
            {stats?.recentlyCompleted.map((doc: SignatureRecordDto) => (
              <div key={doc.documentId} className={styles.docRow}>
                <div className={styles.docInfo}>
                  <div className={styles.docIcon}>✅</div>
                  <div>
                    <div className={styles.docName}>{doc.fileName}</div>
                    <div className={styles.docMeta}>
                      Signed {doc.signedAt ? new Date(doc.signedAt).toLocaleString() : ''}
                    </div>
                  </div>
                </div>
                <span className={styles.dueLabel} style={{ color: 'var(--sv-success)' }}>
                  {doc.signers.filter((s) => s.status === 'signed').length}/{doc.signers.length || 1} Signed
                </span>
              </div>
            ))}
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

          <div className={styles.sectionCard}>
            <div className={styles.dropzone}>
              <div style={{ fontSize: 22 }}>⬆️</div>
              <strong>Drag and drop document here</strong>
              PDF up to 25MB
              <div style={{ marginTop: 14 }}>
                <button className={styles.btnSecondary} onClick={() => router.push('/upload')}>
                  Select File from Computer
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
};

export default DashboardPage;
