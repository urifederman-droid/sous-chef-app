import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Anthropic from '@anthropic-ai/sdk';
import { uploadPhoto } from './firebaseStorage';
import './CookingMode.css';

function compressImage(base64DataUrl, maxWidth = 1024) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ratio = Math.min(maxWidth / img.width, maxWidth / img.height, 1);
      canvas.width = img.width * ratio;
      canvas.height = img.height * ratio;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.src = base64DataUrl;
  });
}

function CookingMode() {
  const navigate = useNavigate();
  const [recipe, setRecipe] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showIngredients, setShowIngredients] = useState(true);
  const [sessionPhotos, setSessionPhotos] = useState([]);

  useEffect(() => {
    const savedRecipe = localStorage.getItem('currentRecipe');
    if (savedRecipe) {
      setRecipe(JSON.parse(savedRecipe));
    } else {
      navigate('/');
    }
  }, [navigate]);

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const compressed = await compressImage(reader.result);
        setPhotoPreview(compressed);
      };
      reader.readAsDataURL(file);
    }
  };

  const getAIFeedback = async () => {
    if (!photoPreview) return;
    
    setLoading(true);
    setFeedback('');
    
    try {
      const anthropic = new Anthropic({
        apiKey: process.env.REACT_APP_ANTHROPIC_API_KEY,
        dangerouslyAllowBrowser: true
      });

      const base64Image = photoPreview.split(',')[1];
      const step = recipe.steps[currentStep];

      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
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
              text: `I'm cooking: ${recipe.title}

Current step (${currentStep + 1}/${recipe.steps.length}): ${step.instruction}

Please analyze this photo and tell me:
1. Does this look correct for this step?
2. Is it done, or does it need more time?
3. Any technique tips for a beginner?
4. What should I look for visually to know it's ready?

Be encouraging and specific!`
            }
          ]
        }]
      });

      const feedbackText = message.content[0].text;
      setFeedback(feedbackText);

      // Upload photo to Firebase Storage and save URL
      setUploading(true);
      let photoUrl = photoPreview; // fallback to base64 if upload fails
      try {
        photoUrl = await uploadPhoto(photoPreview);
      } catch (uploadError) {
        console.error('Photo upload failed, using base64 fallback:', uploadError);
      }
      setUploading(false);

      setSessionPhotos([...sessionPhotos, {
        stepNumber: currentStep + 1,
        photo: photoUrl,
        feedback: feedbackText
      }]);
    } catch (error) {
      console.error('Error getting feedback:', error);
      setFeedback('Sorry, I had trouble analyzing the photo. Please try again!');
    }
    
    setLoading(false);
  };

  const nextStep = () => {
    setPhotoPreview(null);
    setFeedback('');
    if (currentStep < recipe.steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      finishCooking();
    }
  };

  const finishCooking = () => {
    const savedRecipes = JSON.parse(localStorage.getItem('savedRecipes') || '[]');
    const recipeWithDate = { 
      ...recipe, 
      cookedDate: new Date().toISOString(),
      sessionPhotos: sessionPhotos
    };
    savedRecipes.unshift(recipeWithDate);
    localStorage.setItem('savedRecipes', JSON.stringify(savedRecipes));
    navigate('/complete');
  };

  if (!recipe) return null;

  const progress = ((currentStep + 1) / recipe.steps.length) * 100;

  return (
    <div className="cooking-mode">
      <div className="cooking-header">
        <button className="back-btn" onClick={() => navigate('/')}>Exit</button>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progress}%` }}></div>
        </div>
        <div className="step-counter">Step {currentStep + 1} of {recipe.steps.length}</div>
      </div>

      <div className="pinned-recipe">
        <div className="recipe-title-bar" onClick={() => setShowIngredients(!showIngredients)}>
          <h2>{recipe.title}</h2>
          <button className="toggle-btn">
            {showIngredients ? '▼' : '▶'}
          </button>
        </div>
        
        {showIngredients && (
          <div className="ingredients-section">
            <h3>Ingredients</h3>
            <ul>
              {recipe.ingredients.map((ingredient, index) => (
                <li key={index}>
                  {ingredient.amount} {ingredient.item}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="cooking-content">
        <div className="current-step">
          <h3>Step {currentStep + 1}</h3>
          <p className="instruction">{recipe.steps[currentStep].instruction}</p>
          {recipe.steps[currentStep].tip && (
            <p className="tip">💡 {recipe.steps[currentStep].tip}</p>
          )}
        </div>

        <div className="photo-section">
          <p className="photo-prompt">Ready to check your progress? Take a photo!</p>
          
          <input
            type="file"
            accept="image/*"
            onChange={handlePhotoUpload}
            style={{ display: 'none' }}
            id="photo-input"
          />
          
          <label htmlFor="photo-input" className="photo-btn">
            📸 Add Photo
          </label>

          {photoPreview && (
            <div className="photo-preview">
              <img src={photoPreview} alt="Your cooking" />
              <button 
                className="analyze-btn" 
                onClick={getAIFeedback}
                disabled={loading}
              >
                {loading ? 'Analyzing...' : 'Get AI Feedback'}
              </button>
            </div>
          )}

          {uploading && (
            <div className="upload-status">Saving photo...</div>
          )}

          {feedback && (
            <div className="feedback">
              <h4>Chef's Feedback:</h4>
              <p>{feedback}</p>
            </div>
          )}
        </div>

        <button className="next-btn" onClick={nextStep}>
          {currentStep === recipe.steps.length - 1 ? 'Finish Cooking! 🎉' : 'Next Step →'}
        </button>
      </div>
    </div>
  );
}

export default CookingMode;
