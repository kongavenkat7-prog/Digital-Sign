import React from 'react';
import Sidebar from './Sidebar';
import styles from './AppShell.module.css';

interface AppShellProps {
  active: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

const AppShell: React.FC<AppShellProps> = ({ active, title, subtitle, actions, children }) => {
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
