export function getUserPreferencesPrompt() {
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
