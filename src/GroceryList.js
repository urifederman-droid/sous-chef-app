import React, { useState, useEffect } from 'react';
import { Settings, Menu } from 'lucide-react';
import Sidebar from './Sidebar';
import './GroceryList.css';

function normalizeIngredient(name) {
  return name
    .replace(/^[\d\s/½⅓⅔¼¾⅛]+/, '')
    .replace(/^(lbs?|oz|cups?|tbsp|tsp|cloves?|large|small|medium|cans?|bunch|head|bags?|pkgs?|packages?|gallons?|quarts?|pints?|pieces?|slices?|sticks?)\b\s*/i, '')
    .trim()
    .toLowerCase();
}

function loadStorePreferences() {
  return JSON.parse(localStorage.getItem('storePreferences') || '{}');
}

function saveStorePreferences(prefs) {
  localStorage.setItem('storePreferences', JSON.stringify(prefs));
}

function loadUserStores() {
  return JSON.parse(localStorage.getItem('userStores') || '[]');
}

function saveUserStores(stores) {
  localStorage.setItem('userStores', JSON.stringify(stores));
}

function GroceryList() {
  const [groceryList, setGroceryList] = useState([]);
  const [newItem, setNewItem] = useState('');
  const [storePreferences, setStorePreferences] = useState({});
  const [userStores, setUserStores] = useState([]);
  const [groupBy, setGroupBy] = useState('recipe');
  const [showSettings, setShowSettings] = useState(false);
  const [newStore, setNewStore] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const prefs = loadStorePreferences();
    setStorePreferences(prefs);
    setUserStores(loadUserStores());

    const saved = JSON.parse(localStorage.getItem('groceryList') || '[]');
    let changed = false;
    const withDefaults = saved.map(item => {
      if (!item.store) {
        const normalized = normalizeIngredient(item.name);
        if (prefs[normalized]) {
          changed = true;
          return { ...item, store: prefs[normalized] };
        }
      }
      return item;
    });
    if (changed) {
      localStorage.setItem('groceryList', JSON.stringify(withDefaults));
    }
    setGroceryList(withDefaults);
  }, []);

  const saveList = (list) => {
    setGroceryList(list);
    localStorage.setItem('groceryList', JSON.stringify(list));
  };

  const toggleItem = (index) => {
    const updated = [...groceryList];
    updated[index] = { ...updated[index], checked: !updated[index].checked };
    saveList(updated);
  };

  const setItemStore = (index, store) => {
    const updated = [...groceryList];
    const item = updated[index];
    updated[index] = { ...item, store };
    saveList(updated);

    const normalized = normalizeIngredient(item.name);
    const newPrefs = { ...storePreferences };
    if (store) {
      newPrefs[normalized] = store;
    } else {
      delete newPrefs[normalized];
    }
    setStorePreferences(newPrefs);
    saveStorePreferences(newPrefs);
  };

  const clearCompleted = () => {
    saveList(groceryList.filter(item => !item.checked));
  };

  const clearAll = () => {
    saveList([]);
  };

  const addItem = () => {
    if (!newItem.trim()) return;
    const name = newItem.trim();
    const normalized = normalizeIngredient(name);
    const store = storePreferences[normalized] || '';
    saveList([...groceryList, { name, recipe: 'Manual', checked: false, store }]);
    setNewItem('');
  };

  const addStore = () => {
    const name = newStore.trim();
    if (!name || userStores.includes(name)) return;
    const updated = [...userStores, name];
    setUserStores(updated);
    saveUserStores(updated);
    setNewStore('');
  };

  const removeStore = (storeName) => {
    const updated = userStores.filter(s => s !== storeName);
    setUserStores(updated);
    saveUserStores(updated);
  };

  // Group items
  const grouped = {};
  if (groupBy === 'recipe') {
    groceryList.forEach((item, index) => {
      const key = item.recipe || 'Other';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push({ ...item, index });
    });
  } else {
    groceryList.forEach((item, index) => {
      const key = item.store || 'Unassigned';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push({ ...item, index });
    });
  }

  return (
    <div className="grocery-list-page">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} currentPath="/grocery-list" />
      {/* Header */}
      <header className="page-header">
        <div className="header-left">
          <button className="header-menu-btn" onClick={() => setSidebarOpen(true)}>
            <Menu size={20} />
          </button>
          <h1>Grocery List</h1>
        </div>
        <button className="settings-btn" onClick={() => setShowSettings(true)}>
          <Settings size={20} />
        </button>
      </header>

      {/* Store Settings Modal */}
      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Manage Stores</h2>
              <button className="modal-close" onClick={() => setShowSettings(false)}>
                &times;
              </button>
            </div>
            <div className="modal-body">
              <div className="store-add-row">
                <input
                  type="text"
                  className="form-input"
                  placeholder="Add a store..."
                  value={newStore}
                  onChange={(e) => setNewStore(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addStore()}
                />
                <button className="modal-add-btn" onClick={addStore}>Add</button>
              </div>
              {userStores.length === 0 ? (
                <p className="settings-empty">No stores added yet</p>
              ) : (
                <div className="store-list">
                  {userStores.map(store => (
                    <div key={store} className="store-list-item">
                      <span>{store}</span>
                      <button className="store-remove-btn" onClick={() => removeStore(store)}>
                        &times;
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="page-content">
        <div className="add-item-row">
          <input
            type="text"
            placeholder="Add item (e.g. 2 lbs chicken)"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addItem()}
          />
          <button className="add-item-btn" onClick={addItem}>Add</button>
        </div>

        {groceryList.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🛒</div>
            <h3>List is empty</h3>
            <p>Add items above or ask your Sous Chef to export ingredients from a recipe!</p>
          </div>
        ) : (
          <>
            <div className="grocery-actions">
              <div className="group-toggle">
                <button
                  className={'toggle-btn' + (groupBy === 'recipe' ? ' active' : '')}
                  onClick={() => setGroupBy('recipe')}
                >By Recipe</button>
                <button
                  className={'toggle-btn' + (groupBy === 'store' ? ' active' : '')}
                  onClick={() => setGroupBy('store')}
                >By Store</button>
              </div>
              <button className="grocery-action-btn" onClick={clearCompleted}>Clear Completed</button>
              <button className="grocery-action-btn danger" onClick={clearAll}>Clear All</button>
            </div>

            {Object.entries(grouped).map(([groupKey, items]) => (
              <div key={groupKey} className="grocery-section">
                <h3 className="recipe-subheader">{groupKey}</h3>
                {items.map((item) => (
                  <div key={item.index} className={'grocery-item' + (item.checked ? ' checked' : '')}>
                    <label className="grocery-item-label">
                      <input
                        type="checkbox"
                        checked={!!item.checked}
                        onChange={() => toggleItem(item.index)}
                      />
                      <span className="item-name">{item.name}</span>
                    </label>
                    {userStores.length > 0 && (
                      <select
                        className="store-dropdown"
                        value={item.store || ''}
                        onChange={(e) => setItemStore(item.index, e.target.value)}
                      >
                        <option value="">Store</option>
                        {userStores.map(store => (
                          <option key={store} value={store}>{store}</option>
                        ))}
                      </select>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

export default GroceryList;
