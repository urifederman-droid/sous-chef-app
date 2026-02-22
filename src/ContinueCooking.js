import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, ChefHat, X, Menu } from 'lucide-react';
import Sidebar from './Sidebar';
import InlineAgentChat from './InlineAgentChat';
import './ContinueCooking.css';

function ContinueCooking() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);

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
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} currentPath="/continue-cooking" />
      <header className="page-header">
        <div className="header-left">
          <button className="header-menu-btn" onClick={() => setSidebarOpen(true)}>
            <Menu size={20} />
          </button>
          <h1>Continue Cooking</h1>
        </div>
        {sessions.length > 0 && (
          <button className="edit-mode-btn" onClick={() => setEditMode(!editMode)}>
            {editMode ? 'Done' : 'Edit'}
          </button>
        )}
      </header>

      <InlineAgentChat
        systemPrompt={`You are a friendly cooking assistant helping the user find and resume their in-progress cooking sessions. Be concise — 2-3 sentences max unless they ask for detail.\n\nIMPORTANT: ONLY refer to the sessions listed below. Never suggest new recipes — only help them find and resume existing sessions.\n\nTheir active sessions: ${sessions.slice(0, 30).map(s => `${s.title} (last active: ${s.updatedAt ? new Date(s.updatedAt).toLocaleDateString() : 'unknown'})`).join('; ') || 'No sessions yet'}.`}
        placeholder="Which recipe was I working on?"
      />

      <main className="page-content">
        {sessions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon-circle">
              <ChefHat size={40} />
            </div>
            <h3>No recipes in progress</h3>
            <p>When you start cooking, you can pause and pick up right where you left off</p>
          </div>
        ) : (
          <div className="card-list">
            {sessions.map(session => (
              <div key={session.id} className="recipe-card card-inline">
                {editMode && (
                  <button className="delete-badge" onClick={() => dismissSession(session.id)}>
                    <X size={14} />
                  </button>
                )}
                <div className="card-inline-info">
                  <h3 className="card-title">{session.title}</h3>
                  <span className="card-meta">
                    <Clock size={12} />
                    {getTimeAgo(session.updatedAt)}
                  </span>
                </div>
                <button className="cook-btn-inline" onClick={() => resumeSession(session)}>
                  Continue
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default ContinueCooking;
