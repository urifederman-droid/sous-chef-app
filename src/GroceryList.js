import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './GroceryList.css';

function GroceryList() {
  const navigate = useNavigate();
  const [groceryList, setGroceryList] = useState([]);

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('groceryList') || '[]');
    setGroceryList(saved);
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

  const clearCompleted = () => {
    saveList(groceryList.filter(item => !item.checked));
  };

  const clearAll = () => {
    saveList([]);
  };

  // Group items by recipe
  const grouped = {};
  groceryList.forEach((item, index) => {
    const key = item.recipe || 'Other';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push({ ...item, index });
  });

  return (
    <div className="grocery-list-page">
      <button className="back-btn" onClick={() => navigate('/')}>Back</button>

      <div className="content">
        <h1>Grocery List</h1>

        {groceryList.length === 0 ? (
          <p className="empty-state">Your grocery list is empty. Ask your Sous Chef to add ingredients while chatting about a recipe!</p>
        ) : (
          <>
            <div className="grocery-actions">
              <button className="grocery-action-btn" onClick={clearCompleted}>Clear Completed</button>
              <button className="grocery-action-btn danger" onClick={clearAll}>Clear All</button>
            </div>

            {Object.entries(grouped).map(([recipe, items]) => (
              <div key={recipe} className="grocery-section">
                <h3 className="recipe-subheader">{recipe}</h3>
                {items.map((item) => (
                  <label key={item.index} className={'grocery-item' + (item.checked ? ' checked' : '')}>
                    <input
                      type="checkbox"
                      checked={!!item.checked}
                      onChange={() => toggleItem(item.index)}
                    />
                    <span className="item-name">{item.name}</span>
                  </label>
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
