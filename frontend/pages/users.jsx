import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import AppShell from '@/components/AppShell';
import Badge, { roleTone, statusTone } from '@/components/Badge';
import styles from '@/styles/Users.module.css';
import dashboardStyles from '@/styles/Dashboard.module.css';
import { api } from '@/lib/api';

const ROLES = ['Administrator', 'Manager', 'Lead', 'Viewer'];

const initials = (name) =>
  name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();

const relativeTime = (iso) => {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `Today, ${new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'Yesterday';
  return new Date(iso).toLocaleDateString();
};

const UsersPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('All Roles');
  const [statusFilter, setStatusFilter] = useState('All');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', title: '', role: 'Lead' });

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.listUsers({
        search: search || undefined,
        role: roleFilter !== 'All Roles' ? roleFilter : undefined,
        status: statusFilter !== 'All' ? statusFilter : undefined,
      });
      setUsers(res.data.data);
    } catch {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, roleFilter, statusFilter]);

  const handleAddUser = async () => {
    if (!form.name || !form.email) {
      toast.error('Name and email are required');
      return;
    }
    try {
      await api.createUser(form);
      toast.success('User added');
      setModalOpen(false);
      setForm({ name: '', email: '', title: '', role: 'Lead' });
      load();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to add user');
    }
  };

  const toggleStatus = async (user) => {
    try {
      await api.updateUser(user._id, { status: user.status === 'active' ? 'inactive' : 'active' });
      toast.success(`${user.name} is now ${user.status === 'active' ? 'inactive' : 'active'}`);
      load();
    } catch {
      toast.error('Failed to update user');
    }
  };

  return (
    <AppShell
      active="users"
      title="User Roles Management"
      subtitle="Provision users, assign system roles, and audit access credentials."
      actions={
        <button className={dashboardStyles.btnPrimary} onClick={() => setModalOpen(true)}>
          + Add New User
        </button>
      }
    >
      <div className={styles.toolbar}>
        <input
          className={styles.search}
          placeholder="Search by name, email, or credential..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className={styles.select} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option>All Roles</option>
          {ROLES.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
        <select className={styles.select} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option>All</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <table className={styles.table}>
        <thead>
          <tr>
            <th>User Info</th>
            <th>System Role</th>
            <th>Status</th>
            <th>Last Active</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {!loading && users.length === 0 && (
            <tr>
              <td colSpan={5} className={styles.empty}>
                No users match these filters.
              </td>
            </tr>
          )}
          {users.map((user) => (
            <tr key={user._id}>
              <td>
                <div className={styles.userCell}>
                  <div className={styles.avatar}>{initials(user.name)}</div>
                  <div>
                    <div className={styles.userName}>{user.name}</div>
                    <div className={styles.userEmail}>{user.email}</div>
                  </div>
                </div>
              </td>
              <td>
                <Badge tone={roleTone(user.role)}>{user.role}</Badge>
              </td>
              <td>
                <Badge tone={statusTone(user.status)} withDot>
                  {user.status.toUpperCase()}
                </Badge>
              </td>
              <td>{relativeTime(user.lastActiveAt)}</td>
              <td>
                <span className={styles.link} onClick={() => toggleStatus(user)}>
                  {user.status === 'active' ? 'Deactivate' : 'Activate'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {modalOpen && (
        <div className={styles.modalOverlay} onClick={() => setModalOpen(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3>Add New User</h3>
            <div className={styles.field}>
              <label>Full Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className={styles.field}>
              <label>Email</label>
              <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className={styles.field}>
              <label>Title</label>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className={styles.field}>
              <label>System Role</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {ROLES.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </div>
            <div className={styles.modalActions}>
              <button className={dashboardStyles.btnSecondary} onClick={() => setModalOpen(false)}>
                Cancel
              </button>
              <button className={dashboardStyles.btnPrimary} onClick={handleAddUser}>
                Add User
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
};

export default UsersPage;
