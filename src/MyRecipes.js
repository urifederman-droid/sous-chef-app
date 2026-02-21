import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Star, X, ChevronDown } from 'lucide-react';
import './MyRecipes.css';

function MyRecipes() {
  const navigate = useNavigate();
  const [recipes, setRecipes] = useState([]);
  const [expandedRecipe, setExpandedRecipe] = useState(null);
  const [expandedRating, setExpandedRating] = useState(null);
  const [editingRecipe, setEditingRecipe] = useState(null);
  const [activeTagFilter, setActiveTagFilter] = useState(null);
  const [ratingFilter, setRatingFilter] = useState(null);
  const [openDropdown, setOpenDropdown] = useState(null);

  const TAG_CATEGORIES = {
    'Occasion': ['Great for Hosting', 'Great for Kids', 'Weeknight Friendly', 'Date Night', 'Meal Prep Friendly'],
    'Character': ['Healthy / Light', 'Comfort Food', 'Budget Friendly'],
    'Flavor': ['Sweet', 'Salty', 'Sour', 'Spicy', 'Umami', 'Rich']
  };

  useEffect(() => {
    const savedRecipes = JSON.parse(localStorage.getItem('savedRecipes') || '[]');
    setRecipes(savedRecipes);
  }, []);

  const allTags = [...new Set(recipes.flatMap(r => r.tags || []))];
  const hasAnyFilters = allTags.length > 0 || recipes.some(r => r.rating > 0);

  const filteredRecipes = recipes.filter(r => {
    if (activeTagFilter && !(r.tags || []).includes(activeTagFilter)) return false;
    if (ratingFilter && (r.rating || 0) < ratingFilter) return false;
    return true;
  });

  const hasActiveFilter = activeTagFilter || ratingFilter;

  const clearFilters = () => {
    setActiveTagFilter(null);
    setRatingFilter(null);
    setOpenDropdown(null);
  };

  const filterBarRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (filterBarRef.current && !filterBarRef.current.contains(e.target)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const toggleDropdown = (name) => {
    setOpenDropdown(openDropdown === name ? null : name);
  };

  const cookAgain = (recipe) => {
    if (recipe.chatHistory && recipe.chatHistory[0]) {
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
    setEditingRecipe(null);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const togglePhotos = (index) => {
    setExpandedRecipe(expandedRecipe === index ? null : index);
  };

  return (
    <div className="my-recipes-page">
      <header className="page-header">
        <div className="header-left">
          <button className="back-btn" onClick={() => navigate('/')}>
            <ArrowLeft size={20} />
          </button>
          <h1>My Recipes</h1>
        </div>
      </header>

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
            <h3>No recipes yet</h3>
            <p>Finish cooking a recipe to see it here</p>
            <button className="start-cooking-btn" onClick={() => navigate('/')}>
              Start Cooking
            </button>
          </div>
        ) : (
          <div className="card-list">
            {filteredRecipes.length === 0 && hasActiveFilter ? (
              <div className="empty-state">
                <h3>No matching recipes</h3>
                <p>{activeTagFilter ? `Tag: ${activeTagFilter}` : ''}{activeTagFilter && ratingFilter ? ' · ' : ''}{ratingFilter ? `${ratingFilter}+ stars` : ''}</p>
                <button className="start-cooking-btn" onClick={clearFilters}>
                  Clear Filters
                </button>
              </div>
            ) : filteredRecipes.map((recipe) => {
              const index = recipes.indexOf(recipe);
              return (
              <div key={index} className="recipe-card">
                {/* Header */}
                <div className="recipe-card-header">
                  <div className="recipe-card-info">
                    <h3>{recipe.title}</h3>
                    <div className="recipe-meta">
                      <span>{formatDate(recipe.cookedDate)}</span>
                    </div>
                    {(recipe.tags || []).length > 0 && (
                      <div className="recipe-tags">
                        {recipe.tags.map(tag => (
                          <span key={tag} className="recipe-tag">{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    className="menu-btn"
                    onClick={() => setEditingRecipe(editingRecipe === index ? null : index)}
                  >
                    {editingRecipe === index ? <X size={16} /> : '⋮'}
                  </button>
                </div>

                {/* Delete option */}
                {editingRecipe === index && (
                  <button
                    className="delete-recipe-btn"
                    onClick={() => deleteRecipe(index)}
                  >
                    Delete Recipe
                  </button>
                )}

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

                {/* Cook Again */}
                <button
                  className="cook-again-btn"
                  onClick={() => cookAgain(recipe)}
                >
                  Cook Again
                </button>
              </div>
            );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

export default MyRecipes;
