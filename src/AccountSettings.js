import React, { useState, useEffect } from 'react';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';
import './AccountSettings.css';

function AccountSettings() {
  const [allergies, setAllergies] = useState('');
  const [cuisines, setCuisines] = useState('');
  const [dislikes, setDislikes] = useState('');
  const [saved, setSaved] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
    <div className="profile-page">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} currentPath="/account-settings" />
      <header className="profile-header">
        <button className="header-menu-btn" onClick={() => setSidebarOpen(true)}>
          <Menu size={24} />
        </button>
        <h1>Profile</h1>
        <div className="header-spacer" />
      </header>

      <main className="profile-content">
        <section className="profile-section">
          <h2>User Preferences</h2>

          <div className="pref-card">
            <h3>Allergies & Dietary Restrictions</h3>
            <input
              type="text"
              className="pref-input"
              placeholder="e.g. gluten-free, nut allergy, vegan"
              value={allergies}
              onChange={(e) => setAllergies(e.target.value)}
            />
          </div>

          <div className="pref-card">
            <h3>Favorite Cuisines</h3>
            <input
              type="text"
              className="pref-input"
              placeholder="e.g. Mexican, Italian, Japanese"
              value={cuisines}
              onChange={(e) => setCuisines(e.target.value)}
            />
          </div>

          <div className="pref-card">
            <h3>Ingredients I Don't Like</h3>
            <input
              type="text"
              className="pref-input"
              placeholder="e.g. cilantro, olives, anchovies"
              value={dislikes}
              onChange={(e) => setDislikes(e.target.value)}
            />
          </div>
        </section>

        <button className="save-btn" onClick={handleSave}>
          {saved ? 'Saved!' : 'Save Changes'}
        </button>
      </main>
    </div>
  );
}

export default AccountSettings;
