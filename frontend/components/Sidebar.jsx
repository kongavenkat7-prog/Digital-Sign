import React, { useEffect, useRef, useState } from 'react';
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
  admin: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c.8-3.4 3-5.2 6-5.2s5.2 1.8 6 5.2" />
      <rect x="15.5" y="10.5" width="6" height="5" rx="1" />
      <path d="M17 10.5v-1a1.5 1.5 0 0 1 3 0v1" />
    </svg>
  ),
};

// Consolidated per the sidebar sketch: User Management, Role Privileges,
// Password Permissions, and Settings live under one "Administration" section
// (see components/AdminTabs.jsx for its sub-navigation) instead of being
// separate top-level items.
const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', href: '/dashboard', icon: 'dashboard' },
  { key: 'sign', label: 'Document Sign', href: '/documents', icon: 'sign' },
  { key: 'admin', label: 'Administration', href: '/users', icon: 'admin' },
  { key: 'audit', label: 'Audit Logs', href: '/audit-logs', icon: 'audit' },
];

const initials = (name) =>
  name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const Sidebar = ({ active }) => {
  const router = useRouter();
  const [user, setUser] = useState({ name: 'Sarah Jenkins', title: 'Compliance Officer', avatarDataUrl: '' });
  const [branding, setBranding] = useState({ companyName: 'Rynovate', logoDataUrl: '' });
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    api
      .getCurrentUser()
      .then((res) => {
        const data = res.data?.data;
        if (data?.name) setUser({ name: data.name, title: data.title, avatarDataUrl: data.avatarDataUrl || '' });
      })
      .catch(() => {
        // Keep the default fallback identity if the backend isn't reachable yet.
      });

    api
      .getBranding()
      .then((res) => {
        const data = res.data?.data;
        if (data) setBranding({ companyName: data.companyName || 'Rynovate', logoDataUrl: data.logoDataUrl || '' });
      })
      .catch(() => {
        // Keep the default "Rynovate" branding if settings aren't reachable yet.
      });
  }, []);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [menuOpen]);

  const openEditProfile = () => {
    setEditName(user.name);
    setEditAvatar(user.avatarDataUrl || '');
    setEditOpen(true);
    setMenuOpen(false);
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEditAvatar(await fileToDataUrl(file));
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) return;
    try {
      setSavingProfile(true);
      const res = await api.updateCurrentUser({ name: editName.trim(), avatarDataUrl: editAvatar });
      const data = res.data?.data;
      setUser({ name: data.name, title: data.title, avatarDataUrl: data.avatarDataUrl || '' });
      setEditOpen(false);
    } catch {
      // Keep the modal open so the admin can retry.
    } finally {
      setSavingProfile(false);
    }
  };

  const handleLogout = () => {
    setMenuOpen(false);
    clearToken();
    router.push('/login');
  };

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logoRow}>
        <div className={styles.orgBadge}>
          {branding.logoDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={branding.logoDataUrl}
              alt={branding.companyName}
              style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 9 }}
            />
          ) : (
            (branding.companyName || 'R')[0]
          )}
        </div>
        <div className={styles.logoText}>
          <h1 className={styles.orgTitle}>{branding.companyName}</h1>
          <span className={styles.productName}>SignVault</span>
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

      <div className={styles.footer} ref={menuRef}>
        <div className={styles.avatar}>
          {user.avatarDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatarDataUrl}
              alt={user.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
            />
          ) : (
            initials(user.name)
          )}
        </div>
        <div className={styles.footerText}>
          <div className={styles.userName}>{user.name}</div>
          <div className={styles.userTitle}>{user.title}</div>
          <div className={styles.userOrg}>{branding.companyName}</div>
        </div>
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            className={styles.signOut}
            title="More"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="5" r="1.8" />
              <circle cx="12" cy="12" r="1.8" />
              <circle cx="12" cy="19" r="1.8" />
            </svg>
          </button>
          {menuOpen && (
            <div className={styles.footerMenu}>
              <button type="button" className={styles.footerMenuItem} onClick={openEditProfile}>
                Update name & logo
              </button>
              <button type="button" className={`${styles.footerMenuItem} ${styles.footerMenuDanger}`} onClick={handleLogout}>
                Log out
              </button>
            </div>
          )}
        </div>
      </div>

      {editOpen && (
        <div className={styles.modalOverlay} onClick={() => setEditOpen(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>Update profile</h2>

            <div className={styles.modalAvatarRow}>
              <div className={styles.avatarLarge}>
                {editAvatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={editAvatar} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                ) : (
                  initials(editName || user.name)
                )}
              </div>
              <label className={styles.uploadLabel}>
                Upload photo
                <input type="file" accept="image/*" hidden onChange={handleAvatarChange} />
              </label>
            </div>

            <label className={styles.modalLabel}>Display name</label>
            <input
              type="text"
              className={styles.modalInput}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
            />

            <div className={styles.modalActions}>
              <button type="button" className={styles.modalCancel} onClick={() => setEditOpen(false)}>
                Cancel
              </button>
              <button type="button" className={styles.modalSave} disabled={savingProfile} onClick={handleSaveProfile}>
                {savingProfile ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
