// prompts.js
// ============================================================================
// MORPHIC WEB - PROMPT CONFIGURATIONS
// Fetches prompt text files and populates the PROMPTS object.
// ============================================================================

const PROMPTS = {};
let promptsLoaded = false;
let promptsLoadingPromise = null;

async function fetchPrompts() {
  if (promptsLoaded) return;

  const promptKeys = ['system', 'responsive', 'htmlStructure', 'reactStructure', 'aiFeatures', 'quality'];

  await Promise.all(promptKeys.map(async (key) => {
    try {
      const response = await fetch(`./prompts/${key}.txt`);
      if (!response.ok) {
        throw new Error(`Failed to load prompt: ${key}.txt`);
      }
      PROMPTS[key] = await response.text();
    } catch (error) {
      console.warn(error);
      PROMPTS[key] = PROMPTS[key] || '';
    }
  }));

  promptsLoaded = true;
}

function loadPrompts() {
  if (!promptsLoadingPromise) {
    promptsLoadingPromise = fetchPrompts();
  }
  return promptsLoadingPromise;
}

export { PROMPTS, loadPrompts };
