import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Anthropic from '@anthropic-ai/sdk';
import { uploadPhoto } from './firebaseStorage';
import './ChatCookingMode.css';
import ReactMarkdown from 'react-markdown';

function ChatCookingMode() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [userInput, setUserInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [preLoading, setPreLoading] = useState(false);
  const [showPinnedRecipe, setShowPinnedRecipe] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [pinnedRecipe, setPinnedRecipe] = useState(null);
  const [sessionPhotos, setSessionPhotos] = useState([]);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
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

const handleSendMessage = async () => {
    const file = fileInputRef.current?.files[0];
    const hasPhoto = !!file;
    const hasText = userInput.trim();
    
    if (!hasPhoto && !hasText) return;
    
    let photoData = null;
    
    // Read photo if attached
    if (file) {
      photoData = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(file);
      });
      // Upload to Firebase and save URL to session photos
      try {
        const photoUrl = await uploadPhoto(photoData);
        setSessionPhotos([...sessionPhotos, photoUrl]);
      } catch (uploadError) {
        console.error('Photo upload failed:', uploadError);
        setSessionPhotos([...sessionPhotos, photoData]);
      }
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
      
      if (!isPinned && newMessages.length >= 1) setIsPinned(true);
      if (fullContent.includes('Ingredients')) setPinnedRecipe(fullContent);
      
    } catch (error) {
      console.error('Error:', error);
    }
    setLoading(false);
  };

  const handleFinishCooking = () => {
    try {
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