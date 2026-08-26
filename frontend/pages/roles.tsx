import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import AppShell from '@/components/AppShell';
import dashboardStyles from '@/styles/Dashboard.module.css';
import styles from '@/styles/Roles.module.css';
import { api } from '@/lib/api';
import { RolePermissionDto, SystemRole } from '@/lib/types';

const ROLES: SystemRole[] = ['Administrator', 'Manager', 'Signer', 'Viewer'];

const RolesPage: React.FC = () => {
  const [permissions, setPermissions] = useState<RolePermissionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const res = await api.getRolePermissions();
      setPermissions(res.data.data);
    } catch {
      toast.error('Failed to load role permissions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggle = (key: string, role: SystemRole) => {
    if (!editMode) return;
    setDirty(true);
    setPermissions((prev) =>
      prev.map((p) => (p.key === key ? { ...p, roles: { ...p.roles, [role]: !p.roles[role] } } : p))
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateRolePermissions(permissions.map((p) => ({ key: p.key, roles: p.roles })));
      toast.success('Permissions saved');
      setDirty(false);
      setEditMode(false);
    } catch {
      toast.error('Failed to save permissions');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell
      active="roles"
      title="Role Privileges & Permissions"
      subtitle="Define and override system-wide feature permissions across core organizational roles."
      actions={
        <>
          <label className={styles.toggleRow}>
            Edit Permissions Mode
            <button
              className={`${styles.switch} ${editMode ? styles.switchOn : ''}`}
              onClick={() => setEditMode((v) => !v)}
              type="button"
            >
              <span className={`${styles.switchKnob} ${editMode ? styles.switchKnobOn : ''}`} />
            </button>
          </label>
          <button className={dashboardStyles.btnPrimary} onClick={handleSave} disabled={!dirty || saving}>
            {saving ? 'Saving…' : '💾 Save Changes'}
          </button>
        </>
      }
    >
      {loading ? (
        <p style={{ color: 'var(--sv-text-secondary)', fontSize: 13.5 }}>Loading permissions…</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>System Permissions</th>
              {ROLES.map((role) => (
                <th key={role} className={styles.center}>
                  {role}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {permissions.map((perm) => (
              <tr key={perm.key}>
                <td>
                  <div className={styles.permLabel}>{perm.label}</div>
                  <div className={styles.permDesc}>{perm.description}</div>
                </td>
                {ROLES.map((role) => (
                  <td key={role} className={styles.center}>
                    <button
                      type="button"
                      className={`${styles.checkBtn} ${perm.roles[role] ? styles.checkOn : styles.checkOff}`}
                      onClick={() => toggle(perm.key, role)}
                      disabled={!editMode}
                      aria-label={`${perm.label} for ${role}`}
                    >
                      {perm.roles[role] ? '✓' : '✕'}
                    </button>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </AppShell>
  );
};

export default RolesPage;
