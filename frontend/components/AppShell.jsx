import React, { useEffect, useState } from 'react';
import Sidebar from './Sidebar';
import styles from './AppShell.module.css';
import { getToken, useRequireAuth } from '@/lib/auth';

const AppShell = ({ active, title, subtitle, actions, children }) => {
  useRequireAuth();
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    if (getToken()) setAuthed(true);
  }, []);

  if (!authed) return null;

  return (
    <div className={styles.shell}>
      <Sidebar active={active} />
      <main className={styles.content}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <h1>{title}</h1>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <div className={styles.headerRight}>
            <span className={styles.vaultBadge}>
              <span className={styles.vaultDot} />
              Vault Node Active: US-EAST
            </span>
            {actions}
          </div>
        </div>
        {children}
      </main>
    </div>
  );
};

export default AppShell;
