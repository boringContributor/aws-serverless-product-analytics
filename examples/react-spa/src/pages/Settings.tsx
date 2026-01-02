import { useState } from 'react';
import { track } from '@analytics/tracker';
import './Pages.css';

export function Settings() {
  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [language, setLanguage] = useState('en');

  const handleToggle = (setting: string, value: boolean) => {
    track('setting_changed', {
      setting,
      value,
      page: 'settings',
      timestamp: new Date().toISOString(),
    });
  };

  const handleSave = () => {
    track('settings_saved', {
      notifications,
      darkMode,
      language,
      page: 'settings',
      timestamp: new Date().toISOString(),
    });
    alert('Settings saved! Check the console for the tracked event.');
  };

  return (
    <div className="page">
      <h1>Settings</h1>
      <p className="subtitle">
        Modify your preferences. All changes are tracked as events.
      </p>

      <div className="card">
        <h2>⚙️ Preferences</h2>

        <div className="setting-item">
          <label>
            <input
              type="checkbox"
              checked={notifications}
              onChange={(e) => {
                setNotifications(e.target.checked);
                handleToggle('notifications', e.target.checked);
              }}
            />
            <span>Enable Notifications</span>
          </label>
        </div>

        <div className="setting-item">
          <label>
            <input
              type="checkbox"
              checked={darkMode}
              onChange={(e) => {
                setDarkMode(e.target.checked);
                handleToggle('darkMode', e.target.checked);
              }}
            />
            <span>Dark Mode</span>
          </label>
        </div>

        <div className="setting-item">
          <label htmlFor="language">Language:</label>
          <select
            id="language"
            value={language}
            onChange={(e) => {
              setLanguage(e.target.value);
              track('language_changed', {
                language: e.target.value,
                page: 'settings',
              });
            }}
          >
            <option value="en">English</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
            <option value="de">German</option>
          </select>
        </div>

        <div className="button-group">
          <button onClick={handleSave} className="btn btn-primary">
            Save Settings
          </button>
          <button
            onClick={() => track('settings_cancelled', { page: 'settings' })}
            className="btn btn-secondary"
          >
            Cancel
          </button>
        </div>
      </div>

      <div className="card">
        <h2>🔧 Current Configuration</h2>
        <pre className="config-display">
{JSON.stringify({
  notifications,
  darkMode,
  language,
}, null, 2)}
        </pre>
      </div>
    </div>
  );
}
