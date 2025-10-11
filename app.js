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
  const context = conversationHistory.length > 0
    ? `\nCONTEXT: Previous - ${conversationHistory.slice(-2).join(', ')}`
    : '';
  
  const techChoice = analysis.isSimple 
    ? `\nUSE: HTML/CSS/JS\n${PROMPTS.htmlStructure}`
    : analysis.isComplex
    ? `\nUSE: React\n${PROMPTS.reactStructure}`
    : `\nCHOOSE: Best tech for task\n${PROMPTS.htmlStructure}`;
  
  const aiInstruction = analysis.needsAI ? `\n${PROMPTS.aiFeatures}\nACTIVE_MODEL: ${selectedModel}` : '';
  
  return `${PROMPTS.system}

${PROMPTS.responsive}

${PROMPTS.quality}
${techChoice}
${aiInstruction}

USER REQUEST: "${userIntent}"
${context}

DELIVER: Premium app that exceeds expectations with stunning design and bonus features.
OUTPUT FORMAT: <div id="mainAPP">...</div><style>...</style><script>...</script>
FORBIDDEN: Any text outside code structure, markdown, explanations, comments.`;
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
    
    // Always render as HTML since we're not using build tools
    renderHTML(code, content);
    
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
      temperature: 0.7,
      messages: [{ role: "user", content: prompt }]
    })
  });
  
  if (!resp.ok) {
    const error = await resp.json().catch(() => ({}));
    throw new Error(error.error?.message || 'API error');
  }
  
  const data = await resp.json();
  let code = data.choices?.[0]?.message?.content || "";
  
  code = code.replace(/``````/g, '').trim();
  
  // Comprehensive cleaning for pristine code output
  code = code.replace(/```[\w]*\n?/g, '').replace(/```/g, '');
  code = code.replace(/^(HTML:|CSS:|JavaScript:|JS:|Code:|Output:).*$/gm, '');
  code = code.replace(/^(Now you have|This is|You.*|The.*|Here.*|I.*created|.*implement.*|.*add.*|.*improve.*|.*customize.*|.*modify.*)$/gm, '');
  code = code.replace(/\/\*[\s\S]*?\*\//g, '');
  code = code.replace(/\/\/.*$/gm, '');
  code = code.replace(/^\s*[\r\n]/gm, '');
  code = code.trim();
  
  if (code.length < 20) throw new Error("Generated code too short");
  
  return code;
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
  cleaned = cleaned.replace(/^(HTML:|CSS:|JavaScript:|JS:|Code:|Output:|Result:).*$/gm, '');
  cleaned = cleaned.replace(/^(Now you have|This is|You can|Here's|I've created|The above|This creates).*$/gm, '');
  cleaned = cleaned.replace(/^(Feel free|You can customize|To use|Simply|Just).*$/gm, '');
  cleaned = cleaned.replace(/^.*\b(implement|add|customize|modify|improve|enhance)\b.*$/gm, '');
  
  // Remove all comments (both /* */ and //)
  cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');
  cleaned = cleaned.replace(/\/\/.*$/gm, '');
  
  // Remove empty lines and clean up
  cleaned = cleaned.replace(/^\s*[\r\n]/gm, '');
  cleaned = cleaned.replace(/\n\s*\n/g, '\n');
  
  return cleaned.trim();
}

function renderHTML(raw, container) {
  let code = cleanCodeFromMarkdown(raw);
  let html = code;
  let style = "";
  let script = "";

  // Extract styles
  const styleMatch = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  if (styleMatch) {
    style = styleMatch[1];
    html = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  }

  // Extract scripts
  const scriptMatch = html.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
  if (scriptMatch) {
    script = scriptMatch[1];
    html = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  }

  // If no proper HTML structure, try to build one
  if (!html.includes('<div') && !html.includes('<button') && !html.includes('<input')) {
    // Try to extract content from mixed format
    const lines = code.split('\n');
    let htmlContent = '';
    let cssContent = '';
    let jsContent = '';
    let currentSection = '';
    
    for (let line of lines) {
      line = line.trim();
      if (line.includes('Calculator') && !line.includes('//')) {
        htmlContent += `<h2>${line}</h2>\n`;
      } else if (line.match(/^[C0-9+\-x\/=.\s]+$/)) {
        // Button layout line
        const buttons = line.split(/\s+/).filter(b => b);
        htmlContent += '<div class="calculator-grid">\n';
        buttons.forEach(btn => {
          htmlContent += `<button onclick="handleButton('${btn}')">${btn}</button>\n`;
        });
        htmlContent += '</div>\n';
      } else if (line.includes('#') || line.includes('{') || line.includes('}') || line.includes(':')) {
        cssContent += line + '\n';
      } else if (line.includes('function') || line.includes('const') || line.includes('let') || line.includes('addEventListener')) {
        jsContent += line + '\n';
      }
    }
    
    if (htmlContent) {
      html = `<div id="mainAPP">\n<div id="result">0</div>\n${htmlContent}\n</div>`;
      style = cssContent || `
        #mainAPP { padding: 20px; text-align: center; }
        .calculator-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; max-width: 300px; margin: 20px auto; }
        button { padding: 20px; font-size: 18px; border: none; background: #f0f0f0; cursor: pointer; border-radius: 5px; }
        button:hover { background: #e0e0e0; }
        #result { font-size: 24px; padding: 20px; background: #333; color: white; margin-bottom: 20px; border-radius: 5px; }
      `;
      script = jsContent || `
        let display = '0';
        let operator = '';
        let previousValue = '';
        
        function handleButton(value) {
          const resultEl = document.getElementById('result');
          
          if (value === 'C') {
            display = '0';
            operator = '';
            previousValue = '';
          } else if (['+', '-', 'x', '/'].includes(value)) {
            if (previousValue && operator && display !== '0') {
              calculate();
            }
            operator = value;
            previousValue = display;
            display = '0';
          } else if (value === '=') {
            calculate();
            operator = '';
            previousValue = '';
          } else if (value === '.') {
            if (!display.includes('.')) {
              display += '.';
            }
          } else {
            display = display === '0' ? value : display + value;
          }
          
          resultEl.textContent = display;
        }
        
        function calculate() {
          const prev = parseFloat(previousValue);
          const curr = parseFloat(display);
          
          switch(operator) {
            case '+': display = (prev + curr).toString(); break;
            case '-': display = (prev - curr).toString(); break;
            case 'x': display = (prev * curr).toString(); break;
            case '/': display = curr !== 0 ? (prev / curr).toString() : 'Error'; break;
          }
        }
      `;
    }
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
  const elements = content.querySelectorAll('*');
  
  elements.forEach(el => {
    if (!el.style.maxWidth) el.style.maxWidth = '100%';
    if (!el.style.boxSizing) el.style.boxSizing = 'border-box';
    
    switch(el.tagName) {
      case 'TABLE':
        el.style.width = '100%';
        el.style.tableLayout = 'fixed';
        break;
      case 'INPUT':
      case 'TEXTAREA':
        if (!el.style.width) el.style.width = '100%';
        el.style.maxWidth = '100%';
        break;
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

// Expose functions to global scope for HTML onclick handlers
window.initializeExperience = initializeExperience;
window.generateInterface = generateInterface;
window.getModelMaxTokens = getModelMaxTokens;
