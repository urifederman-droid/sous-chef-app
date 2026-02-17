import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './MealSchedule.css';

function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDateLabel(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getDayName(date) {
  return date.toLocaleDateString('en-US', { weekday: 'long' });
}

function MealSchedule() {
  const navigate = useNavigate();
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [schedule, setSchedule] = useState({});
  const [addingDay, setAddingDay] = useState(null);
  const [manualInput, setManualInput] = useState('');
  const [showLibrary, setShowLibrary] = useState(false);
  const [savedRecipes, setSavedRecipes] = useState([]);

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem('mealSchedule') || '{}');
    setSchedule(stored);
  }, []);

  useEffect(() => {
    const recipes = JSON.parse(localStorage.getItem('savedRecipes') || '[]');
    setSavedRecipes(recipes);
  }, []);

  const saveSchedule = (updated) => {
    setSchedule(updated);
    localStorage.setItem('mealSchedule', JSON.stringify(updated));
  };

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const weekEnd = weekDays[6];
  const weekRangeLabel = `${formatDateLabel(weekStart)} – ${formatDateLabel(weekEnd)}`;

  const todayKey = formatDateKey(new Date());

  const prevWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setWeekStart(d);
  };

  const nextWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setWeekStart(d);
  };

  const goToday = () => {
    setWeekStart(getWeekStart(new Date()));
  };

  const addManualMeal = (dateKey) => {
    if (!manualInput.trim()) return;
    const updated = { ...schedule };
    if (!updated[dateKey]) updated[dateKey] = [];
    updated[dateKey] = [...updated[dateKey], {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      title: manualInput.trim(),
      source: 'manual'
    }];
    saveSchedule(updated);
    setManualInput('');
    setAddingDay(null);
  };

  const addLibraryMeal = (dateKey, recipe) => {
    const updated = { ...schedule };
    if (!updated[dateKey]) updated[dateKey] = [];
    updated[dateKey] = [...updated[dateKey], {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      title: recipe.title,
      source: 'library'
    }];
    saveSchedule(updated);
    setShowLibrary(false);
    setAddingDay(null);
  };

  const deleteMeal = (dateKey, mealId) => {
    const updated = { ...schedule };
    updated[dateKey] = (updated[dateKey] || []).filter(m => m.id !== mealId);
    saveSchedule(updated);
  };

  const openAdd = (dateKey) => {
    setAddingDay(dateKey);
    setManualInput('');
    setShowLibrary(false);
  };

  const cancelAdd = () => {
    setAddingDay(null);
    setManualInput('');
    setShowLibrary(false);
  };

  return (
    <div className="meal-schedule">
      <button className="back-btn" onClick={() => navigate('/')}>Back</button>

      <div className="schedule-content">
        <h1>Meal Schedule</h1>

        <div className="week-nav">
          <button className="nav-arrow" onClick={prevWeek}>&larr;</button>
          <span className="week-range">{weekRangeLabel}</span>
          <button className="nav-arrow" onClick={nextWeek}>&rarr;</button>
          <button className="today-btn" onClick={goToday}>Today</button>
        </div>

        <div className="days-list">
          {weekDays.map(day => {
            const dateKey = formatDateKey(day);
            const meals = schedule[dateKey] || [];
            const isToday = dateKey === todayKey;

            return (
              <div key={dateKey} className={`day-row${isToday ? ' today' : ''}`}>
                <div className="day-header">
                  <span className="day-label">
                    {getDayName(day)}
                    <span className="day-date">{formatDateLabel(day)}</span>
                  </span>
                  <button className="add-meal-btn" onClick={() => openAdd(dateKey)}>+</button>
                </div>

                {meals.length > 0 && (
                  <div className="meals-list">
                    {meals.map(meal => (
                      <div key={meal.id} className="meal-item">
                        <span>
                          <span className="meal-title">{meal.title}</span>
                          <span className="meal-source">{meal.source}</span>
                        </span>
                        <button className="delete-meal-btn" onClick={() => deleteMeal(dateKey, meal.id)}>x</button>
                      </div>
                    ))}
                  </div>
                )}

                {addingDay === dateKey && (
                  <div className="inline-add">
                    <div className="inline-add-row">
                      <input
                        type="text"
                        placeholder="Meal name..."
                        value={manualInput}
                        onChange={(e) => setManualInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addManualMeal(dateKey)}
                        autoFocus
                      />
                      <button className="add-btn" onClick={() => addManualMeal(dateKey)}>Add</button>
                    </div>
                    <button className="from-library-btn" onClick={() => setShowLibrary(!showLibrary)}>
                      {showLibrary ? 'Hide Library' : 'From Library'}
                    </button>
                    {showLibrary && (
                      <div className="library-picker">
                        {savedRecipes.length === 0 ? (
                          <div className="library-empty">No saved recipes yet</div>
                        ) : (
                          savedRecipes.map((recipe, i) => (
                            <button
                              key={i}
                              className="library-picker-item"
                              onClick={() => addLibraryMeal(dateKey, recipe)}
                            >
                              {recipe.title}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                    <button className="cancel-add-btn" onClick={cancelAdd}>Cancel</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default MealSchedule;
