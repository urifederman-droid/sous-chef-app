import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus, X, BookOpen, Menu } from 'lucide-react';
import Sidebar from './Sidebar';
import InlineAgentChat from './InlineAgentChat';
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
  return date.toLocaleDateString('en-US', { weekday: 'short' });
}

function MealSchedule() {
  const navigate = useNavigate();
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [schedule, setSchedule] = useState({});
  const [addingDay, setAddingDay] = useState(null);
  const [manualInput, setManualInput] = useState('');
  const [selectedTag, setSelectedTag] = useState(null);
  const [showLibrary, setShowLibrary] = useState(false);
  const [savedRecipes, setSavedRecipes] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  const addManualMeal = () => {
    if (!manualInput.trim() || !addingDay) return;
    const updated = { ...schedule };
    if (!updated[addingDay]) updated[addingDay] = [];
    updated[addingDay] = [...updated[addingDay], {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      title: manualInput.trim(),
      source: 'manual',
      tag: selectedTag || null
    }];
    saveSchedule(updated);
    setManualInput('');
    setSelectedTag(null);
    setAddingDay(null);
    setShowLibrary(false);
  };

  const addLibraryMeal = (recipe) => {
    if (!addingDay) return;
    const updated = { ...schedule };
    if (!updated[addingDay]) updated[addingDay] = [];
    updated[addingDay] = [...updated[addingDay], {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      title: recipe.title,
      source: 'library',
      tag: selectedTag || null,
      chatHistory: recipe.chatHistory || null
    }];
    saveSchedule(updated);
    setShowLibrary(false);
    setSelectedTag(null);
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
    setSelectedTag(null);
    setShowLibrary(false);
  };

  const cancelAdd = () => {
    setAddingDay(null);
    setManualInput('');
    setSelectedTag(null);
    setShowLibrary(false);
  };

  const goToRecipe = (meal) => {
    if (meal.chatHistory) {
      localStorage.setItem('pendingChatHistory', JSON.stringify(meal.chatHistory));
    } else {
      localStorage.setItem('pendingRecipeRequest', meal.title);
    }
    navigate('/cook');
  };

  const addingDayLabel = addingDay
    ? (() => {
        const d = weekDays.find(day => formatDateKey(day) === addingDay);
        return d ? `${getDayName(d)}, ${formatDateLabel(d)}` : addingDay;
      })()
    : '';

  return (
    <div className="meal-schedule-page">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} currentPath="/meal-schedule" />
      {/* Header */}
      <header className="page-header">
        <div className="header-left">
          <button className="header-menu-btn" onClick={() => setSidebarOpen(true)}>
            <Menu size={20} />
          </button>
          <h1>Meal Schedule</h1>
        </div>
      </header>

      <InlineAgentChat
        systemPrompt={`You are a friendly cooking assistant helping the user manage their meal schedule. Be concise — 2-3 sentences max unless they ask for detail. Today is ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}.\n\nTheir meal schedule: ${JSON.stringify(Object.fromEntries(Object.entries(schedule).slice(0, 30).map(([date, meals]) => [date, meals.map(m => m.title)]))) || '{}'}.`}
        placeholder="What's for dinner this week?"
      />

      {/* Add Meal Modal */}
      {addingDay && (
        <div className="modal-overlay" onClick={cancelAdd}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Meal – {addingDayLabel}</h2>
              <button className="modal-close" onClick={cancelAdd}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="tag-toggles">
                {['breakfast', 'lunch', 'dinner'].map(tag => (
                  <button
                    key={tag}
                    className={`tag-toggle${selectedTag === tag ? ' active' : ''} tag-${tag}`}
                    onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                  >
                    {tag}
                  </button>
                ))}
              </div>
              <div className="store-add-row">
                <input
                  type="text"
                  className="form-input"
                  placeholder="Meal name..."
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addManualMeal()}
                  autoFocus
                />
                <button className="modal-add-btn" onClick={addManualMeal}>Add</button>
              </div>
              <button
                className="library-toggle-btn"
                onClick={() => setShowLibrary(!showLibrary)}
              >
                <BookOpen size={16} />
                {showLibrary ? 'Hide Library' : 'From Library'}
              </button>
              {showLibrary && (
                <div className="library-picker">
                  {savedRecipes.length === 0 ? (
                    <p className="settings-empty">No saved recipes yet</p>
                  ) : (
                    savedRecipes.map((recipe, i) => (
                      <button
                        key={i}
                        className="library-picker-item"
                        onClick={() => addLibraryMeal(recipe)}
                      >
                        {recipe.title}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="page-content">
        <div className="week-nav">
          <button className="nav-arrow" onClick={prevWeek}>
            <ChevronLeft size={20} />
          </button>
          <span className="week-range">{weekRangeLabel}</span>
          <button className="nav-arrow" onClick={nextWeek}>
            <ChevronRight size={20} />
          </button>
          <button className="today-btn" onClick={goToday}>Today</button>
        </div>

        <div className="days-list">
          {weekDays.map(day => {
            const dateKey = formatDateKey(day);
            const meals = schedule[dateKey] || [];
            const isToday = dateKey === todayKey;

            return (
              <div key={dateKey} className={`day-card${isToday ? ' today' : ''}`}>
                <div className="day-header">
                  <div className="day-info">
                    <span className="day-name">{getDayName(day)}</span>
                    <span className="day-date">{formatDateLabel(day)}</span>
                  </div>
                  <button className="add-meal-btn" onClick={() => openAdd(dateKey)}>
                    <Plus size={16} />
                  </button>
                </div>

                {meals.length > 0 && (
                  <div className="meals-list">
                    {meals.map(meal => (
                      <div key={meal.id} className="meal-item">
                        <div className="meal-info">
                          {meal.tag && <span className={`meal-tag tag-${meal.tag}`}>{meal.tag}</span>}
                          <span className="meal-title">{meal.title}</span>
                        </div>
                        <div className="meal-actions">
                          <button className="meal-recipe-btn" onClick={() => goToRecipe(meal)}>
                            {meal.chatHistory ? 'Go to Recipe' : 'Generate Recipe'}
                          </button>
                          <button className="delete-meal-btn" onClick={() => deleteMeal(dateKey, meal.id)}>
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {meals.length === 0 && (
                  <p className="no-meals">No meals planned</p>
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
