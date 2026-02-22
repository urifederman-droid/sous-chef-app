import Anthropic from '@anthropic-ai/sdk';

export function generateRecipeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function createRecipeMetadata() {
  return {
    version: 1,

    // LAYER 1: DISCOVERY
    discovery: {
      cuisine: null, subCuisine: null,
      course: null,
      cookingMethods: [],
      proteinType: null,
      keyIngredients: [],
      dietary: {
        vegetarian: false, vegan: false, glutenFree: false, dairyFree: false,
        kosherStyle: false, halalStyle: false, lowCarb: false, highProtein: false
      },
      context: {
        weeknightFriendly: null, mealPrep: null, dinnerParty: null,
        comfortFood: null, seasonal: null, holiday: null
      }
    },

    // LAYER 2: DECISION
    decision: {
      flavorProfile: {
        dominant: [], spiceLevel: null, richness: null,
        acidity: null, texture: []
      },
      quality: {
        avgRating: null, cookCount: 0,
        wouldCookAgain: null, reviewSummary: null
      }
    },

    // LAYER 3: EXECUTION
    execution: {
      time: {
        activeMinutes: null, passiveMinutes: null,
        totalMinutes: null, cleanupEstimate: null
      },
      difficulty: {
        level: null, techniqueComplexity: null,
        prepSteps: null, equipmentRequired: []
      },
      failureRisk: {
        overall: null, temperatureSensitive: false,
        timingSensitive: false, requiresMultitasking: false,
        substitutionTolerance: null
      }
    },

    // LAYER 4: PERSONALIZATION
    personalization: {
      userModifications: [],
      substitutionsMade: [],
      portionAdjustment: null
    },

    // LAYER 5: LEARNING
    learning: {
      userRating: null, tasteRating: null, effortRating: null,
      wouldCookAgain: null,
      actualTimeMinutes: null, difficultyExperienced: null,
      notes: '', tags: [],
      cookHistory: []
    },

    nutrition: {
      estimatedPerServing: {
        calories: null, proteinGrams: null, carbGrams: null,
        fatGrams: null, fiberGrams: null
      },
      macroTags: [],
      confidenceNote: 'estimated'
    },

    servings: { default: null, scalesLinearly: true },

    ingredientAccessibility: {
      specialtyCount: null, pantryStapleRatio: null
    },

    prepAhead: { possible: null, components: [] },

    source: {
      type: null,
      url: null, domain: null,
      cookbook: null, author: null,
      aiGenerated: true
    }
  };
}

export async function extractRecipeMetadata(recipeText) {
  const metadata = createRecipeMetadata();

  try {
    const anthropic = new Anthropic({
      apiKey: process.env.REACT_APP_ANTHROPIC_API_KEY,
      dangerouslyAllowBrowser: true
    });

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1200,
      messages: [{
        role: 'user',
        content: `Analyze this recipe and extract metadata. Return ONLY valid JSON, no other text.

{
  "discovery": {
    "cuisine": "string or null",
    "subCuisine": "string or null",
    "course": "main|side|dessert|snack|appetizer or null",
    "cookingMethods": ["list of methods"],
    "proteinType": "string or null",
    "keyIngredients": ["top 5 ingredients"],
    "dietary": {
      "vegetarian": bool, "vegan": bool, "glutenFree": bool, "dairyFree": bool,
      "kosherStyle": bool, "halalStyle": bool, "lowCarb": bool, "highProtein": bool
    },
    "context": {
      "weeknightFriendly": bool, "mealPrep": bool, "dinnerParty": bool,
      "comfortFood": bool, "seasonal": "string or null", "holiday": "string or null"
    }
  },
  "decision": {
    "flavorProfile": {
      "dominant": ["top 2-3 flavors"], "spiceLevel": 1-5, "richness": 1-5,
      "acidity": 1-5, "texture": ["textures"]
    }
  },
  "execution": {
    "time": {
      "activeMinutes": number, "passiveMinutes": number,
      "totalMinutes": number, "cleanupEstimate": "low|medium|high"
    },
    "difficulty": {
      "level": 1-3, "techniqueComplexity": 1-5,
      "prepSteps": number, "equipmentRequired": ["list"]
    },
    "failureRisk": {
      "overall": "low|medium|high", "temperatureSensitive": bool,
      "timingSensitive": bool, "requiresMultitasking": bool,
      "substitutionTolerance": "low|medium|high"
    }
  },
  "nutrition": {
    "estimatedPerServing": {
      "calories": number, "proteinGrams": number, "carbGrams": number,
      "fatGrams": number, "fiberGrams": number
    },
    "macroTags": ["high-protein", "low-carb", etc]
  },
  "servings": { "default": number, "scalesLinearly": bool },
  "ingredientAccessibility": { "specialtyCount": number, "pantryStapleRatio": 0-1 },
  "prepAhead": { "possible": bool, "components": ["list"] }
}

Recipe:
${recipeText.slice(0, 3000)}`
      }]
    });

    const text = response.content[0].text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const extracted = JSON.parse(jsonMatch[0]);

      // Merge extracted data into metadata
      if (extracted.discovery) {
        Object.assign(metadata.discovery, extracted.discovery);
        if (extracted.discovery.dietary) {
          Object.assign(metadata.discovery.dietary, extracted.discovery.dietary);
        }
        if (extracted.discovery.context) {
          Object.assign(metadata.discovery.context, extracted.discovery.context);
        }
      }
      if (extracted.decision?.flavorProfile) {
        Object.assign(metadata.decision.flavorProfile, extracted.decision.flavorProfile);
      }
      if (extracted.execution) {
        if (extracted.execution.time) Object.assign(metadata.execution.time, extracted.execution.time);
        if (extracted.execution.difficulty) Object.assign(metadata.execution.difficulty, extracted.execution.difficulty);
        if (extracted.execution.failureRisk) Object.assign(metadata.execution.failureRisk, extracted.execution.failureRisk);
      }
      if (extracted.nutrition) {
        if (extracted.nutrition.estimatedPerServing) {
          Object.assign(metadata.nutrition.estimatedPerServing, extracted.nutrition.estimatedPerServing);
        }
        if (extracted.nutrition.macroTags) metadata.nutrition.macroTags = extracted.nutrition.macroTags;
      }
      if (extracted.servings) Object.assign(metadata.servings, extracted.servings);
      if (extracted.ingredientAccessibility) Object.assign(metadata.ingredientAccessibility, extracted.ingredientAccessibility);
      if (extracted.prepAhead) Object.assign(metadata.prepAhead, extracted.prepAhead);
    }
  } catch (err) {
    console.error('Error extracting recipe metadata:', err);
  }

  return metadata;
}

export function mergeMetadataOntoRecipe(recipeIdOrIndex, metadata) {
  const savedRecipes = JSON.parse(localStorage.getItem('savedRecipes') || '[]');
  let idx = typeof recipeIdOrIndex === 'string'
    ? savedRecipes.findIndex(r => r.recipeId === recipeIdOrIndex)
    : recipeIdOrIndex;
  if (idx >= 0 && idx < savedRecipes.length) {
    savedRecipes[idx].metadata = metadata;
    localStorage.setItem('savedRecipes', JSON.stringify(savedRecipes));
  }
}

export function updateRecipeLearning(recipeIndex, learningData) {
  const savedRecipes = JSON.parse(localStorage.getItem('savedRecipes') || '[]');
  if (recipeIndex < 0 || recipeIndex >= savedRecipes.length) return;

  const recipe = savedRecipes[recipeIndex];
  if (!recipe.metadata) recipe.metadata = createRecipeMetadata();

  // Update layer 5 learning fields
  const learning = recipe.metadata.learning;
  if (learningData.userRating != null) learning.userRating = learningData.userRating;
  if (learningData.tasteRating != null) learning.tasteRating = learningData.tasteRating;
  if (learningData.effortRating != null) learning.effortRating = learningData.effortRating;
  if (learningData.wouldCookAgain != null) learning.wouldCookAgain = learningData.wouldCookAgain;
  if (learningData.notes != null) learning.notes = learningData.notes;
  if (learningData.tags != null) learning.tags = learningData.tags;

  // Add cook history entry
  learning.cookHistory.push({
    date: new Date().toISOString(),
    rating: learningData.userRating
  });

  // Increment cook count
  recipe.metadata.decision.quality.cookCount = (recipe.metadata.decision.quality.cookCount || 0) + 1;
  recipe.metadata.decision.quality.wouldCookAgain = learningData.wouldCookAgain;

  localStorage.setItem('savedRecipes', JSON.stringify(savedRecipes));
}

export async function backfillMetadata(onUpdate) {
  const savedRecipes = JSON.parse(localStorage.getItem('savedRecipes') || '[]');
  const needsBackfill = savedRecipes
    .map((r, i) => ({ recipe: r, index: i }))
    .filter(({ recipe }) => !recipe.metadata || !recipe.metadata.discovery?.cuisine);

  if (needsBackfill.length === 0) return;

  for (const { recipe, index } of needsBackfill) {
    try {
      const recipeText = recipe.pinnedRecipeText
        || recipe.chatHistory
          ?.filter(m => m.role === 'assistant')
          .map(m => typeof m.content === 'string' ? m.content : '')
          .join('\n')
        || recipe.title || '';

      if (!recipeText.trim()) continue;

      const metadata = await extractRecipeMetadata(recipeText);
      metadata.source.type = recipe.metadata?.source?.type || 'ai_generated';
      metadata.source.aiGenerated = true;
      const id = recipe.recipeId || index;
      mergeMetadataOntoRecipe(id, metadata);
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error(`Backfill failed for recipe ${index}:`, err);
    }
  }
}
