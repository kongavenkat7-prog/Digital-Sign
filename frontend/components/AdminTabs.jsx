import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import styles from './AdminTabs.module.css';

const TABS = [
  { href: '/users', label: 'User Management' },
  { href: '/roles', label: 'Role Privileges' },
  { href: '/password-permissions', label: 'Password Permissions' },
  { href: '/integrations', label: 'Integrations' },
];

// Horizontal sub-navigation shown at the top of every Administration page —
// the sidebar itself only shows one "Administration" entry (see Sidebar.jsx).
const AdminTabs = () => {
  const router = useRouter();

  return (
    <div className={styles.tabs}>
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={`${styles.tab} ${router.pathname === tab.href ? styles.tabActive : ''}`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
};

export default AdminTabs;
