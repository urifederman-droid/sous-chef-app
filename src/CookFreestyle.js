import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Anthropic from '@anthropic-ai/sdk';
import './CookFreestyle.css';

function CookFreestyle() {
  const navigate = useNavigate();
  const [photoPreview, setPhotoPreview] = useState(null);
  const [dishDescription, setDishDescription] = useState('');
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationHistory, setConversationHistory] = useState([]);

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

  const getAIFeedback = async () => {
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
              text: dishDescription 
                ? `I'm cooking: ${dishDescription}

Please analyze this photo and give me feedback:
1. Does this look correct?
2. What should I do next?
3. Any technique tips?
4. What should I look for to know it's ready?

Be encouraging and specific!`
                : `Please analyze this cooking photo and give me helpful feedback:
1. What do you see?
2. Does it look correct for this stage?
3. What should I do next?
4. Any tips for improvement?

Be encouraging and specific!`
            }
          ]
        }]
      });

      const newFeedback = message.content[0].text;
      setFeedback(newFeedback);
      setConversationHistory([...conversationHistory, { photo: photoPreview, feedback: newFeedback }]);
      setPhotoPreview(null);
    } catch (error) {
      console.error('Error getting feedback:', error);
      setFeedback('Sorry, I had trouble analyzing the photo. Please try again!');
    }
    
    setLoading(false);
  };

  return (
    <div className="cook-freestyle">
      <button className="back-btn" onClick={() => navigate('/')}>← Back</button>
      
      <div className="content">
        <h1>👨‍🍳 Cook Without Recipe</h1>
        <p className="subtitle">Get real-time feedback on anything you're cooking</p>

        <div className="dish-input-section">
          <label>What are you making? (optional)</label>
          <input
            type="text"
            className="dish-input"
            placeholder="e.g., 'pan-seared salmon' or 'stir fry vegetables'"
            value={dishDescription}
            onChange={(e) => setDishDescription(e.target.value)}
          />
        </div>

        <div className="photo-section">
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhotoUpload}
            style={{ display: 'none' }}
            id="freestyle-photo"
          />
          
          {!photoPreview ? (
            <label htmlFor="freestyle-photo" className="upload-btn">
              📸 Take Photo for Feedback
            </label>
          ) : (
            <div className="preview-section">
              <img src={photoPreview} alt="Your cooking" className="preview-image" />
              <button 
                className="analyze-btn" 
                onClick={getAIFeedback}
                disabled={loading}
              >
                {loading ? 'Analyzing...' : 'Get AI Feedback'}
              </button>
              <button 
                className="retake-btn" 
                onClick={() => setPhotoPreview(null)}
              >
                Take Another Photo
              </button>
            </div>
          )}

          {feedback && (
            <div className="feedback">
              <h4>🧑‍🍳 Chef's Feedback:</h4>
              <p>{feedback}</p>
            </div>
          )}
        </div>

        {conversationHistory.length > 0 && (
          <div className="history">
            <h3>Your Cooking Session</h3>
            {conversationHistory.map((item, index) => (
              <div key={index} className="history-item">
                <img src={item.photo} alt={`Step ${index + 1}`} />
                <p>{item.feedback}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default CookFreestyle;
