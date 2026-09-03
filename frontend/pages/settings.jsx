import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import AppShell from '@/components/AppShell';
import AdminTabs from '@/components/AdminTabs';
import styles from '@/styles/Settings.module.css';
import { api } from '@/lib/api';
import { useRequireAuth } from '@/lib/auth';

const TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
];

const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const SettingsPage = () => {
  useRequireAuth();
  const fileInputRef = useRef(null);

  const [branding, setBranding] = useState(null);
  const [savingBranding, setSavingBranding] = useState(false);

  const [retention, setRetention] = useState(null);
  const [savingRetention, setSavingRetention] = useState(false);

  useEffect(() => {
    api
      .getBranding()
      .then((res) => setBranding(res.data.data))
      .catch(() => toast.error('Failed to load branding'));

    api
      .getRetentionSecurity()
      .then((res) => setRetention(res.data.data))
      .catch(() => toast.error('Failed to load retention & security policy'));
  }, []);

  const handleLogoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    setBranding((prev) => ({ ...prev, logoDataUrl: dataUrl }));
  };

  const handleSaveBranding = async () => {
    try {
      setSavingBranding(true);
      const res = await api.updateBranding({
        companyName: branding.companyName,
        logoDataUrl: branding.logoDataUrl,
      });
      setBranding(res.data.data);
      toast.success('Branding updated');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to save branding');
    } finally {
      setSavingBranding(false);
    }
  };

  const handleSaveRetention = async () => {
    try {
      setSavingRetention(true);
      const res = await api.updateRetentionSecurity(retention);
      setRetention(res.data.data);
      toast.success('Retention & security policy updated');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to save policy');
    } finally {
      setSavingRetention(false);
    }
  };

  if (!branding || !retention) {
    return (
      <AppShell active="admin" title="Settings">
        <AdminTabs />
        <p>Loading…</p>
      </AppShell>
    );
  }

  return (
    <AppShell
      active="admin"
      title="Settings"
      subtitle="Company branding and workspace retention & security policy."
    >
      <AdminTabs />

      <div className={styles.card}>
        <h2>Company branding</h2>
        <p className={styles.hint}>Shown in the sidebar and on signing pages recipients see.</p>

        <div className={styles.row} style={{ alignItems: 'center' }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 10,
              background: 'var(--sv-primary-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              overflow: 'hidden',
            }}
          >
            {branding.logoDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={branding.logoDataUrl} alt="Company logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ fontWeight: 800, fontSize: 20, color: 'var(--sv-primary-dark)' }}>
                {(branding.companyName || 'R')[0]}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button type="button" className={styles.btnPrimary} onClick={() => fileInputRef.current?.click()}>
              Upload logo
            </button>
            {branding.logoDataUrl && (
              <button
                type="button"
                className={styles.btnDanger}
                onClick={() => setBranding((prev) => ({ ...prev, logoDataUrl: '' }))}
              >
                Remove logo
              </button>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleLogoChange} />
          </div>
        </div>

        <div className={styles.row} style={{ alignItems: 'center' }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--sv-text)', flex: '0 0 140px' }}>
            Company name
          </label>
          <input
            type="text"
            className={styles.input}
            value={branding.companyName}
            onChange={(e) => setBranding((prev) => ({ ...prev, companyName: e.target.value }))}
          />
        </div>

        <button className={styles.btnPrimary} disabled={savingBranding} onClick={handleSaveBranding}>
          {savingBranding ? 'Saving…' : 'Save branding'}
        </button>
      </div>

      <div className={styles.card}>
        <h2>Retention & security policy</h2>
        <p className={styles.hint}>Workspace-wide defaults for document retention, session timeouts, and login attempts.</p>

        <div className={styles.row} style={{ alignItems: 'center' }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--sv-text)', flex: '0 0 200px' }}>
            Workspace timezone
          </label>
          <select
            className={styles.input}
            value={retention.workspaceTimezone}
            onChange={(e) => setRetention((prev) => ({ ...prev, workspaceTimezone: e.target.value }))}
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.row} style={{ alignItems: 'center' }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--sv-text)', flex: '0 0 200px' }}>
            Document retention (days)
          </label>
          <input
            type="number"
            min={1}
            className={styles.input}
            style={{ flex: '0 0 140px' }}
            value={retention.documentRetentionDays}
            onChange={(e) => setRetention((prev) => ({ ...prev, documentRetentionDays: Number(e.target.value) }))}
          />
        </div>

        <div className={styles.row} style={{ alignItems: 'center' }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--sv-text)', flex: '0 0 200px' }}>
            Signing session timeout (minutes)
          </label>
          <input
            type="number"
            min={1}
            className={styles.input}
            style={{ flex: '0 0 140px' }}
            value={retention.signingSessionTimeoutMinutes}
            onChange={(e) =>
              setRetention((prev) => ({ ...prev, signingSessionTimeoutMinutes: Number(e.target.value) }))
            }
          />
        </div>

        <div className={styles.row} style={{ alignItems: 'center' }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--sv-text)', flex: '0 0 200px' }}>
            Max failed authentication attempts
          </label>
          <input
            type="number"
            min={1}
            className={styles.input}
            style={{ flex: '0 0 140px' }}
            value={retention.maxFailedAuthAttempts}
            onChange={(e) => setRetention((prev) => ({ ...prev, maxFailedAuthAttempts: Number(e.target.value) }))}
          />
        </div>

        <button className={styles.btnPrimary} disabled={savingRetention} onClick={handleSaveRetention}>
          {savingRetention ? 'Saving…' : 'Save policy'}
        </button>

        <div className={styles.infoBox} style={{ marginTop: 16 }}>
          Audit records are retained for 30 years and cannot be shortened, regardless of the document retention
          setting above.
        </div>
      </div>
    </AppShell>
  );
};

export default SettingsPage;
