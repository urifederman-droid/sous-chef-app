import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Anthropic from '@anthropic-ai/sdk';
import { getUserPreferencesPrompt } from './userPreferences';
import './GenerateRecipe.css';

function GenerateRecipe() {
  const navigate = useNavigate();
  const location = useLocation();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (location.state?.query) {
      setInput(location.state.query);
    }
  }, [location]);

  const generateRecipe = async () => {
    if (!input.trim()) return;
    
    setLoading(true);
    try {
      const anthropic = new Anthropic({
        apiKey: process.env.REACT_APP_ANTHROPIC_API_KEY,
        dangerouslyAllowBrowser: true
      });

      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: `Generate a detailed recipe for: ${input}. 
          
          Format the recipe as JSON with this structure:
          {
            "title": "Recipe name",
            "description": "Brief description",
            "servings": 4,
            "prepTime": "15 minutes",
            "cookTime": "30 minutes",
            "ingredients": [
              {"item": "ingredient name", "amount": "quantity"}
            ],
            "steps": [
              {"number": 1, "instruction": "Step instruction", "tip": "Visual tip for beginners"}
            ]
          }
          
          Make it beginner-friendly with clear visual cues at each step.${getUserPreferencesPrompt()}`
        }]
      });

      const recipeText = message.content[0].text;
      const jsonMatch = recipeText.match(/\{[\s\S]*\}/);
      const recipe = jsonMatch ? JSON.parse(jsonMatch[0]) : null;

      if (recipe) {
        localStorage.setItem('currentRecipe', JSON.stringify(recipe));
        navigate('/cook');
      }
    } catch (error) {
      console.error('Error generating recipe:', error);
      alert('Failed to generate recipe. Please try again.');
    }
    setLoading(false);
  };

  return (
    <div className="generate-recipe">
      <button className="back-btn" onClick={() => navigate('/')}>Back</button>
      
      <div className="content">
        <h1>Generate Recipe</h1>
        
        <textarea
          className="recipe-input"
          placeholder="Describe what you'd like to cook..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={5}
        />
        
        <button 
          className="generate-btn" 
          onClick={generateRecipe}
          disabled={loading || !input.trim()}
        >
          {loading ? 'Generating...' : 'Generate Recipe'}
        </button>
      </div>
    </div>
  );
}

export default GenerateRecipe;
