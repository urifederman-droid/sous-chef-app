import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, X, ChevronDown, Menu, MoreHorizontal, Upload } from 'lucide-react';
import Anthropic from '@anthropic-ai/sdk';
import Sidebar from './Sidebar';
import InlineAgentChat from './InlineAgentChat';
import { backfillMetadata, generateRecipeId, extractRecipeMetadata, mergeMetadataOntoRecipe } from './recipeMetadata';
import './MyRecipes.css';

function MyRecipes() {
  const navigate = useNavigate();
  const [recipes, setRecipes] = useState([]);
  const [expandedRecipe, setExpandedRecipe] = useState(null);
  const [expandedRating, setExpandedRating] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [expandedSessions, setExpandedSessions] = useState(null);
  const [activeTagFilter, setActiveTagFilter] = useState(null);
  const [ratingFilter, setRatingFilter] = useState(null);
  const [cuisineFilter, setCuisineFilter] = useState(null);
  const [difficultyFilter, setDifficultyFilter] = useState(null);
  const [dietaryFilter, setDietaryFilter] = useState(null);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const menuRef = useRef(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importMode, setImportMode] = useState('text');
  const [importText, setImportText] = useState('');
  const [importPhoto, setImportPhoto] = useState(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState('');

  const TAG_CATEGORIES = {
    'Occasion': ['Great for Hosting', 'Great for Kids', 'Weeknight Friendly', 'Date Night', 'Meal Prep Friendly'],
    'Character': ['Healthy / Light', 'Comfort Food', 'Budget Friendly'],
    'Flavor': ['Sweet', 'Salty', 'Sour', 'Spicy', 'Umami', 'Rich']
  };

  useEffect(() => {
    const savedRecipes = JSON.parse(localStorage.getItem('savedRecipes') || '[]');
    setRecipes(savedRecipes);

    // Backfill metadata for old recipes that don't have it
    const hasRecipesWithoutMetadata = savedRecipes.some(r => !r.metadata);
    if (hasRecipesWithoutMetadata) {
      backfillMetadata(() => {
        const updated = JSON.parse(localStorage.getItem('savedRecipes') || '[]');
        setRecipes(updated);
      }).catch(() => {});
    }
  }, []);

  const allTags = [...new Set(recipes.flatMap(r => r.tags || []))];
  const allCuisines = [...new Set(recipes.map(r => r.metadata?.discovery?.cuisine).filter(Boolean))];
  const allDifficulties = [...new Set(recipes.map(r => r.metadata?.execution?.difficulty?.level).filter(Boolean))].sort();
  const dietaryOptions = [
    { key: 'vegetarian', label: 'Vegetarian' },
    { key: 'vegan', label: 'Vegan' },
    { key: 'glutenFree', label: 'Gluten Free' },
    { key: 'dairyFree', label: 'Dairy Free' }
  ].filter(d => recipes.some(r => r.metadata?.discovery?.dietary?.[d.key]));
  const hasAnyFilters = allTags.length > 0 || recipes.some(r => r.rating > 0) || allCuisines.length > 0 || allDifficulties.length > 0 || dietaryOptions.length > 0;

  const filteredRecipes = recipes.filter(r => {
    if (activeTagFilter && !(r.tags || []).includes(activeTagFilter)) return false;
    if (ratingFilter && (r.rating || 0) < ratingFilter) return false;
    if (cuisineFilter && r.metadata?.discovery?.cuisine !== cuisineFilter) return false;
    if (difficultyFilter && r.metadata?.execution?.difficulty?.level !== difficultyFilter) return false;
    if (dietaryFilter && !r.metadata?.discovery?.dietary?.[dietaryFilter]) return false;
    return true;
  });

  const hasActiveFilter = activeTagFilter || ratingFilter || cuisineFilter || difficultyFilter || dietaryFilter;

  const clearFilters = () => {
    setActiveTagFilter(null);
    setRatingFilter(null);
    setCuisineFilter(null);
    setDifficultyFilter(null);
    setDietaryFilter(null);
    setOpenDropdown(null);
  };

  const filterBarRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (filterBarRef.current && !filterBarRef.current.contains(e.target)) {
        setOpenDropdown(null);
      }
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const toggleDropdown = (name) => {
    setOpenDropdown(openDropdown === name ? null : name);
  };

  const saveToWishlist = (recipe) => {
    const existing = JSON.parse(localStorage.getItem('wantToCook') || '[]');
    if (existing.some(item => item.recipeId === recipe.recipeId && recipe.recipeId)) return;
    existing.push({
      id: Date.now().toString(),
      title: recipe.title,
      addedDate: new Date().toISOString(),
      recipeId: recipe.recipeId || null,
      pinnedRecipeText: recipe.pinnedRecipeText || null,
      _source: recipe.metadata?.source || null,
      notes: recipe.notes || null
    });
    localStorage.setItem('wantToCook', JSON.stringify(existing));
    setOpenMenuId(null);
  };

  const cookAgain = (recipe) => {
    if (recipe.pinnedRecipeText) {
      // Collect valuable notes from past cook sessions
      const pastNotes = [];
      if (recipe.notes) pastNotes.push(recipe.notes);
      if (recipe.cookSessions) {
        for (const session of recipe.cookSessions) {
          if (session.notes && !pastNotes.includes(session.notes)) {
            pastNotes.push(session.notes);
          }
        }
      }
      localStorage.setItem('pendingCookAgainData', JSON.stringify({
        recipeId: recipe.recipeId,
        pinnedRecipeText: recipe.pinnedRecipeText,
        title: recipe.title,
        _source: recipe.metadata?.source || null,
        pastNotes: pastNotes.length > 0 ? pastNotes : null
      }));
      navigate('/cook');
    } else if (recipe.chatHistory && recipe.chatHistory[0]) {
      // Legacy fallback
      localStorage.setItem('pendingRecipeRequest', recipe.title);
      navigate('/cook');
    } else {
      localStorage.setItem('currentRecipe', JSON.stringify(recipe));
      navigate('/ingredient-check');
    }
  };

  const deleteRecipe = (index) => {
    const updated = recipes.filter((_, i) => i !== index);
    setRecipes(updated);
    localStorage.setItem('savedRecipes', JSON.stringify(updated));
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const togglePhotos = (index) => {
    setExpandedRecipe(expandedRecipe === index ? null : index);
  };

  const formatExtractedRecipe = (parsed) => {
    let md = `# ${parsed.title}\n`;
    if (parsed.description) md += `${parsed.description}\n`;
    md += '\n';
    const timeParts = [];
    if (parsed.prepTime) timeParts.push(`**Prep:** ${parsed.prepTime}`);
    if (parsed.cookTime) timeParts.push(`**Cook:** ${parsed.cookTime}`);
    if (parsed.servings) timeParts.push(`**Servings:** ${parsed.servings}`);
    if (timeParts.length) md += timeParts.join(' | ') + '\n\n';
    if (parsed.ingredients && parsed.ingredients.length) {
      md += '## Ingredients\n';
      for (const ing of parsed.ingredients) {
        md += `- ${ing.amount ? ing.amount + ' ' : ''}${ing.item}\n`;
      }
      md += '\n';
    }
    if (parsed.steps && parsed.steps.length) {
      md += '## Instructions\n';
      for (const step of parsed.steps) {
        md += `${step.number}. ${step.instruction}\n`;
      }
    }
    return md;
  };

  const handleImportRecipe = async () => {
    if (importMode === 'text' && !importText.trim()) return;
    if (importMode === 'photo' && !importPhoto) return;

    setImportLoading(true);
    setImportError('');

    try {
      const anthropic = new Anthropic({
        apiKey: process.env.REACT_APP_ANTHROPIC_API_KEY,
        dangerouslyAllowBrowser: true
      });

      let messageContent;
      if (importMode === 'photo') {
        const base64Image = importPhoto.split(',')[1];
        messageContent = [
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/jpeg', data: base64Image }
          },
          {
            type: 'text',
            text: `Extract the recipe from this image. Return ONLY valid JSON:\n{\n  "title": "Recipe name",\n  "description": "Brief description",\n  "servings": 4,\n  "prepTime": "time",\n  "cookTime": "time",\n  "ingredients": [{"item": "ingredient", "amount": "quantity"}],\n  "steps": [{"number": 1, "instruction": "Step text"}]\n}`
          }
        ];
      } else {
        messageContent = `Extract and structure the recipe from this text. Return ONLY valid JSON:\n{\n  "title": "Recipe name",\n  "description": "Brief description",\n  "servings": 4,\n  "prepTime": "time",\n  "cookTime": "time",\n  "ingredients": [{"item": "ingredient", "amount": "quantity"}],\n  "steps": [{"number": 1, "instruction": "Step text"}]\n}\n\nRecipe text:\n${importText}`;
      }

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{ role: 'user', content: messageContent }]
      });

      const text = response.content[0].text.trim();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('Could not parse recipe');

      const parsed = JSON.parse(jsonMatch[0]);
      const recipeId = generateRecipeId();
      const pinnedRecipeText = formatExtractedRecipe(parsed);

      const savedRecipes = JSON.parse(localStorage.getItem('savedRecipes') || '[]');
      savedRecipes.unshift({
        recipeId,
        title: parsed.title,
        cookedDate: new Date().toISOString(),
        sessionPhotos: [],
        chatHistory: [],
        pinnedRecipeText,
        cookSessions: []
      });
      localStorage.setItem('savedRecipes', JSON.stringify(savedRecipes));
      setRecipes(savedRecipes);

      // Fire-and-forget metadata extraction
      const newIndex = 0;
      extractRecipeMetadata(pinnedRecipeText).then(metadata => {
        metadata.source.type = 'imported';
        metadata.source.aiGenerated = false;
        mergeMetadataOntoRecipe(newIndex, metadata);
        const updated = JSON.parse(localStorage.getItem('savedRecipes') || '[]');
        setRecipes(updated);
      }).catch(() => {});

      // Reset and close modal
      setShowImportModal(false);
      setImportText('');
      setImportPhoto(null);
      setImportMode('text');
    } catch (err) {
      console.error('Import error:', err);
      setImportError('Failed to extract recipe. Please try again.');
    }
    setImportLoading(false);
  };

  const handleImportPhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setImportPhoto(reader.result);
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="my-recipes-page">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} currentPath="/my-recipes" />
      <header className="page-header">
        <div className="header-left">
          <button className="header-menu-btn" onClick={() => setSidebarOpen(true)}>
            <Menu size={20} />
          </button>
          <h1>My Cookbook</h1>
        </div>
        <div className="header-right-actions">
          {recipes.length > 0 && (
            <button className="edit-mode-btn" onClick={() => setEditMode(!editMode)}>
              {editMode ? 'Done' : 'Edit'}
            </button>
          )}
          <button className="import-btn" onClick={() => setShowImportModal(true)}>
            <Upload size={20} />
          </button>
        </div>
      </header>

      <InlineAgentChat
        systemPrompt={`You are a friendly cooking assistant helping the user search and compare recipes in their cookbook. Be concise — 2-3 sentences max unless they ask for detail.\n\nTheir saved recipes: ${recipes.slice(0, 30).map(r => {
          let info = r.title;
          if (r.rating) info += ` (${r.rating} stars)`;
          if (r.tags && r.tags.length) info += ` [${r.tags.join(', ')}]`;
          if (r.cookedDate) info += ` cooked ${new Date(r.cookedDate).toLocaleDateString()}`;
          if (r.notes) info += ` notes: "${r.notes}"`;
          return info;
        }).join('; ') || 'No recipes yet'}.`}
        placeholder="Find a recipe in your cookbook..."
      />

      {hasAnyFilters && (
        <div className="filter-bar" ref={filterBarRef}>
          <div className="filter-dropdowns">
            {Object.entries(TAG_CATEGORIES).map(([category, categoryTags]) => {
              const available = categoryTags.filter(t => allTags.includes(t));
              if (available.length === 0) return null;
              const isActive = activeTagFilter && categoryTags.includes(activeTagFilter);
              return (
                <div key={category} className="filter-dropdown-wrapper">
                  <button
                    className={`filter-dropdown-btn ${isActive ? 'active' : ''}`}
                    onClick={() => toggleDropdown(category)}
                  >
                    {isActive ? activeTagFilter : category}
                    <ChevronDown size={14} />
                  </button>
                  {openDropdown === category && (
                    <div className="filter-dropdown-menu">
                      {isActive && (
                        <button
                          className="filter-dropdown-option"
                          onClick={() => { setActiveTagFilter(null); setOpenDropdown(null); }}
                        >
                          All {category}
                        </button>
                      )}
                      {available.filter(t => t !== activeTagFilter).map(tag => (
                        <button
                          key={tag}
                          className="filter-dropdown-option"
                          onClick={() => { setActiveTagFilter(tag); setOpenDropdown(null); }}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {recipes.some(r => r.rating > 0) && (
              <div className="filter-dropdown-wrapper">
                <button
                  className={`filter-dropdown-btn ${ratingFilter ? 'active' : ''}`}
                  onClick={() => toggleDropdown('rating')}
                >
                  {ratingFilter ? `${ratingFilter}+ Stars` : 'Rating'}
                  <ChevronDown size={14} />
                </button>
                {openDropdown === 'rating' && (
                  <div className="filter-dropdown-menu">
                    {ratingFilter && (
                      <button
                        className="filter-dropdown-option"
                        onClick={() => { setRatingFilter(null); setOpenDropdown(null); }}
                      >
                        Any Rating
                      </button>
                    )}
                    {[5, 4, 3, 2, 1].map(stars => (
                      <button
                        key={stars}
                        className={`filter-dropdown-option ${ratingFilter === stars ? 'selected' : ''}`}
                        onClick={() => { setRatingFilter(stars); setOpenDropdown(null); }}
                      >
                        {'★'.repeat(stars)}{'☆'.repeat(5 - stars)} {stars}+
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {allCuisines.length > 0 && (
              <div className="filter-dropdown-wrapper">
                <button
                  className={`filter-dropdown-btn ${cuisineFilter ? 'active' : ''}`}
                  onClick={() => toggleDropdown('cuisine')}
                >
                  {cuisineFilter || 'Cuisine'}
                  <ChevronDown size={14} />
                </button>
                {openDropdown === 'cuisine' && (
                  <div className="filter-dropdown-menu">
                    {cuisineFilter && (
                      <button
                        className="filter-dropdown-option"
                        onClick={() => { setCuisineFilter(null); setOpenDropdown(null); }}
                      >
                        Any Cuisine
                      </button>
                    )}
                    {allCuisines.filter(c => c !== cuisineFilter).map(cuisine => (
                      <button
                        key={cuisine}
                        className="filter-dropdown-option"
                        onClick={() => { setCuisineFilter(cuisine); setOpenDropdown(null); }}
                      >
                        {cuisine}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {allDifficulties.length > 0 && (
              <div className="filter-dropdown-wrapper">
                <button
                  className={`filter-dropdown-btn ${difficultyFilter ? 'active' : ''}`}
                  onClick={() => toggleDropdown('difficulty')}
                >
                  {difficultyFilter ? `${'●'.repeat(difficultyFilter)}${'○'.repeat(3 - difficultyFilter)}` : 'Difficulty'}
                  <ChevronDown size={14} />
                </button>
                {openDropdown === 'difficulty' && (
                  <div className="filter-dropdown-menu">
                    {difficultyFilter && (
                      <button
                        className="filter-dropdown-option"
                        onClick={() => { setDifficultyFilter(null); setOpenDropdown(null); }}
                      >
                        Any Difficulty
                      </button>
                    )}
                    {[1, 2, 3].filter(d => allDifficulties.includes(d) && d !== difficultyFilter).map(level => (
                      <button
                        key={level}
                        className="filter-dropdown-option"
                        onClick={() => { setDifficultyFilter(level); setOpenDropdown(null); }}
                      >
                        {'●'.repeat(level)}{'○'.repeat(3 - level)} {level === 1 ? 'Easy' : level === 2 ? 'Medium' : 'Hard'}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {dietaryOptions.length > 0 && (
              <div className="filter-dropdown-wrapper">
                <button
                  className={`filter-dropdown-btn ${dietaryFilter ? 'active' : ''}`}
                  onClick={() => toggleDropdown('dietary')}
                >
                  {dietaryFilter ? dietaryOptions.find(d => d.key === dietaryFilter)?.label : 'Dietary'}
                  <ChevronDown size={14} />
                </button>
                {openDropdown === 'dietary' && (
                  <div className="filter-dropdown-menu">
                    {dietaryFilter && (
                      <button
                        className="filter-dropdown-option"
                        onClick={() => { setDietaryFilter(null); setOpenDropdown(null); }}
                      >
                        Any Dietary
                      </button>
                    )}
                    {dietaryOptions.filter(d => d.key !== dietaryFilter).map(d => (
                      <button
                        key={d.key}
                        className="filter-dropdown-option"
                        onClick={() => { setDietaryFilter(d.key); setOpenDropdown(null); }}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {hasActiveFilter && (
              <button className="clear-filters-btn" onClick={clearFilters}>
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      <main className="page-content">
        {recipes.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📖</div>
            <h3>Your cookbook is empty</h3>
            <p>Recipes you've cooked will be saved here automatically</p>
            <button className="start-cooking-btn" onClick={() => navigate('/')}>
              Start Cooking
            </button>
            <button className="import-recipe-text-btn" onClick={() => setShowImportModal(true)}>
              Or import an existing recipe
            </button>
          </div>
        ) : (
          <div className="card-list">
            {filteredRecipes.length === 0 && hasActiveFilter ? (
              <div className="empty-state">
                <h3>No matching recipes</h3>
                <p>{[
                  activeTagFilter && `Tag: ${activeTagFilter}`,
                  ratingFilter && `${ratingFilter}+ stars`,
                  cuisineFilter,
                  difficultyFilter && `Difficulty ${difficultyFilter}`,
                  dietaryFilter && dietaryOptions.find(d => d.key === dietaryFilter)?.label
                ].filter(Boolean).join(' · ')}</p>
                <button className="start-cooking-btn" onClick={clearFilters}>
                  Clear Filters
                </button>
              </div>
            ) : filteredRecipes.map((recipe) => {
              const index = recipes.indexOf(recipe);
              return (
              <div key={index} className="recipe-card">
                {editMode && (
                  <button className="delete-badge" onClick={() => deleteRecipe(index)}>
                    <X size={14} />
                  </button>
                )}
                {/* Header */}
                <div className="recipe-card-header">
                  <div className="recipe-card-info">
                    <h3>{recipe.title}</h3>
                    <div className="recipe-meta">
                      <span>{formatDate(recipe.cookedDate)}</span>
                      {recipe.cookSessions && recipe.cookSessions.length > 1 && (
                        <span className="cook-count-badge">Cooked {recipe.cookSessions.length} times</span>
                      )}
                    </div>
                    {recipe.metadata && (
                      <div className="recipe-metadata-row">
                        {recipe.metadata.discovery?.cuisine && (
                          <span className="metadata-badge cuisine">{recipe.metadata.discovery.cuisine}</span>
                        )}
                        {recipe.metadata.execution?.time?.totalMinutes && (
                          <span className="metadata-badge time">{recipe.metadata.execution.time.totalMinutes} min</span>
                        )}
                        {recipe.metadata.execution?.difficulty?.level && (
                          <span className="metadata-badge difficulty">
                            {'●'.repeat(recipe.metadata.execution.difficulty.level)}{'○'.repeat(3 - recipe.metadata.execution.difficulty.level)}
                          </span>
                        )}
                        {recipe.metadata.discovery?.dietary?.vegetarian && (
                          <span className="metadata-badge dietary">V</span>
                        )}
                        {recipe.metadata.discovery?.dietary?.vegan && (
                          <span className="metadata-badge dietary">VG</span>
                        )}
                        {recipe.metadata.discovery?.dietary?.glutenFree && (
                          <span className="metadata-badge dietary">GF</span>
                        )}
                      </div>
                    )}
                    {(recipe.tags || []).length > 0 && (
                      <div className="recipe-tags">
                        {recipe.tags.map(tag => (
                          <span key={tag} className="recipe-tag">{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="card-actions">
                    <button className="cook-btn-inline" onClick={() => cookAgain(recipe)}>
                      Cook Again
                    </button>
                    <div className="overflow-menu-wrapper" ref={openMenuId === recipe.recipeId ? menuRef : null}>
                      <button className="overflow-btn" onClick={() => setOpenMenuId(openMenuId === recipe.recipeId ? null : recipe.recipeId)}>
                        <MoreHorizontal size={18} />
                      </button>
                      {openMenuId === recipe.recipeId && (
                        <div className="overflow-menu">
                          <button className="overflow-menu-item" onClick={() => saveToWishlist(recipe)}>
                            Save to Wishlist
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Rating */}
                {recipe.rating > 0 && (
                  <div className="stars">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        size={18}
                        className={star <= recipe.rating ? 'star-filled' : 'star-empty'}
                      />
                    ))}
                  </div>
                )}

                {/* Sub-ratings */}
                {(recipe.tasteRating > 0 || recipe.effortRating > 0) && (
                  <>
                    <button
                      className="rating-details-toggle"
                      onClick={() => setExpandedRating(expandedRating === index ? null : index)}
                    >
                      Details {expandedRating === index ? '▼' : '▶'}
                    </button>
                    {expandedRating === index && (
                      <div className="sub-ratings-display">
                        {recipe.tasteRating > 0 && (
                          <div className="sub-rating-display-row">
                            <span className="sub-rating-display-label">Taste</span>
                            <div className="sub-rating-display-stars">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  size={14}
                                  className={star <= recipe.tasteRating ? 'star-filled' : 'star-empty'}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                        {recipe.effortRating > 0 && (
                          <div className="sub-rating-display-row">
                            <span className="sub-rating-display-label">Effort</span>
                            <div className="sub-rating-display-stars">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  size={14}
                                  className={star <= recipe.effortRating ? 'star-filled' : 'star-empty'}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}

                {/* Notes */}
                {recipe.notes && (
                  <div className="recipe-notes">
                    <p className="notes-label">Tips for next time:</p>
                    <p className="notes-text">{recipe.notes}</p>
                  </div>
                )}

                {/* Photos */}
                {recipe.sessionPhotos && recipe.sessionPhotos.length > 0 && (
                  <>
                    <button
                      className="view-photos-btn"
                      onClick={() => togglePhotos(index)}
                    >
                      {expandedRecipe === index ? 'Hide' : 'View'} {recipe.sessionPhotos.length} Photo{recipe.sessionPhotos.length > 1 ? 's' : ''}
                    </button>
                    {expandedRecipe === index && (
                      <div className="photos-gallery">
                        {recipe.sessionPhotos.map((photoData, photoIndex) => {
                          const photo = typeof photoData === 'string' ? photoData : photoData.photo;
                          return (
                            <div key={photoIndex} className="photo-thumb">
                              <img src={photo} alt={`Cooking step ${photoIndex + 1}`} />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}

                {recipe.cookSessions && recipe.cookSessions.length > 1 && (
                  <>
                    <button
                      className="view-sessions-btn"
                      onClick={() => setExpandedSessions(expandedSessions === index ? null : index)}
                    >
                      {expandedSessions === index ? 'Hide' : 'View'} Past Cooks
                    </button>
                    {expandedSessions === index && (
                      <div className="cook-sessions-list">
                        {recipe.cookSessions.slice(1).map((session, si) => (
                          <div key={si} className="cook-session-item">
                            <span className="session-date">{formatDate(session.date)}</span>
                            {session.rating > 0 && (
                              <span className="session-stars">
                                {'★'.repeat(session.rating)}{'☆'.repeat(5 - session.rating)}
                              </span>
                            )}
                            {session.notes && (
                              <span className="session-notes">{session.notes}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}

              </div>
            );
            })}
          </div>
        )}
      </main>

      {showImportModal && (
        <div className="modal-overlay" onClick={() => !importLoading && setShowImportModal(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Import Recipe</h2>
              <button className="modal-close-btn" onClick={() => !importLoading && setShowImportModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="import-modal-tabs">
              <button
                className={`import-tab ${importMode === 'text' ? 'active' : ''}`}
                onClick={() => { setImportMode('text'); setImportError(''); }}
              >
                Paste Text
              </button>
              <button
                className={`import-tab ${importMode === 'photo' ? 'active' : ''}`}
                onClick={() => { setImportMode('photo'); setImportError(''); }}
              >
                Photo
              </button>
            </div>
            <div className="modal-body">
              {importMode === 'text' ? (
                <textarea
                  className="import-textarea"
                  placeholder="Paste your recipe here — from notes, messages, or anywhere..."
                  value={importText}
                  onChange={e => setImportText(e.target.value)}
                  disabled={importLoading}
                />
              ) : (
                <div className="import-photo-upload">
                  {importPhoto ? (
                    <div className="import-photo-preview">
                      <img src={importPhoto} alt="Recipe" />
                      <button className="import-photo-change" onClick={() => setImportPhoto(null)}>
                        Change Photo
                      </button>
                    </div>
                  ) : (
                    <>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImportPhotoUpload}
                        style={{ display: 'none' }}
                        id="import-recipe-photo"
                      />
                      <label htmlFor="import-recipe-photo" className="import-photo-label">
                        <Upload size={24} />
                        <span>Upload a photo of your recipe</span>
                      </label>
                    </>
                  )}
                </div>
              )}
              {importError && <p className="import-error">{importError}</p>}
              <button
                className="import-submit-btn"
                onClick={handleImportRecipe}
                disabled={importLoading || (importMode === 'text' ? !importText.trim() : !importPhoto)}
              >
                {importLoading ? 'Importing...' : 'Import to Cookbook'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MyRecipes;
