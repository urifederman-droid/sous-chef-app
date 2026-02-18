import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
  const [groceryList, setGroceryList] = useState([]);
  const [newItem, setNewItem] = useState('');
  const [storePreferences, setStorePreferences] = useState({});
  const [userStores, setUserStores] = useState([]);
  const [newStore, setNewStore] = useState('');
  const [groupBy, setGroupBy] = useState('recipe'); // 'recipe' or 'store'

  useEffect(() => {
    const prefs = loadStorePreferences();
    setStorePreferences(prefs);
    setUserStores(loadUserStores());

    const saved = JSON.parse(localStorage.getItem('groceryList') || '[]');
    // Apply store defaults to items without a store
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
    // Toggle off if same store is tapped again
    const newStore = item.store === store ? '' : store;
    updated[index] = { ...item, store: newStore };
    saveList(updated);

    // Update store preferences
    const normalized = normalizeIngredient(item.name);
    const newPrefs = { ...storePreferences };
    if (newStore) {
      newPrefs[normalized] = newStore;
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
      <button className="back-btn" onClick={() => navigate('/')}>Back</button>

      <div className="content">
        <h1>Grocery List</h1>

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

        <div className="add-store-row">
          <input
            type="text"
            placeholder="Add a store..."
            value={newStore}
            onChange={(e) => setNewStore(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addStore()}
          />
          <button className="add-store-btn" onClick={addStore}>Add Store</button>
        </div>

        {userStores.length > 0 && (
          <div className="store-tags">
            {userStores.map(store => (
              <span key={store} className="store-tag">
                {store}
                <button className="remove-store" onClick={() => removeStore(store)}>&times;</button>
              </span>
            ))}
          </div>
        )}

        {groceryList.length === 0 ? (
          <p className="empty-state">Your grocery list is empty. Add items above or ask your Sous Chef to export ingredients from a recipe!</p>
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
                      <div className="store-selector">
                        {userStores.map(store => (
                          <button
                            key={store}
                            className={'store-pill' + (item.store === store ? ' active' : '')}
                            onClick={() => setItemStore(item.index, store)}
                          >{store}</button>
                        ))}
                      </div>
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
