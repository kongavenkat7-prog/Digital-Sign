import React from 'react';
import styles from './Badge.module.css';

const Badge = ({ tone, withDot = false, children }) => (
  <span className={`${styles.badge} ${styles[tone]}`}>
    {withDot && <span className={styles.dot} />}
    {children}
  </span>
);

export const roleTone = (role) =>
  role === 'Administrator' ? 'indigo' : role === 'Manager' ? 'green' : role === 'Lead' ? 'amber' : 'gray';

export const statusTone = (status) =>
  status === 'active' || status === 'signed' || status === 'verified' ? 'green' : status === 'inactive' || status === 'declined' ? 'red' : 'amber';

export default Badge;
