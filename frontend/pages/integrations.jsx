import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import AppShell from '@/components/AppShell';
import AdminTabs from '@/components/AdminTabs';
import styles from '@/styles/Settings.module.css';
import { api } from '@/lib/api';
import { useRequireAuth } from '@/lib/auth';

const IntegrationsPage = () => {
  useRequireAuth();
  const [apiKeys, setApiKeys] = useState([]);
  const [webhooks, setWebhooks] = useState([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [newWebhookUrl, setNewWebhookUrl] = useState('');
  const [justCreatedKey, setJustCreatedKey] = useState(null);
  const [justCreatedWebhook, setJustCreatedWebhook] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    Promise.all([api.listApiKeys(), api.listWebhooks()])
      .then(([keysRes, hooksRes]) => {
        setApiKeys(keysRes.data.data);
        setWebhooks(hooksRes.data.data);
      })
      .catch(() => toast.error('Failed to load integrations'));
  };

  useEffect(load, []);

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) {
      toast.error('Name the key so you remember what it\'s for');
      return;
    }
    try {
      setBusy(true);
      const res = await api.createApiKey(newKeyName.trim());
      setJustCreatedKey(res.data.data);
      setNewKeyName('');
      load();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to create API key');
    } finally {
      setBusy(false);
    }
  };

  const handleRevokeKey = async (id) => {
    try {
      await api.revokeApiKey(id);
      toast.success('API key revoked');
      load();
    } catch {
      toast.error('Failed to revoke key');
    }
  };

  const handleCreateWebhook = async () => {
    if (!newWebhookUrl.trim()) {
      toast.error('A URL is required');
      return;
    }
    try {
      setBusy(true);
      const res = await api.createWebhook(newWebhookUrl.trim());
      setJustCreatedWebhook(res.data.data);
      setNewWebhookUrl('');
      load();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to create webhook');
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveWebhook = async (id) => {
    try {
      await api.removeWebhook(id);
      toast.success('Webhook removed');
      load();
    } catch {
      toast.error('Failed to remove webhook');
    }
  };

  return (
    <AppShell
      active="admin"
      title="Integrations"
      subtitle="API keys, HMAC-signed webhook endpoints, delivery logs and embedded signing are managed here."
    >
      <AdminTabs />
      <div className={styles.card}>
        <h2>API Keys</h2>
        <p className={styles.hint}>Used to call the SignVault API directly. The full key is shown once, right after creation.</p>

        {justCreatedKey && (
          <div className={styles.newKeyBanner}>
            Copy this key now — it won't be shown again.
            <code>{justCreatedKey.key}</code>
          </div>
        )}

        <div className={styles.row}>
          <input
            className={styles.input}
            placeholder="Key name (e.g. CI pipeline)"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
          />
          <button className={styles.btnPrimary} disabled={busy} onClick={handleCreateKey}>+ Generate key</button>
        </div>

        {apiKeys.length === 0 ? (
          <p className={styles.empty}>No API keys yet.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr><th>Name</th><th>Prefix</th><th>Created</th><th>Last used</th><th></th></tr>
            </thead>
            <tbody>
              {apiKeys.map((key) => (
                <tr key={key._id}>
                  <td>{key.name}</td>
                  <td className={styles.mono}>{key.keyPrefix}…</td>
                  <td>{new Date(key.createdAt).toLocaleDateString()}</td>
                  <td>{key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleDateString() : 'Never'}</td>
                  <td><button className={styles.btnDanger} onClick={() => handleRevokeKey(key._id)}>Revoke</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className={styles.card}>
        <h2>Webhooks</h2>
        <p className={styles.hint}>Every delivery is signed with an HMAC-SHA256 signature using the endpoint's secret.</p>

        {justCreatedWebhook && (
          <div className={styles.newKeyBanner}>
            Signing secret — store it to verify deliveries.
            <code>{justCreatedWebhook.secret}</code>
          </div>
        )}

        <div className={styles.row}>
          <input
            className={styles.input}
            placeholder="https://your-app.example.com/webhooks/signvault"
            value={newWebhookUrl}
            onChange={(e) => setNewWebhookUrl(e.target.value)}
          />
          <button className={styles.btnPrimary} disabled={busy} onClick={handleCreateWebhook}>+ Add endpoint</button>
        </div>

        {webhooks.length === 0 ? (
          <p className={styles.empty}>No webhook endpoints configured.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr><th>URL</th><th>Events</th><th>Added</th><th></th></tr>
            </thead>
            <tbody>
              {webhooks.map((hook) => (
                <tr key={hook._id}>
                  <td className={styles.mono}>{hook.url}</td>
                  <td>{(hook.events || []).join(', ')}</td>
                  <td>{new Date(hook.createdAt).toLocaleDateString()}</td>
                  <td><button className={styles.btnDanger} onClick={() => handleRemoveWebhook(hook._id)}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className={styles.card}>
        <h2>Delivery Logs</h2>
        <p className={styles.hint}>Webhook delivery attempts and their response codes.</p>
        <div className={styles.infoBox}>
          No deliveries have fired yet — this build doesn't drive webhook calls from live events. Endpoint
          management above is fully functional; wiring an event (e.g. envelope completion) to fire a signed
          delivery here is a follow-up.
        </div>
      </div>

      <div className={styles.card}>
        <h2>Embedded Signing</h2>
        <p className={styles.hint}>Embed the signing experience directly inside your own product via a session URL.</p>
        <div className={styles.infoBox}>
          Embedded signing isn't implemented in this build. The public token-based signing page
          (<code>/signing/:token</code>) already works standalone and could be iframed as a starting point,
          but there's no dedicated embed-session API yet.
        </div>
      </div>
    </AppShell>
  );
};

export default IntegrationsPage;
