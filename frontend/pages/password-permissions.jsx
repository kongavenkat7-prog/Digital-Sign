import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import AppShell from '@/components/AppShell';
import styles from '@/styles/Settings.module.css';
import { api } from '@/lib/api';
import { useRequireAuth } from '@/lib/auth';

const PasswordPermissionsPage = () => {
  useRequireAuth();
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .getPasswordPermissions()
      .then((res) => setSettings(res.data.data))
      .catch(() => toast.error('Failed to load password permissions'));
  }, []);

  const update = (patch) => setSettings((prev) => ({ ...prev, ...patch }));

  const handleSave = async () => {
    try {
      setSaving(true);
      const res = await api.updatePasswordPermissions(settings);
      setSettings(res.data.data);
      toast.success('Password permissions updated');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (!settings) {
    return (
      <AppShell active="password" title="Password Permissions">
        <p>Loading…</p>
      </AppShell>
    );
  }

  return (
    <AppShell
      active="password"
      title="Password Permissions"
      subtitle="Controls which identity-verification methods recipients can use before signing."
    >
      <div className={styles.card}>
        <h2>Identity verification methods</h2>
        <p className={styles.hint}>At least one method must stay enabled — recipients can't sign without verifying identity somehow.</p>

        <div className={styles.toggleRow}>
          <div>
            <div className={styles.toggleLabel}>Email link + one-time passcode</div>
            <div className={styles.toggleHint}>The default: a magic link plus an emailed OTP.</div>
          </div>
          <button
            type="button"
            className={`${styles.toggle} ${settings.allowEmailOtp ? styles.toggleOn : ''}`}
            onClick={() => update({ allowEmailOtp: !settings.allowEmailOtp })}
          >
            <span className={styles.toggleKnob} />
          </button>
        </div>

        <div className={styles.toggleRow}>
          <div>
            <div className={styles.toggleLabel}>Account login + password</div>
            <div className={styles.toggleHint}>Recipient enters an access password set by the sender.</div>
          </div>
          <button
            type="button"
            className={`${styles.toggle} ${settings.allowAccountPassword ? styles.toggleOn : ''}`}
            onClick={() => update({ allowAccountPassword: !settings.allowAccountPassword })}
          >
            <span className={styles.toggleKnob} />
          </button>
        </div>

        <div className={styles.toggleRow}>
          <div>
            <div className={styles.toggleLabel}>Require OTP for admin-role recipients</div>
            <div className={styles.toggleHint}>Even if password login is allowed, Administrator recipients must still verify by OTP.</div>
          </div>
          <button
            type="button"
            className={`${styles.toggle} ${settings.requireOtpForAdmins ? styles.toggleOn : ''}`}
            onClick={() => update({ requireOtpForAdmins: !settings.requireOtpForAdmins })}
          >
            <span className={styles.toggleKnob} />
          </button>
        </div>
      </div>

      <div className={styles.card}>
        <h2>Password policy</h2>
        <p className={styles.hint}>Applies to access passwords set for the "Account login + password" method.</p>
        <div className={styles.row} style={{ alignItems: 'center' }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--sv-text)' }}>Minimum length</label>
          <input
            type="number"
            min={4}
            max={64}
            className={styles.input}
            style={{ flex: '0 0 100px' }}
            value={settings.minPasswordLength}
            onChange={(e) => update({ minPasswordLength: Number(e.target.value) })}
          />
        </div>
        <p className={styles.hint} style={{ margin: 0 }}>
          Not yet enforced on the New Envelope wizard's access-password field — this sets the stored policy value only.
        </p>
      </div>

      <button className={styles.btnPrimary} disabled={saving} onClick={handleSave}>
        {saving ? 'Saving…' : 'Save changes'}
      </button>
    </AppShell>
  );
};

export default PasswordPermissionsPage;
