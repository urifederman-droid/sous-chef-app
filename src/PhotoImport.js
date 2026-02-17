import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Anthropic from '@anthropic-ai/sdk';
import { getUserPreferencesPrompt } from './userPreferences';
import './PhotoImport.css';

function PhotoImport() {
  const navigate = useNavigate();
  const [photoPreview, setPhotoPreview] = useState(null);
  const [loading, setLoading] = useState(false);

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const processRecipe = async () => {
    if (!photoPreview) return;
    
    setLoading(true);
    try {
      const anthropic = new Anthropic({
        apiKey: process.env.REACT_APP_ANTHROPIC_API_KEY,
        dangerouslyAllowBrowser: true
      });

      const base64Image = photoPreview.split(',')[1];

      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: base64Image
              }
            },
            {
              type: 'text',
              text: `Please extract the recipe from this cookbook page and convert it into a beginner-friendly format. If the recipe is in a language other than English, translate it to English.

Format as JSON:
{
  "title": "Recipe name",
  "description": "Brief description",
  "servings": 4,
  "prepTime": "time",
  "cookTime": "time",
  "ingredients": [
    {"item": "ingredient", "amount": "quantity"}
  ],
  "steps": [
    {"number": 1, "instruction": "Clear, detailed instruction", "tip": "Visual cue for beginners"}
  ]
}

Make instructions very clear and add helpful tips for each step.${getUserPreferencesPrompt()}`
            }
          ]
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
      console.error('Error processing recipe:', error);
      alert('Failed to process recipe. Please try again.');
    }
    setLoading(false);
  };

  return (
    <div className="photo-import">
      <button className="back-btn" onClick={() => navigate('/')}>Back</button>
      
      <div className="content">
        <h1>Photo of Cookbook</h1>
        <p className="subtitle">Take a picture of any recipe page</p>
        
        <input
          type="file"
          accept="image/*"
          onChange={handlePhotoUpload}
          style={{ display: 'none' }}
          id="cookbook-photo"
        />
        
        {!photoPreview ? (
          <label htmlFor="cookbook-photo" className="upload-btn">
            Take or Upload Photo
          </label>
        ) : (
          <div className="preview-section">
            <img src={photoPreview} alt="Cookbook page" className="preview-image" />
            <button 
              className="process-btn" 
              onClick={processRecipe}
              disabled={loading}
            >
              {loading ? 'Processing...' : 'Convert to Interactive Recipe'}
            </button>
            <button 
              className="retake-btn" 
              onClick={() => setPhotoPreview(null)}
            >
              Take Another Photo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default PhotoImport;
