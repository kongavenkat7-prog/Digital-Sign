import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import toast from 'react-hot-toast';
import styles from '@/styles/Sign.module.css';

interface SigningStep {
  step: number;
  label: string;
  completed: boolean;
}

const SignPage: React.FC = () => {
  const router = useRouter();
  const { documentId } = router.query;
  const [signingSteps, setSigningSteps] = useState<SigningStep[]>([
    { step: 6, label: 'PDF Signed', completed: false },
    { step: 7, label: 'Signed PDF Generated', completed: false },
    { step: 8, label: 'SHA-256 Calculated', completed: false },
  ]);
  const [signing, setSigning] = useState(false);
  const [hashes, setHashes] = useState({ original: '', signed: '' });

  const handleSign = async () => {
    try {
      setSigning(true);

      // Step 6, 7, 8: Sign PDF
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/api/signatures/${documentId}/sign`
      );

      // Update steps as completed
      setSigningSteps((prev) =>
        prev.map((s) => ({ ...s, completed: true }))
      );

      setHashes({
        original: response.data.data.originalHash,
        signed: response.data.data.signedPdfHash,
      });

      toast.success('PDF signed successfully');

      // Proceed to audit
      setTimeout(() => {
        router.push(`/audit/${documentId}`);
      }, 1500);
    } catch (error) {
      console.error('Signing error:', error);
      toast.error('Failed to sign PDF');
    } finally {
      setSigning(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.badge}>6-8</div>
        <h1>Signing in Progress</h1>
      </div>

      <div className={styles.stepsContainer}>
        {signingSteps.map((step) => (
          <div
            key={step.step}
            className={`${styles.step} ${step.completed ? styles.completed : ''}`}
          >
            <div className={styles.stepIndicator}>
              {step.completed ? '✓' : step.step}
            </div>
            <div className={styles.stepLabel}>{step.label}</div>
          </div>
        ))}
      </div>

      {signingSteps[0].completed && (
        <div className={styles.hashesSection}>
          <h2>SHA-256 Hash Verification</h2>
          <div className={styles.hashPair}>
            <div className={styles.hash}>
              <label>Original PDF Hash</label>
              <code>{hashes.original}</code>
            </div>
            <div className={styles.hash}>
              <label>Signed PDF Hash</label>
              <code>{hashes.signed}</code>
            </div>
          </div>
        </div>
      )}

      {!signingSteps[0].completed && (
        <div className={styles.actionSection}>
          <button
            onClick={handleSign}
            disabled={signing}
            className={styles.btnPrimary}
          >
            {signing ? 'Signing...' : '✓ Sign PDF'}
          </button>
        </div>
      )}
    </div>
  );
};

export default SignPage;
