import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Anthropic from '@anthropic-ai/sdk';
import { getUserPreferencesPrompt } from './userPreferences';
import './ImportURL.css';

function ImportURL() {
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const handleImport = async () => {
    if (!url.trim()) return;

    setLoading(true);
    setError('');
    setStatus('Fetching recipe page...');

    try {
      // Step 1: Fetch the page content via our serverless proxy
      const fetchRes = await fetch('/api/fetch-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });

      const fetchData = await fetchRes.json();

      if (!fetchRes.ok) {
        throw new Error(fetchData.error || 'Failed to fetch the URL');
      }

      setStatus('Extracting recipe...');

      // Step 2: Send to Claude to extract the recipe
      const anthropic = new Anthropic({
        apiKey: process.env.REACT_APP_ANTHROPIC_API_KEY,
        dangerouslyAllowBrowser: true,
      });

      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: `Extract the recipe from this webpage HTML. Return ONLY valid JSON with this exact structure, no other text:
{
  "title": "Recipe Title",
  "description": "Brief one-sentence description",
  "prepTime": "X mins",
  "cookTime": "Y mins",
  "servings": "Z",
  "ingredients": [
    {"amount": "1 cup", "item": "flour"}
  ],
  "steps": [
    {"number": 1, "instruction": "Step text here"}
  ]
}

If you cannot find a recipe in the content, return exactly: {"error": "no recipe found"}${getUserPreferencesPrompt()}

Webpage content:
${fetchData.content.substring(0, 50000)}`,
          },
        ],
      });

      const responseText = message.content[0].text.trim();

      // Parse the JSON response
      let recipe;
      try {
        // Handle case where Claude wraps in markdown code block
        const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
        recipe = JSON.parse(jsonMatch ? jsonMatch[1].trim() : responseText);
      } catch {
        throw new Error('Could not parse the recipe. Try a different URL.');
      }

      if (recipe.error) {
        throw new Error("Couldn't find a recipe on that page. Try a direct recipe URL.");
      }

      // Step 3: Save and navigate to cook mode
      localStorage.setItem('currentRecipe', JSON.stringify(recipe));
      navigate('/cook');
    } catch (err) {
      console.error('Import error:', err);
      setError(err.message);
    }

    setLoading(false);
    setStatus('');
  };

  return (
    <div className="import-url">
      <button className="back-btn" onClick={() => navigate('/')}>← Back</button>

      <div className="content">
        <h1>Import Recipe from URL</h1>
        <p className="subtitle">Paste a link from any recipe site or social media post</p>

        <input
          type="url"
          className="url-input"
          placeholder="https://example.com/recipe"
          value={url}
          onChange={(e) => { setUrl(e.target.value); setError(''); }}
          onKeyDown={(e) => e.key === 'Enter' && !loading && handleImport()}
          disabled={loading}
        />

        {error && <p className="error-message">{error}</p>}

        <button
          className="import-btn"
          onClick={handleImport}
          disabled={loading || !url.trim()}
        >
          {loading ? status : 'Import Recipe'}
        </button>

        {loading && (
          <div className="loading-indicator">
            <span className="chef-emoji pulsing">👨‍🍳</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default ImportURL;
