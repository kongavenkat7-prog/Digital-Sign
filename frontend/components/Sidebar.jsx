import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import styles from './Sidebar.module.css';
import { api } from '@/lib/api';
import { clearToken } from '@/lib/auth';

const icons = {
  dashboard: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  ),
  sign: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  ),
  users: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="9" cy="8" r="3.2" />
      <path d="M2.5 20c1-3.6 3.6-5.5 6.5-5.5s5.5 1.9 6.5 5.5" />
      <circle cx="17" cy="8" r="2.6" />
      <path d="M15.5 14.7c2.4.3 4.2 1.9 5 4.8" />
    </svg>
  ),
  audit: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  ),
  roles: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c.8-3.4 3-5.2 6-5.2s5.2 1.8 6 5.2" />
      <rect x="15.5" y="10.5" width="6" height="5" rx="1" />
      <path d="M17 10.5v-1a1.5 1.5 0 0 1 3 0v1" />
    </svg>
  ),
};

const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', href: '/dashboard', icon: 'dashboard' },
  { key: 'sign', label: 'Document Sign', href: '/documents', icon: 'sign' },
  { key: 'users', label: 'User Management', href: '/users', icon: 'users' },
  { key: 'audit', label: 'Audit Logs', href: '/audit-logs', icon: 'audit' },
  { key: 'roles', label: 'Role Privileges', href: '/roles', icon: 'roles' },
];

const initials = (name) =>
  name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

const Sidebar = ({ active }) => {
  const router = useRouter();
  const [user, setUser] = useState({ name: 'Sarah Jenkins', title: 'Compliance Officer' });

  useEffect(() => {
    api
      .getCurrentUser()
      .then((res) => {
        const data = res.data?.data;
        if (data?.name) setUser({ name: data.name, title: data.title });
      })
      .catch(() => {
        // Keep the default fallback identity if the backend isn't reachable yet.
      });
  }, []);

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logoRow}>
        <div className={styles.logoIcon}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
            <rect x="4" y="10" width="16" height="10" rx="2" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
          </svg>
        </div>
        <div className={styles.logoText}>
          <h1>SignVault</h1>
          <span>ENTERPRISE SECURITY</span>
        </div>
      </div>

      <nav className={styles.nav}>
        {NAV_ITEMS.map((item) => {
          const isActive = active === item.key;
          return (
            <Link
              key={item.key}
              href={item.href}
              className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
            >
              <span className={styles.navIcon}>{icons[item.icon]}</span>
              <span className={styles.navLabel}>{item.label}</span>
              {isActive && <span className={styles.dot} />}
            </Link>
          );
        })}
      </nav>

      <div className={styles.footer}>
        <div className={styles.avatar}>{initials(user.name)}</div>
        <div className={styles.footerText}>
          <div className={styles.userName}>{user.name}</div>
          <div className={styles.userTitle}>{user.title}</div>
        </div>
        <button
          type="button"
          className={styles.signOut}
          title="Sign out"
          onClick={() => {
            clearToken();
            router.push('/login');
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <path d="M16 17l5-5-5-5" />
            <path d="M21 12H9" />
          </svg>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
