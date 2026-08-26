import React from 'react';
import styles from './Badge.module.css';

export type BadgeTone = 'indigo' | 'green' | 'amber' | 'red' | 'gray';

const Badge: React.FC<{ tone: BadgeTone; withDot?: boolean; children: React.ReactNode }> = ({
  tone,
  withDot = false,
  children,
}) => (
  <span className={`${styles.badge} ${styles[tone]}`}>
    {withDot && <span className={styles.dot} />}
    {children}
  </span>
);

export const roleTone = (role: string): BadgeTone =>
  role === 'Administrator' ? 'indigo' : role === 'Manager' ? 'green' : role === 'Signer' ? 'amber' : 'gray';

export const statusTone = (status: string): BadgeTone =>
  status === 'active' || status === 'signed' || status === 'verified' ? 'green' : status === 'inactive' || status === 'declined' ? 'red' : 'amber';

export default Badge;
