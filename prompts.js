// prompts.js
// ============================================================================
// MORPHIC WEB - PROMPT CONFIGURATIONS
// Fetches prompt text files and populates the PROMPTS object.
// ============================================================================

const PROMPTS = {};
let promptsLoaded = false;
let promptsLoadingPromise = null;

async function fetchPrompts() {
  const promptKeys = ['system', 'responsive', 'htmlStructure', 'reactStructure', 'aiFeatures', 'quality'];
  const fetchPromises = promptKeys.map(key =>
    fetch(`./prompts/${key}.txt`)
      .then(response => {
        if (!response.ok) {
          throw new Error(`Failed to load prompt: ${key}.txt`);
        }
        return response.text();
      })
      .then(text => {
        PROMPTS[key] = text;
      })
  );

  await Promise.all(fetchPromises);
  promptsLoaded = true;
}

function loadPrompts() {
  if (!promptsLoadingPromise) {
    promptsLoadingPromise = fetchPrompts();
  }
  return promptsLoadingPromise;
}

export { PROMPTS, loadPrompts };
