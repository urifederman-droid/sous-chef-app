import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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

  return (
    <div className="continue-cooking-page">
      <button className="back-btn" onClick={() => navigate('/')}>Back</button>

      <div className="continue-content">
        <h1>Continue Cooking</h1>

        {sessions.length === 0 ? (
          <div className="empty-state">No recipes in progress</div>
        ) : (
          <div className="wip-list">
            {sessions.map(session => (
              <div key={session.id} className="wip-item">
                <button className="wip-item-btn" onClick={() => resumeSession(session)}>
                  <span className="wip-title">{session.title}</span>
                  {session.updatedAt && (
                    <span className="wip-date">
                      {new Date(session.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                </button>
                <button className="wip-dismiss" onClick={() => dismissSession(session.id)}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ContinueCooking;
