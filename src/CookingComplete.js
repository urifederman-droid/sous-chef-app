import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Anthropic from '@anthropic-ai/sdk';
import { extractAndMergeSessionSignal } from './userPreferences';
import './CookingComplete.css';

const TAG_CATEGORIES = {
  'Occasion': ['Great for Hosting', 'Great for Kids', 'Weeknight Friendly', 'Date Night', 'Meal Prep Friendly'],
  'Character': ['Healthy / Light', 'Comfort Food', 'Budget Friendly'],
  'Flavor': ['Sweet', 'Salty', 'Sour', 'Spicy', 'Umami', 'Rich']
};
const ALL_DEFAULT_TAGS = Object.values(TAG_CATEGORIES).flat();

function CookingComplete() {
  const navigate = useNavigate();
  const [rating, setRating] = useState(0);
  const [tasteRating, setTasteRating] = useState(0);
  const [effortRating, setEffortRating] = useState(0);
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState([]);
  const [loadingTags, setLoadingTags] = useState(false);
  const [showAddTag, setShowAddTag] = useState(false);
  const [customTagInput, setCustomTagInput] = useState('');

  useEffect(() => {
    const suggestTags = async () => {
      try {
        const savedRecipes = JSON.parse(localStorage.getItem('savedRecipes') || '[]');
        if (savedRecipes.length === 0 || !savedRecipes[0].chatHistory) return;

        const recipeText = savedRecipes[0].chatHistory
          .filter(msg => msg.role === 'assistant')
          .map(msg => typeof msg.content === 'string' ? msg.content : '')
          .join('\n');

        if (!recipeText.trim()) return;

        setLoadingTags(true);
        const anthropic = new Anthropic({
          apiKey: process.env.REACT_APP_ANTHROPIC_API_KEY,
          dangerouslyAllowBrowser: true
        });

        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 200,
          messages: [{
            role: 'user',
            content: `Analyze this recipe and suggest 3-5 tags from this list: ${JSON.stringify(ALL_DEFAULT_TAGS)}. Respond with only a JSON array of strings, nothing else.\n\nRecipe:\n${recipeText.slice(0, 3000)}`
          }]
        });

        const text = response.content[0].text.trim();
        const suggested = JSON.parse(text);
        if (Array.isArray(suggested)) {
          setTags(suggested.filter(t => typeof t === 'string'));
        }
      } catch (err) {
        // Silently fail — user can add tags manually
      } finally {
        setLoadingTags(false);
      }
    };
    suggestTags();
  }, []);

  const removeTag = (tag) => setTags(tags.filter(t => t !== tag));
  const addTag = (tag) => {
    if (!tags.includes(tag)) setTags([...tags, tag]);
    setShowAddTag(false);
  };
  const addCustomTag = () => {
    const trimmed = customTagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
    }
    setCustomTagInput('');
    setShowAddTag(false);
  };

  const saveAndContinue = () => {
    const savedRecipes = JSON.parse(localStorage.getItem('savedRecipes') || '[]');
    if (savedRecipes.length > 0) {
      savedRecipes[0].rating = rating;
      savedRecipes[0].tasteRating = tasteRating;
      savedRecipes[0].effortRating = effortRating;
      savedRecipes[0].notes = notes;
      savedRecipes[0].tags = tags;
      localStorage.setItem('savedRecipes', JSON.stringify(savedRecipes));

      // Fire-and-forget: extract signals from this cooking session
      extractAndMergeSessionSignal(savedRecipes[0]).catch(() => {});
    }
    navigate('/');
  };

  return (
    <div className="cooking-complete">
      <div className="celebration">
        <div className="confetti">🎉</div>
        <h1>You did it!</h1>
        <p>Your dish is complete</p>
      </div>

      <div className="feedback-form">
        <h3>How did it turn out?</h3>

        <div className="rating">
          {[1, 2, 3, 4, 5].map((star) => (
            <span
              key={star}
              className={`star ${star <= rating ? 'filled' : ''}`}
              onClick={() => setRating(star)}
            >
              ★
            </span>
          ))}
        </div>

        <div className="sub-ratings">
          <div className="sub-rating-row">
            <span className="sub-rating-label">Taste</span>
            <div className="sub-rating-stars">
              {[1, 2, 3, 4, 5].map((star) => (
                <span
                  key={star}
                  className={`star ${star <= tasteRating ? 'filled' : ''}`}
                  onClick={() => setTasteRating(star)}
                >
                  ★
                </span>
              ))}
            </div>
          </div>
          <div className="sub-rating-row">
            <span className="sub-rating-label">Effort</span>
            <div className="sub-rating-stars">
              {[1, 2, 3, 4, 5].map((star) => (
                <span
                  key={star}
                  className={`star ${star <= effortRating ? 'filled' : ''}`}
                  onClick={() => setEffortRating(star)}
                >
                  ★
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="tags-section">
          <div className="tags-label">Tags</div>
          {loadingTags ? (
            <div className="tags-loading">Suggesting tags...</div>
          ) : (
            <>
              {Object.entries(TAG_CATEGORIES).map(([category, categoryTags]) => {
                const selected = categoryTags.filter(t => tags.includes(t));
                if (selected.length === 0) return null;
                return (
                  <div key={category} className="tag-category-group">
                    <div className="tag-category-label">{category}</div>
                    <div className="tags-container">
                      {selected.map((tag) => (
                        <span key={tag} className="tag-chip">
                          {tag}
                          <button className="tag-remove-btn" onClick={() => removeTag(tag)}>×</button>
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
              {tags.filter(t => !ALL_DEFAULT_TAGS.includes(t)).length > 0 && (
                <div className="tag-category-group">
                  <div className="tag-category-label">Custom</div>
                  <div className="tags-container">
                    {tags.filter(t => !ALL_DEFAULT_TAGS.includes(t)).map((tag) => (
                      <span key={tag} className="tag-chip">
                        {tag}
                        <button className="tag-remove-btn" onClick={() => removeTag(tag)}>×</button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <button className="add-tag-btn" onClick={() => setShowAddTag(!showAddTag)}>+ Add Tag</button>
              {showAddTag && (
                <div className="add-tag-menu">
                  {Object.entries(TAG_CATEGORIES).map(([category, categoryTags]) => {
                    const available = categoryTags.filter(t => !tags.includes(t));
                    if (available.length === 0) return null;
                    return (
                      <div key={category} className="add-tag-category">
                        <div className="add-tag-category-label">{category}</div>
                        <div className="default-tags">
                          {available.map((tag) => (
                            <button key={tag} className="default-tag-option" onClick={() => addTag(tag)}>
                              {tag}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  <div className="custom-tag-input">
                    <input
                      type="text"
                      placeholder="Custom tag..."
                      value={customTagInput}
                      onChange={(e) => setCustomTagInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addCustomTag()}
                    />
                    <button onClick={addCustomTag}>Add</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <textarea
          className="notes-input"
          placeholder="Any notes? What worked well? What would you change next time?"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
        />

        <button className="done-btn" onClick={saveAndContinue}>
          Save & Return Home
        </button>
      </div>
    </div>
  );
}

export default CookingComplete;
