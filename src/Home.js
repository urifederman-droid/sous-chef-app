import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ChefHat, Clock, BookOpen, ShoppingCart, CalendarDays, User, Mic, Camera, Menu, SquarePen, X } from 'lucide-react';
import './Home.css';

function Home() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  const toggleDictation = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    let finalTranscript = searchQuery;
    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += (finalTranscript ? ' ' : '') + event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      setSearchQuery(finalTranscript + (interim ? ' ' + interim : ''));
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      localStorage.setItem('pendingRecipeRequest', searchQuery);
      navigate('/cook');
    }
  };

  const recentSessions = (() => {
    try {
      const sessions = JSON.parse(localStorage.getItem('pausedSessions') || '[]');
      const twoDaysAgo = Date.now() - 2 * 24 * 60 * 60 * 1000;
      return sessions.filter(s => new Date(s.updatedAt).getTime() > twoDaysAgo);
    } catch { return []; }
  })();

  const handleResumeSession = (id) => {
    localStorage.setItem('resumeSessionId', id);
    setSidebarOpen(false);
    navigate('/cook');
  };

  return (
    <div className="home">
      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)}>
          <div className="sidebar" onClick={(e) => e.stopPropagation()}>
            <div className="sidebar-header">
              <button className="sidebar-close" onClick={() => setSidebarOpen(false)}>
                <X size={20} />
              </button>
              <button className="sidebar-new-chat" onClick={() => { setSidebarOpen(false); navigate('/cook'); }}>
                <SquarePen size={18} />
              </button>
            </div>

            <nav className="sidebar-nav">
              <button className="sidebar-nav-item" onClick={() => { setSidebarOpen(false); navigate('/want-to-cook'); }}>
                <ChefHat size={18} />
                <span>Want to Cook</span>
              </button>
              <button className="sidebar-nav-item" onClick={() => { setSidebarOpen(false); navigate('/continue-cooking'); }}>
                <Clock size={18} />
                <span>Continue Cooking</span>
              </button>
              <button className="sidebar-nav-item" onClick={() => { setSidebarOpen(false); navigate('/my-recipes'); }}>
                <BookOpen size={18} />
                <span>My Recipes</span>
              </button>
              <button className="sidebar-nav-item" onClick={() => { setSidebarOpen(false); navigate('/grocery-list'); }}>
                <ShoppingCart size={18} />
                <span>Grocery List</span>
              </button>
              <button className="sidebar-nav-item" onClick={() => { setSidebarOpen(false); navigate('/meal-schedule'); }}>
                <CalendarDays size={18} />
                <span>Meal Schedule</span>
              </button>
            </nav>

            {recentSessions.length > 0 && (
              <div className="sidebar-section">
                <h3 className="sidebar-section-title">Recent</h3>
                {recentSessions.map(session => (
                  <button
                    key={session.id}
                    className="sidebar-session-item"
                    onClick={() => handleResumeSession(session.id)}
                  >
                    {session.title}
                  </button>
                ))}
              </div>
            )}

            <div className="sidebar-footer">
              <button className="sidebar-nav-item" onClick={() => { setSidebarOpen(false); navigate('/account-settings'); }}>
                <User size={18} />
                <span>Profile</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status Bar Spacer */}
      <div className="status-spacer" />

      {/* Header */}
      <header className="home-header">
        <button className="header-menu-btn" onClick={() => setSidebarOpen(true)}>
          <Menu size={24} />
        </button>
        <div className="header-actions">
          <button
            className="profile-btn"
            onClick={() => navigate('/account-settings')}
          >
            <User size={20} />
          </button>
        </div>
      </header>

      {/* Logo */}
      <div className="logo-section">
        <img src="/logo.png" alt="SousChef" className="logo-img" />
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="search-section">
        <div className="search-bar">
          <textarea
            placeholder="AI Generate or Import Recipe"
            value={searchQuery}
            rows={1}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSearch(e);
              }
            }}
          />
          <div className="search-actions">
            <button type="submit" className="search-icon-btn">
              <Search size={20} />
            </button>
            <button type="button" className={`search-icon-btn ${isListening ? 'listening' : ''}`} onClick={toggleDictation}>
              <Mic size={20} />
            </button>
            <button
              type="button"
              className="search-icon-btn"
              onClick={() => navigate('/photo-import')}
            >
              <Camera size={20} />
            </button>
          </div>
        </div>
      </form>

      {/* Main Content Area */}
      <main className="home-content">
        <div className="placeholder-cards">
          <div className="placeholder-card" />
          <div className="placeholder-card" />
          <div className="placeholder-card" />
        </div>
      </main>

      {/* Bottom Tab Navigation */}
      <nav className="bottom-nav">
        <button
          className="nav-tab"
          onClick={() => navigate('/want-to-cook')}
        >
          <ChefHat size={24} />
          <span>Want to Cook</span>
        </button>
        <button
          className="nav-tab"
          onClick={() => navigate('/continue-cooking')}
        >
          <Clock size={24} />
          <span>Continue</span>
        </button>
        <button
          className="nav-tab"
          onClick={() => navigate('/my-recipes')}
        >
          <BookOpen size={24} />
          <span>My Recipes</span>
        </button>
        <button
          className="nav-tab"
          onClick={() => navigate('/grocery-list')}
        >
          <ShoppingCart size={24} />
          <span>Grocery</span>
        </button>
        <button
          className="nav-tab"
          onClick={() => navigate('/meal-schedule')}
        >
          <CalendarDays size={24} />
          <span>Schedule</span>
        </button>
      </nav>
    </div>
  );
}

export default Home;
