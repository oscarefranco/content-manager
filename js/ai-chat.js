// ══════════════════════════════════════════════════════════════════════════
// AI CHAT — Conversational assistant with live data context
// ══════════════════════════════════════════════════════════════════════════

const chatState = {
  messages: [],       // {role: 'user'|'assistant', content: string, timestamp: Date}
  isStreaming: false,
  maxContextTokens: 3000
};

// Build system prompt with live data context
function buildChatSystemPrompt() {
  const product = state.selectedProduct?.name || 'No product selected';
  const moduleCount = state.modules?.length || 0;
  const docCount = state.flatDocTopics?.length || 0;
  const gapData = state.gapResults;
  const gapResults = gapData?.results || [];

  let systemPrompt = `You are an AI assistant for the Microsoft Learn Content Gap Manager. You help content authors understand and address gaps between documentation and training content.

Current context:
- Selected product: ${product}
- Training modules loaded: ${moduleCount}
- Documentation topics loaded: ${docCount}
- Gap analysis results: ${gapResults.length} items analyzed

`;

  // Add module summary (top-level info, truncated for token budget)
  if (moduleCount > 0) {
    const moduleSummary = state.modules.slice(0, 50).map(m => {
      const date = m.msDate || m.lastModified || 'unknown';
      return `- "${m.title}" (${m.units?.length || 0} units, date: ${date})`;
    }).join('\n');
    systemPrompt += `\nTraining modules (first ${Math.min(50, moduleCount)} of ${moduleCount}):\n${moduleSummary}\n`;
  }

  // Add gap summary if available
  if (gapResults.length > 0) {
    const uncovered = gapResults.filter(g => g.status === 'uncovered' || g.score < 0.3);
    const partial = gapResults.filter(g => g.status === 'partial' || (g.score >= 0.3 && g.score < 0.7));
    const covered = gapResults.filter(g => g.status === 'covered' || g.score >= 0.7);

    systemPrompt += `\nGap Analysis Summary:
- Fully covered topics: ${covered.length}
- Partially covered topics: ${partial.length}
- Uncovered topics (gaps): ${uncovered.length}
`;

    // List top uncovered gaps
    if (uncovered.length > 0) {
      const topGaps = uncovered.slice(0, 20).map(g => `- "${g.docTopic || g.title}" (score: ${(g.score || 0).toFixed(2)})`).join('\n');
      systemPrompt += `\nTop uncovered gaps:\n${topGaps}\n`;
    }
  }

  // Add doc topics summary
  if (docCount > 0) {
    const docSample = state.flatDocTopics.slice(0, 30).map(d => `- ${d.breadcrumb || d.title || d.name}`).join('\n');
    systemPrompt += `\nDocumentation topics (first ${Math.min(30, docCount)} of ${docCount}):\n${docSample}\n`;
  }

  systemPrompt += `\nInstructions:
- Be concise and actionable in your responses
- Reference specific module titles and doc topics when relevant
- When asked about gaps, cite the specific uncovered topics
- Suggest concrete next steps for content authors
- Format responses with markdown (bold, lists, code blocks as needed)
- If data isn't loaded yet, let the user know they should select a product and load data first`;

  return systemPrompt;
}

// Send a message from suggestion chips
function sendChatSuggestion(el) {
  const text = el.textContent.trim();
  document.getElementById('chat-input').value = text;
  sendChatMessage();
}

// Handle Enter key in chat input
function handleChatKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendChatMessage();
  }
}

// Auto-resize textarea
function autoResizeChatInput(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

// Send a chat message
async function sendChatMessage() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text || chatState.isStreaming) return;

  // Clear input
  input.value = '';
  input.style.height = 'auto';

  // Remove welcome screen on first message
  const welcome = document.querySelector('.chat-welcome');
  if (welcome) welcome.remove();

  // Add user message
  appendChatBubble('user', text);
  chatState.messages.push({ role: 'user', content: text, timestamp: new Date() });

  // Show typing indicator
  const typingEl = showChatTyping();
  chatState.isStreaming = true;
  updateChatSendButton();

  try {
    // Build messages array for AI
    const systemMsg = { role: 'system', content: buildChatSystemPrompt() };
    const historyMsgs = chatState.messages.slice(-10).map(m => ({
      role: m.role,
      content: m.content
    }));

    const response = await callAI([systemMsg, ...historyMsgs], {
      maxTokens: 2000,
      temperature: 0.7
    });

    // Remove typing indicator
    typingEl.remove();

    // Add AI response
    const aiText = response || 'Sorry, I could not generate a response. Please check your API token in Settings.';
    appendChatBubble('assistant', aiText);
    chatState.messages.push({ role: 'assistant', content: aiText, timestamp: new Date() });

  } catch (err) {
    typingEl.remove();
    const errorMsg = `⚠️ Error: ${err.message || 'Failed to get AI response'}. Make sure your GitHub token is configured in Settings.`;
    appendChatBubble('assistant', errorMsg);
    chatState.messages.push({ role: 'assistant', content: errorMsg, timestamp: new Date() });
  }

  chatState.isStreaming = false;
  updateChatSendButton();
}

// Append a chat bubble to the messages container
function appendChatBubble(role, content) {
  const container = document.getElementById('chat-messages');
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble chat-bubble-${role === 'user' ? 'user' : 'ai'}`;

  if (role === 'user') {
    bubble.textContent = content;
  } else {
    bubble.innerHTML = formatChatMarkdown(content);
  }

  // Timestamp
  const ts = document.createElement('div');
  ts.className = 'chat-timestamp';
  ts.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  bubble.appendChild(ts);

  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
}

// Show typing indicator
function showChatTyping() {
  const container = document.getElementById('chat-messages');
  const typing = document.createElement('div');
  typing.className = 'chat-typing';
  typing.innerHTML = '<div class="chat-typing-dot"></div><div class="chat-typing-dot"></div><div class="chat-typing-dot"></div>';
  container.appendChild(typing);
  container.scrollTop = container.scrollHeight;
  return typing;
}

// Update send button state
function updateChatSendButton() {
  const btn = document.getElementById('chat-send-btn');
  if (btn) btn.disabled = chatState.isStreaming;
}

// Format basic markdown in AI responses
function formatChatMarkdown(text) {
  let html = escHtml(text);
  // Code blocks
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Bold
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // Italic
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  // Unordered lists
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
  // Line breaks
  html = html.replace(/\n/g, '<br>');
  // Clean up double breaks in lists
  html = html.replace(/<\/li><br>/g, '</li>');
  html = html.replace(/<\/ul><br>/g, '</ul>');
  html = html.replace(/<\/pre><br>/g, '</pre>');
  return html;
}

// Clear chat history
function clearChatHistory() {
  chatState.messages = [];
  const container = document.getElementById('chat-messages');
  container.innerHTML = `
    <div class="chat-welcome">
      <div class="chat-welcome-icon">🤖</div>
      <h3>Content Gap AI Assistant</h3>
      <p>I have access to your loaded modules, documentation, and gap analysis results. Ask me anything about your content!</p>
      <div class="chat-suggestions">
        <button class="chat-suggestion-chip" onclick="sendChatSuggestion(this)">What are the biggest content gaps?</button>
        <button class="chat-suggestion-chip" onclick="sendChatSuggestion(this)">Which modules need updating?</button>
        <button class="chat-suggestion-chip" onclick="sendChatSuggestion(this)">Summarize coverage for this product</button>
        <button class="chat-suggestion-chip" onclick="sendChatSuggestion(this)">Suggest priorities for new content</button>
      </div>
    </div>`;
}

// Export chat history as text
function exportChatHistory() {
  if (chatState.messages.length === 0) {
    toast('No chat messages to export', 'warning');
    return;
  }
  const product = state.selectedProduct?.name || 'Unknown Product';
  let text = `# AI Chat Export — ${product}\n`;
  text += `Generated: ${new Date().toLocaleString()}\n\n`;
  text += '---\n\n';

  chatState.messages.forEach(m => {
    const time = m.timestamp ? new Date(m.timestamp).toLocaleTimeString() : '';
    const label = m.role === 'user' ? '👤 You' : '🤖 AI';
    text += `**${label}** (${time}):\n${m.content}\n\n---\n\n`;
  });

  const blob = new Blob([text], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `chat-export-${product.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.md`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Chat exported', 'success');
}

// Update context bar counts (called when data loads)
function updateChatContextBar() {
  const modulesEl = document.getElementById('chat-ctx-modules');
  const docsEl = document.getElementById('chat-ctx-docs');
  const gapsEl = document.getElementById('chat-ctx-gaps');
  if (modulesEl) modulesEl.textContent = `${state.modules?.length || 0} modules`;
  if (docsEl) docsEl.textContent = `${state.flatDocTopics?.length || 0} docs`;
  if (gapsEl) gapsEl.textContent = `${state.gapResults?.results?.length || 0} gaps`;
}
