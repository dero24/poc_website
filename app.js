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
  let html = raw;
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

function oldRenderLogic(raw, container) {
  // Keep old complex logic for reference but don't use
  let code = raw;
  let html = code;
  let style = "";
  let script = "";

  if ((!html.includes('<div') && !html.includes('<button') && !html.includes('<input'))) {
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
    
    if (containsNodeOnly) {
      // Fallback: premium AI chat UI using window.morphicGroqChat
      html = `
        <div id="mainAPP">
          <div class="chat-wrap">
            <div class="chat-header">🤖 AI Assistant</div>
            <div id="chatMessages" class="chat-messages"></div>
            <div class="chat-input">
              <input id="chatText" type="text" placeholder="Type your message..." />
              <button id="chatSend">Send</button>
            </div>
          </div>
        </div>
      `;
      style = `
        #mainAPP { padding: 18px; }
        .chat-wrap { max-width: 680px; margin: 0 auto; background: #fff; border-radius: 12px; box-shadow: 0 8px 24px #00000014; overflow: hidden; }
        .chat-header { background: linear-gradient(135deg,#6d5dfc,#47caff); color:#fff; padding: 14px 16px; font-weight: 800; }
        .chat-messages { height: 360px; overflow-y: auto; padding: 12px; background: #f8fafc; }
        .msg { margin: 8px 0; display: flex; gap: 10px; }
        .msg.me { justify-content: flex-end; }
        .bubble { max-width: 78%; padding: 10px 12px; border-radius: 12px; box-shadow: 0 2px 6px #0001; }
        .me .bubble { background: #e0e7ff; }
        .ai .bubble { background: #ffffff; }
        .chat-input { display: flex; gap: 8px; padding: 10px; border-top: 1px solid #eef2ff; background: #f8fafc; }
        .chat-input input { flex: 1; padding: 10px 12px; border-radius: 10px; border: 1px solid #dbe3ff; font-size: 1rem; }
        .chat-input button { padding: 10px 16px; border-radius: 10px; border: none; background: linear-gradient(135deg,#6d5dfc,#47caff); color:#fff; font-weight: 800; cursor: pointer; }
        .chat-input button:hover { filter: brightness(1.05); }
      `;
      script = `
        const elMsgs = document.getElementById('chatMessages');
        const elInput = document.getElementById('chatText');
        const elSend = document.getElementById('chatSend');
        
        function addMsg(role, text) {
          const row = document.createElement('div');
          row.className = 'msg ' + (role === 'user' ? 'me' : 'ai');
          const bubble = document.createElement('div');
          bubble.className = 'bubble';
          bubble.textContent = text;
          row.appendChild(bubble);
          elMsgs.appendChild(row);
          elMsgs.scrollTop = elMsgs.scrollHeight;
        }
        
        async function sendChat() {
          const text = elInput.value.trim();
          if (!text) return;
          addMsg('user', text);
          elInput.value = '';
          const loaderId = 'loading-' + Date.now();
          addMsg('assistant', '…');
          try {
            const reply = await window.morphicGroqChat([
              { role: 'system', content: 'Helpful, concise AI assistant.' },
              { role: 'user', content: text }
            ], { temperature: 0.6 });
            // replace last bubble content
            const last = elMsgs.querySelector('.msg.ai:last-child .bubble');
            if (last) last.textContent = reply || '(no response)';
          } catch (e) {
            const last = elMsgs.querySelector('.msg.ai:last-child .bubble');
            if (last) last.textContent = 'Error: ' + (e.message || e);
          }
        }
        
        elSend.addEventListener('click', sendChat);
        elInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendChat(); });
      `;
    } else if (htmlContent) {
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

function renderPremiumFallback(analysis, container) {
  const intent = document.getElementById('userIntent')?.value || '';
  const isCalculator = /calculator/i.test(intent);
  
  if (isCalculator) {
    const html = `
      <div id="mainAPP" style="padding:20px;">
        <div class="calc-container">
          <div class="calc-display" id="calcDisplay">0</div>
          <div class="calc-buttons">
            <button onclick="calcClear()">C</button>
            <button onclick="calcInput('/')">/</button>
            <button onclick="calcInput('*')">×</button>
            <button onclick="calcBackspace()">←</button>
            <button onclick="calcInput('7')">7</button>
            <button onclick="calcInput('8')">8</button>
            <button onclick="calcInput('9')">9</button>
            <button onclick="calcInput('-')">-</button>
            <button onclick="calcInput('4')">4</button>
            <button onclick="calcInput('5')">5</button>
            <button onclick="calcInput('6')">6</button>
            <button onclick="calcInput('+')">+</button>
            <button onclick="calcInput('1')">1</button>
            <button onclick="calcInput('2')">2</button>
            <button onclick="calcInput('3')">3</button>
            <button onclick="calcEquals()" class="equals">=</button>
            <button onclick="calcInput('0')" style="grid-column: span 2;">0</button>
            <button onclick="calcInput('.')">.</button>
          </div>
        </div>
      </div>
    `;
    const style = `
      .calc-container { max-width: 400px; margin: 0 auto; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 24px; border-radius: 20px; box-shadow: 0 20px 60px rgba(102, 126, 234, 0.4); }
      .calc-display { background: rgba(255,255,255,0.95); color: #333; font-size: 2.5rem; padding: 24px; border-radius: 12px; text-align: right; margin-bottom: 20px; font-weight: 600; min-height: 70px; word-wrap: break-word; }
      .calc-buttons { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
      .calc-buttons button { padding: 24px; font-size: 1.3rem; border: none; border-radius: 12px; background: rgba(255,255,255,0.9); color: #333; cursor: pointer; transition: all 0.2s; font-weight: 600; }
      .calc-buttons button:hover { background: #fff; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
      .calc-buttons button:active { transform: translateY(0); }
      .calc-buttons button.equals { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; grid-row: span 2; }
      .calc-buttons button.equals:hover { background: linear-gradient(135deg, #f5576c 0%, #f093fb 100%); }
    `;
    const script = `
      let calcValue = '0';
      let calcOperator = '';
      let calcPrevious = '';
      
      function calcInput(val) {
        if (calcValue === '0' && val !== '.') {
          calcValue = val;
        } else if (['+', '-', '*', '/'].includes(val)) {
          if (calcPrevious && calcOperator) {
            calcEquals();
          }
          calcOperator = val;
          calcPrevious = calcValue;
          calcValue = '0';
        } else {
          calcValue += val;
        }
        document.getElementById('calcDisplay').textContent = calcValue;
      }
      
      function calcEquals() {
        if (!calcPrevious || !calcOperator) return;
        const prev = parseFloat(calcPrevious);
        const curr = parseFloat(calcValue);
        let result = 0;
        switch(calcOperator) {
          case '+': result = prev + curr; break;
          case '-': result = prev - curr; break;
          case '*': result = prev * curr; break;
          case '/': result = curr !== 0 ? prev / curr : 'Error'; break;
        }
        calcValue = result.toString();
        calcOperator = '';
        calcPrevious = '';
        document.getElementById('calcDisplay').textContent = calcValue;
      }
      
      function calcClear() {
        calcValue = '0';
        calcOperator = '';
        calcPrevious = '';
        document.getElementById('calcDisplay').textContent = calcValue;
      }
      
      function calcBackspace() {
        calcValue = calcValue.length > 1 ? calcValue.slice(0, -1) : '0';
        document.getElementById('calcDisplay').textContent = calcValue;
      }
    `;
    container.innerHTML = html;
    const styleEl = document.createElement('style');
    styleEl.textContent = style;
    container.appendChild(styleEl);
    const scriptEl = document.createElement('script');
    scriptEl.textContent = script;
    container.appendChild(scriptEl);
    return;
  }
  
  if (analysis && analysis.needsAI) {
    const html = `
      <div id="mainAPP">
        <div class="chat-wrap">
          <div class="chat-header">🤖 AI Assistant</div>
          <div id="chatMessages" class="chat-messages"></div>
          <div class="chat-input">
            <input id="chatText" type="text" placeholder="Type your message..." />
            <button id="chatSend">Send</button>
          </div>
        </div>
      </div>
    `;
    const style = `
      #mainAPP { padding: 18px; }
      .chat-wrap { max-width: 680px; margin: 0 auto; background: #fff; border-radius: 12px; box-shadow: 0 8px 24px #00000014; overflow: hidden; }
      .chat-header { background: linear-gradient(135deg,#6d5dfc,#47caff); color:#fff; padding: 14px 16px; font-weight: 800; }
      .chat-messages { height: 360px; overflow-y: auto; padding: 12px; background: #f8fafc; }
      .msg { margin: 8px 0; display: flex; gap: 10px; }
      .msg.me { justify-content: flex-end; }
      .bubble { max-width: 78%; padding: 10px 12px; border-radius: 12px; box-shadow: 0 2px 6px #0001; }
      .me .bubble { background: #e0e7ff; }
      .ai .bubble { background: #ffffff; }
      .chat-input { display: flex; gap: 8px; padding: 10px; border-top: 1px solid #eef2ff; background: #f8fafc; }
      .chat-input input { flex: 1; padding: 10px 12px; border-radius: 10px; border: 1px solid #dbe3ff; font-size: 1rem; }
      .chat-input button { padding: 10px 16px; border-radius: 10px; border: none; background: linear-gradient(135deg,#6d5dfc,#47caff); color:#fff; font-weight: 800; cursor: pointer; }
      .chat-input button:hover { filter: brightness(1.05); }
    `;
    const script = `
      const elMsgs = document.getElementById('chatMessages');
      const elInput = document.getElementById('chatText');
      const elSend = document.getElementById('chatSend');
      
      function addMsg(role, text) {
        const row = document.createElement('div');
        row.className = 'msg ' + (role === 'user' ? 'me' : 'ai');
        const bubble = document.createElement('div');
        bubble.className = 'bubble';
        bubble.textContent = text;
        row.appendChild(bubble);
        elMsgs.appendChild(row);
        elMsgs.scrollTop = elMsgs.scrollHeight;
      }
      
      async function sendChat() {
        const text = elInput.value.trim();
        if (!text) return;
        addMsg('user', text);
        elInput.value = '';
        addMsg('assistant', '…');
        try {
          const reply = await window.morphicGroqChat([
            { role: 'system', content: 'Helpful, concise AI assistant.' },
            { role: 'user', content: text }
          ], { temperature: 0.6 });
          const last = elMsgs.querySelector('.msg.ai:last-child .bubble');
          if (last) last.textContent = reply || '(no response)';
        } catch (e) {
          const last = elMsgs.querySelector('.msg.ai:last-child .bubble');
          if (last) last.textContent = 'Error: ' + (e.message || e);
        }
      }
      
      elSend.addEventListener('click', sendChat);
      elInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendChat(); });
    `;
    container.innerHTML = html;
    const styleEl = document.createElement('style');
    styleEl.textContent = style;
    container.appendChild(styleEl);
    const scriptEl = document.createElement('script');
    scriptEl.textContent = script;
    container.appendChild(scriptEl);
    return;
  }
  
  const html = `
    <div id="mainAPP" style="padding:20px;">
      <h2>Instant App</h2>
      <p>A premium interactive experience is ready.</p>
      <div class="card">
        <input id="txt" placeholder="Type here" />
        <button id="btn">Go</button>
        <div id="out" class="out"></div>
      </div>
    </div>
  `;
  const style = `
    .card { background:#fff; border:1px solid #e6eaff; border-radius:12px; padding:12px; box-shadow:0 8px 24px #0000000d; }
    #txt { padding:10px 12px; border:1px solid #d8defe; border-radius:10px; width:100%; max-width:420px; }
    #btn { margin-top:8px; padding:10px 14px; border:none; border-radius:10px; background:linear-gradient(135deg,#6d5dfc,#47caff); color:#fff; font-weight:800; cursor:pointer; }
    #btn:hover { filter:brightness(1.05); }
    .out { margin-top:10px; min-height:20px; }
  `;
  const script = `
    const t = document.getElementById('txt');
    const b = document.getElementById('btn');
    const o = document.getElementById('out');
    b.addEventListener('click', () => { o.textContent = 'You typed: ' + (t.value || '(empty)'); });
  `;
  container.innerHTML = html;
  const styleEl = document.createElement('style');
  styleEl.textContent = style;
  container.appendChild(styleEl);
  const scriptEl = document.createElement('script');
  scriptEl.textContent = script;
  container.appendChild(scriptEl);
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
