import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, ChefHat, X } from 'lucide-react';
import './ContinueCooking.css';

function ContinueCooking() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem('pausedSessions') || '[]');
    setSessions(stored);
  }, []);

  const resumeSession = (session) => {
    localStorage.setItem('resumeSessionId', session.id);
    navigate('/cook');
  };

  const dismissSession = (sessionId) => {
    const updated = sessions.filter(s => s.id !== sessionId);
    setSessions(updated);
    localStorage.setItem('pausedSessions', JSON.stringify(updated));
  };

  const getTimeAgo = (dateString) => {
    if (!dateString) return '';
    const diff = Date.now() - new Date(dateString).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return days === 1 ? 'Yesterday' : `${days}d ago`;
  };

  return (
    <div className="continue-cooking-page">
      <header className="page-header">
        <div className="header-left">
          <button className="back-btn" onClick={() => navigate('/')}>
            <ArrowLeft size={20} />
          </button>
          <h1>Continue Cooking</h1>
        </div>
      </header>

      <main className="page-content">
        {sessions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon-circle">
              <ChefHat size={40} />
            </div>
            <h3>No recipes in progress</h3>
            <p>Start cooking a recipe to see it here</p>
          </div>
        ) : (
          <div className="card-list">
            {sessions.map(session => (
              <button
                key={session.id}
                className="session-card"
                onClick={() => resumeSession(session)}
              >
                <div className="session-card-header">
                  <h3 className="session-title">{session.title}</h3>
                  <button
                    className="dismiss-btn"
                    onClick={(e) => { e.stopPropagation(); dismissSession(session.id); }}
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="session-meta">
                  <span className="session-time">
                    <Clock size={14} />
                    {getTimeAgo(session.updatedAt)}
                  </span>
                </div>
                <div className="continue-banner">
                  <span>Continue cooking</span>
                  <ChefHat size={16} />
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default ContinueCooking;
