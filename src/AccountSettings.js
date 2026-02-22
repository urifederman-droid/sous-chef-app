import React, { useState, useEffect } from 'react';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';
import { getUserProfile, saveUserProfile, createDefaultProfile } from './userPreferences';
import './AccountSettings.css';

function AccountSettings() {
  const [allergies, setAllergies] = useState('');
  const [cuisines, setCuisines] = useState('');
  const [dislikes, setDislikes] = useState('');
  const [saved, setSaved] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    // Load from profile first, fallback to legacy
    const p = getUserProfile();
    if (p) {
      setProfile(p);
      setAllergies(p.manual?.allergies || '');
      setCuisines(p.manual?.cuisines || '');
      setDislikes(p.manual?.dislikes || '');
    } else {
      try {
        const stored = localStorage.getItem('userPreferences');
        if (stored) {
          const prefs = JSON.parse(stored);
          setAllergies(prefs.allergies || '');
          setCuisines(prefs.cuisines || '');
          setDislikes(prefs.dislikes || '');
        }
      } catch {}
    }
  }, []);

  const handleSave = () => {
    // Save to both legacy and new profile
    localStorage.setItem('userPreferences', JSON.stringify({ allergies, cuisines, dislikes }));

    const p = getUserProfile() || createDefaultProfile();
    p.manual = { allergies, cuisines, dislikes };
    saveUserProfile(p);
    setProfile(p);

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleResetLearned = () => {
    if (!profile) return;
    const p = { ...profile };
    p.identity = {};
    p.equipment = { owned: [], confidence: 0 };
    p.dietary = { restrictions: [], allergies: [] };
    p.tastes = {
      cuisineAffinities: [],
      flavorProfile: {},
      ingredientAffinities: [],
      proteinPreferences: []
    };
    p.patterns = {};
    p.signals = [];
    p.sessionsCompleted = 0;
    saveUserProfile(p);
    setProfile(p);
  };

  // Gather learned data for display
  const learnedCuisines = (profile?.tastes?.cuisineAffinities || [])
    .filter(c => c.score >= 0.5)
    .sort((a, b) => b.score - a.score);

  const learnedFlavors = Object.entries(profile?.tastes?.flavorProfile || {})
    .filter(([, v]) => v.score >= 0.4)
    .sort((a, b) => b[1].score - a[1].score);

  const likedIngredients = (profile?.tastes?.ingredientAffinities || [])
    .filter(i => i.score >= 0.6)
    .sort((a, b) => b.score - a.score);

  const dislikedIngredients = (profile?.tastes?.ingredientAffinities || [])
    .filter(i => i.score < 0.3)
    .sort((a, b) => a.score - b.score);

  const learnedProteins = (profile?.tastes?.proteinPreferences || [])
    .filter(p => p.score >= 0.5)
    .sort((a, b) => b.score - a.score);

  const learnedRestrictions = profile?.dietary?.restrictions || [];
  const learnedAllergies = profile?.dietary?.allergies || [];
  const equipment = profile?.equipment?.owned || [];

  const contextItems = [];
  if (profile?.identity?.householdSize) contextItems.push(`Household: ${profile.identity.householdSize.value}`);
  if (profile?.identity?.skillLevel) contextItems.push(`Skill: ${profile.identity.skillLevel.value}`);
  if (profile?.identity?.cookingFrequency) contextItems.push(`Frequency: ${profile.identity.cookingFrequency.value}`);
  if (profile?.patterns?.avgCookTime) contextItems.push(`Avg cook time: ~${Math.round(profile.patterns.avgCookTime.value)} min`);
  if (profile?.patterns?.preferredComplexity) contextItems.push(`Complexity: ${profile.patterns.preferredComplexity.value}`);

  const hasLearnedData = learnedCuisines.length > 0 || learnedFlavors.length > 0 ||
    likedIngredients.length > 0 || dislikedIngredients.length > 0 || learnedProteins.length > 0 ||
    learnedRestrictions.length > 0 || learnedAllergies.length > 0 || equipment.length > 0 ||
    contextItems.length > 0;

  const sessionsCount = profile?.sessionsCompleted || 0;

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

        {/* Learned Preferences Section */}
        {profile && (
          <section className="profile-section learned-section">
            <h2>What SousChef Has Learned</h2>
            {sessionsCount > 0 && (
              <p className="sessions-counter">Based on {sessionsCount} cooking session{sessionsCount !== 1 ? 's' : ''}</p>
            )}

            {!hasLearnedData && (
              <p className="learned-empty">
                I haven't learned anything yet! The more you cook, the better I'll know your preferences.
              </p>
            )}

            {contextItems.length > 0 && (
              <div className="learned-group">
                <h4>About You</h4>
                <div className="learned-chips">
                  {contextItems.map((item, i) => (
                    <span key={i} className="learned-chip context-chip">{item}</span>
                  ))}
                </div>
              </div>
            )}

            {(learnedRestrictions.length > 0 || learnedAllergies.length > 0) && (
              <div className="learned-group">
                <h4>Dietary</h4>
                <div className="learned-chips">
                  {learnedAllergies.map((a, i) => (
                    <span key={`a-${i}`} className="learned-chip allergy-chip">{a.name}</span>
                  ))}
                  {learnedRestrictions.map((r, i) => (
                    <span key={`r-${i}`} className="learned-chip restriction-chip">{r.name}</span>
                  ))}
                </div>
              </div>
            )}

            {learnedCuisines.length > 0 && (
              <div className="learned-group">
                <h4>Favorite Cuisines</h4>
                <div className="learned-chips">
                  {learnedCuisines.map((c, i) => (
                    <span key={i} className="learned-chip cuisine-chip" style={{ opacity: 0.5 + c.confidence * 0.5 }}>
                      {c.cuisine}
                      <span className="chip-bar" style={{ width: `${c.score * 100}%` }} />
                    </span>
                  ))}
                </div>
              </div>
            )}

            {learnedFlavors.length > 0 && (
              <div className="learned-group">
                <h4>Flavor Profile</h4>
                <div className="learned-chips">
                  {learnedFlavors.map(([name, v], i) => (
                    <span key={i} className="learned-chip flavor-chip" style={{ opacity: 0.5 + v.confidence * 0.5 }}>
                      {name}
                      <span className="chip-bar" style={{ width: `${v.score * 100}%` }} />
                    </span>
                  ))}
                </div>
              </div>
            )}

            {learnedProteins.length > 0 && (
              <div className="learned-group">
                <h4>Preferred Proteins</h4>
                <div className="learned-chips">
                  {learnedProteins.map((p, i) => (
                    <span key={i} className="learned-chip protein-chip" style={{ opacity: 0.5 + p.confidence * 0.5 }}>
                      {p.protein}
                      <span className="chip-bar" style={{ width: `${p.score * 100}%` }} />
                    </span>
                  ))}
                </div>
              </div>
            )}

            {likedIngredients.length > 0 && (
              <div className="learned-group">
                <h4>Ingredients You Love</h4>
                <div className="learned-chips">
                  {likedIngredients.map((ing, i) => (
                    <span key={i} className="learned-chip like-chip" style={{ opacity: 0.5 + ing.confidence * 0.5 }}>
                      {ing.ingredient}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {dislikedIngredients.length > 0 && (
              <div className="learned-group">
                <h4>Ingredients You Avoid</h4>
                <div className="learned-chips">
                  {dislikedIngredients.map((ing, i) => (
                    <span key={i} className="learned-chip dislike-chip">
                      {ing.ingredient}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {equipment.length > 0 && (
              <div className="learned-group">
                <h4>Equipment</h4>
                <div className="learned-chips">
                  {equipment.map((e, i) => (
                    <span key={i} className="learned-chip equipment-chip">{e}</span>
                  ))}
                </div>
              </div>
            )}

            {hasLearnedData && (
              <button className="reset-learned-btn" onClick={handleResetLearned}>
                Reset Learned Preferences
              </button>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

export default AccountSettings;
