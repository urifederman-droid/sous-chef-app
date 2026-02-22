import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Anthropic from '@anthropic-ai/sdk';
import { Send, X, ChefHat } from 'lucide-react';
import { getUserPreferencesPrompt } from './userPreferences';
import ReactMarkdown from 'react-markdown';
import './InlineAgentChat.css';

function looksLikeRecipe(text) {
  // Count bullet points (-, *, •) — recipes typically have 4+ ingredients
  const bulletCount = (text.match(/^[\s]*[-•*]\s+.+/gm) || []).length;
  const hasIngredientWord = /ingredient/i.test(text);
  // Any of these step formats: "1. ", "1) ", "Step 1", "Instructions"
  const hasSteps = /^\s*\d+[.)]\s+/m.test(text) || /instruction/i.test(text) || /\bstep\s+\d/i.test(text) || /direction/i.test(text);
  const hasCookingVerb = /\b(cook|bake|saut[ée]|simmer|boil|roast|fry|dice|chop|stir|preheat|whisk|fold|knead|marinate)\b/i.test(text);

  return (hasIngredientWord && bulletCount >= 3) || (bulletCount >= 4 && hasSteps) || (hasIngredientWord && hasSteps && hasCookingVerb);
}

function extractRecipeTitle(text) {
  const headingMatch = text.match(/^#+\s+(.+)/m);
  if (headingMatch) return headingMatch[1].replace(/[*_]/g, '').trim();
  const boldMatch = text.match(/\*\*(.+?)\*\*/);
  if (boldMatch) return boldMatch[1].trim();
  const firstLine = text.split('\n')[0].replace(/[#*_]/g, '').trim();
  return firstLine.length > 5 && firstLine.length < 80 ? firstLine : 'Recipe';
}

function InlineAgentChat({ systemPrompt, placeholder }) {
  const navigate = useNavigate();
  const [userInput, setUserInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const handleStartCooking = (recipeText) => {
    const title = extractRecipeTitle(recipeText);
    localStorage.setItem('pendingCookAgainData', JSON.stringify({
      pinnedRecipeText: recipeText,
      title
    }));
    navigate('/cook');
  };

  useEffect(() => {
    if (isExpanded) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isExpanded]);

  const handleDismiss = () => {
    setIsExpanded(false);
    setMessages([]);
  };

  const handleSend = async () => {
    if (!userInput.trim() || loading) return;

    const userMessage = { role: 'user', content: userInput.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setUserInput('');
    setIsExpanded(true);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    setLoading(true);
    try {
      const anthropic = new Anthropic({
        apiKey: process.env.REACT_APP_ANTHROPIC_API_KEY,
        dangerouslyAllowBrowser: true
      });

      const streamingMessage = { role: 'assistant', content: '', streaming: true };
      setMessages([...newMessages, streamingMessage]);

      const conversationHistory = newMessages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      const fullSystemPrompt = systemPrompt + getUserPreferencesPrompt();

      const stream = await anthropic.messages.stream({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 3000,
        system: fullSystemPrompt,
        messages: conversationHistory
      });

      let fullContent = '';

      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          fullContent += chunk.delta.text;
          setMessages([...newMessages, { role: 'assistant', content: fullContent, streaming: true }]);
        }
      }

      setMessages([...newMessages, { role: 'assistant', content: fullContent, streaming: false }]);
    } catch (error) {
      console.error('InlineAgentChat error:', error);
      setMessages([...newMessages, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }]);
    }
    setLoading(false);
  };

  const visibleMessages = messages.slice(-6);
  const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant' && !m.streaming);
  const showStartCooking = isExpanded && lastAssistant && looksLikeRecipe(lastAssistant.content);
  const showNewRecipe = isExpanded && lastAssistant && !showStartCooking && /none of|no match|doesn't match|don't have|not on your|isn't in your|don't see|couldn't find|not among|isn't on|no .* match|not in your/i.test(lastAssistant.content);

  return (
    <div className="inline-agent-chat">
      {isExpanded && visibleMessages.length > 0 && (
        <div className="inline-chat-messages">
          <button className="inline-chat-dismiss" onClick={handleDismiss}>
            <X size={16} />
          </button>
          {visibleMessages.map((msg, i) => (
            <div key={i} className={`inline-msg-wrapper ${msg.role}`}>
              <div className={`inline-msg-bubble ${msg.role}`}>
                {msg.role === 'assistant' ? (
                  <div className="inline-msg-content"><ReactMarkdown>{msg.content}</ReactMarkdown></div>
                ) : (
                  <div className="inline-msg-content">{msg.content}</div>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      )}
      {showStartCooking && (
        <div className="inline-start-cooking-bar">
          <button className="inline-start-cooking-btn" onClick={() => handleStartCooking(lastAssistant.content)}>
            <ChefHat size={16} />
            Start Cooking
          </button>
        </div>
      )}
      {showNewRecipe && (
        <div className="inline-start-cooking-bar">
          <button className="inline-new-recipe-btn" onClick={() => navigate('/')}>
            Start a New Recipe
          </button>
        </div>
      )}
      <div className="inline-chat-input-bar">
        <textarea
          ref={textareaRef}
          className="inline-chat-input"
          placeholder={placeholder}
          value={userInput}
          rows={1}
          onChange={(e) => {
            setUserInput(e.target.value);
            e.target.style.height = 'auto';
            e.target.style.height = Math.min(e.target.scrollHeight, 80) + 'px';
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <button
          className="inline-chat-send"
          onClick={handleSend}
          disabled={loading || !userInput.trim()}
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}

export default InlineAgentChat;
