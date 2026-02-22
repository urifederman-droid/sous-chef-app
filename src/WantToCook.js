import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, X, Menu, MoreHorizontal, CalendarDays } from 'lucide-react';
import Sidebar from './Sidebar';
import InlineAgentChat from './InlineAgentChat';
import { logPassiveSignal } from './userPreferences';
import './WantToCook.css';

function WantToCook() {
  const navigate = useNavigate();
  const [wantToCook, setWantToCook] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRecipe, setNewRecipe] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [schedulingItem, setSchedulingItem] = useState(null);
  const [scheduleDate, setScheduleDate] = useState('');

  const menuRef = useRef(null);

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('wantToCook') || '[]');
    setWantToCook(saved);
  }, []);

  useEffect(() => {
    if (!openMenuId) return;
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [openMenuId]);

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
    logPassiveSignal('wishlist_add', { title: newRecipe.trim() });
    setNewRecipe('');
    setShowAddForm(false);
  };

  const removeRecipe = (id) => {
    saveList(wantToCook.filter(item => item.id !== id));
  };

  const cookRecipe = (item) => {
    localStorage.setItem('wishlistItemCooking', item.id);
    if (item.recipeId && item.pinnedRecipeText) {
      const pastNotes = [];
      if (item.notes) pastNotes.push(item.notes);
      localStorage.setItem('pendingCookAgainData', JSON.stringify({
        recipeId: item.recipeId,
        pinnedRecipeText: item.pinnedRecipeText,
        title: item.title,
        _source: item._source || null,
        pastNotes: pastNotes.length > 0 ? pastNotes : null
      }));
    } else if (item.chatHistory) {
      localStorage.setItem('pendingChatHistory', JSON.stringify(item.chatHistory));
    } else {
      localStorage.setItem('pendingRecipeRequest', item.title);
    }
    navigate('/cook');
  };

  const scheduleRecipe = (item) => {
    setOpenMenuId(null);
    setSchedulingItem(item);
    setScheduleDate('');
  };

  const confirmSchedule = () => {
    if (!scheduleDate || !schedulingItem) return;
    const mealSchedule = JSON.parse(localStorage.getItem('mealSchedule') || '{}');
    if (!mealSchedule[scheduleDate]) mealSchedule[scheduleDate] = [];
    mealSchedule[scheduleDate].push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      title: schedulingItem.title,
      source: 'wishlist',
      chatHistory: schedulingItem.chatHistory || null
    });
    localStorage.setItem('mealSchedule', JSON.stringify(mealSchedule));
    setSchedulingItem(null);
    setScheduleDate('');
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
        systemPrompt={`You are a friendly cooking assistant helping the user decide what to cook from their wishlist. Be concise — 2-3 sentences max unless they ask for detail. Today is ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}.\n\nIMPORTANT: ONLY recommend from the items listed below. Never invent or suggest recipes that aren't on their wishlist. If none match what they're looking for, say so and suggest they add something new.\n\nTheir wishlist items: ${wantToCook.slice(0, 30).map(i => i.title).join(', ') || 'No items yet'}.`}
        placeholder="What can I help you find?"
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
            <h3>Your wishlist is empty</h3>
            <p>Save dishes you want to try — tap + or ask your Sous Chef to suggest ideas</p>
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
                <div className="card-actions">
                  <button className="cook-btn-inline" onClick={() => cookRecipe(item)}>
                    {item.recipeId && item.pinnedRecipeText ? 'Cook Again' : item.chatHistory ? 'Continue' : 'Create Recipe'}
                  </button>
                  <div className="overflow-menu-wrapper" ref={openMenuId === item.id ? menuRef : null}>
                    <button className="overflow-btn" onClick={() => setOpenMenuId(openMenuId === item.id ? null : item.id)}>
                      <MoreHorizontal size={18} />
                    </button>
                    {openMenuId === item.id && (
                      <div className="overflow-menu">
                        <button className="overflow-menu-item" onClick={() => scheduleRecipe(item)}>
                          <CalendarDays size={16} />
                          Schedule
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Schedule Modal */}
      {schedulingItem && (
        <div className="modal-overlay" onClick={() => setSchedulingItem(null)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Schedule "{schedulingItem.title}"</h2>
              <button className="modal-close" onClick={() => setSchedulingItem(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <label className="form-label">Pick a date</label>
              <input
                type="date"
                className="form-input"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                autoFocus
              />
              <button className="modal-submit" onClick={confirmSchedule} disabled={!scheduleDate}>
                Add to Schedule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default WantToCook;
