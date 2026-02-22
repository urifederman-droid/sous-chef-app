import Anthropic from '@anthropic-ai/sdk';

// --- Profile Schema ---

function createDefaultProfile() {
  return {
    version: 1,
    onboardingComplete: false,
    sessionsCompleted: 0,
    manual: { allergies: '', cuisines: '', dislikes: '' },
    identity: {},
    equipment: { owned: [], confidence: 0 },
    dietary: {
      restrictions: [],
      allergies: []
    },
    tastes: {
      cuisineAffinities: [],
      flavorProfile: {},
      ingredientAffinities: [],
      proteinPreferences: []
    },
    patterns: {},
    signals: []
  };
}

// --- Confidence Formula ---
// 1 signal ~ 0.3, 5 signals ~ 0.7, 10 signals ~ 0.8
function computeConfidence(signalCount) {
  return Math.min(1.0, 0.3 + 0.15 * Math.log2(signalCount + 1));
}

// --- Score Merging ---
// Weighted moving average
function mergeScore(oldScore, signalScore) {
  return oldScore * 0.7 + signalScore * 0.3;
}

// --- Profile Read/Write ---

export function getUserProfile() {
  try {
    const stored = localStorage.getItem('userProfile');
    if (stored) return JSON.parse(stored);
  } catch {}
  return null;
}

export function saveUserProfile(profile) {
  localStorage.setItem('userProfile', JSON.stringify(profile));
}

// --- Signal Merging ---

export function mergeSignalIntoProfile(signal) {
  let profile = getUserProfile() || createDefaultProfile();

  // Identity signals (householdSize, skillLevel, cookingFrequency, budgetSensitivity)
  if (signal.identity) {
    for (const [key, value] of Object.entries(signal.identity)) {
      const existing = profile.identity[key];
      if (existing) {
        existing.signalCount += 1;
        existing.value = value;
        existing.confidence = computeConfidence(existing.signalCount);
      } else {
        profile.identity[key] = { value, confidence: 0.3, signalCount: 1 };
      }
    }
  }

  // Equipment
  if (signal.equipment && Array.isArray(signal.equipment)) {
    for (const item of signal.equipment) {
      if (!profile.equipment.owned.includes(item)) {
        profile.equipment.owned.push(item);
      }
    }
    profile.equipment.confidence = computeConfidence(profile.equipment.owned.length);
  }

  // Dietary restrictions
  if (signal.dietary) {
    if (signal.dietary.restrictions) {
      for (const r of signal.dietary.restrictions) {
        const existing = profile.dietary.restrictions.find(x => x.name === r.name);
        if (!existing) {
          profile.dietary.restrictions.push({ name: r.name, confidence: r.confidence || 1.0, strict: r.strict !== false });
        }
      }
    }
    if (signal.dietary.allergies) {
      for (const a of signal.dietary.allergies) {
        const existing = profile.dietary.allergies.find(x => x.name === a.name);
        if (!existing) {
          profile.dietary.allergies.push({ name: a.name, confidence: a.confidence || 1.0 });
        }
      }
    }
  }

  // Taste signals
  if (signal.tastes) {
    // Cuisine affinities
    if (signal.tastes.cuisines) {
      for (const { cuisine, score } of signal.tastes.cuisines) {
        const existing = profile.tastes.cuisineAffinities.find(x => x.cuisine === cuisine);
        if (existing) {
          existing.signalCount += 1;
          existing.score = mergeScore(existing.score, score);
          existing.confidence = computeConfidence(existing.signalCount);
        } else {
          profile.tastes.cuisineAffinities.push({ cuisine, score, confidence: 0.3, signalCount: 1 });
        }
      }
    }

    // Flavor profile
    if (signal.tastes.flavors) {
      for (const { flavor, score } of signal.tastes.flavors) {
        const existing = profile.tastes.flavorProfile[flavor];
        if (existing) {
          existing.signalCount += 1;
          existing.score = mergeScore(existing.score, score);
          existing.confidence = computeConfidence(existing.signalCount);
        } else {
          profile.tastes.flavorProfile[flavor] = { score, confidence: 0.3, signalCount: 1 };
        }
      }
    }

    // Ingredient affinities
    if (signal.tastes.ingredients) {
      for (const { ingredient, score } of signal.tastes.ingredients) {
        const existing = profile.tastes.ingredientAffinities.find(x => x.ingredient === ingredient);
        if (existing) {
          existing.signalCount += 1;
          existing.score = mergeScore(existing.score, score);
          existing.confidence = computeConfidence(existing.signalCount);
        } else {
          profile.tastes.ingredientAffinities.push({ ingredient, score, confidence: 0.3, signalCount: 1 });
        }
      }
    }

    // Protein preferences
    if (signal.tastes.proteins) {
      for (const { protein, score } of signal.tastes.proteins) {
        const existing = profile.tastes.proteinPreferences.find(x => x.protein === protein);
        if (existing) {
          existing.signalCount += 1;
          existing.score = mergeScore(existing.score, score);
          existing.confidence = computeConfidence(existing.signalCount);
        } else {
          profile.tastes.proteinPreferences.push({ protein, score, confidence: 0.3, signalCount: 1 });
        }
      }
    }
  }

  // Pattern signals
  if (signal.patterns) {
    for (const [key, value] of Object.entries(signal.patterns)) {
      const existing = profile.patterns[key];
      if (existing) {
        existing.signalCount += 1;
        if (typeof value === 'number') {
          existing.value = mergeScore(existing.value, value);
        } else {
          existing.value = value;
        }
        existing.confidence = computeConfidence(existing.signalCount);
      } else {
        profile.patterns[key] = { value, confidence: 0.3, signalCount: 1 };
      }
    }
  }

  saveUserProfile(profile);
  return profile;
}

// --- Passive Signal Logging ---

export function logPassiveSignal(type, data) {
  try {
    let profile = getUserProfile();
    if (!profile) return;

    const signal = {
      type,
      data,
      timestamp: new Date().toISOString()
    };

    // Keep rolling window of last 50 signals
    profile.signals = profile.signals || [];
    profile.signals.push(signal);
    if (profile.signals.length > 50) {
      profile.signals = profile.signals.slice(-50);
    }

    saveUserProfile(profile);
  } catch {}
}

// --- Post-Session Signal Extraction ---

export async function extractAndMergeSessionSignal(recipe) {
  try {
    const profile = getUserProfile();
    if (!profile) return;

    const chatText = (recipe.chatHistory || [])
      .map(m => `${m.role}: ${typeof m.content === 'string' ? m.content : ''}`)
      .join('\n')
      .slice(0, 4000);

    const ratingInfo = [
      recipe.rating ? `Overall rating: ${recipe.rating}/5` : '',
      recipe.tasteRating ? `Taste rating: ${recipe.tasteRating}/5` : '',
      recipe.effortRating ? `Effort rating: ${recipe.effortRating}/5` : '',
      recipe.notes ? `Notes: ${recipe.notes}` : '',
      recipe.tags ? `Tags: ${recipe.tags.join(', ')}` : ''
    ].filter(Boolean).join('\n');

    const anthropic = new Anthropic({
      apiKey: process.env.REACT_APP_ANTHROPIC_API_KEY,
      dangerouslyAllowBrowser: true
    });

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `Analyze this cooking session and extract user preference signals. Return ONLY valid JSON, no other text.

Session data:
${chatText}

Ratings and feedback:
${ratingInfo}

Return JSON with any of these fields (omit fields you can't infer):
{
  "tastes": {
    "cuisines": [{"cuisine": "Mexican", "score": 0.8}],
    "flavors": [{"flavor": "spicy", "score": 0.9}],
    "ingredients": [{"ingredient": "garlic", "score": 0.7}],
    "proteins": [{"protein": "chicken", "score": 0.8}]
  },
  "patterns": {
    "preferredComplexity": "medium",
    "avgCookTime": 35
  },
  "identity": {
    "skillLevel": "intermediate"
  }
}

Score meaning: 1.0 = loves it, 0.5 = neutral, 0.0 = dislikes it. Infer from ratings, tags, notes, and what they cooked.`
      }]
    });

    const text = response.content[0].text.trim();
    const signal = JSON.parse(text);
    mergeSignalIntoProfile(signal);

    // Increment sessions completed
    const updated = getUserProfile();
    if (updated) {
      updated.sessionsCompleted = (updated.sessionsCompleted || 0) + 1;
      saveUserProfile(updated);
    }
  } catch (err) {
    console.error('Signal extraction failed:', err);
  }
}

// --- Enhanced Preferences Prompt ---

export function getUserPreferencesPrompt() {
  // Try new profile first
  const profile = getUserProfile();
  if (profile) {
    return buildProfilePrompt(profile);
  }

  // Fallback to legacy userPreferences
  try {
    const stored = localStorage.getItem('userPreferences');
    if (!stored) return '';
    const prefs = JSON.parse(stored);
    const parts = [];
    if (prefs.allergies && prefs.allergies.trim()) {
      parts.push(`- Allergies & dietary restrictions: ${prefs.allergies.trim()}`);
    }
    if (prefs.cuisines && prefs.cuisines.trim()) {
      parts.push(`- Favorite cuisines: ${prefs.cuisines.trim()}`);
    }
    if (prefs.dislikes && prefs.dislikes.trim()) {
      parts.push(`- Ingredients I dislike: ${prefs.dislikes.trim()}`);
    }
    if (parts.length === 0) return '';
    return `\n\nUser preferences:\n${parts.join('\n')}\n\nIMPORTANT: These preferences are ONLY for when the user gives a vague or open-ended request (e.g. "give me a taco recipe"). When the user explicitly names a specific ingredient or dish (e.g. "beef tacos"), you MUST give them exactly what they asked for — never substitute or modify based on preferences. After providing the full recipe they asked for, you may add a brief note like "I noticed you don't usually like [X] — would you like me to swap it for something else?"`;
  } catch {
    return '';
  }
}

function buildProfilePrompt(profile) {
  const parts = [];

  // Hard constraints first (allergies, dietary restrictions)
  const allergies = [
    ...(profile.dietary?.allergies || []).map(a => a.name),
    ...(profile.manual?.allergies ? [profile.manual.allergies.trim()] : [])
  ].filter(Boolean);
  if (allergies.length > 0) {
    parts.push(`- ALLERGIES (strict): ${allergies.join(', ')}`);
  }

  const restrictions = (profile.dietary?.restrictions || [])
    .filter(r => r.strict)
    .map(r => r.name);
  if (restrictions.length > 0) {
    parts.push(`- Dietary restrictions: ${restrictions.join(', ')}`);
  }

  // Dislikes
  const dislikes = [
    ...(profile.manual?.dislikes ? [profile.manual.dislikes.trim()] : []),
    ...(profile.tastes?.ingredientAffinities || [])
      .filter(i => i.score < 0.3 && i.confidence >= 0.4)
      .map(i => i.ingredient)
  ].filter(Boolean);
  if (dislikes.length > 0) {
    parts.push(`- Dislikes: ${dislikes.join(', ')}`);
  }

  // Favorite cuisines
  const cuisines = [
    ...(profile.manual?.cuisines ? [profile.manual.cuisines.trim()] : []),
    ...(profile.tastes?.cuisineAffinities || [])
      .filter(c => c.score >= 0.6 && c.confidence >= 0.3)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(c => c.cuisine)
  ].filter(Boolean);
  if (cuisines.length > 0) {
    parts.push(`- Favorite cuisines: ${cuisines.join(', ')}`);
  }

  // Flavor preferences
  const flavors = Object.entries(profile.tastes?.flavorProfile || {})
    .filter(([, v]) => v.score >= 0.6 && v.confidence >= 0.3)
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, 5)
    .map(([name, v]) => `${name} (${Math.round(v.score * 10)}/10)`);
  if (flavors.length > 0) {
    parts.push(`- Flavor preferences: ${flavors.join(', ')}`);
  }

  // Preferred proteins
  const proteins = (profile.tastes?.proteinPreferences || [])
    .filter(p => p.score >= 0.5 && p.confidence >= 0.3)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(p => p.protein);
  if (proteins.length > 0) {
    parts.push(`- Preferred proteins: ${proteins.join(', ')}`);
  }

  // Liked ingredients
  const likedIngredients = (profile.tastes?.ingredientAffinities || [])
    .filter(i => i.score >= 0.7 && i.confidence >= 0.4)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map(i => i.ingredient);
  if (likedIngredients.length > 0) {
    parts.push(`- Loves: ${likedIngredients.join(', ')}`);
  }

  // Cooking context
  const contextParts = [];
  if (profile.identity?.householdSize) {
    contextParts.push(`cooks for ${profile.identity.householdSize.value}`);
  }
  if (profile.identity?.skillLevel) {
    contextParts.push(`${profile.identity.skillLevel.value} cook`);
  }
  if (profile.identity?.cookingFrequency) {
    contextParts.push(`cooks ${profile.identity.cookingFrequency.value}`);
  }
  if (profile.patterns?.avgCookTime) {
    contextParts.push(`prefers ~${Math.round(profile.patterns.avgCookTime.value)} min recipes`);
  }
  if (contextParts.length > 0) {
    parts.push(`- Context: ${contextParts.join(', ')}`);
  }

  // Equipment
  if (profile.equipment?.owned?.length > 0) {
    parts.push(`- Equipment: ${profile.equipment.owned.slice(0, 8).join(', ')}`);
  }

  if (parts.length === 0) return '';

  return `\n\nUser profile:\n${parts.join('\n')}\n\nIMPORTANT: These preferences are ONLY for when the user gives a vague or open-ended request (e.g. "give me a taco recipe"). When the user explicitly names a specific ingredient or dish (e.g. "beef tacos"), you MUST give them exactly what they asked for — never substitute or modify based on preferences. After providing the full recipe they asked for, you may add a brief note like "I noticed you don't usually like [X] — would you like me to swap it for something else?"`;
}

export { createDefaultProfile };
