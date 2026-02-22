import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, X, Menu } from 'lucide-react';
import Sidebar from './Sidebar';
import InlineAgentChat from './InlineAgentChat';
import './WantToCook.css';

function WantToCook() {
  const navigate = useNavigate();
  const [wantToCook, setWantToCook] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRecipe, setNewRecipe] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('wantToCook') || '[]');
    setWantToCook(saved);
  }, []);

  const saveList = (list) => {
    setWantToCook(list);
    localStorage.setItem('wantToCook', JSON.stringify(list));
  };

  const addRecipe = () => {
    if (!newRecipe.trim()) return;
    const item = {
      id: Date.now().toString(),
      title: newRecipe.trim(),
      addedDate: new Date().toISOString()
    };
    saveList([...wantToCook, item]);
    setNewRecipe('');
    setShowAddForm(false);
  };

  const removeRecipe = (id) => {
    saveList(wantToCook.filter(item => item.id !== id));
  };

  const cookRecipe = (item) => {
    if (item.chatHistory) {
      localStorage.setItem('pendingChatHistory', JSON.stringify(item.chatHistory));
    } else {
      localStorage.setItem('pendingRecipeRequest', item.title);
    }
    navigate('/cook');
  };

  return (
    <div className="want-to-cook-page">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} currentPath="/want-to-cook" />
      {/* Header */}
      <header className="page-header">
        <div className="header-left">
          <button className="header-menu-btn" onClick={() => setSidebarOpen(true)}>
            <Menu size={20} />
          </button>
          <h1>Wishlist</h1>
        </div>
        <div className="header-right-actions">
          {wantToCook.length > 0 && (
            <button className="edit-mode-btn" onClick={() => setEditMode(!editMode)}>
              {editMode ? 'Done' : 'Edit'}
            </button>
          )}
          <button className="add-btn" onClick={() => setShowAddForm(true)}>
            <Plus size={20} />
          </button>
        </div>
      </header>

      <InlineAgentChat
        systemPrompt={`You are a friendly cooking assistant helping the user decide what to cook from their wishlist. Be concise — 2-3 sentences max unless they ask for detail. Today is ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}.\n\nTheir wishlist items: ${wantToCook.slice(0, 30).map(i => i.title).join(', ') || 'No items yet'}.`}
        placeholder="What should I cook tonight?"
      />

      {/* Add Item Modal */}
      {showAddForm && (
        <div className="modal-overlay" onClick={() => setShowAddForm(false)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add to Wishlist</h2>
              <button className="modal-close" onClick={() => { setShowAddForm(false); setNewRecipe(''); }}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <label className="form-label">Dish Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g., Beef Wellington"
                value={newRecipe}
                onChange={(e) => setNewRecipe(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addRecipe()}
                autoFocus
              />
              <button className="modal-submit" onClick={addRecipe}>
                Add to Wishlist
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <main className="page-content">
        {wantToCook.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <h3>No items yet</h3>
            <p>Add dishes you want to cook to your wishlist</p>
          </div>
        ) : (
          <div className="card-list">
            {wantToCook.map((item) => (
              <div key={item.id} className="recipe-card card-inline">
                {editMode && (
                  <button className="delete-badge" onClick={() => removeRecipe(item.id)}>
                    <X size={14} />
                  </button>
                )}
                <h3 className="card-title">{item.title}</h3>
                <button className="cook-btn-inline" onClick={() => cookRecipe(item)}>
                  {item.chatHistory ? 'Continue' : 'Cook'}
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default WantToCook;
