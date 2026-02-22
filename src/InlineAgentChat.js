import React, { useState, useRef, useEffect } from 'react';
import Anthropic from '@anthropic-ai/sdk';
import { Send, X } from 'lucide-react';
import { getUserPreferencesPrompt } from './userPreferences';
import ReactMarkdown from 'react-markdown';
import './InlineAgentChat.css';

function InlineAgentChat({ systemPrompt, placeholder }) {
  const [userInput, setUserInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

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
        max_tokens: 1500,
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
