import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import AppShell from '@/components/AppShell';
import Badge from '@/components/Badge';
import styles from '@/styles/AuditLogsPage.module.css';
import { api } from '@/lib/api';
import { ACTION_TYPES } from '@/lib/constants';

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
  'User Added': '👤',
  'User Updated': '🔧',
  'Privilege Changed': '🛡️',
};

const AuditLogsPage = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionType, setActionType] = useState('All Activities');
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.listAuditLogs({
        actionType: actionType !== 'All Activities' ? actionType : undefined,
        search: search || undefined,
      });
      setLogs(res.data.data);
    } catch {
      toast.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionType, search]);

  const handleExportCsv = () => {
    const url = api.exportAuditLogsUrl({ actionType: actionType !== 'All Activities' ? actionType : undefined });
    window.open(url, '_blank');
  };

  return (
    <AppShell
      active="audit"
      title="Audit Trail & Verification Logs"
      subtitle="Chronological immutable cryptographic log of all administrative, viewing, and signature actions."
      actions={
        <>
          <button className={styles.field} onClick={handleExportCsv}>
            📤 Export CSV
          </button>
          <button className={styles.field} onClick={() => window.print()}>
            🖨️ Print PDF
          </button>
        </>
      }
    >
      <div className={styles.toolbar}>
        <input
          className={styles.field}
          style={{ flex: 1, minWidth: 220 }}
          placeholder="Search by user, document, or action..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className={styles.field} value={actionType} onChange={(e) => setActionType(e.target.value)}>
          {ACTION_TYPES.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </select>
      </div>

      <table className={styles.table}>
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>User</th>
            <th>Action Type</th>
            <th>Resource / Document</th>
            <th>IP Address</th>
            <th>Verification</th>
          </tr>
        </thead>
        <tbody>
          {!loading && logs.length === 0 && (
            <tr>
              <td colSpan={6} className={styles.empty}>
                No audit events match these filters.
              </td>
            </tr>
          )}
          {logs.map((log) => (
            <tr key={log._id}>
              <td className={styles.timestamp}>{new Date(log.timestamp).toLocaleString()}</td>
              <td>{log.userName}</td>
              <td>
                <span className={styles.actionCell}>
                  <span className={styles.actionIcon}>{ACTION_ICONS[log.action] || '•'}</span>
                  {log.action}
                </span>
              </td>
              <td className={styles.resource} title={log.documentName || log.documentId}>
                {log.documentName || log.documentId || '—'}
              </td>
              <td className={styles.ip}>{log.ipAddress || '—'}</td>
              <td>
                <Badge tone={log.hash ? 'green' : 'gray'} withDot>
                  {log.hash ? 'Verified' : 'Unverified'}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </AppShell>
  );
};

export default AuditLogsPage;
