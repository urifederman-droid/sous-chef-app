import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Anthropic from '@anthropic-ai/sdk';
import { getUserProfile, saveUserProfile, mergeSignalIntoProfile, createDefaultProfile } from './userPreferences';
import { Send } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import './Onboarding.css';

function Onboarding() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [userInput, setUserInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Check if already onboarded
  useEffect(() => {
    const profile = getUserProfile();
    if (profile && profile.onboardingComplete) {
      navigate('/');
    }
  }, [navigate]);

  const startOnboarding = async () => {
    setStarted(true);
    setLoading(true);

    try {
      const anthropic = new Anthropic({
        apiKey: process.env.REACT_APP_ANTHROPIC_API_KEY,
        dangerouslyAllowBrowser: true
      });

      const streamingMsg = { role: 'assistant', content: '', streaming: true };
      setMessages([streamingMsg]);

      const stream = await anthropic.messages.stream({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 400,
        system: getSystemPrompt(),
        messages: [{ role: 'user', content: 'Hi! I just downloaded SousChef.' }]
      });

      let fullContent = '';
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          fullContent += chunk.delta.text;
          setMessages([{ role: 'assistant', content: fullContent, streaming: true }]);
        }
      }

      processProfileData(fullContent);
      setMessages([{ role: 'assistant', content: cleanDisplayContent(fullContent) }]);
    } catch (err) {
      console.error('Onboarding start error:', err);
      setMessages([{ role: 'assistant', content: "Hey there! I'm your sous chef. Tell me a bit about yourself — who do you cook for, how often do you cook, and what's your experience level?" }]);
    }
    setLoading(false);
  };

  const handleSend = async () => {
    if (!userInput.trim() || loading) return;

    const userMessage = { role: 'user', content: userInput.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setUserInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    setLoading(true);
    try {
      const anthropic = new Anthropic({
        apiKey: process.env.REACT_APP_ANTHROPIC_API_KEY,
        dangerouslyAllowBrowser: true
      });

      const streamingMsg = { role: 'assistant', content: '', streaming: true };
      setMessages([...newMessages, streamingMsg]);

      // Build conversation for API (include the hidden initial user message)
      const apiMessages = [
        { role: 'user', content: 'Hi! I just downloaded SousChef.' },
        ...newMessages.map(m => ({ role: m.role, content: m.content }))
      ];

      const stream = await anthropic.messages.stream({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 400,
        system: getSystemPrompt(),
        messages: apiMessages
      });

      let fullContent = '';
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          fullContent += chunk.delta.text;
          setMessages([...newMessages, { role: 'assistant', content: fullContent, streaming: true }]);
        }
      }

      processProfileData(fullContent);

      // Check for completion
      if (fullContent.includes('[ONBOARDING_COMPLETE]')) {
        const cleanContent = cleanDisplayContent(fullContent);
        setMessages([...newMessages, { role: 'assistant', content: cleanContent }]);
        // Finalize profile
        const profile = getUserProfile() || createDefaultProfile();
        profile.onboardingComplete = true;
        saveUserProfile(profile);
        // Navigate after a brief delay so user can see final message
        setTimeout(() => navigate('/'), 1500);
      } else {
        setMessages([...newMessages, { role: 'assistant', content: cleanDisplayContent(fullContent) }]);
      }
    } catch (err) {
      console.error('Onboarding chat error:', err);
      setMessages([...newMessages, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }]);
    }
    setLoading(false);
  };

  const handleSkip = () => {
    const profile = getUserProfile() || createDefaultProfile();
    profile.onboardingComplete = true;
    saveUserProfile(profile);
    navigate('/');
  };

  if (!started) {
    return (
      <div className="onboarding-page">
        <div className="onboarding-welcome">
          <img src="/logo.png" alt="SousChef" className="onboarding-logo" />
          <h1>Welcome to SousChef</h1>
          <p>Let me get to know you so I can personalize your cooking experience. It'll only take a minute!</p>
          <button className="onboarding-start-btn" onClick={startOnboarding}>
            Let's Go
          </button>
          <button className="onboarding-skip-btn" onClick={handleSkip}>
            Skip for now
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="onboarding-page">
      <div className="onboarding-header">
        <h2>Getting to know you</h2>
        <button className="onboarding-skip-link" onClick={handleSkip}>Skip</button>
      </div>

      <div className="onboarding-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`onboarding-msg-wrapper ${msg.role}`}>
            <div className={`onboarding-msg-bubble ${msg.role}`}>
              {msg.role === 'assistant' ? (
                <div className="onboarding-msg-content"><ReactMarkdown>{msg.content}</ReactMarkdown></div>
              ) : (
                <div className="onboarding-msg-content">{msg.content}</div>
              )}
            </div>
          </div>
        ))}
        {loading && messages.length > 0 && messages[messages.length - 1]?.role !== 'assistant' && (
          <div className="onboarding-msg-wrapper assistant">
            <div className="onboarding-msg-bubble assistant">
              <div className="onboarding-typing">...</div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="onboarding-input-area">
        <div className="onboarding-input-bar">
          <textarea
            ref={textareaRef}
            className="onboarding-input"
            placeholder="Tell me about yourself..."
            value={userInput}
            rows={1}
            onChange={(e) => {
              setUserInput(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <button
            className="onboarding-send-btn"
            onClick={handleSend}
            disabled={loading || !userInput.trim()}
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

function getSystemPrompt() {
  return `You are SousChef, a friendly cooking assistant getting to know a new user. Your goal is to learn about them in 3 quick, conversational exchanges so you can personalize their experience.

CONVERSATION FLOW (3 exchanges total):
1. First response: Warmly greet them. Ask who they cook for (household size), how often they cook, and their experience level. Keep it casual and brief (2-3 sentences + questions).
2. Second response: Acknowledge what they shared. Ask about any dietary restrictions, allergies, or ingredients they really dislike. Brief and warm.
3. Third response: Ask about favorite cuisines, typical cooking time preference, and any special equipment they have (instant pot, air fryer, etc). Tell them you're excited to cook with them!

After EACH response, include a hidden data block on a new line:
[PROFILE_DATA: {"identity":{"householdSize":2,"skillLevel":"beginner","cookingFrequency":"3-4x/week"},"dietary":{"restrictions":[{"name":"vegetarian","strict":true}],"allergies":[{"name":"peanuts"}]},"tastes":{"cuisines":[{"cuisine":"Italian","score":0.9}]},"equipment":["instant pot"],"patterns":{"avgCookTime":30}}]

Only include fields you've actually learned. Use your best inference for scores. Omit fields you haven't discussed yet.

On your THIRD response (after they answer about cuisines/equipment), also include [ONBOARDING_COMPLETE] at the very end.

RULES:
- Be warm, brief, and conversational — not formal or robotic
- Each response should be 2-4 sentences max plus your question(s)
- Don't overwhelm them with too many questions at once
- Don't repeat questions they've already answered`;
}

function processProfileData(content) {
  const matches = content.matchAll(/\[PROFILE_DATA:\s*(\{[\s\S]*?\})\]/g);
  for (const match of matches) {
    try {
      const data = JSON.parse(match[1]);
      const signal = {};

      if (data.identity) signal.identity = data.identity;
      if (data.equipment) signal.equipment = data.equipment;
      if (data.patterns) signal.patterns = data.patterns;

      if (data.dietary) {
        signal.dietary = {};
        if (data.dietary.restrictions) signal.dietary.restrictions = data.dietary.restrictions;
        if (data.dietary.allergies) signal.dietary.allergies = data.dietary.allergies;
      }

      if (data.tastes) {
        signal.tastes = {};
        if (data.tastes.cuisines) signal.tastes.cuisines = data.tastes.cuisines;
        if (data.tastes.flavors) signal.tastes.flavors = data.tastes.flavors;
        if (data.tastes.ingredients) signal.tastes.ingredients = data.tastes.ingredients;
        if (data.tastes.proteins) signal.tastes.proteins = data.tastes.proteins;
      }

      // Ensure profile exists before merging
      if (!getUserProfile()) {
        saveUserProfile(createDefaultProfile());
      }
      mergeSignalIntoProfile(signal);
    } catch (err) {
      console.error('Failed to parse profile data:', err);
    }
  }
}

function cleanDisplayContent(content) {
  return content
    .replace(/\[PROFILE_DATA:\s*\{[\s\S]*?\}\]/g, '')
    .replace(/\[ONBOARDING_COMPLETE\]/g, '')
    .trim();
}

export default Onboarding;
