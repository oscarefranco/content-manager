// ══════════════════════════════════════════════════════════════════════════
// DOC REFERENCE PANEL — Live documentation reference for content editing
// ══════════════════════════════════════════════════════════════════════════

let docRefState = {
  isOpen: false,
  currentTopics: [],
  pinnedTopics: []
};

// Toggle the doc reference panel
function toggleDocRefPanel() {
  docRefState.isOpen = !docRefState.isOpen;
  const panel = document.getElementById('doc-ref-panel');
  if (panel) {
    panel.style.display = docRefState.isOpen ? 'flex' : 'none';
  }
  const btn = document.getElementById('doc-ref-toggle-btn');
  if (btn) {
    btn.classList.toggle('active', docRefState.isOpen);
  }
  if (docRefState.isOpen) {
    refreshDocRefPanel();
  }
}

// Refresh the panel content based on current editor context
function refreshDocRefPanel() {
  const container = document.getElementById('doc-ref-content');
  if (!container) return;

  // Get the current context from the editor
  const context = getEditorDocContext();

  if (!context || context.topics.length === 0) {
    container.innerHTML = `
      <div class="doc-ref-empty">
        <p>📖 No related documentation found</p>
        <p class="text-sm">Select a suggestion or generate content to see related docs</p>
      </div>`;
    return;
  }

  docRefState.currentTopics = context.topics;

  let html = '';

  // Section: Directly related docs
  if (context.directMatches.length > 0) {
    html += `<div class="doc-ref-section">
      <h4 class="doc-ref-section-title">📎 Direct Matches</h4>
      ${context.directMatches.map(t => renderDocRefTopic(t, 'direct')).join('')}
    </div>`;
  }

  // Section: Related by category
  if (context.relatedTopics.length > 0) {
    html += `<div class="doc-ref-section">
      <h4 class="doc-ref-section-title">🔗 Related Topics</h4>
      ${context.relatedTopics.slice(0, 15).map(t => renderDocRefTopic(t, 'related')).join('')}
    </div>`;
  }

  // Section: Pinned
  if (docRefState.pinnedTopics.length > 0) {
    html += `<div class="doc-ref-section">
      <h4 class="doc-ref-section-title">📌 Pinned</h4>
      ${docRefState.pinnedTopics.map(t => renderDocRefTopic(t, 'pinned')).join('')}
    </div>`;
  }

  container.innerHTML = html;
}

// Get documentation context based on current editor state
function getEditorDocContext() {
  if (!state.flatDocTopics || state.flatDocTopics.length === 0) {
    return { topics: [], directMatches: [], relatedTopics: [] };
  }

  let searchTerms = [];
  let parentPath = '';

  // Check if we have a selected suggestion in the editor
  const activeSuggestions = editorState?.suggestions || [];
  const selectedIdx = editorState?.selectedIdx;

  if (selectedIdx >= 0 && activeSuggestions[selectedIdx]) {
    const suggestion = activeSuggestions[selectedIdx];
    // Get terms from the suggestion's gap topic
    if (suggestion.gap?.docTopic?.title) {
      searchTerms.push(...extractKeywords(suggestion.gap.docTopic.title));
    }
    if (suggestion.gap?.docTopic?.breadcrumb) {
      parentPath = suggestion.gap.docTopic.breadcrumb.split(' > ').slice(0, -1).join(' > ');
      searchTerms.push(...extractKeywords(suggestion.gap.docTopic.breadcrumb));
    }
    if (suggestion.targetModule?.title) {
      searchTerms.push(...extractKeywords(suggestion.targetModule.title));
    }
  } else if (editorState?.currentModule) {
    // Use the current module title
    searchTerms = extractKeywords(editorState.currentModule.title || '');
  }

  if (searchTerms.length === 0) {
    return { topics: [], directMatches: [], relatedTopics: [] };
  }

  const searchSet = new Set(searchTerms);
  const scored = state.flatDocTopics.map(topic => {
    const topicTerms = extractKeywords(topic.breadcrumb || topic.title || topic.name || '');
    const overlap = keywordOverlap(searchSet, new Set(topicTerms));
    const pathBonus = parentPath && (topic.breadcrumb || '').includes(parentPath) ? 0.2 : 0;
    return { ...topic, score: overlap + pathBonus };
  }).filter(t => t.score > 0.05).sort((a, b) => b.score - a.score);

  // Direct matches are high-score hits
  const directMatches = scored.filter(t => t.score >= 0.3).slice(0, 8);
  // Related are lower-score hits
  const relatedTopics = scored.filter(t => t.score < 0.3 && t.score >= 0.1).slice(0, 15);

  return {
    topics: scored.slice(0, 20),
    directMatches,
    relatedTopics
  };
}

// Render a single doc topic in the reference panel
function renderDocRefTopic(topic, type) {
  const breadcrumb = topic.breadcrumb || topic.title || topic.name || 'Untitled';
  const parts = breadcrumb.split(' > ');
  const title = parts[parts.length - 1];
  const path = parts.slice(0, -1).join(' > ');
  const score = topic.score ? Math.round(topic.score * 100) : 0;
  const isPinned = docRefState.pinnedTopics.some(p => p.breadcrumb === topic.breadcrumb);

  const url = topic.href ? `https://learn.microsoft.com${topic.href}` : '';
  const linkAttr = url ? `href="${url}" target="_blank"` : 'href="#"';

  return `<div class="doc-ref-item ${type}">
    <div class="doc-ref-item-content">
      <a class="doc-ref-item-title" ${linkAttr}>${escHtml(title)}</a>
      ${path ? `<div class="doc-ref-item-path">${escHtml(path)}</div>` : ''}
    </div>
    <div class="doc-ref-item-actions">
      <span class="doc-ref-score">${score}%</span>
      <button class="doc-ref-pin-btn ${isPinned ? 'pinned' : ''}" onclick="togglePinDocRef('${escHtml(breadcrumb).replace(/'/g, "\\'")}')" title="${isPinned ? 'Unpin' : 'Pin'}">📌</button>
    </div>
  </div>`;
}

// Pin/unpin a doc topic
function togglePinDocRef(breadcrumb) {
  const idx = docRefState.pinnedTopics.findIndex(p => p.breadcrumb === breadcrumb);
  if (idx >= 0) {
    docRefState.pinnedTopics.splice(idx, 1);
  } else {
    const topic = docRefState.currentTopics.find(t => (t.breadcrumb || t.title) === breadcrumb);
    if (topic) docRefState.pinnedTopics.push(topic);
  }
  refreshDocRefPanel();
}

// Search within the doc reference panel
function searchDocRef(query) {
  if (!query || !state.flatDocTopics) {
    refreshDocRefPanel();
    return;
  }

  const container = document.getElementById('doc-ref-content');
  if (!container) return;

  const terms = new Set(extractKeywords(query));
  const results = state.flatDocTopics
    .map(topic => {
      const topicTerms = extractKeywords(topic.breadcrumb || topic.title || topic.name || '');
      return { ...topic, score: keywordOverlap(terms, new Set(topicTerms)) };
    })
    .filter(t => t.score > 0.05)
    .sort((a, b) => b.score - a.score)
    .slice(0, 25);

  if (results.length === 0) {
    container.innerHTML = `<div class="doc-ref-empty"><p>No results for "${escHtml(query)}"</p></div>`;
    return;
  }

  docRefState.currentTopics = results;
  container.innerHTML = `
    <div class="doc-ref-section">
      <h4 class="doc-ref-section-title">🔎 Search Results (${results.length})</h4>
      ${results.map(t => renderDocRefTopic(t, 'search')).join('')}
    </div>`;
}
