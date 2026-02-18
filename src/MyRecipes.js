import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './MyRecipes.css';

function MyRecipes() {
  const navigate = useNavigate();
  const [recipes, setRecipes] = useState([]);
  const [expandedRecipe, setExpandedRecipe] = useState(null);

  useEffect(() => {
    const savedRecipes = JSON.parse(localStorage.getItem('savedRecipes') || '[]');
    setRecipes(savedRecipes);
  }, []);

  const cookAgain = (recipe) => {
    // If recipe has chat history, extract the original recipe from first message
    if (recipe.chatHistory && recipe.chatHistory[0]) {
      localStorage.setItem('pendingRecipeRequest', recipe.title);
      navigate('/cook');
    } else {
      // Old format - use ingredient check
      localStorage.setItem('currentRecipe', JSON.stringify(recipe));
      navigate('/ingredient-check');
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const togglePhotos = (index) => {
    setExpandedRecipe(expandedRecipe === index ? null : index);
  };

  return (
    <div className="my-recipes">
      <button className="back-btn" onClick={() => navigate('/')}>Back</button>
      
      <div className="content">
        <h1>My Recipes</h1>
        
        {recipes.length === 0 ? (
          <div className="empty-state">
            <p>You haven't cooked anything yet!</p>
            <button className="start-btn" onClick={() => navigate('/')}>
              Start Cooking
            </button>
          </div>
        ) : (
          <div className="recipe-list">
            {recipes.map((recipe, index) => (
              <div key={index} className="recipe-card">
                <div className="recipe-main">
                  <div className="recipe-info">
                    <h3>{recipe.title}</h3>
                    <p className="date">Cooked on {formatDate(recipe.cookedDate)}</p>
                    {recipe.rating > 0 && (
                      <div className="rating-display">
                        {'★'.repeat(recipe.rating)}{'☆'.repeat(5 - recipe.rating)}
                      </div>
                    )}
                    {recipe.notes && (
                      <p className="notes">"{recipe.notes}"</p>
                    )}
                    {recipe.sessionPhotos && recipe.sessionPhotos.length > 0 && (
                      <button 
                        className="view-photos-btn"
                        onClick={() => togglePhotos(index)}
                      >
                        {expandedRecipe === index ? 'Hide' : 'View'} {recipe.sessionPhotos.length} Photo{recipe.sessionPhotos.length > 1 ? 's' : ''}
                      </button>
                    )}
                  </div>
                  <button 
                    className="cook-again-btn"
                    onClick={() => cookAgain(recipe)}
                  >
                    Cook Again
                  </button>
                </div>

                {expandedRecipe === index && recipe.sessionPhotos && (
                  <div className="photos-gallery">
                    {recipe.sessionPhotos.map((photoData, photoIndex) => {
                      const photo = typeof photoData === 'string' ? photoData : photoData.photo;
                      return (
                        <div key={photoIndex} className="photo-item">
                          <img src={photo} alt={`Cooking photo ${photoIndex + 1}`} />
                          {photoData.feedback && <div className="photo-feedback">{photoData.feedback}</div>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default MyRecipes;
