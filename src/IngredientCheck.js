import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Anthropic from '@anthropic-ai/sdk';
import { getUserPreferencesPrompt, logPassiveSignal } from './userPreferences';
import './IngredientCheck.css';

function IngredientCheck() {
  const navigate = useNavigate();
  const [recipe, setRecipe] = useState(null);
  const [checkedIngredients, setCheckedIngredients] = useState({});
  // const [substitutionRequests, setSubstitutionRequests] = useState({});
  const [substitutions, setSubstitutions] = useState({});
  const [loadingSubstitution, setLoadingSubstitution] = useState(null);

  useEffect(() => {
    const savedRecipe = localStorage.getItem('currentRecipe');
    if (savedRecipe) {
      const parsedRecipe = JSON.parse(savedRecipe);
      setRecipe(parsedRecipe);
      
      // Initialize all ingredients as checked
      const initialChecked = {};
      parsedRecipe.ingredients.forEach((_, index) => {
        initialChecked[index] = true;
      });
      setCheckedIngredients(initialChecked);
    } else {
      navigate('/');
    }
  }, [navigate]);

  const toggleIngredient = (index) => {
    setCheckedIngredients({
      ...checkedIngredients,
      [index]: !checkedIngredients[index]
    });
  };

  const requestSubstitution = async (index) => {
    setLoadingSubstitution(index);
    
    try {
      const anthropic = new Anthropic({
        apiKey: process.env.REACT_APP_ANTHROPIC_API_KEY,
        dangerouslyAllowBrowser: true
      });

      const ingredient = recipe.ingredients[index];

      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: `I'm making ${recipe.title} but I don't have ${ingredient.item}. 
          
          Suggest a good substitute that:
          1. Works for this specific recipe
          2. Is commonly available
          3. Won't dramatically change the dish
          
          Be brief and specific. Format: "Use [substitute] - [one sentence why it works]"${getUserPreferencesPrompt()}`
        }]
      });

      const suggestion = message.content[0].text;
      setSubstitutions({
        ...substitutions,
        [index]: suggestion
      });
      logPassiveSignal('substitution', { missing: ingredient.item, recipe: recipe.title });
    } catch (error) {
      console.error('Error getting substitution:', error);
      alert('Failed to get substitution. Please try again.');
    }
    
    setLoadingSubstitution(null);
  };

  const startCooking = () => {
    // Update recipe with substitution notes if any
    const updatedRecipe = { ...recipe };
    
    // Add substitution info to recipe steps if needed
    if (Object.keys(substitutions).length > 0) {
      updatedRecipe.substitutionNotes = substitutions;
    }
    
    localStorage.setItem('currentRecipe', JSON.stringify(updatedRecipe));
    navigate('/cook');
  };

  if (!recipe) return null;

  const missingCount = Object.values(checkedIngredients).filter(v => !v).length;

  return (
    <div className="ingredient-check">
      <button className="back-btn" onClick={() => navigate('/')}>← Back</button>
      
      <div className="content">
        <h1>Check Your Ingredients</h1>
        <p className="subtitle">Make sure you have everything you need</p>

        <div className="recipe-header">
          <h2>{recipe.title}</h2>
          <p className="servings">Serves {recipe.servings}</p>
        </div>

        <div className="ingredients-list">
          {recipe.ingredients.map((ingredient, index) => (
            <div key={index} className="ingredient-item">
              <div className="ingredient-main">
                <label className="checkbox-container">
                  <input
                    type="checkbox"
                    checked={checkedIngredients[index]}
                    onChange={() => toggleIngredient(index)}
                  />
                  <span className="checkmark"></span>
                  <span className={checkedIngredients[index] ? 'checked' : 'unchecked'}>
                    {ingredient.amount} {ingredient.item}
                  </span>
                </label>
                
                {!checkedIngredients[index] && !substitutions[index] && (
                  <button 
                    className="substitute-btn"
                    onClick={() => requestSubstitution(index)}
                    disabled={loadingSubstitution === index}
                  >
                    {loadingSubstitution === index ? 'Finding...' : 'Find Substitute'}
                  </button>
                )}
              </div>
              
              {substitutions[index] && (
                <div className="substitution">
                  <strong>Substitute:</strong> {substitutions[index]}
                </div>
              )}
            </div>
          ))}
        </div>

        {missingCount > 0 && (
          <div className="warning">
            <p>⚠️ You're missing {missingCount} ingredient{missingCount > 1 ? 's' : ''}. Consider finding substitutes or getting them first.</p>
          </div>
        )}

        <button className="start-cooking-btn" onClick={startCooking}>
          Start Cooking
        </button>
      </div>
    </div>
  );
}

export default IngredientCheck;
