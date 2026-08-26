import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import toast from 'react-hot-toast';
import styles from '@/styles/Audit.module.css';

interface AuditEvent {
  _id: string;
  action: string;
  timestamp: string;
  details: Record<string, any>;
}

const AuditPage: React.FC = () => {
  const router = useRouter();
  const { documentId } = router.query;
  const [auditLogs, setAuditLogs] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isVerified, setIsVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [completing, setCompleting] = useState(false);

  // Fetch audit records
  useEffect(() => {
    if (!documentId) return;

    const fetchAuditRecords = async () => {
      try {
        setLoading(true);
        const response = await axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}/api/documents/${documentId}/audit-records`
        );
        setAuditLogs(response.data.data.auditTrail || []);
      } catch (error) {
        console.error('Audit records fetch error:', error);
        toast.error('Failed to fetch audit records');
      } finally {
        setLoading(false);
      }
    };

    fetchAuditRecords();
  }, [documentId]);

  const handleVerifyAudit = async () => {
    try {
      setVerifying(true);
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/api/documents/${documentId}/verify-audit`
      );
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
    try {
      setCompleting(true);
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/api/documents/${documentId}/complete-audit`
      );
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
      <div className={styles.container}>
        <div className={styles.loading}>Loading audit trail...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.badge}>9-11</div>
        <h1>Audit Trail & Verification</h1>
      </div>

      <div className={styles.auditContainer}>
        <div className={styles.timeline}>
          <h2>Step 9: Audit Records ({auditLogs.length} events)</h2>
          {auditLogs.length === 0 ? (
            <div className={styles.emptyState}>No audit records found</div>
          ) : (
            <div className={styles.events}>
              {auditLogs.map((log, index) => (
                <div key={log._id} className={styles.event}>
                  <div className={styles.eventMarker}>
                    <span className={styles.eventNumber}>{index + 1}</span>
                  </div>
                  <div className={styles.eventContent}>
                    <h3>{log.action}</h3>
                    <p className={styles.timestamp}>
                      {new Date(log.timestamp).toLocaleString()}
                    </p>
                    {Object.keys(log.details).length > 0 && (
                      <details className={styles.details}>
                        <summary>View Details</summary>
                        <pre>{JSON.stringify(log.details, null, 2)}</pre>
                      </details>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={styles.verificationSection}>
          <h2>Step 10: Verify Audit Chain</h2>
          <div className={styles.verificationCard}>
            <p>Verify the integrity of the complete audit trail</p>
            <button
              onClick={handleVerifyAudit}
              disabled={verifying}
              className={styles.btnPrimary}
            >
              {verifying ? 'Verifying...' : '✓ Verify Audit Chain'}
            </button>
            {isVerified && (
              <div className={styles.verified}>
                <span className={styles.checkmark}>✓</span>
                <p>Audit chain verified successfully!</p>
              </div>
            )}
          </div>
        </div>

        <div className={styles.completionSection}>
          <h2>Step 11: Complete Audit</h2>
          <div className={styles.completionCard}>
            <p>All steps completed. Ready to finalize?</p>
            <button
              onClick={handleCompleteAudit}
              disabled={completing || !isVerified}
              className={styles.btnSuccess}
            >
              {completing ? 'Completing...' : '✓ Complete Audit & Download'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuditPage;
