import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './CookingComplete.css';

function CookingComplete() {
  const navigate = useNavigate();
  const [rating, setRating] = useState(0);
  const [notes, setNotes] = useState('');

  const saveAndContinue = () => {
    const savedRecipes = JSON.parse(localStorage.getItem('savedRecipes') || '[]');
    if (savedRecipes.length > 0) {
      savedRecipes[0].rating = rating;
      savedRecipes[0].notes = notes;
      localStorage.setItem('savedRecipes', JSON.stringify(savedRecipes));
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
