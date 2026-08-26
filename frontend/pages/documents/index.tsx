import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import AppShell from '@/components/AppShell';
import Badge, { statusTone } from '@/components/Badge';
import styles from '@/styles/Documents.module.css';
import { api } from '@/lib/api';
import { SignatureRecordDto } from '@/lib/types';

const DocumentsPage: React.FC = () => {
  const router = useRouter();
  const [documents, setDocuments] = useState<SignatureRecordDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .listDocuments()
      .then((res) => setDocuments(res.data.data))
      .catch(() => toast.error('Failed to load documents'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppShell active="sign" title="Document Sign" subtitle="Select a document to review, sign, or track through its signer pipeline.">
      <div className={styles.card}>
        {loading && <div className={styles.empty}>Loading documents…</div>}
        {!loading && documents.length === 0 && (
          <div className={styles.empty}>
            No documents yet. <a onClick={() => router.push('/upload')} style={{ color: 'var(--sv-primary)', fontWeight: 600, cursor: 'pointer' }}>Upload one</a> to get started.
          </div>
        )}
        {documents.map((doc) => (
          <div key={doc.documentId} className={styles.row}>
            <div className={styles.info}>
              <div className={styles.icon}>📄</div>
              <div>
                <div className={styles.name}>{doc.fileName}</div>
                <div className={styles.meta}>
                  {doc.signers.length > 0
                    ? `${doc.signers.filter((s) => s.status === 'signed').length}/${doc.signers.length} signed`
                    : 'No signer pipeline set'}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <Badge tone={statusTone(doc.status)} withDot>
                {doc.status.toUpperCase()}
              </Badge>
              <button className={styles.btnOpen} onClick={() => router.push(`/sign/${doc.documentId}`)}>
                Open
              </button>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
};

export default DocumentsPage;
