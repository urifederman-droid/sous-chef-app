import React from 'react';
import { useNavigate } from 'react-router-dom';
import { X, SquarePen, ChefHat, Clock, BookOpen, ShoppingCart, CalendarDays, User, Home } from 'lucide-react';
import './Sidebar.css';

const NAV_ITEMS = [
  { path: '/', label: 'Home', icon: Home },
  { path: '/want-to-cook', label: 'Want to Cook', icon: ChefHat },
  { path: '/continue-cooking', label: 'Continue Cooking', icon: Clock },
  { path: '/my-recipes', label: 'My Cookbook', icon: BookOpen },
  { path: '/grocery-list', label: 'Grocery List', icon: ShoppingCart },
  { path: '/meal-schedule', label: 'Meal Schedule', icon: CalendarDays },
];

function Sidebar({ isOpen, onClose, currentPath }) {
  const navigate = useNavigate();

  const recentSessions = (() => {
    try {
      const sessions = JSON.parse(localStorage.getItem('pausedSessions') || '[]');
      const twoDaysAgo = Date.now() - 2 * 24 * 60 * 60 * 1000;
      return sessions.filter(s => new Date(s.updatedAt).getTime() > twoDaysAgo);
    } catch { return []; }
  })();

  const handleResumeSession = (id) => {
    localStorage.setItem('resumeSessionId', id);
    onClose();
    if (currentPath === '/cook') {
      window.location.href = '/cook';
    } else {
      navigate('/cook');
    }
  };

  const handleNewChat = () => {
    onClose();
    if (currentPath === '/cook') {
      window.location.href = '/cook';
    } else {
      navigate('/cook');
    }
  };

  const handleNav = (path) => {
    onClose();
    navigate(path);
  };

  if (!isOpen) return null;

  return (
    <div className="sidebar-overlay" onClick={onClose}>
      <div className="sidebar" onClick={(e) => e.stopPropagation()}>
        <div className="sidebar-header">
          <button className="sidebar-close" onClick={onClose}>
            <X size={20} />
          </button>
          {currentPath !== '/' && (
            <button className="sidebar-new-chat" onClick={handleNewChat}>
              <SquarePen size={18} />
            </button>
          )}
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.filter(item => item.path !== currentPath).map(item => (
            <button key={item.path} className="sidebar-nav-item" onClick={() => handleNav(item.path)}>
              <item.icon size={18} />
              <span>{item.label}</span>
            </button>
          ))}
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
          {currentPath !== '/account-settings' && (
            <button className="sidebar-nav-item" onClick={() => handleNav('/account-settings')}>
              <User size={18} />
              <span>Profile</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default Sidebar;
