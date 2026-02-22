import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ChefHat, Clock, BookOpen, ShoppingCart, CalendarDays, User, Mic, Plus, Camera, Menu, X, ImageIcon } from 'lucide-react';
import Sidebar from './Sidebar';
import './Home.css';

function Home() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [showPhotoPicker, setShowPhotoPicker] = useState(false);
  const recognitionRef = useRef(null);
  const cameraInputRef = useRef(null);
  const libraryInputRef = useRef(null);

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


  return (
    <div className="home">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} currentPath="/" />

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
            placeholder="What would you like to cook?"
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
              onClick={() => setShowPhotoPicker(true)}
            >
              <Plus size={20} />
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
          <span>Wishlist</span>
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
          <span>My Cookbook</span>
        </button>
        <button
          className="nav-tab"
          onClick={() => navigate('/grocery-list')}
        >
          <ShoppingCart size={24} />
          <span>Grocery List</span>
        </button>
        <button
          className="nav-tab"
          onClick={() => navigate('/meal-schedule')}
        >
          <CalendarDays size={24} />
          <span>Schedule</span>
        </button>
      </nav>

      {/* Hidden file inputs */}
      <input type="file" accept="image/*" capture="environment" ref={cameraInputRef} style={{ display: 'none' }} onChange={() => navigate('/photo-import')} />
      <input type="file" accept="image/*" multiple ref={libraryInputRef} style={{ display: 'none' }} onChange={() => navigate('/photo-import')} />

      {/* Photo Picker Bottom Sheet */}
      {showPhotoPicker && (
        <div className="photo-picker-overlay" onClick={() => setShowPhotoPicker(false)}>
          <div className="photo-picker-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="photo-picker-header">
              <span className="photo-picker-title">Add Photo</span>
              <button className="photo-picker-close" onClick={() => setShowPhotoPicker(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="picker-options">
              <button className="picker-option-btn" onClick={() => { setShowPhotoPicker(false); cameraInputRef.current?.click(); }}>
                <Camera size={24} />
                <span>Camera</span>
              </button>
              <button className="picker-option-btn" onClick={() => { setShowPhotoPicker(false); libraryInputRef.current?.click(); }}>
                <ImageIcon size={24} />
                <span>Photo Library</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Home;
