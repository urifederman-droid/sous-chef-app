/* eslint-disable */
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Anthropic from '@anthropic-ai/sdk';
import './ChatCookingMode.css';

function ChatCookingMode() {
  const navigate = useNavigate();
  const [recipe, setRecipe] = useState(null);
  const [messages, setMessages] = useState([]);
  const [userInput, setUserInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPinnedRecipe, setShowPinnedRecipe] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [pinnedRecipe, setPinnedRecipe] = useState(null);
  // const [sessionPhotos, setSessionPhotos] = useState([]);
  const messagesEndRef = useRef(null);
  // const fileInputRef = useRef(null);

  useEffect(() => {
    const pendingRequest = localStorage.getItem('pendingRecipeRequest');
    const savedRecipe = localStorage.getItem('currentRecipe');
    
    if (pendingRequest) {
      // User typed a recipe request from home
      localStorage.removeItem('pendingRecipeRequest');
      generateRecipeFromRequest(pendingRequest);
    } else if (savedRecipe) {
      // User imported/generated recipe elsewhere
      const parsedRecipe = JSON.parse(savedRecipe);
      setRecipe(parsedRecipe);
      generateInitialRecipe(parsedRecipe);
    } else {
      navigate('/');
    }
  }, [navigate]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

const parseRecipeText = (text) => {
    // Remove markdown symbols but preserve structure
    let formatted = text
      .replace(/#{1,6}\s/g, '') // Remove # headers
      .replace(/\*\*(.+?)\*\*/g, '$1') // Remove bold **
      .replace(/\*(.+?)\*/g, '$1') // Remove italic *
      .replace(/^>\s/gm, '') // Remove blockquotes >
      .replace(/^-\s/gm, '• '); // Convert - to bullets
    
    return formatted;
  };

    const generateInitialRecipe = async (recipeData) => {
    setLoading(true);
    try {
      const anthropic = new Anthropic({
        apiKey: process.env.REACT_APP_ANTHROPIC_API_KEY,
        dangerouslyAllowBrowser: true
      });
      const prompt = `You are a friendly, experienced sous chef helping a beginner cook.

Present this recipe in a warm, conversational style like you're texting a friend:

Recipe: ${recipeData.title}
Servings: ${recipeData.servings || 4}
Ingredients: ${JSON.stringify(recipeData.ingredients)}
Steps: ${JSON.stringify(recipeData.steps)}

Format it like this:
- Start with an emoji and title with servings (e.g., "🍝 Chicken Pasta for 4 People")
- Group ingredients by purpose (e.g., "For the sauce:", "For serving:")
- Include weights AND volumes when helpful
- Add helpful notes in parentheses (e.g., "start with less, adjust to taste")
- Write instructions conversationally (e.g., "You want it golden, not burnt")
- End with a "Quick tips" section with 2-3 helpful notes
- Offer to customize: "If you tell me [preference], I'll adjust it"

IMPORTANT: End your response by asking: "Do you have all these ingredients? Does ${recipeData.servings || 4} servings work for you?"

Make this question clear and on its own line.`;
      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }]
      });
      const aiResponse = message.content[0].text;
      const newMessage = { role: 'assistant', content: aiResponse, timestamp: new Date() };
      setMessages([newMessage]);
      const recipePortion = aiResponse.split('Do you have')[0].trim();
      setPinnedRecipe(recipePortion);
      // Don't show pin yet - wait for user's first interaction
    } catch (error) {
      console.error('Error:', error);
    }
    setLoading(false);
  };

  const generateRecipeFromRequest = async (request) => {
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
          content: `Generate a detailed recipe for: ${request}. 
          
          Format as JSON:
          {
            "title": "Recipe name",
            "servings": 4,
            "ingredients": [{"item": "ingredient", "amount": "quantity"}],
            "steps": [{"number": 1, "instruction": "Step instruction"}]
          }`
        }]
      });

      const recipeText = message.content[0].text;
      const jsonMatch = recipeText.match(/\{[\s\S]*\}/);
      const recipeData = jsonMatch ? JSON.parse(jsonMatch[0]) : null;

      if (recipeData) {
        setRecipe(recipeData);
        localStorage.setItem('currentRecipe', JSON.stringify(recipeData));
        generateInitialRecipe(recipeData);
      }
    } catch (error) {
      console.error('Error:', error);
    }
    setLoading(false);
  };

  const checkAndUpdatePinnedRecipe = (aiResponse) => {
    const hasRecipeStructure = aiResponse.includes('Ingredients') || 
                                aiResponse.includes('Instructions') ||
                                aiResponse.includes('Steps') ||
                                /^[🌀-🧿]/u.test(aiResponse);
    
    if (hasRecipeStructure) {
      const recipePortion = aiResponse
        .split(/Do you have|Does this|Would you like|Any questions|Let me know/)[0]
        .trim();
      
      if (recipePortion.length > 100) {
        setPinnedRecipe(recipePortion);
      }
    }
  };

  const handleSendMessage = async () => {
    if (!userInput.trim()) return;
    const userMessage = { role: 'user', content: userInput, timestamp: new Date() };
    setMessages([...messages, userMessage]);
    setUserInput('');
    setLoading(true);
    try {
      const anthropic = new Anthropic({
        apiKey: process.env.REACT_APP_ANTHROPIC_API_KEY,
        dangerouslyAllowBrowser: true
      });
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        messages: [...messages.map(m => ({ role: m.role, content: m.content })), { role: 'user', content: userInput }]
      });
      const aiResponse = response.content[0].text;
      const aiMessage = { role: 'assistant', content: aiResponse, timestamp: new Date() };
      setMessages([...messages, userMessage, aiMessage]);
      
      // Pin the recipe after first user interaction
      if (!isPinned && messages.length >= 1) {
        setIsPinned(true);
      }
      
      // Check if response contains updated recipe and update pin
      checkAndUpdatePinnedRecipe(aiResponse);
    } catch (error) {
      console.error('Error:', error);
    }
    setLoading(false);
  };



  const handleFinishCooking = () => {
    navigate('/complete');
  };

  if (!recipe) return null;

  return (
    <div className="chat-cooking-mode">
      <div className="chat-header">
        <button className="back-btn" onClick={() => navigate('/')}>Exit</button>
        <button className="finish-btn" onClick={handleFinishCooking}>Finish</button>
      </div>
      {isPinned && pinnedRecipe && (
        <div className="pinned-message">
          <div className="pinned-preview" onClick={() => setShowPinnedRecipe(!showPinnedRecipe)}>
            <span>📌</span>
            <span>{recipe.title}</span>
            <span>{showPinnedRecipe ? '▼' : '▶'}</span>
          </div>
          {showPinnedRecipe && <div className="pinned-content"><pre>{pinnedRecipe}</pre></div>}
        </div>
      )}
      <div className="chat-messages">
        {messages.map((msg, i) => (
          <div key={i} className={"message " + msg.role}>
            <div className="message-content">
              <p>{msg.role === 'assistant' ? parseRecipeText(msg.content) : msg.content}</p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div className="chat-input-container">
        <input className="chat-input" placeholder="Ask a question..." value={userInput} onChange={(e) => setUserInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()} />
        <button className="send-btn" onClick={handleSendMessage}>Send</button>
      </div>
    </div>
  );
}

export default ChatCookingMode;
