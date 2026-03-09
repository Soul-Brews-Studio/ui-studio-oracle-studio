import { useState, useEffect } from 'react';
import { getSettings, updateSettings, type Settings as SettingsType } from '../api/oracle';
import { useAuth } from '../contexts/AuthContext';

export function Settings() {
  const [settings, setSettings] = useState<SettingsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [authEnabled, setAuthEnabled] = useState(false);
  const [localBypass, setLocalBypass] = useState(true);

  const { checkAuth, isLocal } = useAuth();

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const data = await getSettings();
      setSettings(data);
      setAuthEnabled(data.authEnabled);
      setLocalBypass(data.localBypass);
    } catch (e) {
      setMessage({ type: 'error', text: 'Failed to load settings' });
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match' });
      return;
    }

    if (newPassword && newPassword.length < 4) {
      setMessage({ type: 'error', text: 'Password must be at least 4 characters' });
      return;
    }

    setSaving(true);
    try {
      const result = await updateSettings({
        currentPassword: settings?.hasPassword ? currentPassword : undefined,
        newPassword: newPassword || undefined
      });

      if (result.error) {
        setMessage({ type: 'error', text: result.error });
      } else {
        setMessage({ type: 'success', text: 'Password updated successfully' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        await loadSettings();
        await checkAuth();
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Failed to update password' });
    } finally {
      setSaving(false);
    }
  }

  async function handleRemovePassword() {
    if (!confirm('Are you sure you want to remove the password? This will disable authentication.')) {
      return;
    }

    setMessage(null);
    setSaving(true);

    try {
      const result = await updateSettings({
        currentPassword,
        removePassword: true
      });

      if (result.error) {
        setMessage({ type: 'error', text: result.error });
      } else {
        setMessage({ type: 'success', text: 'Password removed' });
        setCurrentPassword('');
        await loadSettings();
        await checkAuth();
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Failed to remove password' });
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleAuth(enabled: boolean) {
    setMessage(null);
    setSaving(true);

    try {
      const result = await updateSettings({ authEnabled: enabled });

      if (result.error) {
        setMessage({ type: 'error', text: result.error });
      } else {
        setAuthEnabled(enabled);
        await checkAuth();
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Failed to update setting' });
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleLocalBypass(bypass: boolean) {
    setMessage(null);
    setSaving(true);

    try {
      const result = await updateSettings({ localBypass: bypass });

      if (result.error) {
        setMessage({ type: 'error', text: result.error });
      } else {
        setLocalBypass(bypass);
        await checkAuth();
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Failed to update setting' });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-[640px] mx-auto px-6 py-12">
        <div className="text-center text-text-muted py-12">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="max-w-[640px] mx-auto px-6 py-12">
      <h1 className="text-[32px] font-bold text-text-primary mb-2">Settings</h1>
      <p className="text-text-secondary mb-8">Configure authentication and security options</p>

      {message && (
        <div className={`px-4 py-3 rounded-lg text-sm mb-6 ${
          message.type === 'success'
            ? 'bg-[rgba(34,197,94,0.1)] border border-[rgba(34,197,94,0.3)] text-[#22c55e]'
            : 'bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.3)] text-[#ef4444]'
        }`}>
          {message.text}
        </div>
      )}

      <div className="bg-bg-card border border-border rounded-xl p-6 mb-6">
        <h2 className="text-lg font-semibold text-text-primary mb-2">Password</h2>
        <p className="text-text-secondary text-sm mb-5">
          {settings?.hasPassword
            ? 'A password is currently set. You can change or remove it below.'
            : 'No password is set. Set a password to enable authentication.'}
        </p>

        <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4">
          {settings?.hasPassword && (
            <div className="flex flex-col gap-2">
              <label className="text-text-secondary text-sm">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                className="bg-bg-secondary border border-border text-text-primary px-3.5 py-3 rounded-lg text-[15px] font-[inherit] outline-none focus:border-accent transition-colors duration-200 placeholder:text-text-muted"
                placeholder="Enter current password"
              />
            </div>
          )}

          <div className="flex flex-col gap-2">
            <label className="text-text-secondary text-sm">
              {settings?.hasPassword ? 'New Password' : 'Password'}
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="bg-bg-secondary border border-border text-text-primary px-3.5 py-3 rounded-lg text-[15px] font-[inherit] outline-none focus:border-accent transition-colors duration-200 placeholder:text-text-muted"
              placeholder="Enter new password"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-text-secondary text-sm">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="bg-bg-secondary border border-border text-text-primary px-3.5 py-3 rounded-lg text-[15px] font-[inherit] outline-none focus:border-accent transition-colors duration-200 placeholder:text-text-muted"
              placeholder="Confirm new password"
            />
          </div>

          <div className="flex gap-3 mt-2">
            <button
              type="submit"
              disabled={saving || !newPassword}
              className="bg-accent border-none text-white px-6 py-3 rounded-lg text-sm font-medium cursor-pointer transition-colors duration-200 hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : settings?.hasPassword ? 'Change Password' : 'Set Password'}
            </button>

            {settings?.hasPassword && (
              <button
                type="button"
                onClick={handleRemovePassword}
                disabled={saving || (settings?.hasPassword && !currentPassword)}
                className="bg-transparent border border-[rgba(239,68,68,0.5)] text-[#ef4444] px-6 py-3 rounded-lg text-sm font-medium cursor-pointer transition-all duration-200 hover:bg-[rgba(239,68,68,0.1)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Remove Password
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="bg-bg-card border border-border rounded-xl p-6 mb-6">
        <h2 className="text-lg font-semibold text-text-primary mb-2">Authentication</h2>

        <div className="flex justify-between items-center gap-4 py-4 border-b border-border last:border-b-0 last:pb-0">
          <div className="flex flex-col gap-1">
            <span className="text-[15px] font-medium text-text-primary">Require Password</span>
            <span className="text-[13px] text-text-muted">
              When enabled, users must enter the password to access the dashboard
            </span>
          </div>
          <button
            onClick={() => handleToggleAuth(!authEnabled)}
            disabled={saving || !settings?.hasPassword}
            className={`border px-4 py-2 rounded-md text-[13px] font-medium cursor-pointer transition-all duration-200 min-w-[90px] disabled:opacity-50 disabled:cursor-not-allowed ${
              authEnabled
                ? 'bg-[rgba(34,197,94,0.15)] border-[rgba(34,197,94,0.4)] text-[#22c55e]'
                : 'bg-bg-secondary border-border text-text-secondary hover:border-accent hover:text-accent'
            }`}
          >
            {authEnabled ? 'Enabled' : 'Disabled'}
          </button>
        </div>

        {!settings?.hasPassword && (
          <p className="text-[13px] text-text-muted italic mt-3">Set a password first to enable authentication</p>
        )}
      </div>

      <div className="bg-bg-card border border-border rounded-xl p-6 mb-6">
        <h2 className="text-lg font-semibold text-text-primary mb-2">Local Network Bypass</h2>

        <div className="flex justify-between items-center gap-4 py-4 border-b border-border last:border-b-0 last:pb-0">
          <div className="flex flex-col gap-1">
            <span className="text-[15px] font-medium text-text-primary">Skip auth for local network</span>
            <span className="text-[13px] text-text-muted">
              When enabled, requests from local IP addresses (192.168.x.x, 10.x.x.x, 127.0.0.1) bypass authentication
            </span>
          </div>
          <button
            onClick={() => handleToggleLocalBypass(!localBypass)}
            disabled={saving}
            className={`border px-4 py-2 rounded-md text-[13px] font-medium cursor-pointer transition-all duration-200 min-w-[90px] disabled:opacity-50 disabled:cursor-not-allowed ${
              localBypass
                ? 'bg-[rgba(34,197,94,0.15)] border-[rgba(34,197,94,0.4)] text-[#22c55e]'
                : 'bg-bg-secondary border-border text-text-secondary hover:border-accent hover:text-accent'
            }`}
          >
            {localBypass ? 'Enabled' : 'Disabled'}
          </button>
        </div>

        <div className="flex items-center gap-3 mt-4 pt-4 border-t border-border">
          <span className="text-[13px] text-text-muted">Your connection:</span>
          <span className={`text-xs font-medium px-2.5 py-1 rounded ${
            isLocal
              ? 'bg-[rgba(34,197,94,0.15)] text-[#22c55e]'
              : 'bg-[rgba(59,130,246,0.15)] text-[#60a5fa]'
          }`}>
            {isLocal ? 'Local Network' : 'Remote'}
          </span>
        </div>
      </div>
    </div>
  );
}
