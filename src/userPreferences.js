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
    return `\n\nUser preferences (use as defaults, but if the user explicitly requests something that conflicts with these preferences, go with what they asked for and just briefly ask if they'd like a substitution instead):\n${parts.join('\n')}`;
  } catch {
    return '';
  }
}
