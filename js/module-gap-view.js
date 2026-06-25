// ══════════════════════════════════════════════════════════════════════════
// MODULE-CENTRIC GAP VIEW
// ══════════════════════════════════════════════════════════════════════════

let moduleGapData = [];
let moduleGapFilter = { status: 'all', search: '' };

function toggleGapPerspective(mode) {
  const isModule = mode === 'module';

  document.getElementById('persp-doc-btn').classList.toggle('active', !isModule);
  document.getElementById('persp-module-btn').classList.toggle('active', isModule);

  // Show/hide doc-centric elements
  const docEls = ['gap-summary', 'gap-visuals', 'gap-results'];
  docEls.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (isModule) {
      el.style.display = 'none';
    } else {
      if (id === 'gap-summary') el.style.display = state.gapResults ? 'block' : 'none';
      else if (id === 'gap-visuals') el.style.display = state.gapResults ? 'block' : 'none';
      else el.style.display = '';
    }
  });

  document.getElementById('gap-module-view').style.display = isModule ? '' : 'none';

  if (isModule && moduleGapData.length === 0 && state.gapResults) {
    buildModuleGapMap();
  }
}

function buildModuleGapMap() {
  if (!state.gapResults || state.modules.length === 0) return;

  const gapResults = state.gapResults.results;

  moduleGapData = state.modules.map(mod => {
    const modKeywords = extractKeywords(mod.title + ' ' + (mod.summary || ''));

    // Find doc topics where this module is the bestMatch
    const directMatches = gapResults.filter(r => r.bestMatch && r.bestMatch.title === mod.title);

    // Find ALL related doc topics by keyword relevance to this module
    const relatedTopics = gapResults
      .map(r => {
        const docKeywords = extractKeywords(r.docTopic.title + ' ' + (r.docTopic.path || ''));
        const relevance = keywordOverlap(modKeywords, docKeywords);
        return { ...r, moduleRelevance: relevance };
      })
      .filter(r => r.moduleRelevance > 0.15)
      .sort((a, b) => b.moduleRelevance - a.moduleRelevance);

    const strongTopics = relatedTopics.filter(r => r.moduleRelevance >= 0.4);
    const moderateTopics = relatedTopics.filter(r => r.moduleRelevance >= 0.2 && r.moduleRelevance < 0.4);
    const weakTopics = relatedTopics.filter(r => r.moduleRelevance < 0.2);

    // Module's gap score: average relevance of related topics weighted by coverage
    const score = relatedTopics.length > 0
      ? Math.round(relatedTopics.reduce((s, r) => {
          const covBonus = r.coverage === 'covered' ? 1 : r.coverage === 'partial' ? 0.5 : 0.1;
          return s + r.moduleRelevance * covBonus;
        }, 0) / relatedTopics.length * 100)
      : 0;

    const hasGaps = relatedTopics.some(r => r.coverage === 'uncovered' && r.moduleRelevance >= 0.2);

    return {
      module: mod,
      directMatches,
      relatedTopics,
      strongTopics,
      moderateTopics,
      weakTopics,
      gapScore: Math.min(score, 100),
      hasGaps,
    };
  });

  // Sort: modules with gaps first, then by gap score ascending
  moduleGapData.sort((a, b) => {
    if (a.hasGaps !== b.hasGaps) return a.hasGaps ? -1 : 1;
    return a.gapScore - b.gapScore;
  });

  renderModuleGapList();
}

function renderModuleGapList() {
  const list = document.getElementById('mgap-list');
  let filtered = moduleGapData;

  if (moduleGapFilter.search) {
    const q = moduleGapFilter.search.toLowerCase();
    filtered = filtered.filter(d =>
      d.module.title.toLowerCase().includes(q) ||
      (d.module.summary || '').toLowerCase().includes(q) ||
      (d.module.author || '').toLowerCase().includes(q)
    );
  }

  if (moduleGapFilter.status === 'has-gaps') {
    filtered = filtered.filter(d => d.hasGaps);
  } else if (moduleGapFilter.status === 'good') {
    filtered = filtered.filter(d => !d.hasGaps);
  }

  document.getElementById('mgap-count').textContent = `${filtered.length} of ${moduleGapData.length}`;

  if (filtered.length === 0) {
    list.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:24px;font-size:12px;">No modules match this filter</div>';
    return;
  }

  list.innerHTML = filtered.map(d => {
    const idx = moduleGapData.indexOf(d);
    const color = d.hasGaps ? 'var(--danger)' : d.gapScore >= 40 ? 'var(--success)' : 'var(--warning)';
    const dotClass = d.hasGaps ? 'uncovered' : d.gapScore >= 40 ? 'covered' : 'partial';
    const age = d.module.msDate
      ? `${Math.floor((Date.now() - new Date(d.module.msDate).getTime()) / (30 * 24 * 60 * 60 * 1000))}mo`
      : '?';

    return `<div class="mgap-module-item" data-midx="${idx}" onclick="selectModuleGap(${idx})">
      <div class="dot ${dotClass}"></div>
      <div class="item-title">
        <h5 title="${escHtml(d.module.title)}">${escHtml(d.module.title)}</h5>
        <p>${d.relatedTopics.length} related topics · ${d.module.unitCount} units · ${age}</p>
      </div>
      <div class="item-score" style="color:${color};">${d.gapScore}%</div>
    </div>`;
  }).join('');
}

function selectModuleGap(idx) {
  const d = moduleGapData[idx];
  if (!d) return;

  // Highlight selection
  document.querySelectorAll('#mgap-list .mgap-module-item').forEach(el => el.classList.remove('selected'));
  const item = document.querySelector(`#mgap-list .mgap-module-item[data-midx="${idx}"]`);
  if (item) { item.classList.add('selected'); item.scrollIntoView({ block: 'nearest' }); }

  const body = document.getElementById('mgap-detail-body');
  document.getElementById('mgap-detail-title').textContent = d.module.title;

  const mod = d.module;
  const age = mod.msDate ? Math.floor((Date.now() - new Date(mod.msDate).getTime()) / (30 * 24 * 60 * 60 * 1000)) : null;
  const ageTag = age !== null ? (age <= 3 ? 'tag-green' : age <= 12 ? 'tag-yellow' : 'tag-red') : 'tag-blue';
  const ageLabel = age !== null ? (age <= 3 ? 'Current' : `${age}mo old`) : 'No date';
  const gapColor = d.hasGaps ? 'var(--danger)' : d.gapScore >= 40 ? 'var(--success)' : 'var(--warning)';

  function renderTopicRows(topics, showBg) {
    return topics.map(r => {
      const icon = r.coverage === 'covered' ? '✅' : r.coverage === 'partial' ? '⚠️' : '❌';
      const rel = Math.round(r.moduleRelevance * 100);
      const canFix = r.coverage === 'uncovered' || r.coverage === 'partial';
      const fixBtn = canFix
        ? `<button class="mgap-edit-btn" onclick="event.stopPropagation(); navigateToEditorForGap('${escHtml(r.docTopic.title.replace(/'/g, "\\\'"))}', '${r.coverage}');" title="Open in Content Editor">✏️ Fix</button>`
        : '';
      return `<div class="mgap-topic-row ${showBg ? 'strong' : ''}">
        <span>${icon}</span>
        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escHtml(r.docTopic.path)}">${escHtml(r.docTopic.title)}</span>
        ${fixBtn}
        <span style="font-size:10px;font-family:'JetBrains Mono',monospace;color:var(--text-muted);flex-shrink:0;">${rel}%</span>
      </div>`;
    }).join('');
  }

  const uncoveredGaps = d.relatedTopics.filter(r => r.coverage === 'uncovered' && r.moduleRelevance >= 0.2);

  body.innerHTML = `
    <div style="margin-bottom:14px;">
      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
        <span class="tag ${ageTag}">${ageLabel}</span>
        <span class="tag tag-blue">${mod.unitCount} units</span>
        ${mod.author ? `<span class="tag tag-purple">👤 ${escHtml(mod.author)}</span>` : ''}
        ${mod.msService ? `<span class="tag tag-blue">${escHtml(mod.msService)}</span>` : ''}
      </div>
      ${mod.summary ? `<p style="font-size:12px;color:var(--text-muted);margin-top:8px;line-height:1.5;">${escHtml(mod.summary)}</p>` : ''}
      <div style="display:flex;gap:8px;margin-top:8px;">
        ${mod.learnUrl ? `<a href="${mod.learnUrl}" target="_blank" class="btn btn-secondary btn-sm">Learn ↗</a>` : ''}
        ${mod.ghUrl ? `<a href="${mod.ghUrl}" target="_blank" class="btn btn-ghost btn-sm">GitHub ↗</a>` : ''}
        ${d.hasGaps ? `<button class="btn btn-primary btn-sm" onclick="navigateToEditorForModule(${idx})" style="margin-left:auto;">✏️ Fix Gaps in Editor</button>` : ''}
      </div>
    </div>

    <div style="margin-bottom:14px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
        <strong style="font-size:13px;">Documentation Coverage</strong>
        <span style="font-weight:600;color:${gapColor};font-family:'JetBrains Mono',monospace;">${d.gapScore}%</span>
      </div>
      <div class="score-bar" style="margin-bottom:4px;">
        <div class="score-fill" style="width:${d.gapScore}%;background:${gapColor};"></div>
      </div>
      <div style="font-size:11px;color:var(--text-muted);">
        ${d.relatedTopics.length} related doc topics · ${d.strongTopics.length} strong · ${d.moderateTopics.length} moderate · ${d.weakTopics.length} weak
      </div>
    </div>

    ${d.strongTopics.length > 0 ? `
    <div class="mgap-detail-section">
      <h4><span style="color:var(--success);">●</span> Strong Matches (${d.strongTopics.length})</h4>
      <div style="display:flex;flex-direction:column;gap:2px;">
        ${renderTopicRows(d.strongTopics, true)}
      </div>
    </div>` : ''}

    ${d.moderateTopics.length > 0 ? `
    <div class="mgap-detail-section">
      <h4><span style="color:var(--warning);">●</span> Moderate Matches (${d.moderateTopics.length})</h4>
      <div style="display:flex;flex-direction:column;gap:2px;">
        ${renderTopicRows(d.moderateTopics.slice(0, 20), false)}
        ${d.moderateTopics.length > 20 ? `<div style="font-size:11px;color:var(--text-muted);padding:4px 8px;">+ ${d.moderateTopics.length - 20} more</div>` : ''}
      </div>
    </div>` : ''}

    ${d.weakTopics.length > 0 ? `
    <div class="mgap-detail-section">
      <details>
        <summary style="font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px;">
          <span style="color:var(--text-light);">●</span> Weak Matches (${d.weakTopics.length})
        </summary>
        <div style="display:flex;flex-direction:column;gap:2px;margin-top:4px;">
          ${renderTopicRows(d.weakTopics.slice(0, 15), false)}
          ${d.weakTopics.length > 15 ? `<div style="font-size:10px;color:var(--text-light);padding:2px 8px;">+ ${d.weakTopics.length - 15} more</div>` : ''}
        </div>
      </details>
    </div>` : ''}

    ${d.relatedTopics.length === 0 ? `
    <div class="mgap-gap-box no-gaps">
      <p style="font-size:12px;color:var(--text-muted);">No related documentation topics found. This module may cover a niche area not reflected in the doc TOC.</p>
    </div>` : ''}

    ${uncoveredGaps.length > 0 ? `
    <div class="mgap-gap-box has-gaps">
      <h4 style="color:var(--danger);">🚨 Content Gaps (${uncoveredGaps.length})</h4>
      <p style="font-size:11px;color:var(--text-muted);margin-bottom:6px;">These documentation topics are relevant to this module but have no training coverage:</p>
      <ul>
        ${uncoveredGaps.slice(0, 10).map(r =>
          `<li>
            <span><strong>${escHtml(r.docTopic.title)}</strong> <span style="font-size:10px;color:var(--text-muted);">(${Math.round(r.moduleRelevance * 100)}% relevance)</span></span>
            <button class="mgap-edit-btn" style="opacity:1;" onclick="event.stopPropagation(); navigateToEditorForGap('${escHtml(r.docTopic.title.replace(/'/g, "\\\\'"))}', 'uncovered');" title="Create content in Editor">✏️ Fix</button>
          </li>`
        ).join('')}
        ${uncoveredGaps.length > 10 ? `<li style="color:var(--text-muted);">+ ${uncoveredGaps.length - 10} more</li>` : ''}
      </ul>
      <button class="mgap-fix-all-btn" onclick="navigateToEditorForModule(${idx})">
        🛠️ Fix All ${uncoveredGaps.length} Gaps in Content Editor
      </button>
    </div>` : !d.hasGaps && d.relatedTopics.length > 0 ? `
    <div class="mgap-gap-box no-gaps">
      <p style="font-size:12px;color:var(--success);font-weight:500;">✅ Good coverage — no major content gaps detected for related documentation topics.</p>
    </div>` : ''}
  `;
}

function filterModuleGapList(q) {
  moduleGapFilter.search = q;
  renderModuleGapList();
}

function filterModuleGapStatus(status) {
  moduleGapFilter.status = status;
  document.querySelectorAll('#mgap-filter button').forEach(btn => {
    const text = btn.textContent.toLowerCase();
    btn.classList.toggle('active',
      status === 'all' ? text.includes('all') :
      status === 'has-gaps' ? text.includes('gaps') :
      text.includes('good')
    );
  });
  renderModuleGapList();
}

// ══════════════════════════════════════════════════════════════════════════
// GAP → EDITOR NAVIGATION
// ══════════════════════════════════════════════════════════════════════════

function navigateToEditorForGap(topicTitle, coverageType) {
  // Ensure suggestions exist
  if (editorState.suggestions.length === 0) {
    buildEditorSuggestions();
  }

  // Switch to editor view
  switchView('editor');

  const targetTab = coverageType === 'uncovered' ? 'new' : coverageType === 'partial' ? 'update' : 'outdated';
  const titleLower = topicTitle.toLowerCase();
  let bestIdx = -1;

  for (let i = 0; i < editorState.suggestions.length; i++) {
    const s = editorState.suggestions[i];
    if (s.type !== targetTab) continue;

    if (s.type === 'new') {
      // Match if any topic in the group matches
      if (s.topics && s.topics.some(t => t.title.toLowerCase() === titleLower)) {
        bestIdx = i; break;
      }
      // Also match by title/category
      if (s.title.toLowerCase().includes(titleLower) || titleLower.includes(s.category.toLowerCase())) {
        bestIdx = i;
      }
    } else if (s.type === 'update') {
      if (s.docTopic && s.docTopic.title.toLowerCase() === titleLower) {
        bestIdx = i; break;
      }
      if (s.title.toLowerCase().includes(titleLower)) {
        bestIdx = i;
      }
    }
  }

  switchEditorTab(targetTab);

  if (bestIdx >= 0) {
    selectSuggestion(bestIdx);
    setTimeout(() => {
      const card = document.querySelector('.suggestion-card.selected');
      if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);
    toast(`Found matching suggestion for "${topicTitle}"`, 'success');
  } else {
    toast(`Opened editor — browse ${targetTab} suggestions for related content`, 'info');
  }
}

function navigateToEditorForModule(moduleIdx) {
  const d = moduleGapData[moduleIdx];
  if (!d) return;

  // Ensure suggestions exist
  if (editorState.suggestions.length === 0) {
    buildEditorSuggestions();
  }

  switchView('editor');

  // Collect all suggestion indices related to this module's gaps
  const modTitle = d.module.title.toLowerCase();
  const uncoveredTitles = d.relatedTopics
    .filter(r => r.coverage === 'uncovered' && r.moduleRelevance >= 0.2)
    .map(r => r.docTopic.title.toLowerCase());
  const partialTitles = d.relatedTopics
    .filter(r => r.coverage === 'partial' && r.moduleRelevance >= 0.2)
    .map(r => r.docTopic.title.toLowerCase());

  // Find the best single suggestion to highlight
  let bestIdx = -1;
  let bestTab = 'new';

  for (let i = 0; i < editorState.suggestions.length; i++) {
    const s = editorState.suggestions[i];

    // Check if this is a "new" suggestion targeting this module
    if (s.type === 'new' && s.targetModule && s.targetModule.title.toLowerCase() === modTitle) {
      bestIdx = i; bestTab = 'new'; break;
    }

    // Check if this is a "new" suggestion with matching uncovered topics
    if (s.type === 'new' && s.topics) {
      const match = s.topics.some(t => uncoveredTitles.includes(t.title.toLowerCase()));
      if (match && bestIdx === -1) { bestIdx = i; bestTab = 'new'; }
    }

    // Check if this is an update suggestion for this module
    if (s.type === 'update' && s.module && s.module.title.toLowerCase() === modTitle) {
      if (bestIdx === -1) { bestIdx = i; bestTab = 'update'; }
    }

    // Check if this is an update suggestion with matching partial topics
    if (s.type === 'update' && s.docTopic) {
      if (partialTitles.includes(s.docTopic.title.toLowerCase()) && bestIdx === -1) {
        bestIdx = i; bestTab = 'update';
      }
    }

    // Check if this is an outdated suggestion for this module
    if (s.type === 'outdated' && s.module && s.module.title.toLowerCase() === modTitle) {
      if (bestIdx === -1) { bestIdx = i; bestTab = 'outdated'; }
    }
  }

  switchEditorTab(bestTab);

  if (bestIdx >= 0) {
    selectSuggestion(bestIdx);
    setTimeout(() => {
      const card = document.querySelector('.suggestion-card.selected');
      if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);
  }

  const gapCount = uncoveredTitles.length + partialTitles.length;
  toast(`Opened editor for "${d.module.title}" — ${gapCount} gap${gapCount !== 1 ? 's' : ''} to address`, 'info');
}

