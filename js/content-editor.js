// ══════════════════════════════════════════════════════════════════════════
// CONTENT EDITOR — Module Builder with Gap Analysis & URL Support
// ══════════════════════════════════════════════════════════════════════════

let editorState = {
  suggestions: [],
  activeTab: 'new',
  selectedIdx: -1,
  currentModule: null, // generated module with units
  currentUnitIdx: 0,
  contentPlan: null,
  isGenerating: false,
};

async function buildEditorSuggestions() {
  if (!state.selectedProduct) { toast('Select a product first', 'warning'); return; }
  if (state.modules.length === 0) { toast('Load modules first', 'warning'); return; }

  // Auto-run gap analysis if not done
  if (!state.gapResults && state.flatDocTopics.length > 0) {
    toast('Running gap analysis first...', 'info');
    runClientGapAnalysis();
    // Wait a bit for gap analysis to complete
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  if (!state.gapResults) {
    toast('Run Gap Analysis first', 'warning');
    return;
  }

  // Show progress indicator
  const progressContainer = document.getElementById('editor-suggestions-container');
  if (progressContainer) {
    progressContainer.innerHTML = '<div style="padding:2rem;text-align:center;"><div class="spinner"></div><p style="margin-top:1rem;color:var(--text-muted);">Analyzing gaps with AI...</p></div>';
  }

  const suggestions = [];
  
  // Filter for uncovered and partial gaps (ignore covered)
  const gapsToProcess = state.gapResults.results.filter(r => 
    r.coverage === 'uncovered' || r.coverage === 'partial'
  );

  toast(`Analyzing ${gapsToProcess.length} gaps with AI...`, 'info');

  // Process each gap with AI recommendation
  let processed = 0;
  for (const gap of gapsToProcess) {
    try {
      // Call AI to determine action type
      const aiRec = await analyzeGapAction(gap, state.modules);
      
      // Create suggestion object
      const suggestion = {
        id: `gap-${gap.docTopic.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`,
        gap: gap,
        actionType: aiRec.actionType,
        targetModule: aiRec.targetModuleObject || null,
        targetUnit: aiRec.targetUnit || null,
        reasoning: aiRec.reasoning,
        confidence: aiRec.confidence,
        estimatedEffort: aiRec.estimatedEffort,
        status: 'pending',
        generatedContent: null,
        prInfo: null
      };

      suggestions.push(suggestion);
      processed++;

      // Update progress every 5 items
      if (processed % 5 === 0 && progressContainer) {
        progressContainer.innerHTML = `<div style="padding:2rem;text-align:center;"><div class="spinner"></div><p style="margin-top:1rem;color:var(--text-muted);">Analyzed ${processed}/${gapsToProcess.length} gaps...</p></div>`;
      }

    } catch (e) {
      console.error('Failed to analyze gap:', gap.docTopic.title, e);
      // Continue processing other gaps even if one fails
    }
  }

  // Store suggestions in state
  state.editorSuggestions = suggestions;

  // Group suggestions by action type for summary
  const byAction = {
    EDIT_EXISTING: suggestions.filter(s => s.actionType === ACTION_TYPES.EDIT_EXISTING).length,
    ADD_TO_UNIT: suggestions.filter(s => s.actionType === ACTION_TYPES.ADD_TO_UNIT).length,
    NEW_UNIT: suggestions.filter(s => s.actionType === ACTION_TYPES.NEW_UNIT).length,
    NEW_MODULE: suggestions.filter(s => s.actionType === ACTION_TYPES.NEW_MODULE).length
  };

  // Update UI
  renderEditorView();
  
  const summary = `Generated ${suggestions.length} suggestions: ${byAction.EDIT_EXISTING} edits, ${byAction.ADD_TO_UNIT} additions, ${byAction.NEW_UNIT} new units, ${byAction.NEW_MODULE} new modules`;
  toast(summary, 'success');
}

// Wrapper function for button click
async function refreshEditorSuggestions() {
  const btn = document.getElementById('refresh-suggestions-btn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ Analyzing...';
  }
  
  try {
    await buildEditorSuggestions();
  } catch (e) {
    console.error('Error building suggestions:', e);
    toast(`Error: ${e.message}`, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '🔄 Generate Suggestions';
    }
  }
}

function renderEditorView() {
  const s = state.editorSuggestions;
  
  console.log('renderEditorView called, suggestions:', s.length);
  
  // Find container
  const container = document.getElementById('editor-suggestions-container') || 
                    document.getElementById('editor-content');
  
  if (!container) {
    console.error('Editor container not found');
    return;
  }

  console.log('Container found:', container.id);

  if (s.length === 0) {
    container.innerHTML = `
    <div class="empty-state" style="padding:3rem;">
      <div class="empty-state-icon">✅</div>
      <p>No content suggestions yet. Run Gap Analysis first, then generate suggestions.</p>
    </div>`;
    return;
  }

  // Group suggestions by action type
  const byAction = {
    [ACTION_TYPES.EDIT_EXISTING]: s.filter(x => x.actionType === ACTION_TYPES.EDIT_EXISTING),
    [ACTION_TYPES.ADD_TO_UNIT]: s.filter(x => x.actionType === ACTION_TYPES.ADD_TO_UNIT),
    [ACTION_TYPES.NEW_UNIT]: s.filter(x => x.actionType === ACTION_TYPES.NEW_UNIT),
    [ACTION_TYPES.NEW_MODULE]: s.filter(x => x.actionType === ACTION_TYPES.NEW_MODULE),
  };

  console.log('Suggestions by action:', {
    EDIT: byAction[ACTION_TYPES.EDIT_EXISTING].length,
    ADD: byAction[ACTION_TYPES.ADD_TO_UNIT].length,
    NEW_UNIT: byAction[ACTION_TYPES.NEW_UNIT].length,
    NEW_MODULE: byAction[ACTION_TYPES.NEW_MODULE].length
  });

  // Render grouped by action type
  container.innerHTML = `
  <div style="display:flex;flex-direction:column;gap:20px;">
    ${renderActionTypeSection(ACTION_TYPES.EDIT_EXISTING, byAction[ACTION_TYPES.EDIT_EXISTING], '✏️', 'Edit Existing Units', 'Modify existing unit content to cover gaps')}
    ${renderActionTypeSection(ACTION_TYPES.ADD_TO_UNIT, byAction[ACTION_TYPES.ADD_TO_UNIT], '➕', 'Add Sections to Units', 'Append new sections to existing units')}
    ${renderActionTypeSection(ACTION_TYPES.NEW_UNIT, byAction[ACTION_TYPES.NEW_UNIT], '📄', 'Create New Units', 'Add new units to existing modules')}
    ${renderActionTypeSection(ACTION_TYPES.NEW_MODULE, byAction[ACTION_TYPES.NEW_MODULE], '🆕', 'Create New Modules', 'Build entirely new training modules')}
  </div>`;

  // Update count badge if it exists
  const countEl = document.getElementById('count-suggestions');
  if (countEl) countEl.textContent = s.length;
  
  console.log('Render complete');
}

function renderActionTypeSection(actionType, suggestions, icon, title, subtitle) {
  if (suggestions.length === 0) return '';

  const suggestionsHtml = suggestions.map((s, idx) => {
    const globalIdx = state.editorSuggestions.indexOf(s);
    const confidenceClass = s.confidence >= 0.8 ? 'tag-green' : s.confidence >= 0.5 ? 'tag-blue' : 'tag-yellow';
    const effortClass = s.estimatedEffort === 'low' ? 'tag-green' : s.estimatedEffort === 'medium' ? 'tag-yellow' : 'tag-red';
    
    let targetInfo = '';
    if (s.targetModule) {
      targetInfo = `<div style="font-size:11px;color:var(--text-muted);margin-top:4px;">📦 Module: ${escHtml(s.targetModule.title)}</div>`;
      if (s.targetUnit) {
        targetInfo += `<div style="font-size:11px;color:var(--text-muted);">📄 Unit: ${escHtml(s.targetUnit)}</div>`;
      }
    }

    const statusIcon = {
      'pending': '⏳',
      'generating': '🔄',
      'generated': '✅',
      'approved': '👍',
      'rejected': '❌',
      'committed': '🚀'
    }[s.status] || '⏳';

    return `
    <div class="suggestion-card" style="border:1px solid var(--border);border-radius:8px;padding:12px;background:var(--bg);">
      <div style="display:flex;align-items:start;gap:10px;">
        <div style="flex:1;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
            <h4 style="margin:0;font-size:13px;">${escHtml(s.gap.docTopic.title)}</h4>
            <span class="tag ${confidenceClass}" title="AI Confidence">${Math.round(s.confidence * 100)}%</span>
            <span class="tag ${effortClass}">${s.estimatedEffort}</span>
            <span style="font-size:14px;" title="Status: ${s.status}">${statusIcon}</span>
          </div>
          <p style="font-size:12px;color:var(--text-muted);margin:0 0 8px 0;line-height:1.5;">${escHtml(s.reasoning)}</p>
          ${targetInfo}
        </div>
        <div style="display:flex;gap:8px;flex-shrink:0;">
          ${s.status === 'generated' ? `
            <button class="btn btn-sm btn-secondary" onclick="previewSuggestion(${globalIdx})" title="Preview generated content">
              👁️ Preview
            </button>
          ` : ''}
          <button 
            class="btn btn-sm btn-primary" 
            onclick="generateContentForSuggestion(${globalIdx})"
            ${s.status === 'generating' ? 'disabled' : ''}
            style="flex-shrink:0;">
            ${s.status === 'pending' ? '🏗️ Generate' : s.status === 'generating' ? '⏳ ...' : '🔄 Regenerate'}
          </button>
        </div>
      </div>
    </div>`;
  }).join('');

  return `
  <div class="card" style="border:1px solid var(--border);">
    <div class="card-header" style="background:var(--bg-muted);">
      <span style="font-size:20px;">${icon}</span>
      <div style="flex:1;">
        <h3 style="margin:0;font-size:14px;">${title}</h3>
        <p style="margin:0;font-size:11px;color:var(--text-muted);">${subtitle}</p>
      </div>
      <span class="tag tag-blue">${suggestions.length}</span>
    </div>
    <div style="padding:12px;display:flex;flex-direction:column;gap:10px;">
      ${suggestionsHtml}
    </div>
  </div>`;
}

function previewSuggestion(globalIdx) {
  const suggestion = state.editorSuggestions[globalIdx];
  if (!suggestion || !suggestion.generatedContent) {
    toast('No content generated yet', 'warning');
    return;
  }
  
  const gap = suggestion.gap;
  const content = suggestion.generatedContent;
  
  let contentHtml = '';
  
  if (content.type === 'edit') {
    // Show edit preview
    contentHtml = `
      <div style="margin-bottom:16px;">
        <h4 style="margin:0 0 8px 0;font-size:14px;">📝 Edit Preview</h4>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px;">
          Target: ${escHtml(content.unitPath)}
        </div>
        ${content.preview || ''}
        <details style="margin-top:12px;">
          <summary style="cursor:pointer;font-size:12px;color:var(--primary);">View full content (${content.newContent.length} chars)</summary>
          <pre style="background:var(--bg-muted);padding:12px;border-radius:6px;overflow-x:auto;font-size:11px;margin-top:8px;">${escHtml(content.newContent)}</pre>
        </details>
      </div>`;
  } else if (content.type === 'add_section') {
    // Show add section preview
    contentHtml = `
      <div style="margin-bottom:16px;">
        <h4 style="margin:0 0 8px 0;font-size:14px;">➕ New Section Preview</h4>
        <div style="font-size:13px;font-weight:600;margin-bottom:8px;">${escHtml(content.sectionTitle)}</div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:12px;">${escHtml(content.summary)}</div>
        <div style="background:var(--bg-muted);padding:12px;border-radius:6px;max-height:400px;overflow-y:auto;">
          <pre style="margin:0;font-size:11px;white-space:pre-wrap;">${escHtml(content.content)}</pre>
        </div>
      </div>`;
  } else if (content.type === 'new_unit') {
    // Show new unit preview
    contentHtml = `
      <div style="margin-bottom:16px;">
        <h4 style="margin:0 0 8px 0;font-size:14px;">📄 New Unit Preview</h4>
        <div style="font-size:13px;font-weight:600;margin-bottom:8px;">${escHtml(content.unitTitle)}</div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px;">Filename: ${escHtml(content.filename)}.md</div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:12px;">${escHtml(content.description)}</div>
        <details open>
          <summary style="cursor:pointer;font-size:12px;font-weight:600;margin-bottom:8px;">YAML Frontmatter</summary>
          <pre style="background:var(--bg-muted);padding:12px;border-radius:6px;font-size:11px;margin-bottom:12px;">${escHtml(content.yamlFrontmatter)}</pre>
        </details>
        <details>
          <summary style="cursor:pointer;font-size:12px;font-weight:600;margin-bottom:8px;">Full Content (${content.content.length} chars)</summary>
          <div style="background:var(--bg-muted);padding:12px;border-radius:6px;max-height:400px;overflow-y:auto;margin-top:8px;">
            <pre style="margin:0;font-size:11px;white-space:pre-wrap;">${escHtml(content.content)}</pre>
          </div>
        </details>
      </div>`;
  } else {
    // Full module from editorState
    const module = editorState.generatedModule;
    if (module && module.units) {
      contentHtml = `
        <div style="margin-bottom:16px;">
          <h4 style="margin:0 0 8px 0;font-size:14px;">🆕 New Module Preview</h4>
          <div style="font-size:13px;font-weight:600;margin-bottom:8px;">${escHtml(module.title || 'Untitled Module')}</div>
          <div style="font-size:12px;color:var(--text-muted);margin-bottom:12px;">${module.units.length} units generated</div>
          ${module.units.map((unit, i) => `
            <details ${i === 0 ? 'open' : ''} style="margin-bottom:8px;">
              <summary style="cursor:pointer;font-size:12px;font-weight:600;padding:8px;background:var(--bg-muted);border-radius:4px;">
                ${escHtml(unit.title || `Unit ${i+1}`)}
              </summary>
              <div style="background:var(--bg-muted);padding:12px;border-radius:6px;max-height:300px;overflow-y:auto;margin-top:4px;">
                <pre style="margin:0;font-size:11px;white-space:pre-wrap;">${escHtml(unit.content.substring(0, 2000))}${unit.content.length > 2000 ? '\n...(truncated)' : ''}</pre>
              </div>
            </details>
          `).join('')}
        </div>`;
    } else {
      contentHtml = '<div style="padding:20px;text-align:center;color:var(--text-muted);">No preview available</div>';
    }
  }
  
  // Show preview modal
  const modalHtml = `
  <div class="modal-overlay" id="preview-modal" style="display:flex;z-index:9999;">
    <div class="modal" style="max-width:900px;max-height:90vh;">
      <div class="modal-header">
        <h2>👁️ Content Preview</h2>
        <button class="btn btn-ghost" onclick="closePreviewModal()">✕</button>
      </div>
      <div class="modal-body" style="max-height:70vh;overflow-y:auto;">
        <div style="margin-bottom:16px;padding:12px;background:var(--bg-muted);border-radius:6px;">
          <div style="font-size:13px;font-weight:600;margin-bottom:4px;">${escHtml(gap.docTopic.title)}</div>
          <div style="font-size:11px;color:var(--text-muted);">Action: ${suggestion.actionType.replace(/_/g, ' ')}</div>
          <div style="font-size:11px;color:var(--text-muted);">Confidence: ${Math.round(suggestion.confidence * 100)}% | Effort: ${suggestion.estimatedEffort}</div>
        </div>
        ${contentHtml}
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closePreviewModal()">Close</button>
        <button class="btn btn-ghost" onclick="copyPreviewContent(${globalIdx})">📋 Copy Content</button>
        <button class="btn btn-primary" onclick="approveAndCreatePR(${globalIdx})">✓ Approve & Create PR</button>
      </div>
    </div>
  </div>`;
  
  const existing = document.getElementById('preview-modal');
  if (existing) existing.remove();
  
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  
  window.closePreviewModal = () => {
    const modal = document.getElementById('preview-modal');
    if (modal) modal.remove();
  };
  
  window.copyPreviewContent = (idx) => {
    const s = state.editorSuggestions[idx];
    if (!s || !s.generatedContent) return;
    
    let textToCopy = '';
    const content = s.generatedContent;
    
    if (content.type === 'edit' || content.type === 'add_section') {
      textToCopy = content.newContent || content.content;
    } else if (content.type === 'new_unit') {
      textToCopy = `${content.yamlFrontmatter}\n\n${content.content}`;
    } else if (editorState.generatedModule && editorState.generatedModule.units) {
      textToCopy = editorState.generatedModule.units.map(u => u.content).join('\n\n---\n\n');
    }
    
    navigator.clipboard.writeText(textToCopy).then(() => {
      toast('Content copied to clipboard', 'success');
    }).catch(err => {
      console.error('Copy failed:', err);
      toast('Failed to copy content', 'error');
    });
  };
  
  window.approveAndCreatePR = async (idx) => {
    const s = state.editorSuggestions[idx];
    s.status = 'approved';
    closePreviewModal();
    
    // Start PR creation workflow
    await createPRForSuggestion(s, idx);
  };
}

