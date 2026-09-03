import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import AppShell from '@/components/AppShell';
import styles from '@/styles/AuditLogsPage.module.css';
import { api } from '@/lib/api';
import { ACTION_TYPES } from '@/lib/constants';

const CATEGORIES = {
  'All Categories': null,
  Document: ['Document Created', 'Document Viewed', 'Document Downloaded', 'Document Declined', 'Changes Requested'],
  Signature: [
    'Signature Placed',
    'Signature Request Sent',
    'Signing Link Opened',
    'Recipient Signed',
    'Document Signed',
    'Signed Copy Generated',
  ],
  'Review & Approval': ['Document Reviewed', 'Envelope Completed'],
  'Security & Identity': [
    'OTP Sent',
    'OTP Verified',
    'Password Verified',
    'Audit Chain Verified',
    'Audit Completed',
    'Retention Updated',
  ],
  'User Management': ['User Added', 'User Updated', 'Privilege Changed'],
};

const AuditLogsPage = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All Categories');
  const [actionType, setActionType] = useState('All Activities');
  const [actor, setActor] = useState('All Actors');
  const [documentId, setDocumentId] = useState('All Envelopes');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const [actors, setActors] = useState([]);
  const [envelopes, setEnvelopes] = useState([]);

  useEffect(() => {
    api
      .getAuditLogFilters()
      .then((res) => {
        setActors(res.data.data.actors || []);
        setEnvelopes(res.data.data.envelopes || []);
      })
      .catch(() => {
        // Filter dropdowns just stay empty if this fails — search/date filters still work.
      });
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.listAuditLogs({
        search: search || undefined,
        actionType: actionType !== 'All Activities' ? actionType : undefined,
        actor: actor !== 'All Actors' ? actor : undefined,
        documentId: documentId !== 'All Envelopes' ? documentId : undefined,
        from: from || undefined,
        to: to || undefined,
      });
      const categoryEvents = CATEGORIES[category];
      const rows = categoryEvents ? res.data.data.filter((log) => categoryEvents.includes(log.action)) : res.data.data;
      setLogs(rows);
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
  }, [category, actionType, actor, documentId, from, to, search]);

  const handleExportAuditPack = async () => {
    try {
      setExporting(true);
      const res = await api.exportAuditLogs({
        actionType: actionType !== 'All Activities' ? actionType : undefined,
        actor: actor !== 'All Actors' ? actor : undefined,
        documentId: documentId !== 'All Envelopes' ? documentId : undefined,
        from: from || undefined,
        to: to || undefined,
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'signvault-audit-logs.csv');
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Audit pack exported');
    } catch {
      toast.error('Failed to export audit pack');
    } finally {
      setExporting(false);
    }
  };

  const handleVerifyChain = async () => {
    try {
      setVerifying(true);
      const res = await api.verifyAuditChainIntegrity();
      const { intact, totalRecords, brokenRecords } = res.data.data;
      if (intact) {
        toast.success(`Chain intact — ${totalRecords} record(s) verified.`);
      } else {
        toast.error(`Chain integrity failure in ${brokenRecords.length} record(s). Investigate immediately.`);
      }
    } catch {
      toast.error('Failed to verify chain integrity');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <AppShell
      active="audit"
      title="Audit trail"
      subtitle="Chronological, tamper-evident log of every administrative, viewing, and signature action."
      actions={
        <>
          <button className={styles.btnPrimary} disabled={exporting} onClick={handleExportAuditPack}>
            {exporting ? 'Exporting…' : 'Export audit pack'}
          </button>
          <button className={styles.field} disabled={verifying} onClick={handleVerifyChain}>
            {verifying ? 'Verifying…' : 'Verify chain integrity'}
          </button>
        </>
      }
    >
      <div className={styles.toolbar}>
        <input
          className={styles.field}
          style={{ flex: '1 1 220px', minWidth: 220 }}
          placeholder="Search by user, document, or action..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className={styles.field} value={category} onChange={(e) => setCategory(e.target.value)}>
          {Object.keys(CATEGORIES).map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select className={styles.field} value={actionType} onChange={(e) => setActionType(e.target.value)}>
          {ACTION_TYPES.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </select>
        <select className={styles.field} value={actor} onChange={(e) => setActor(e.target.value)}>
          <option>All Actors</option>
          {actors.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </select>
        <select className={styles.field} value={documentId} onChange={(e) => setDocumentId(e.target.value)}>
          <option>All Envelopes</option>
          {envelopes.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
        <input
          type="date"
          className={styles.field}
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          title="From"
        />
        <input type="date" className={styles.field} value={to} onChange={(e) => setTo(e.target.value)} title="To" />
      </div>

      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>#</th>
              <th>WHEN (UTC)</th>
              <th>WHAT HAPPENED</th>
              <th>WHO</th>
              <th>SOURCE IP</th>
              <th>CHAIN HASH</th>
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
            {logs.map((log, index) => (
              <tr key={log._id}>
                <td>{index + 1}</td>
                <td className={styles.timestamp}>
                  {new Date(log.timestamp).toISOString().replace('T', ' ').slice(0, 19)}
                </td>
                <td>{log.action}</td>
                <td>{log.userName}</td>
                <td className={styles.ip}>{log.ipAddress || '—'}</td>
                <td className={styles.mono}>{log.hash || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
};

export default AuditLogsPage;
