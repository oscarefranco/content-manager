// ══════════════════════════════════════════════════════════════════════════
// GITHUB PR WORKFLOW
// ══════════════════════════════════════════════════════════════════════════

async function createPRForSuggestion(suggestion, idx) {
  try {
    toast('Creating PR... Step 1/3: Creating branch', 'info');
    
    // Determine target repo (based on product/module)
    const targetRepo = determineTargetRepo(suggestion);
    const baseBranch = state.repoBranches[targetRepo] || 'main';
    
    // Step 1: Create branch
    const branchName = await createBranchForSuggestion(suggestion, targetRepo, baseBranch);
    suggestion.prInfo = { repo: targetRepo, branch: branchName, baseBranch };
    
    toast(`Creating PR... Step 2/3: Committing files (branch: ${branchName})`, 'info');
    
    // Step 2: Commit files
    await commitContentToGitHub(suggestion, targetRepo, branchName);
    
    toast('Creating PR... Step 3/3: Opening pull request', 'info');
    
    // Step 3: Create PR
    const prUrl = await createPullRequest(suggestion, targetRepo, branchName, baseBranch);
    suggestion.prInfo.url = prUrl;
    suggestion.status = 'pr_created';
    
    // Update UI
    renderEditorView();
    
    toast(`✓ PR created successfully!`, 'success');
    
    // Show success modal with PR link
    showPRCreatedModal(prUrl, suggestion);
    
  } catch (err) {
    console.error('PR creation failed:', err);
    suggestion.status = 'approved'; // Reset to approved
    renderEditorView();
    toast(`PR creation failed: ${err.message}`, 'error');
  }
}

function determineTargetRepo(suggestion) {
  // Determine which repo based on product or module info
  const productName = state.selectedProduct?.name || '';
  
  // Power Platform products go to learn-bizapps-pr
  const bizappsProducts = ['Power Apps', 'Power BI', 'Power Automate', 'Copilot Studio', 'Power Platform'];
  if (bizappsProducts.some(p => productName.includes(p))) {
    return 'learn-bizapps-pr';
  }
  
  // Dynamics products go to learn-dynamics-pr
  return 'learn-dynamics-pr';
}

async function createBranchForSuggestion(suggestion, repo, baseBranch) {
  const gap = suggestion.gap;
  const timestamp = Date.now();
  const slug = gap.docTopic.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 40);
  const branchName = `content-gap-${slug}-${timestamp}`;
  
  // Get latest commit SHA from base branch
  const refUrl = `https://api.github.com/repos/MicrosoftDocs/${repo}/git/ref/heads/${baseBranch}`;
  const refResponse = await fetch(refUrl, { headers: ghHeaders() });
  
  if (!refResponse.ok) {
    throw new Error(`Failed to get ref: ${refResponse.statusText}`);
  }
  
  const refData = await refResponse.json();
  const sha = refData.object.sha;
  
  // Create new branch
  const createRefUrl = `https://api.github.com/repos/MicrosoftDocs/${repo}/git/refs`;
  const createResponse = await fetch(createRefUrl, {
    method: 'POST',
    headers: { ...ghHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ref: `refs/heads/${branchName}`,
      sha: sha
    })
  });
  
  if (!createResponse.ok) {
    const error = await createResponse.text();
    throw new Error(`Failed to create branch: ${error}`);
  }
  
  console.log(`Created branch: ${branchName}`);
  return branchName;
}

async function commitContentToGitHub(suggestion, repo, branch) {
  const content = suggestion.generatedContent;
  const gap = suggestion.gap;
  
  let filePath = '';
  let fileContent = '';
  let commitMessage = '';
  
  // Determine file path and content based on action type
  if (content.type === 'edit' || content.type === 'add_section') {
    // Update existing file
    filePath = content.unitPath || determinFilePath(suggestion);
    fileContent = content.type === 'edit' ? content.newContent : (content.originalContent + '\n\n' + content.content);
    commitMessage = `Update: ${gap.docTopic.title}\n\nAction: ${suggestion.actionType}\n${content.explanation || suggestion.reasoning}`;
  } else if (content.type === 'new_unit') {
    // Create new unit file
    const modulePath = determineModulePath(suggestion);
    filePath = `${modulePath}/${content.filename}.md`;
    fileContent = `${content.yamlFrontmatter}\n\n${content.content}`;
    commitMessage = `Add new unit: ${content.unitTitle}\n\n${content.description}\n\nCovers: ${gap.docTopic.title}`;
  } else {
    // Full module - commit multiple files
    if (editorState.generatedModule && editorState.generatedModule.units) {
      const module = editorState.generatedModule;
      const modulePath = `learn-${gap.docTopic.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      
      // Commit index.yml
      await commitFile(repo, branch, `${modulePath}/index.yml`, module.indexYml || '', `Add module: ${module.title}`);
      
      // Commit each unit
      for (const unit of module.units) {
        const unitPath = `${modulePath}/${unit.filename}`;
        await commitFile(repo, branch, unitPath, unit.content, `Add unit: ${unit.title}`);
      }
      
      return; // Early return for module
    }
  }
  
  // Commit single file
  await commitFile(repo, branch, filePath, fileContent, commitMessage);
}

async function commitFile(repo, branch, path, content, message) {
  // Check if file exists (for updates)
  let sha = null;
  try {
    const checkUrl = `https://api.github.com/repos/MicrosoftDocs/${repo}/contents/${path}?ref=${branch}`;
    const checkResponse = await fetch(checkUrl, { headers: ghHeaders() });
    if (checkResponse.ok) {
      const data = await checkResponse.json();
      sha = data.sha;
    }
  } catch (err) {
    // File doesn't exist, that's ok for new files
  }
  
  // Create or update file
  const url = `https://api.github.com/repos/MicrosoftDocs/${repo}/contents/${path}`;
  const body = {
    message: message,
    content: btoa(unescape(encodeURIComponent(content))), // Base64 encode UTF-8
    branch: branch
  };
  
  if (sha) {
    body.sha = sha; // Required for updates
  }
  
  const response = await fetch(url, {
    method: 'PUT',
    headers: { ...ghHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to commit ${path}: ${error}`);
  }
  
  console.log(`Committed: ${path}`);
}

async function createPullRequest(suggestion, repo, headBranch, baseBranch) {
  const gap = suggestion.gap;
  const title = `Content gap: ${gap.docTopic.title}`;
  const body = `## Content Gap Coverage

**Action Type:** ${suggestion.actionType.replace(/_/g, ' ')}
**Confidence:** ${Math.round(suggestion.confidence * 100)}%
**Estimated Effort:** ${suggestion.estimatedEffort}

### Documentation Gap
**Topic:** ${gap.docTopic.title}
**Path:** ${gap.docTopic.path}

### Explanation
${gap.explanation}

### AI Recommendation
${suggestion.reasoning}

---
*Generated by Content Gap Manager*
*Branch: \`${headBranch}\`*`;
  
  const url = `https://api.github.com/repos/MicrosoftDocs/${repo}/pulls`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { ...ghHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: title,
      body: body,
      head: headBranch,
      base: baseBranch
    })
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create PR: ${error}`);
  }
  
  const prData = await response.json();
  console.log(`Created PR: ${prData.html_url}`);
  
  return prData.html_url;
}

function determinFilePath(suggestion) {
  // Fallback path determination
  const module = suggestion.targetModule || 'module';
  const unit = suggestion.targetUnit || 'unit';
  const moduleSlug = module.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const unitSlug = unit.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return `${moduleSlug}/${unitSlug}.md`;
}

function determineModulePath(suggestion) {
  const module = suggestion.targetModule || 'module';
  return module.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function showPRCreatedModal(prUrl, suggestion) {
  const modalHtml = `
  <div class="modal-overlay" id="pr-success-modal" style="display:flex;z-index:9999;">
    <div class="modal" style="max-width:600px;">
      <div class="modal-header">
        <h2>✓ Pull Request Created!</h2>
        <button class="btn btn-ghost" onclick="closePRSuccessModal()">✕</button>
      </div>
      <div class="modal-body">
        <div style="text-align:center;padding:20px;">
          <div style="font-size:48px;margin-bottom:16px;">🎉</div>
          <h3 style="margin:0 0 16px 0;">Pull Request Successfully Created</h3>
          <p style="margin:0 0 20px 0;color:var(--text-muted);">
            Your content has been committed and a pull request has been opened for review.
          </p>
          <a href="${escHtml(prUrl)}" target="_blank" class="btn btn-primary" style="display:inline-block;text-decoration:none;">
            View Pull Request on GitHub ↗
          </a>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closePRSuccessModal()">Close</button>
      </div>
    </div>
  </div>`;
  
  const existing = document.getElementById('pr-success-modal');
  if (existing) existing.remove();
  
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  
  window.closePRSuccessModal = () => {
    const modal = document.getElementById('pr-success-modal');
    if (modal) modal.remove();
  };
}

function switchEditorTab(tab) {
  editorState.activeTab = tab;
  document.querySelectorAll('.editor-tab').forEach(t => {
    const key = tab === 'new' ? 'new content' : tab === 'update' ? 'updates' : 'outdated';
    t.classList.toggle('active', t.textContent.toLowerCase().includes(key));
  });
  renderSuggestionList();
}

function renderSuggestionList() {
  const list = document.getElementById('suggestion-list');
  const filtered = editorState.suggestions.filter(s => s.type === editorState.activeTab);

  if (filtered.length === 0) {
    const msgs = {
      'new': 'No uncovered documentation topics found — great coverage! 🎉',
      'update': 'No partially-matched modules to expand.',
      'outdated': 'No outdated modules found — content is fresh! ✅',
    };
    list.innerHTML = `<div class="empty-state" style="padding:2rem;"><p>${msgs[editorState.activeTab]}</p></div>`;
    return;
  }

  list.innerHTML = filtered.map((s) => {
    const globalIdx = editorState.suggestions.indexOf(s);
    const isSelected = globalIdx === editorState.selectedIdx;
    const priorityColor = s.priority === 'high' ? 'tag-red' : s.priority === 'medium' ? 'tag-yellow' : 'tag-blue';
    const typeIcon = s.type === 'new' ? '📝' : s.type === 'update' ? '🔄' : '⏰';

    let metaHtml = '';
    if (s.type === 'new' && s.topicCount > 1) metaHtml = `<span class="tag tag-purple">${s.topicCount} topics</span>`;
    if (s.type === 'update' && s.score !== undefined) metaHtml = `<span class="tag tag-blue">${Math.round(s.score * 100)}% match</span>`;
    if (s.type === 'outdated') metaHtml = `<span class="tag tag-red">${s.ageMonths}mo old</span>`;

    let recHtml = '';
    if (s.type === 'new') {
      if (s.recommendation === 'expand-unit' && s.targetUnit) {
        recHtml = `<div style="margin-top:6px;padding:6px 10px;background:var(--success-bg);border-radius:6px;font-size:11px;display:flex;align-items:center;gap:6px;">
          <span>📄</span> <strong>Expand unit:</strong> <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escHtml(s.targetUnit.title)}">${escHtml(s.targetUnit.title)}</span>
          <span class="tag tag-green" style="flex-shrink:0;">${Math.round(s.targetOverlap * 100)}%</span>
        </div>
        <div style="margin-top:3px;font-size:10px;color:var(--text-muted);padding-left:26px;">in module: ${escHtml(s.targetModule.title)}</div>`;
      } else if (s.recommendation === 'add-unit' && s.targetModule) {
        recHtml = `<div style="margin-top:6px;padding:6px 10px;background:var(--primary-light);border-radius:6px;font-size:11px;display:flex;align-items:center;gap:6px;">
          <span>➕</span> <strong>New unit in:</strong> <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escHtml(s.targetModule.title)}">${escHtml(s.targetModule.title)}</span>
          <span class="tag tag-blue" style="flex-shrink:0;">${Math.round(s.targetOverlap * 100)}%</span>
        </div>`;
      } else {
        recHtml = `<div style="margin-top:6px;padding:6px 10px;background:var(--purple-light);border-radius:6px;font-size:11px;display:flex;align-items:center;gap:6px;">
          <span>🆕</span> <strong>New module needed</strong> <span style="font-size:10px;color:var(--text-muted);">— checked ${state.modules.length} modules, no match</span>
        </div>`;
      }
    }
    if (s.type === 'update' && s.module) {
      recHtml = `<div style="margin-top:6px;padding:6px 10px;background:var(--warning-bg);border-radius:6px;font-size:11px;display:flex;align-items:center;gap:6px;">
        <span>✏️</span> <strong>Expand:</strong> <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escHtml(s.module.title)}">${escHtml(s.module.title)}</span>
      </div>`;
    }

    return `<div class="suggestion-card ${isSelected ? 'selected' : ''}" onclick="selectSuggestion(${globalIdx})">
      <div class="suggestion-card-header">
        <span>${typeIcon}</span>
        <h4 title="${escHtml(s.title)}">${escHtml(s.title)}</h4>
        <span class="tag ${priorityColor}">${s.priority}</span>
      </div>
      <p>${escHtml(s.reason)}</p>
      ${recHtml}
      <div class="suggestion-meta">
        ${metaHtml}
        <button class="generate-btn" onclick="event.stopPropagation(); selectSuggestion(${globalIdx}); generateModuleFromSuggestion(${globalIdx});">🏗️ Generate Module</button>
      </div>
    </div>`;
  }).join('');
}

function selectSuggestion(idx) {
  editorState.selectedIdx = idx;
  renderSuggestionList();
}

