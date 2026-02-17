import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Home.css';

function Home() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [showAccountMenu, setShowAccountMenu] = useState(false);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      // Store the recipe request and go to chat
      localStorage.setItem('pendingRecipeRequest', searchQuery);
      navigate('/cook');
    }
  };

  return (
    <div className="home">
      <div className="top-bar">
        <div className="account-section">
          <button 
            className="account-icon"
            onClick={() => setShowAccountMenu(!showAccountMenu)}
          >
            A
          </button>
          {showAccountMenu && (
            <div className="account-dropdown">
              <button onClick={() => { navigate('/account-settings'); setShowAccountMenu(false); }}>
                Account Settings
              </button>
              <button onClick={() => { navigate('/my-recipes'); setShowAccountMenu(false); }}>
                My Library
              </button>
              <button onClick={() => { navigate('/meal-schedule'); setShowAccountMenu(false); }}>
                Meal Schedule
              </button>
              <button onClick={() => { navigate('/grocery-list'); setShowAccountMenu(false); }}>
                Grocery List
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="container">
        <h1>Sous Chef</h1>
        
        <form onSubmit={handleSearch} className="search-section">
          <div className="search-wrapper">
            <input
              type="text"
              className="search-bar"
              placeholder="What would you like to cook today?"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button 
                type="button"
                className="clear-search"
                onClick={() => setSearchQuery('')}
              >
                ✕
              </button>
            )}
          </div>
        </form>

        <div className="secondary-actions">
          <button 
            className="secondary-btn"
            onClick={() => navigate('/photo-import')}
          >
            Import recipe by Photo
          </button>
          
          <button 
            className="secondary-btn"
            onClick={() => navigate('/import-url')}
          >
            Import from URL
          </button>
        </div>

        <button 
          className="cook-mode-btn"
          onClick={() => navigate('/cook-freestyle')}
        >
          I'm already cooking
        </button>
      </div>
    </div>
  );
}

export default Home;
