import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, X } from 'lucide-react';
import './WantToCook.css';

function WantToCook() {
  const navigate = useNavigate();
  const [wantToCook, setWantToCook] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRecipe, setNewRecipe] = useState('');

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

  const cookRecipe = (title) => {
    localStorage.setItem('pendingRecipeRequest', title);
    navigate('/cook');
  };

  return (
    <div className="want-to-cook-page">
      {/* Header */}
      <header className="page-header">
        <div className="header-left">
          <button className="back-btn" onClick={() => navigate('/')}>
            <ArrowLeft size={20} />
          </button>
          <h1>Want to Cook</h1>
        </div>
        <button className="add-btn" onClick={() => setShowAddForm(true)}>
          <Plus size={20} />
        </button>
      </header>

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
              <div key={item.id} className="recipe-card">
                <div className="card-content">
                  <h3 className="card-title">{item.title}</h3>
                  <div className="card-actions">
                    <button className="cook-btn" onClick={() => cookRecipe(item.title)}>
                      Start Cooking
                    </button>
                    <button className="remove-btn" onClick={() => removeRecipe(item.id)}>
                      <X size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default WantToCook;
