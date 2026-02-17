import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Anthropic from '@anthropic-ai/sdk';
import { uploadPhoto } from './firebaseStorage';
import './ChatCookingMode.css';
import ReactMarkdown from 'react-markdown';

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

function formatRecipeFromJSON(recipe) {
  let text = `# ${recipe.title}\n`;
  if (recipe.description) text += `${recipe.description}\n`;
  text += `\nPrep Time: ${recipe.prepTime} | Cook Time: ${recipe.cookTime} | Serves: ${recipe.servings}\n`;
  text += `\n## Ingredients\n`;
  for (const ing of recipe.ingredients) {
    text += `- ${ing.amount} ${ing.item}\n`;
  }
  text += `\n## Instructions\n`;
  for (const step of recipe.steps) {
    text += `${step.number}. ${step.instruction}\n`;
    if (step.tip) text += `   *Tip: ${step.tip}*\n`;
  }
  text += `\nHow does that sound? Any changes to the number of people eating? Do you have all the equipment? All ingredients? I can help make any substitution.`;
  return text;
}

function ChatCookingMode() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [userInput, setUserInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [preLoading, setPreLoading] = useState(
    () => !!localStorage.getItem('pendingRecipeRequest') || !!localStorage.getItem('currentRecipe')
  );
  const [showPinnedRecipe, setShowPinnedRecipe] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [pinnedRecipe, setPinnedRecipe] = useState(null);
  const [newRecipeRequest, setNewRecipeRequest] = useState(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const savedRecipe = localStorage.getItem('currentRecipe');
    if (savedRecipe) {
      localStorage.removeItem('currentRecipe');
      try {
        const recipe = JSON.parse(savedRecipe);
        const formatted = formatRecipeFromJSON(recipe);
        const aiMessage = { role: 'assistant', content: formatted, timestamp: new Date() };
        setMessages([aiMessage]);
        setPinnedRecipe(formatted);
        setIsPinned(true);
        enrichRecipeWithTips(formatted);
      } catch (e) {
        console.error('Error parsing saved recipe:', e);
      }
      return;
    }
    const pendingRequest = localStorage.getItem('pendingRecipeRequest');
    if (pendingRequest) {
      localStorage.removeItem('pendingRecipeRequest');
      generateRecipe(pendingRequest);
    }
  }, []);

  const generateRecipe = async (request) => {
    setPreLoading(true);
    setTimeout(() => setPreLoading(false), 100); // Will be removed once streaming starts
    setLoading(true);
    try {
      const anthropic = new Anthropic({
        apiKey: process.env.REACT_APP_ANTHROPIC_API_KEY,
        dangerouslyAllowBrowser: true
      });
      
      // Create a placeholder message
      const streamingMessage = { role: 'assistant', content: '', timestamp: new Date(), streaming: true };
      setMessages([streamingMessage]);
      
      const stream = await anthropic.messages.stream({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        messages: [{ 
        role: 'user', 
        content: 'I need a recipe for ' + request + '. Please format it with:\n\n1. Title (with emoji)\n2. Right below the title, show: Prep Time | Cook Time | Serves X (on one line, separated by |)\n3. Then ingredients and instructions\n\nAt the END, always ask:\n\n"How does that sound? Any changes to the number of people eating? Do you have all the equipment? All ingredients? I can help make any substitution."\n\nMake it friendly and conversational.'
      }]
      });
      
      let fullContent = '';
      
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          setPreLoading(false); // Remove emoji once streaming starts
          fullContent += chunk.delta.text;
          setMessages([{ role: 'assistant', content: fullContent, timestamp: new Date(), streaming: true }]);
        }
      }
      
      // Final message
      const aiMessage = { role: 'assistant', content: fullContent, timestamp: new Date(), streaming: false };
      setMessages([aiMessage]);
      setPinnedRecipe(fullContent);
      
    } catch (error) {
      console.error('Error:', error);
    }
    setLoading(false);
  };

  const enrichRecipeWithTips = async (recipeText) => {
    setLoading(true);
    try {
      const anthropic = new Anthropic({
        apiKey: process.env.REACT_APP_ANTHROPIC_API_KEY,
        dangerouslyAllowBrowser: true
      });

      const stream = await anthropic.messages.stream({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 3000,
        messages: [{
          role: 'user',
          content: `Rewrite the following recipe. Output ONLY the rewritten recipe — no preamble, no commentary, no "here's the recipe" intro.\n\nRules:\n- Keep the exact same structure: title, prep/cook/serves line, ingredients list, numbered instructions, and closing question.\n- For ONLY 2-3 steps where a beginner would genuinely struggle, add a tip on the line right after the instruction, formatted as: "   *Sous Chef Tip: ...*"\n- Only add tips for things a beginner truly wouldn't know (e.g. how many minutes "until softened" means, what "golden brown" looks like, a tricky temperature). Do NOT tip obvious steps like "preheat oven" or "mix in a bowl".\n- Do NOT add a separate tips section. Do NOT list tips at the end. Tips go inline, directly under their step.\n- Do NOT change ingredient amounts, step order, or recipe content.\n\nRecipe:\n\n${recipeText}`
        }]
      });

      let fullContent = '';

      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          fullContent += chunk.delta.text;
          setMessages([{ role: 'assistant', content: fullContent, timestamp: new Date(), streaming: true }]);
        }
      }

      const enrichedMessage = { role: 'assistant', content: fullContent, timestamp: new Date() };
      setMessages([enrichedMessage]);
      setPinnedRecipe(fullContent);

    } catch (error) {
      console.error('Error enriching recipe:', error);
      // Silently fail — user still has the original recipe
    }
    setLoading(false);
  };

const handleSendMessage = async () => {
    const file = fileInputRef.current?.files[0];
    const hasPhoto = !!file;
    const hasText = userInput.trim();
    
    if (!hasPhoto && !hasText) return;
    
    let photoData = null;
    
    // Read photo if attached
    if (file) {
      const rawData = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(file);
      });
      photoData = await compressImage(rawData);
    }
    
    const userMessage = { 
      role: 'user', 
      content: userInput || 'What do you think of this?',
      photo: photoData,
      timestamp: new Date() 
    };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setUserInput('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    
    setPreLoading(true);
    setLoading(true);
    
    try {
      const anthropic = new Anthropic({
        apiKey: process.env.REACT_APP_ANTHROPIC_API_KEY,
        dangerouslyAllowBrowser: true
      });
      
      const streamingMessage = { role: 'assistant', content: '', timestamp: new Date(), streaming: true };
      setMessages([...newMessages, streamingMessage]);
      
      // Build message content with photo if present
      const conversationHistory = newMessages.map(msg => {
        if (msg.photo) {
          return {
            role: msg.role,
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/jpeg',
                  data: msg.photo.split(',')[1]
                }
              },
              {
                type: 'text',
                text: msg.content
              }
            ]
          };
        }
        return { role: msg.role, content: msg.content };
      });
      
      const stream = await anthropic.messages.stream({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 3000,
        system: `You are a friendly cooking assistant. Whenever the user requests ANY change to the recipe — such as adjusting servings, substituting ingredients, swapping cookware, changing cooking method, dietary modifications, or any other alteration — you MUST output the complete updated recipe in full, with title, prep/cook/serves line, all ingredients, and all instructions reflecting the changes. Do not just describe the changes — always provide the entire updated recipe so it can replace the pinned version.

If the user asks for a completely different recipe (not a modification, substitution, or adjustment of the current recipe), respond with EXACTLY this format and nothing else:
[NEW_RECIPE: name of the recipe they want]

If the user asks to add ingredients to their grocery list (or shopping list), extract the requested ingredients and respond with EXACTLY this format and nothing else:
[GROCERY_EXPORT: ["ingredient 1", "ingredient 2", ...]]
If they don't specify which ingredients, export all ingredients from the current recipe.`,
        messages: conversationHistory
      });
      
      let fullContent = '';
      
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          setPreLoading(false);
          fullContent += chunk.delta.text;
          setMessages([...newMessages, { role: 'assistant', content: fullContent, timestamp: new Date(), streaming: true }]);
        }
      }
      
      // Check if Claude detected a new recipe request
      const newRecipeMatch = fullContent.trim().match(/^\[NEW_RECIPE:\s*(.+)\]$/);
      if (newRecipeMatch) {
        // Remove the streaming message, keep only the user's messages
        setMessages(newMessages);
        setNewRecipeRequest(newRecipeMatch[1]);
        setLoading(false);
        return;
      }

      // Check if Claude exported grocery items
      const groceryMatch = fullContent.trim().match(/^\[GROCERY_EXPORT:\s*(\[.*\])\]$/s);
      if (groceryMatch) {
        try {
          const ingredients = JSON.parse(groceryMatch[1]);
          const recipeTitle = (pinnedRecipe || '').split('\n')[0].replace(/[#*]/g, '').trim() || 'Recipe';
          const existing = JSON.parse(localStorage.getItem('groceryList') || '[]');
          const newItems = ingredients.map(name => ({ name, recipe: recipeTitle, checked: false }));
          localStorage.setItem('groceryList', JSON.stringify([...existing, ...newItems]));
          const confirmMsg = { role: 'assistant', content: `Added ${ingredients.length} ingredient${ingredients.length !== 1 ? 's' : ''} to your grocery list!`, timestamp: new Date() };
          setMessages([...newMessages, confirmMsg]);
          setLoading(false);
          return;
        } catch (e) {
          console.error('Error parsing grocery export:', e);
        }
      }

      const aiMessage = { role: 'assistant', content: fullContent, timestamp: new Date() };
      setMessages([...newMessages, aiMessage]);

      if (!isPinned && newMessages.length >= 1) setIsPinned(true);
      // Update pinned recipe only if response contains a full recipe structure
      const hasIngredients = /ingredient/i.test(fullContent);
      const hasInstructions = /instruction|step\s*\d|directions/i.test(fullContent);
      if (hasIngredients && hasInstructions) {
        setPinnedRecipe(fullContent);
      }

    } catch (error) {
      console.error('Error:', error);
      setMessages([...newMessages, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.', timestamp: new Date() }]);
    }
    setLoading(false);
  };

  const handleStartNewChat = () => {
    localStorage.setItem('pendingRecipeRequest', newRecipeRequest);
    setNewRecipeRequest(null);
    window.location.href = '/cook';
  };

  const handleContinueInChat = () => {
    const recipeName = newRecipeRequest;
    setNewRecipeRequest(null);
    // Re-send as a normal message bypassing new recipe detection
    const userMessage = { role: 'user', content: `Give me a recipe for ${recipeName}`, timestamp: new Date() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setPreLoading(true);
    setLoading(true);

    (async () => {
      try {
        const anthropic = new Anthropic({
          apiKey: process.env.REACT_APP_ANTHROPIC_API_KEY,
          dangerouslyAllowBrowser: true
        });

        const streamingMessage = { role: 'assistant', content: '', timestamp: new Date(), streaming: true };
        setMessages([...newMessages, streamingMessage]);

        const conversationHistory = newMessages.map(msg => {
          if (msg.photo) {
            return {
              role: msg.role,
              content: [
                { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: msg.photo.split(',')[1] } },
                { type: 'text', text: msg.content }
              ]
            };
          }
          return { role: msg.role, content: msg.content };
        });

        const stream = await anthropic.messages.stream({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 3000,
          system: `You are a friendly cooking assistant. The user wants a new recipe. Please provide it in full with title, prep/cook/serves line, all ingredients, and all instructions. At the end, ask if they'd like any changes.`,
          messages: conversationHistory
        });

        let fullContent = '';
        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            setPreLoading(false);
            fullContent += chunk.delta.text;
            setMessages([...newMessages, { role: 'assistant', content: fullContent, timestamp: new Date(), streaming: true }]);
          }
        }

        const aiMessage = { role: 'assistant', content: fullContent, timestamp: new Date() };
        setMessages([...newMessages, aiMessage]);

        const hasIngredients = /ingredient/i.test(fullContent);
        const hasInstructions = /instruction|step\s*\d|directions/i.test(fullContent);
        if (hasIngredients && hasInstructions) {
          setPinnedRecipe(fullContent);
        }
      } catch (error) {
        console.error('Error:', error);
        setMessages([...newMessages, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.', timestamp: new Date() }]);
      }
      setLoading(false);
    })();
  };

  const handleFinishCooking = async () => {
    try {
      // Collect photos from messages and upload to Firebase
      const photosFromMessages = messages.filter(m => m.photo).map(m => m.photo);
      const sessionPhotos = [];
      for (let i = 0; i < photosFromMessages.length; i++) {
        try {
          const url = await uploadPhoto(photosFromMessages[i]);
          sessionPhotos.push({ photo: url, stepNumber: i + 1 });
        } catch (err) {
          console.error('Photo upload failed:', err);
        }
      }

      const firstMessage = messages[0]?.content || '';
      const firstLine = firstMessage.split('\n')[0] || 'Recipe';
      const title = firstLine.replace(/[^a-zA-Z0-9\s-]/g, '').trim() || 'Recipe';

      const savedRecipes = JSON.parse(localStorage.getItem('savedRecipes') || '[]');
      savedRecipes.unshift({
        title: title,
        cookedDate: new Date().toISOString(),
        sessionPhotos: sessionPhotos,
        chatHistory: messages.map(m => ({ role: m.role, content: m.content }))
      });
      localStorage.setItem('savedRecipes', JSON.stringify(savedRecipes));
      
      console.log('Saved recipe:', title);
      navigate('/complete');
    } catch (error) {
      console.error('Error finishing cooking:', error);
      alert('Error saving recipe: ' + error.message);
    }
  };

  return (
    <div className="chat-cooking-mode">
      <div className="chat-header">
        <button className="back-btn" onClick={() => navigate('/')}>Exit</button>
        <button className="finish-btn" onClick={handleFinishCooking}>Finish</button>
      </div>
      {isPinned && pinnedRecipe && (
        <div className="pinned-message">
          <div className="pinned-preview" onClick={() => setShowPinnedRecipe(!showPinnedRecipe)}>
            <span>📌 Recipe</span>
            <span>{showPinnedRecipe ? '▼' : '▶'}</span>
          </div>
          {showPinnedRecipe && <div className="pinned-content"><ReactMarkdown>{pinnedRecipe}</ReactMarkdown></div>}
        </div>
      )}
      <div className="chat-messages">
        {messages.map((msg, i) => (
          <div key={i} className={'message ' + msg.role}>
            {msg.photo && (
              <img src={msg.photo} alt="Cooking" className="message-photo" />
            )}
            <div className="message-content"><ReactMarkdown>{msg.content}</ReactMarkdown></div>
          </div>
        ))}
        {newRecipeRequest && (
          <div className="message assistant">
            <div className="new-recipe-prompt">
              <p>It looks like you want to make <strong>{newRecipeRequest}</strong>! Would you like to:</p>
              <div className="new-recipe-buttons">
                <button className="new-recipe-btn primary" onClick={handleStartNewChat}>Start New Recipe Chat</button>
                <button className="new-recipe-btn secondary" onClick={handleContinueInChat}>Continue in This Chat</button>
              </div>
            </div>
          </div>
        )}
        {preLoading && messages.length === 0 && (
          <div className="message assistant">
            <div className="pre-loading-indicator">
              <span className="chef-emoji pulsing">👨‍🍳</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="chat-input-container">
        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          style={{ display: 'none' }}
          id="chat-photo-input"
        />
        <label htmlFor="chat-photo-input" className="photo-attach-btn">
          📷
        </label>
        <input className="chat-input" placeholder="Ask a question..." value={userInput} onChange={(e) => setUserInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()} />
        <button className="send-btn" onClick={handleSendMessage} disabled={loading}>Send</button>
      </div>
    </div>
  );
}

export default ChatCookingMode;