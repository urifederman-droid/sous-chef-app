import React, { useState } from 'react';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';
import './Settings.css';

function Settings() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="profile-page">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} currentPath="/settings" />
      <header className="profile-header">
        <button className="header-menu-btn" onClick={() => setSidebarOpen(true)}>
          <Menu size={24} />
        </button>
        <h1>Settings</h1>
        <div className="header-spacer" />
      </header>

      <main className="profile-content">
        <div className="empty-state">
          <p>More settings coming soon</p>
        </div>
      </main>
    </div>
  );
}

export default Settings;
