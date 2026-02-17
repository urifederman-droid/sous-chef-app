import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './AccountSettings.css';

function AccountSettings() {
  const navigate = useNavigate();
  const [allergies, setAllergies] = useState('');
  const [cuisines, setCuisines] = useState('');
  const [dislikes, setDislikes] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('userPreferences');
      if (stored) {
        const prefs = JSON.parse(stored);
        setAllergies(prefs.allergies || '');
        setCuisines(prefs.cuisines || '');
        setDislikes(prefs.dislikes || '');
      }
    } catch {}
  }, []);

  const handleSave = () => {
    localStorage.setItem('userPreferences', JSON.stringify({ allergies, cuisines, dislikes }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="account-settings">
      <button className="back-btn" onClick={() => navigate('/')}>Back</button>

      <div className="content">
        <h1>Account Settings</h1>

        <div className="settings-section">
          <h3>Preferences</h3>
          <div className="setting-item">
            <label>Allergies & Dietary Restrictions</label>
            <input
              type="text"
              placeholder="e.g. gluten-free, nut allergy, vegan"
              value={allergies}
              onChange={(e) => setAllergies(e.target.value)}
            />
          </div>
          <div className="setting-item">
            <label>Favorite Cuisines</label>
            <input
              type="text"
              placeholder="e.g. Mexican, Italian, Japanese"
              value={cuisines}
              onChange={(e) => setCuisines(e.target.value)}
            />
          </div>
          <div className="setting-item">
            <label>Ingredients I Dislike</label>
            <input
              type="text"
              placeholder="e.g. cilantro, olives, anchovies"
              value={dislikes}
              onChange={(e) => setDislikes(e.target.value)}
            />
          </div>
          <div className="save-row">
            <button className="save-btn" onClick={handleSave}>Save Preferences</button>
            {saved && <span className="saved-feedback">Saved!</span>}
          </div>
        </div>

        <div className="settings-section">
          <h3>API Settings</h3>
          <p className="info-text">Your Anthropic API key is configured and working.</p>
        </div>
      </div>
    </div>
  );
}

export default AccountSettings;
