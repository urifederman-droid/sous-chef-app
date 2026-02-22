import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Anthropic from '@anthropic-ai/sdk';
import { uploadPhoto } from './firebaseStorage';
import { getUserPreferencesPrompt, logPassiveSignal } from './userPreferences';
import { Menu, SquarePen, Pin, Plus, Send, Camera, Mic, X, ImageIcon } from 'lucide-react';
import Sidebar from './Sidebar';
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
  const [sessionId] = useState(() => localStorage.getItem('resumeSessionId') || (Date.now().toString(36) + Math.random().toString(36).slice(2, 7)));
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingPhotos, setPendingPhotos] = useState([]);
  const [showPhotoPicker, setShowPhotoPicker] = useState(false);
  const [pickerSelections, setPickerSelections] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const cameraInputRef = useRef(null);
  const libraryInputRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-save session on every message change
  useEffect(() => {
    if (messages.length > 0 && !messages[messages.length - 1]?.streaming) {
      const firstMessage = messages[0]?.content || '';
      const firstLine = firstMessage.split('\n')[0] || 'Recipe';
      const title = firstLine.replace(/[^a-zA-Z0-9\s-]/g, '').trim() || 'Recipe';
      const sessions = JSON.parse(localStorage.getItem('pausedSessions') || '[]');
      const existing = sessions.findIndex(s => s.id === sessionId);
      const entry = {
        id: sessionId,
        title,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        pinnedRecipe,
        updatedAt: new Date().toISOString()
      };
      if (existing >= 0) {
        sessions[existing] = entry;
      } else {
        sessions.unshift(entry);
      }
      localStorage.setItem('pausedSessions', JSON.stringify(sessions));
    }
  }, [messages, pinnedRecipe, sessionId]);

  useEffect(() => {
    const pendingChat = localStorage.getItem('pendingChatHistory');
    if (pendingChat) {
      localStorage.removeItem('pendingChatHistory');
      try {
        const history = JSON.parse(pendingChat);
        const restored = history.map(m => ({ role: m.role, content: m.content, timestamp: new Date() }));
        setMessages(restored);
        const firstAssistant = history.find(m => m.role === 'assistant');
        if (firstAssistant) {
          setPinnedRecipe(firstAssistant.content);
          setIsPinned(true);
        }
      } catch (e) {
        console.error('Error restoring chat history:', e);
      }
      return;
    }
    const resumeId = localStorage.getItem('resumeSessionId');
    if (resumeId && !localStorage.getItem('currentRecipe') && !localStorage.getItem('pendingRecipeRequest')) {
      localStorage.removeItem('resumeSessionId');
      try {
        const sessions = JSON.parse(localStorage.getItem('pausedSessions') || '[]');
        const session = sessions.find(s => s.id === resumeId);
        if (session) {
          const restored = session.messages.map(m => ({ role: m.role, content: m.content, timestamp: new Date() }));
          setMessages(restored);
          if (session.pinnedRecipe) {
            setPinnedRecipe(session.pinnedRecipe);
            setIsPinned(true);
          }
          return;
        }
      } catch (e) {
        console.error('Error restoring paused session:', e);
      }
    }
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
        content: 'I need a recipe for ' + request + '. Please format it with:\n\n1. Title (with emoji)\n2. Right below the title, show: Prep Time | Cook Time | Serves X (on one line, separated by |)\n3. Then ingredients and instructions\n\nAt the END, always ask:\n\n"How does that sound? Any changes to the number of people eating? Do you have all the equipment? All ingredients? I can help make any substitution."\n\nMake it friendly and conversational.' + getUserPreferencesPrompt()
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

const handleFilesSelected = async (files) => {
    const newSelections = [...pickerSelections];
    for (const file of files) {
      const rawData = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(file);
      });
      const compressed = await compressImage(rawData);
      newSelections.push(compressed);
    }
    setPickerSelections(newSelections);
  };

  const handleAddPhotos = () => {
    setPendingPhotos(prev => [...prev, ...pickerSelections]);
    setPickerSelections([]);
    setShowPhotoPicker(false);
  };

  const handleRemovePendingPhoto = (index) => {
    setPendingPhotos(prev => prev.filter((_, i) => i !== index));
  };

const toggleDictation = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    let finalTranscript = userInput;
    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += (finalTranscript ? ' ' : '') + event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      setUserInput(finalTranscript + (interim ? ' ' + interim : ''));
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

const handleSendMessage = async () => {
    const hasPhotos = pendingPhotos.length > 0;
    const hasText = userInput.trim();

    if (!hasPhotos && !hasText) return;

    const userMessage = {
      role: 'user',
      content: userInput || (hasPhotos ? 'What do you think of this?' : ''),
      photos: hasPhotos ? [...pendingPhotos] : undefined,
      timestamp: new Date()
    };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setUserInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setPendingPhotos([]);
    
    setPreLoading(true);
    setLoading(true);
    
    try {
      const anthropic = new Anthropic({
        apiKey: process.env.REACT_APP_ANTHROPIC_API_KEY,
        dangerouslyAllowBrowser: true
      });
      
      const streamingMessage = { role: 'assistant', content: '', timestamp: new Date(), streaming: true };
      setMessages([...newMessages, streamingMessage]);
      
      // Build message content with photos if present
      const conversationHistory = newMessages.map(msg => {
        const photos = msg.photos || (msg.photo ? [msg.photo] : []);
        if (photos.length > 0) {
          return {
            role: msg.role,
            content: [
              ...photos.map(photo => ({
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/jpeg',
                  data: photo.split(',')[1]
                }
              })),
              { type: 'text', text: msg.content }
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

If the user asks to add ingredients to their grocery list (or shopping list), extract the requested ingredients WITH their quantities and respond with EXACTLY this format and nothing else:
[GROCERY_EXPORT: ["2 lbs chicken breast", "1 large onion", "3 cloves garlic", ...]]
Always include the amount/quantity for each ingredient. If they don't specify which ingredients, export all ingredients from the current recipe.

If the user asks to save or schedule this recipe for a specific day, respond with EXACTLY this format and nothing else:
[SCHEDULE_MEAL: {"title": "Recipe Title", "date": "YYYY-MM-DD"}]
Use the current date context: today is ${new Date().toLocaleDateString('en-CA')} (${new Date().toLocaleDateString('en-US', { weekday: 'long' })}). The title should be the recipe name from the current conversation.

If the user asks to save a recipe for later, add to their "want to cook" list, or bookmark a recipe idea, respond with EXACTLY this format and nothing else:
[WANT_TO_COOK: "recipe title"]
Use the recipe name from the current conversation as the title.` + getUserPreferencesPrompt(),
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

      // Check if Claude scheduled a meal
      const scheduleMatch = fullContent.trim().match(/^\[SCHEDULE_MEAL:\s*(\{.*\})\]$/s);
      if (scheduleMatch) {
        try {
          const { title, date } = JSON.parse(scheduleMatch[1]);
          const mealSchedule = JSON.parse(localStorage.getItem('mealSchedule') || '{}');
          if (!mealSchedule[date]) mealSchedule[date] = [];
          mealSchedule[date].push({
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
            title,
            source: 'chat',
            chatHistory: newMessages.map(m => ({ role: m.role, content: m.content }))
          });
          localStorage.setItem('mealSchedule', JSON.stringify(mealSchedule));
          const dayLabel = new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
          const confirmMsg = { role: 'assistant', content: `Saved ${title} to ${dayLabel}!`, timestamp: new Date() };
          setMessages([...newMessages, confirmMsg]);
          setLoading(false);
          return;
        } catch (e) {
          console.error('Error parsing schedule meal:', e);
        }
      }

      // Check if Claude wants to save to Want to Cook
      const wantToCookMatch = fullContent.trim().match(/^\[WANT_TO_COOK:\s*"(.+)"\]$/);
      if (wantToCookMatch) {
        try {
          const title = wantToCookMatch[1];
          logPassiveSignal('wishlist_add', { title });
          const existing = JSON.parse(localStorage.getItem('wantToCook') || '[]');
          existing.push({
            id: Date.now().toString(),
            title,
            addedDate: new Date().toISOString(),
            chatHistory: newMessages.map(m => ({ role: m.role, content: m.content }))
          });
          localStorage.setItem('wantToCook', JSON.stringify(existing));
          const confirmMsg = { role: 'assistant', content: `Saved "${title}" to your Want to Cook list!`, timestamp: new Date() };
          setMessages([...newMessages, confirmMsg]);
          setLoading(false);
          return;
        } catch (e) {
          console.error('Error saving want to cook:', e);
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
          const photos = msg.photos || (msg.photo ? [msg.photo] : []);
          if (photos.length > 0) {
            return {
              role: msg.role,
              content: [
                ...photos.map(photo => ({
                  type: 'image',
                  source: { type: 'base64', media_type: 'image/jpeg', data: photo.split(',')[1] }
                })),
                { type: 'text', text: msg.content }
              ]
            };
          }
          return { role: msg.role, content: msg.content };
        });

        const stream = await anthropic.messages.stream({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 3000,
          system: `You are a friendly cooking assistant. The user wants a new recipe. Please provide it in full with title, prep/cook/serves line, all ingredients, and all instructions. At the end, ask if they'd like any changes.

CRITICAL RULE: Always give the user EXACTLY what they asked for. If they say "beef tacos", give them beef tacos. If they say "pork ramen", give them pork ramen. NEVER substitute, replace, or change specific ingredients the user explicitly named. After providing the recipe exactly as requested, if it conflicts with their preferences, add a brief note offering to swap.

If the user asks to save a recipe for later, add to their "want to cook" list, or bookmark a recipe idea, respond with EXACTLY this format and nothing else:
[WANT_TO_COOK: "recipe title"]
Use the recipe name from the current conversation as the title.` + getUserPreferencesPrompt(),
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
      const photosFromMessages = messages.flatMap(m => m.photos || (m.photo ? [m.photo] : []));
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
      
      const sessions = JSON.parse(localStorage.getItem('pausedSessions') || '[]');
      localStorage.setItem('pausedSessions', JSON.stringify(sessions.filter(s => s.id !== sessionId)));
      console.log('Saved recipe:', title);
      navigate('/complete');
    } catch (error) {
      console.error('Error finishing cooking:', error);
      alert('Error saving recipe: ' + error.message);
    }
  };

  const recipeTitle = (() => {
    const first = messages[0]?.content || '';
    const line = first.split('\n')[0] || '';
    return line.replace(/[#*]/g, '').trim() || 'Recipe';
  })();

  const handleNewChat = () => {
    setSidebarOpen(false);
    window.location.href = '/cook';
  };

  return (
    <div className="chat-cooking-mode">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} currentPath="/cook" />

      {/* ChatGPT-Style Header */}
      <header className="chat-header">
        <button className="chat-header-btn" onClick={() => setSidebarOpen(true)}>
          <Menu size={24} />
        </button>
        <div className="chat-header-title">{recipeTitle}</div>
        <div className="header-right">
          <button className="chat-header-btn" onClick={handleNewChat}>
            <SquarePen size={20} />
          </button>
          <button className="chat-header-btn finish-btn" onClick={handleFinishCooking}>
            Finish
          </button>
        </div>
      </header>

      {/* Pinned Recipe Bar */}
      {isPinned && pinnedRecipe && (
        <div className="pinned-message">
          <div className="pinned-preview" onClick={() => setShowPinnedRecipe(!showPinnedRecipe)}>
            <Pin size={16} className="pinned-icon" />
            <span className="pinned-label">Full Recipe</span>
            <span className="pinned-chevron">{showPinnedRecipe ? '▼' : '▶'}</span>
          </div>
          {showPinnedRecipe && <div className="pinned-content"><ReactMarkdown>{pinnedRecipe}</ReactMarkdown></div>}
        </div>
      )}

      {/* Messages */}
      <div className="chat-messages">
        {messages.map((msg, i) => (
          <div key={i} className={'message-wrapper ' + msg.role}>
            <div className={'message-bubble ' + msg.role}>
              {/* Backward compat: single photo */}
              {msg.photo && !msg.photos && (
                <img src={msg.photo} alt="Cooking" className="message-photo" />
              )}
              {/* Multi-photo display */}
              {msg.photos && msg.photos.length === 1 && (
                <img src={msg.photos[0]} alt="Cooking" className="message-photo" />
              )}
              {msg.photos && msg.photos.length > 1 && (
                <div className="message-photos">
                  {msg.photos.map((photo, pi) => (
                    <img key={pi} src={photo} alt={`Capture ${pi + 1}`} />
                  ))}
                </div>
              )}
              <div className="message-content"><ReactMarkdown>{msg.content}</ReactMarkdown></div>
            </div>
          </div>
        ))}
        {newRecipeRequest && (
          <div className="message-wrapper assistant">
            <div className="message-bubble assistant">
              <div className="new-recipe-prompt">
                <p>It looks like you want to make <strong>{newRecipeRequest}</strong>! Would you like to:</p>
                <div className="new-recipe-buttons">
                  <button className="new-recipe-btn primary" onClick={handleStartNewChat}>Start New Recipe Chat</button>
                  <button className="new-recipe-btn secondary" onClick={handleContinueInChat}>Continue in This Chat</button>
                </div>
              </div>
            </div>
          </div>
        )}
        {preLoading && messages.length === 0 && (
          <div className="message-wrapper assistant">
            <div className="pre-loading-indicator">
              <span className="chef-emoji pulsing">👨‍🍳</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Pending Photos Strip */}
      {pendingPhotos.length > 0 && (
        <div className="pending-photos">
          {pendingPhotos.map((photo, i) => (
            <div key={i} className="pending-thumb-wrapper">
              <img src={photo} alt={`Pending ${i + 1}`} className="pending-thumb" />
              <button className="pending-thumb-remove" onClick={() => handleRemovePendingPhoto(i)}>
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ChatGPT-Style Input Bar */}
      <div className="chat-input-container">
        {/* Hidden file inputs */}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          ref={cameraInputRef}
          style={{ display: 'none' }}
          onChange={(e) => {
            if (e.target.files.length) handleFilesSelected(Array.from(e.target.files));
            e.target.value = '';
          }}
        />
        <input
          type="file"
          accept="image/*"
          multiple
          ref={libraryInputRef}
          style={{ display: 'none' }}
          onChange={(e) => {
            if (e.target.files.length) handleFilesSelected(Array.from(e.target.files));
            e.target.value = '';
          }}
        />

        <button className="attach-btn" onClick={() => setShowPhotoPicker(true)}>
          <Plus size={20} />
        </button>
        <div className="chat-input-bar">
          <textarea
            ref={textareaRef}
            className="chat-input"
            placeholder="Ask anything"
            value={userInput}
            rows={1}
            onChange={(e) => {
              setUserInput(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
          />
          {(userInput.trim() || pendingPhotos.length > 0) ? (
            <button className="send-btn" onClick={handleSendMessage} disabled={loading}>
              <Send size={16} />
            </button>
          ) : (
            <button className={`mic-btn ${isListening ? 'listening' : ''}`} onClick={toggleDictation}>
              <Mic size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Photo Picker Bottom Sheet */}
      {showPhotoPicker && (
        <div className="photo-picker-overlay" onClick={() => { setShowPhotoPicker(false); setPickerSelections([]); }}>
          <div className="photo-picker-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="photo-picker-header">
              <span className="photo-picker-title">SousChef</span>
              <button className="photo-picker-close" onClick={() => { setShowPhotoPicker(false); setPickerSelections([]); }}>
                <X size={20} />
              </button>
            </div>

            <div className="picker-options">
              <button className="picker-option-btn" onClick={() => cameraInputRef.current?.click()}>
                <Camera size={24} />
                <span>Camera</span>
              </button>
              <button className="picker-option-btn" onClick={() => libraryInputRef.current?.click()}>
                <ImageIcon size={24} />
                <span>Photo Library</span>
              </button>
            </div>

            {pickerSelections.length > 0 && (
              <>
                <div className="picker-selections">
                  {pickerSelections.map((photo, i) => (
                    <div key={i} className="picker-thumb-wrapper">
                      <img src={photo} alt={`Selection ${i + 1}`} className="picker-thumb" />
                      <button className="picker-thumb-remove" onClick={() => setPickerSelections(prev => prev.filter((_, idx) => idx !== i))}>
                        <X size={12} />
                      </button>
                      <span className="picker-thumb-number">{i + 1}</span>
                    </div>
                  ))}
                </div>
                <button className="picker-add-btn" onClick={handleAddPhotos}>
                  Add {pickerSelections.length} Photo{pickerSelections.length !== 1 ? 's' : ''}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ChatCookingMode;