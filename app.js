// app.js
// ============================================================================
// MORPHIC WEB - MAIN APPLICATION
// ============================================================================

import { PROMPTS, loadPrompts } from './prompts.js';

// State
let groqKey = "";
let interactionCount = 0;
let elementsCreated = 0;
let adaptations = 0;
let conversationHistory = [];
let selectedModel = 'llama-3.1-70b-versatile';

// ============================================================================
// UTILITIES
// ============================================================================

function updateStats() {
  document.getElementById('interactionCount').textContent = interactionCount;
  document.getElementById('elementsCreated').textContent = elementsCreated;
  document.getElementById('adaptations').textContent = adaptations;
}

function logHistory(msg) {
  const log = document.getElementById('historyLog');
  const item = document.createElement('div');
  item.className = 'history-item';
  item.textContent = `${new Date().toLocaleTimeString()} - ${msg}`;
  log.appendChild(item);
  log.scrollTop = log.scrollHeight;
}

async function initializeExperience() {
  groqKey = document.getElementById('apiKey').value.trim();
  if (!groqKey) {
    alert('Please paste your Groq API key!');
    return;
  }
  window.groqKey = groqKey;
  window.selectedModel = selectedModel;

  const startBtn = document.querySelector('.start-btn');
  startBtn.disabled = true;
  startBtn.textContent = 'Loading...';

  try {
    await loadPrompts();
    document.getElementById('setupCard').style.display = "none";
    document.getElementById('interactionZone').style.display = "block";
    fetchGroqModels().catch(err => {
      console.error('Model fetch failed:', err);
      const sel = document.getElementById('modelSelect');
      if (sel) {
        sel.innerHTML = `<option value="${selectedModel}">${selectedModel}</option>`;
        sel.disabled = false;
      }
    });
    logHistory('🚀 Ready to build apps!');
  } catch (error) {
    console.error('Failed to load prompts:', error);
    alert(`Error initializing the application: ${error.message}`);
    startBtn.disabled = false;
    startBtn.textContent = '🚀 Start Building';
  }
}

// ============================================================================
// INTENT ANALYSIS
// ============================================================================

function analyzeIntent(intent) {
  const lower = intent.toLowerCase();
  
  return {
    needsAI: /(ai|assistant|chatbot|chat|gpt|groq|llm|talk)/i.test(intent),
    isComplex: /(todo|task|crud|dashboard|multi|state|form|track|manage)/i.test(intent) && intent.length > 30,
    isSimple: /(calculator|counter|timer|clock|convert|simple)/i.test(intent)
  };
}

// ============================================================================
// PROMPT BUILDER
// ============================================================================

function buildPrompt(userIntent, analysis) {
  const aiInstruction = analysis.needsAI ? PROMPTS.aiFeatures : '';
  const context = conversationHistory.length > 0 
    ? `Past: ${conversationHistory.slice(-2).join(' | ')}` 
    : '';

  return `${PROMPTS.system}
User wants: "${userIntent}"

${PROMPTS.responsive}
${aiInstruction}

${context}`;
}

// ============================================================================
// MAIN GENERATION
// ============================================================================

async function generateInterface() {
  const intent = document.getElementById('userIntent').value.trim();
  const content = document.getElementById('generatedContent');
  
  if (!intent) {
    alert('Describe what to build!');
    return;
  }
  
  content.innerHTML = '<div class="loading">✨ Building...</div>';
  interactionCount++;
  updateStats();
  
  const analysis = analyzeIntent(intent);
  const prompt = buildPrompt(intent, analysis);
  
  try {
    const code = await callGroq(prompt);
    renderHTML(code, content, intent);
    enforceResponsive();
    setTimeout(() => content.scrollIntoView({behavior:'smooth', block:'center'}), 100);
    
    conversationHistory.push(intent.substring(0, 40));
    if (conversationHistory.length > 5) conversationHistory.shift();
    
    elementsCreated += countElements(code);
    adaptations++;
    updateStats();
    
    logHistory(`✅ ${intent.substring(0, 35)}...`);
    document.getElementById('userIntent').value = '';
    
  } catch(e) {
    content.innerHTML = `<div class='error-message'><b>Error:</b> ${e.message}</div>`;
    logHistory(`❌ ${e.message}`);
  }
}

// ============================================================================
// API CALL
// ============================================================================

function getModelMaxTokens(model) {
  if (model.includes('gemma')) return 512;
  if (model.includes('llama-3.3') || model.includes('llama-3.2')) return 2048;
  if (model.includes('llama-3.1')) return 4096;
  if (model.includes('mixtral')) return 4096;
  return 2048;
}

async function callGroq(prompt) {
  const maxTokens = getModelMaxTokens(selectedModel);
  const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${groqKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: selectedModel,
      max_tokens: maxTokens,
      temperature: 0.74,
      messages: [{ role: "user", content: prompt }]
    })
  });
  
  if (!resp.ok) {
    const error = await resp.json().catch(() => ({}));
    throw new Error(error.error?.message || 'API error');
  }
  
  const data = await resp.json();
  let html = data.choices?.[0]?.message?.content || "";
  html = html.replace(/``````/g, '').trim();
  if (!/<div/i.test(html)) throw new Error("No usable HTML generated");
  return html;
}

// ============================================================================
// RENDERING
// ============================================================================

function cleanCodeFromMarkdown(raw) {
  let cleaned = raw;
  
  // Remove all markdown code blocks
  cleaned = cleaned.replace(/```[\w]*\n?([\s\S]*?)\n?```/g, '$1');
  cleaned = cleaned.replace(/```([\s\S]*?)```/g, '$1');
  
  // Remove section headers and explanatory text
  cleaned = cleaned.replace(/^(HTML:|CSS:|JavaScript:|JS:|Code:|Output:|Result:|HTML TEMPLATE:|JS CODE:).*$/gm, '');
  cleaned = cleaned.replace(/^(Now you have|This is|You can|Here's|I've created|The above|This creates).*$/gm, '');
  cleaned = cleaned.replace(/^(Feel free|You can customize|To use|Simply|Just).*$/gm, '');
  cleaned = cleaned.replace(/^.*\b(implement|add|customize|modify|improve|enhance)\b.*$/gm, '');
  
  // Remove server-only and non-browser lines
  cleaned = cleaned.replace(/^.*\brequire\(.*$/gm, '');
  cleaned = cleaned.replace(/^.*\bmodule\.exports\b.*$/gm, '');
  cleaned = cleaned.replace(/^.*\bJSDOM\b.*$/gm, '');
  cleaned = cleaned.replace(/^.*\bimport\s+.*$/gm, '');

  // Remove placeholder HTML comments
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');
  
  // Remove all comments (both /* */ and //)
  cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');
  cleaned = cleaned.replace(/\/\/.*$/gm, '');
  
  // Remove empty lines and clean up
  cleaned = cleaned.replace(/^\s*[\r\n]/gm, '');
  cleaned = cleaned.replace(/\n\s*\n/g, '\n');
  
  // Remove duplicate/redundant sections
  const divMatches = cleaned.match(/<div[^>]*id="mainAPP"[^>]*>[\s\S]*?<\/div>/gi);
  if (divMatches && divMatches.length > 1) {
    // Keep only the first mainAPP div
    cleaned = divMatches[0] + cleaned.substring(cleaned.lastIndexOf('</div>') + 6);
  }
  return cleaned.trim();
}

function renderHTML(raw, container) {
  const code = cleanCodeFromMarkdown(raw || '');
  let html = code;
  let style = '';
  let script = '';

  const styleMatch = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  if (styleMatch) {
    style = styleMatch[1];
    html = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  }

  const scriptMatch = html.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
  if (scriptMatch) {
    script = scriptMatch[1];
    html = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  }

  if (!/id\s*=\s*"?mainAPP"?/i.test(html)) {
    html = `<div id="mainAPP">${html}</div>`;
  }

  container.innerHTML = html;

  if (style) {
    const styleEl = document.createElement('style');
    styleEl.textContent = style;
    container.appendChild(styleEl);
  }

  if (script) {
    const scriptEl = document.createElement('script');
    scriptEl.textContent = script;
    container.appendChild(scriptEl);
  }
}

function renderReact(code, container) {
  container.innerHTML = `
    <div style="padding:20px;text-align:center;">
      <h3>⚛️ React App Generated</h3>
      <p>React requires build tools. Copy code below:</p>
      <pre style="background:#f5f5f5;padding:15px;border-radius:8px;overflow-x:auto;text-align:left;font-size:0.85em;max-height:400px;">${escapeHTML(code)}</pre>
      <p><small>Use in a React environment with npm/yarn.</small></p>
    </div>
  `;
}

function escapeHTML(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================================================
// HELPERS & EVENT LISTENERS
// ============================================================================

function enforceResponsive() {
  const content = document.getElementById('generatedContent');
  const allElements = content.querySelectorAll('*');
  
  allElements.forEach(el => {
    if (!el.style.maxWidth) el.style.maxWidth = '100%';
    if (!el.style.boxSizing) el.style.boxSizing = 'border-box';
    
    if (el.tagName === 'TABLE') {
      el.style.width = '100%';
      el.style.tableLayout = 'fixed';
    }
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      if (!el.style.width) el.style.width = '100%';
      el.style.maxWidth = '100%';
    }
  });
}

function countElements(code) {
  const div = document.createElement('div');
  div.innerHTML = code;
  return div.querySelectorAll('*').length;
}

document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById('userIntent');
  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        generateInterface();
      }
    });
  }
  const modelSelect = document.getElementById('modelSelect');
  if (modelSelect) {
    modelSelect.addEventListener('change', (e) => {
      selectedModel = e.target.value;
      window.selectedModel = selectedModel;
      logHistory(`🧠 Model set to: ${selectedModel}`);
    });
  }
  window.selectedModel = selectedModel;
});

async function fetchGroqModels() {
  const sel = document.getElementById('modelSelect');
  if (!sel) return;
  sel.disabled = true;
  sel.innerHTML = '<option>Loading models...</option>';

  const resp = await fetch('https://api.groq.com/openai/v1/models', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${groqKey}`,
      'Content-Type': 'application/json'
    }
  });

  if (!resp.ok) {
    const error = await resp.json().catch(() => ({}));
    throw new Error(error.error?.message || 'Failed to load models');
  }

  const data = await resp.json();
  const models = Array.isArray(data.data) ? data.data : [];
  const ids = models
    .map(m => m.id)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  sel.innerHTML = '';
  const preferred = selectedModel;
  let preferredExists = false;
  ids.forEach(id => {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = id;
    if (id === preferred) preferredExists = true;
    sel.appendChild(opt);
  });

  if (preferredExists) {
    sel.value = preferred;
  } else if (ids.length) {
    sel.value = ids[0];
    selectedModel = ids[0];
  } else {
    // Fallback to default
    const opt = document.createElement('option');
    opt.value = preferred;
    opt.textContent = preferred;
    sel.appendChild(opt);
    sel.value = preferred;
  }
  sel.disabled = false;
}

// Simple helper for generated apps to call Groq chat with the active model
window.morphicGroqChat = async function(messages, opts = {}) {
  const key = window.groqKey;
  if (!key) throw new Error('Missing Groq API key');
  const model = opts.model || window.selectedModel || 'llama-3.1-70b-versatile';
  const temperature = typeof opts.temperature === 'number' ? opts.temperature : 0.7;
  const max_tokens = typeof opts.max_tokens === 'number' ? opts.max_tokens : Math.min(1024, getModelMaxTokens(model));
  const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ model, temperature, max_tokens, messages })
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Groq request failed');
  }
  const data = await resp.json();
  return data.choices?.[0]?.message?.content || '';
}

// Populate textarea with an example prompt
function useExamplePrompt(text) {
  const input = document.getElementById('userIntent');
  if (input) {
    input.value = text;
    input.focus();
  }
}

// Expose functions to global scope for HTML onclick handlers
window.initializeExperience = initializeExperience;
window.generateInterface = generateInterface;
window.getModelMaxTokens = getModelMaxTokens;
window.useExamplePrompt = useExamplePrompt;
