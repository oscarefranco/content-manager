// ══════════════════════════════════════════════════════════════════════════
// MODULE GENERATION PIPELINE (ported from generate_training.py)
// ══════════════════════════════════════════════════════════════════════════

function buildSourceFromSuggestion(s) {
  // Build source material content from gap analysis suggestion data
  const productName = state.selectedProduct?.name || 'Unknown Product';
  let title = s.title || 'Untitled';
  let description = s.reason || '';
  let rawText = '';

  if (s.type === 'new') {
    const topicList = (s.topics || []).map(t => `## ${t.title}\nDocumentation path: ${t.path}\n`).join('\n');
    const moduleContext = s.targetModule
      ? `\nTarget Module: "${s.targetModule.title}"\nModule Summary: ${s.targetModule.summary || 'N/A'}\nExisting Units:\n${(s.targetModule.units || []).map((u, i) => `  ${i + 1}. ${u}`).join('\n')}\n`
      : '';
    rawText = `Product: ${productName}\n${moduleContext}\n# Documentation Topics to Cover\n\n${topicList}\n\n# Context\n${s.reason}\n\nRecommendation: ${s.recommendation || 'new-module'}`;
    if (s.recommendation === 'expand-unit' && s.targetUnit) {
      title = `Expand: ${s.targetUnit.title}`;
      description = `Add subsections within unit "${s.targetUnit.title}" in module "${s.targetModule.title}" for ${productName}`;
    } else if (s.recommendation === 'add-unit' && s.targetModule) {
      title = `New Unit for: ${s.targetModule.title}`;
      description = `Add new training unit(s) to module "${s.targetModule.title}" for ${productName}`;
    } else {
      title = s.title;
      description = `New training module for ${productName} covering ${s.topicCount || 1} documentation topic(s)`;
    }
  } else if (s.type === 'update') {
    title = s.module?.title || s.title;
    description = `Update "${s.module?.title}" to better cover "${s.docTopic?.title}" (currently ${Math.round((s.score || 0) * 100)}% match)`;
    rawText = `Product: ${productName}\n\n# Module to Update\nTitle: ${s.module?.title}\nUID: ${s.module?.uid || 'unknown'}\nSummary: ${s.module?.summary || 'N/A'}\nUnits: ${s.module?.unitCount || 0}\n${s.module?.units ? `\nCurrent Units:\n${s.module.units.map((u, i) => `  ${i + 1}. ${u}`).join('\n')}\n` : ''}\n\n# Documentation Topic Not Fully Covered\nTitle: ${s.docTopic?.title}\nPath: ${s.docTopic?.path}\nCurrent Match: ${Math.round((s.score || 0) * 100)}%\n\n# Context\n${s.reason}`;
  } else if (s.type === 'outdated') {
    title = s.module?.title || s.title;
    description = `Refresh outdated module "${s.module?.title}" (${s.ageMonths} months old) for ${productName}`;
    const docContext = state.flatDocTopics.filter(d => d.depth <= 2).slice(0, 40).map(d => `${'  '.repeat(d.depth)}• ${d.title}`).join('\n');
    rawText = `Product: ${productName}\n\n# Module to Refresh\nTitle: ${s.module?.title}\nUID: ${s.module?.uid || 'unknown'}\nLast Updated: ${s.module?.msDate} (${s.ageMonths} months ago)\nSummary: ${s.module?.summary || 'N/A'}\n\n# Current Documentation Topics (for reference)\n${docContext}\n\n# Context\n${s.reason}`;
  }

  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'module';
  return { title, description, rawText, slug, sourceUrl: '' };
}

function updateProgressUI(steps) {
  const container = document.getElementById('progress-steps');
  document.getElementById('module-builder-progress').style.display = '';
  container.innerHTML = steps.map((step, i) => {
    const statusClass = step.status === 'active' ? 'active' : step.status === 'done' ? 'done' : step.status === 'error' ? 'error' : '';
    const icon = step.status === 'done' ? '✓' : step.status === 'error' ? '✗' : step.status === 'active' ? '⏳' : (i + 1);
    const chars = step.chars ? `${step.chars.toLocaleString()} chars` : '';
    return `<div class="progress-step ${statusClass}">
      <div class="step-icon">${icon}</div>
      <span class="step-label">${step.label}</span>
      <span class="step-chars">${chars}</span>
    </div>`;
  }).join('');
}

async function generateFullModule(source) {
  const { token } = getAIConfig();
  if (!token) { toast('Add your GitHub token in Settings first', 'warning'); openSettings(); return null; }
  if (editorState.isGenerating) { toast('Generation already in progress', 'warning'); return null; }

  editorState.isGenerating = true;
  const body = document.getElementById('module-builder-body');
  const footer = document.getElementById('module-builder-footer');
  const unitTabsBar = document.getElementById('unit-tabs-bar');
  const titleEl = document.getElementById('module-builder-title');
  const copyBtn = document.getElementById('copy-module-btn');

  titleEl.textContent = `Building: ${source.title}`;
  footer.style.display = 'none';
  unitTabsBar.style.display = 'none';
  copyBtn.style.display = 'none';
  body.innerHTML = '';

  // Build step list
  const steps = [
    { label: 'Identifying logical areas…', status: 'pending', chars: 0 },
    { label: 'Generating Overview…', status: 'pending', chars: 0 },
    { label: 'Generating Introduction…', status: 'pending', chars: 0 },
    // Area steps will be inserted dynamically
    { label: 'Generating Knowledge Check…', status: 'pending', chars: 0 },
    { label: 'Generating Summary…', status: 'pending', chars: 0 },
  ];
  updateProgressUI(steps);

  const units = [];

  try {
    // Step 1: Identify areas
    steps[0].status = 'active';
    updateProgressUI(steps);
    const areasPrompt = MODULE_PROMPTS.identifyAreas(source.title, source.description, source.rawText);
    const areasRaw = await callAI([
      { role: 'system', content: areasPrompt.system },
      { role: 'user', content: areasPrompt.user },
    ], { maxTokens: 2000, temperature: 0.3 });
    const areas = parseAreasResponse(areasRaw);
    steps[0].status = 'done';
    steps[0].label = `Found ${areas.length} area(s): ${areas.map(a => a.name).join(', ')}`;
    steps[0].chars = areasRaw.length;

    // Insert area steps before knowledge check
    const areaSteps = areas.map(a => ({ label: `Generating: ${a.name}…`, status: 'pending', chars: 0 }));
    steps.splice(3, 0, ...areaSteps);
    updateProgressUI(steps);

    // Step 2: Overview
    steps[1].status = 'active';
    updateProgressUI(steps);
    const ovPrompt = MODULE_PROMPTS.overview(source.title, source.description, source.rawText);
    const overview = await callAI([
      { role: 'system', content: ovPrompt.system },
      { role: 'user', content: ovPrompt.user },
    ], { maxTokens: 4000, temperature: 0.5 });
    units.push({ name: '0-overview', title: 'Overview', content: overview, slug: 'overview' });
    steps[1].status = 'done';
    steps[1].chars = overview.length;
    updateProgressUI(steps);

    // Step 3: Introduction
    steps[2].status = 'active';
    updateProgressUI(steps);
    const introPrompt = MODULE_PROMPTS.introduction(source.title, source.description, source.rawText);
    const intro = await callAI([
      { role: 'system', content: introPrompt.system },
      { role: 'user', content: introPrompt.user },
    ], { maxTokens: 6000, temperature: 0.5 });
    units.push({ name: '1-introduction', title: 'Introduction', content: intro, slug: 'introduction' });
    steps[2].status = 'done';
    steps[2].chars = intro.length;
    updateProgressUI(steps);

    // Steps 4+: Area units
    for (let i = 0; i < areas.length; i++) {
      const stepIdx = 3 + i;
      steps[stepIdx].status = 'active';
      updateProgressUI(steps);
      const areaPrompt = MODULE_PROMPTS.areaContent(source.title, source.description, source.rawText, areas[i].name, areas[i].description);
      const areaContent = await callAI([
        { role: 'system', content: areaPrompt.system },
        { role: 'user', content: areaPrompt.user },
      ], { maxTokens: 8000, temperature: 0.5 });
      units.push({
        name: `${i + 2}-${areas[i].slug}`,
        title: areas[i].name,
        content: areaContent,
        slug: areas[i].slug,
      });
      steps[stepIdx].status = 'done';
      steps[stepIdx].chars = areaContent.length;
      updateProgressUI(steps);
    }

    // Knowledge Check
    const kcStepIdx = 3 + areas.length;
    steps[kcStepIdx].status = 'active';
    updateProgressUI(steps);
    const kcPrompt = MODULE_PROMPTS.knowledgeCheck(source.title, source.description, source.rawText);
    const kc = await callAI([
      { role: 'system', content: kcPrompt.system },
      { role: 'user', content: kcPrompt.user },
    ], { maxTokens: 6000, temperature: 0.5 });
    units.push({ name: `${areas.length + 2}-knowledge-check`, title: 'Knowledge Check', content: kc, slug: 'knowledge-check' });
    steps[kcStepIdx].status = 'done';
    steps[kcStepIdx].chars = kc.length;
    updateProgressUI(steps);

    // Summary
    const sumStepIdx = 4 + areas.length;
    steps[sumStepIdx].status = 'active';
    updateProgressUI(steps);
    const sumPrompt = MODULE_PROMPTS.summary(source.title, source.description, source.rawText);
    const summary = await callAI([
      { role: 'system', content: sumPrompt.system },
      { role: 'user', content: sumPrompt.user },
    ], { maxTokens: 4000, temperature: 0.5 });
    units.push({ name: `${areas.length + 3}-summary`, title: 'Summary', content: summary, slug: 'summary' });
    steps[sumStepIdx].status = 'done';
    steps[sumStepIdx].chars = summary.length;
    updateProgressUI(steps);

    // Build module object
    const module = {
      title: source.title,
      slug: source.slug,
      sourceUrl: source.sourceUrl || '',
      units,
      areas,
      generatedAt: new Date().toISOString(),
      product: state.selectedProduct?.name || '',
      totalChars: units.reduce((s, u) => s + u.content.length, 0),
    };

    editorState.currentModule = module;
    editorState.currentUnitIdx = 0;

    // Show module output
    setTimeout(() => {
      document.getElementById('module-builder-progress').style.display = 'none';
      renderModuleOutput();
      footer.style.display = 'flex';
      copyBtn.style.display = 'inline-flex';
      titleEl.textContent = `🏗️ ${source.title}`;
      toast(`Module generated: ${units.length} units, ${module.totalChars.toLocaleString()} chars total`, 'success');
    }, 500);

    return module;

  } catch (e) {
    const failedStep = steps.find(s => s.status === 'active');
    if (failedStep) failedStep.status = 'error';
    updateProgressUI(steps);

    if (e.message === 'NO_TOKEN') { toast('Add your GitHub token in Settings', 'warning'); openSettings(); }
    else {
      body.innerHTML = `<div class="empty-state" style="padding:2rem;"><p style="color:var(--danger);">❌ Generation failed: ${escHtml(e.message)}</p><p style="margin-top:8px;font-size:12px;">Units generated before failure are preserved above.</p></div>`;
      toast('Module generation failed', 'warning');
    }
    return null;
  } finally {
    editorState.isGenerating = false;
  }
}

function renderModuleOutput() {
  const mod = editorState.currentModule;
  if (!mod) return;

  // Render unit tabs
  const tabsBar = document.getElementById('unit-tabs-bar');
  tabsBar.style.display = 'flex';
  tabsBar.innerHTML = mod.units.map((u, i) => {
    const active = i === editorState.currentUnitIdx ? 'active' : '';
    return `<button class="unit-tab ${active}" onclick="switchModuleUnit(${i})" title="${escHtml(u.title)}">${escHtml(u.title)}</button>`;
  }).join('');

  // Render current unit content
  const body = document.getElementById('module-builder-body');
  const unit = mod.units[editorState.currentUnitIdx];
  if (!unit) return;

  body.innerHTML = `<div class="draft-content">${renderMarkdown(unit.content)}</div>`;
}

function switchModuleUnit(idx) {
  editorState.currentUnitIdx = idx;
  renderModuleOutput();
}

function renderMarkdown(md) {
  let html = escHtml(md);
  html = html.replace(/^#### (.+)$/gm, '<h4 style="font-size:13px;font-weight:600;margin:10px 0 4px;">$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 style="font-size:18px;font-weight:700;margin:0 0 12px;">$1</h1>');
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => `<pre><code>${code.trim()}</code></pre>`);
  html = html.replace(/&gt; \[!TIP\]\s*\n&gt; (.+)/g, '<blockquote style="border-left-color:var(--success);background:var(--success-bg);"><strong>💡 Tip:</strong> $1</blockquote>');
  html = html.replace(/&gt; \[!IMPORTANT\]\s*\n&gt; (.+)/g, '<blockquote style="border-left-color:var(--warning);background:var(--warning-bg);"><strong>⚠️ Important:</strong> $1</blockquote>');
  html = html.replace(/&gt; \[!NOTE\]\s*\n&gt; (.+)/g, '<blockquote><strong>📝 Note:</strong> $1</blockquote>');
  html = html.replace(/&gt; (.+)/gm, '<blockquote>$1</blockquote>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/`([^`]+)`/g, '<code style="background:var(--bg);padding:1px 5px;border-radius:3px;font-size:12px;">$1</code>');
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>');
  html = html.replace(/((?:<li>.*<\/li>\s*)+)/g, '<ul>$1</ul>');
  html = html.replace(/\n\n/g, '</p><p>');
  html = html.replace(/\n/g, '<br>');
  html = `<p>${html}</p>`;
  html = html.replace(/<p><\/p>/g, '');
  html = html.replace(/<p>(<h[1-4][^>]*>)/g, '$1');
  html = html.replace(/(<\/h[1-4]>)<\/p>/g, '$1');
  html = html.replace(/<p>(<pre>)/g, '$1');
  html = html.replace(/(<\/pre>)<\/p>/g, '$1');
  html = html.replace(/<p>(<ul>)/g, '$1');
  html = html.replace(/(<\/ul>)<\/p>/g, '$1');
  html = html.replace(/<p>(<blockquote)/g, '$1');
  html = html.replace(/(<\/blockquote>)<\/p>/g, '$1');
  return html;
}

// ── Generate from Suggestion (gap analysis) ──

async function generateModuleFromSuggestion(idx) {
  const s = editorState.suggestions[idx];
  if (!s) return;
  editorState.selectedIdx = idx;
  renderSuggestionList();
  if (docRefState.isOpen) refreshDocRefPanel();
  const source = buildSourceFromSuggestion(s);
  await generateFullModule(source);
}

// ── Generate from URL ──

async function generateFromUrl() {
  const input = document.getElementById('url-input');
  const url = input.value.trim();
  if (!url) { toast('Enter a URL first', 'warning'); return; }

  const { token } = getAIConfig();
  if (!token) { toast('Sign in with GitHub or add a token in Settings first', 'warning'); openSettings(); return; }

  // Support owner/repo/path shorthand (not a URL)
  if (!url.startsWith('http') && url.includes('/')) {
    const parts = url.split('/');
    if (parts.length >= 3) {
      const owner = parts[0];
      const repo = parts[1];
      const path = parts.slice(2).join('/');
      await generateFromRepoFile(owner, repo, path);
      return;
    }
  }

  if (!url.startsWith('http')) { toast('Enter a valid URL starting with http(s):// or owner/repo/path', 'warning'); return; }

  // Show editor content area
  document.getElementById('editor-empty').style.display = 'none';
  document.getElementById('editor-content').style.display = '';

  const body = document.getElementById('module-builder-body');
  const titleEl = document.getElementById('module-builder-title');
  titleEl.textContent = 'Fetching URL…';
  body.innerHTML = '<div class="loading-overlay"><div class="loading-spinner"></div> Fetching and extracting content…</div>';

  try {
    const extracted = await fetchUrlContent(url);
    if (!extracted.rawText || extracted.rawText.length < 50) {
      body.innerHTML = `<div class="empty-state" style="padding:2rem;"><p style="color:var(--danger);">⚠️ Very little content extracted from URL. Try a different page.</p></div>`;
      return;
    }

    toast(`Fetched: "${extracted.title}" (${extracted.rawText.length.toLocaleString()} chars)`, 'success');
    extracted.sourceUrl = url;
    await generateFullModule(extracted);

  } catch (e) {
    body.innerHTML = `<div class="empty-state" style="padding:2rem;"><p style="color:var(--danger);">❌ Failed to fetch URL: ${escHtml(e.message)}</p></div>`;
    toast('URL fetch failed', 'warning');
  }
}

// ── Repo Browser ──

let repoBrowserState = { owner: '', repo: '', branch: 'main', path: '' };

function openRepoBrowser() {
  const panel = document.getElementById('repo-browser-panel');
  panel.style.display = '';
  if (!getToken()) {
    document.getElementById('repo-browser-list').innerHTML = '<p style="padding:16px;font-size:12px;color:var(--text-muted);">Sign in with GitHub first to browse private repos.</p>';
  }
}

function closeRepoBrowser() {
  document.getElementById('repo-browser-panel').style.display = 'none';
}

async function browseRepo(subPath) {
  const token = getToken();
  if (!token) { toast('Sign in with GitHub first', 'warning'); return; }

  if (subPath === undefined) {
    // Initial load from inputs
    const input = document.getElementById('repo-browser-input').value.trim();
    const branch = document.getElementById('repo-browser-branch').value.trim() || 'main';
    const parts = input.split('/');
    if (parts.length < 2) { toast('Enter owner/repo (e.g. MicrosoftDocs/learn-bizapps-pr)', 'warning'); return; }
    repoBrowserState = { owner: parts[0], repo: parts[1], branch, path: '' };
  } else {
    repoBrowserState.path = subPath;
  }

  const { owner, repo, branch, path } = repoBrowserState;
  const listEl = document.getElementById('repo-browser-list');
  const breadcrumb = document.getElementById('repo-browser-breadcrumb');

  // Breadcrumb
  const crumbs = [`<a href="#" onclick="browseRepo('');return false;" style="color:var(--primary);">${owner}/${repo}</a>`];
  if (path) {
    const segments = path.split('/');
    let cumulative = '';
    for (const seg of segments) {
      cumulative += (cumulative ? '/' : '') + seg;
      const link = cumulative;
      crumbs.push(`<a href="#" onclick="browseRepo('${link}');return false;" style="color:var(--primary);">${seg}</a>`);
    }
  }
  breadcrumb.innerHTML = '📁 ' + crumbs.join(' / ');

  listEl.innerHTML = '<div style="padding:16px;text-align:center;"><div class="loading-spinner"></div> Loading…</div>';

  try {
    let apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    if (branch) apiUrl += `?ref=${branch}`;
    const resp = await fetch(apiUrl, { headers: ghHeaders() });
    if (!resp.ok) throw new Error(`GitHub API ${resp.status}: ${resp.statusText}`);
    const items = await resp.json();

    if (!Array.isArray(items)) {
      // Single file was returned — use it
      await selectRepoFile(owner, repo, path, items);
      return;
    }

    // Sort: dirs first, then files
    items.sort((a, b) => {
      if (a.type === 'dir' && b.type !== 'dir') return -1;
      if (a.type !== 'dir' && b.type === 'dir') return 1;
      return a.name.localeCompare(b.name);
    });

    let html = '<div style="padding:4px;">';
    if (path) {
      const parent = path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : '';
      html += `<div style="padding:6px 12px;cursor:pointer;font-size:12px;border-bottom:1px solid var(--border);" onclick="browseRepo('${parent}')">⬆️ ..</div>`;
    }
    for (const item of items) {
      const icon = item.type === 'dir' ? '📁' : '📄';
      const itemPath = path ? `${path}/${item.name}` : item.name;
      if (item.type === 'dir') {
        html += `<div style="padding:6px 12px;cursor:pointer;font-size:12px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:6px;" onclick="browseRepo('${itemPath}')" onmouseover="this.style.background='var(--primary-light)'" onmouseout="this.style.background=''">${icon} <span style="flex:1;">${item.name}</span></div>`;
      } else {
        const size = item.size > 1024 ? `${(item.size / 1024).toFixed(1)} KB` : `${item.size} B`;
        html += `<div style="padding:6px 12px;cursor:pointer;font-size:12px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:6px;" onclick="selectRepoFile('${owner}','${repo}','${itemPath}')" onmouseover="this.style.background='var(--primary-light)'" onmouseout="this.style.background=''">${icon} <span style="flex:1;">${item.name}</span> <span style="font-size:10px;color:var(--text-light);">${size}</span></div>`;
      }
    }
    html += '</div>';
    listEl.innerHTML = html;

  } catch (e) {
    listEl.innerHTML = `<p style="padding:16px;font-size:12px;color:var(--danger);">❌ ${escHtml(e.message)}</p>`;
  }
}

async function selectRepoFile(owner, repo, path, preloadedData) {
  closeRepoBrowser();
  document.getElementById('url-input').value = `${owner}/${repo}/${path}`;
  await generateFromRepoFile(owner, repo, path, preloadedData);
}

async function generateFromRepoFile(owner, repo, path, preloadedData) {
  const token = getToken();
  if (!token) { toast('Sign in with GitHub first', 'warning'); return; }

  document.getElementById('editor-empty').style.display = 'none';
  document.getElementById('editor-content').style.display = '';

  const body = document.getElementById('module-builder-body');
  const titleEl = document.getElementById('module-builder-title');
  titleEl.textContent = `Loading ${path.split('/').pop()}…`;
  body.innerHTML = '<div class="loading-overlay"><div class="loading-spinner"></div> Fetching file from repo…</div>';

  try {
    let data = preloadedData;
    if (!data) {
      const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
      const resp = await fetch(apiUrl, { headers: ghHeaders() });
      if (!resp.ok) throw new Error(`GitHub API ${resp.status}: ${resp.statusText}`);
      data = await resp.json();
    }

    let content = '';
    if (data.content) {
      content = atob(data.content.replace(/\n/g, ''));
    } else if (data.download_url) {
      const dl = await fetch(data.download_url, { headers: ghHeaders() });
      content = await dl.text();
    }

    if (!content || content.length < 20) {
      body.innerHTML = `<div class="empty-state" style="padding:2rem;"><p style="color:var(--danger);">⚠️ File is empty or too small to generate a module.</p></div>`;
      return;
    }

    const title = path.split('/').pop().replace(/\.(yml|yaml|md|markdown)$/i, '').replace(/[-_]/g, ' ');
    toast(`Loaded: "${title}" (${content.length.toLocaleString()} chars) from ${owner}/${repo}`, 'success');

    const extracted = {
      title,
      rawText: content,
      sourceUrl: `https://github.com/${owner}/${repo}/blob/main/${path}`,
    };
    await generateFullModule(extracted);

  } catch (e) {
    body.innerHTML = `<div class="empty-state" style="padding:2rem;"><p style="color:var(--danger);">❌ Failed to load file: ${escHtml(e.message)}</p></div>`;
    toast('Repo file load failed', 'warning');
  }
}

// ── Regenerate current unit ──

async function regenerateCurrentUnit() {
  const mod = editorState.currentModule;
  if (!mod || editorState.isGenerating) return;

  const unit = mod.units[editorState.currentUnitIdx];
  if (!unit) return;

  const body = document.getElementById('module-builder-body');
  body.innerHTML = '<div class="loading-overlay"><div class="loading-spinner"></div> Regenerating unit…</div>';

  try {
    // Reconstruct source from module
    const source = { title: mod.title, description: '', rawText: '', slug: mod.slug };
    // Use the original suggestion or URL data if available
    if (editorState.selectedIdx >= 0) {
      const s = editorState.suggestions[editorState.selectedIdx];
      if (s) { const src = buildSourceFromSuggestion(s); Object.assign(source, src); }
    }

    let prompt;
    if (unit.slug === 'overview') prompt = MODULE_PROMPTS.overview(source.title, source.description, source.rawText);
    else if (unit.slug === 'introduction') prompt = MODULE_PROMPTS.introduction(source.title, source.description, source.rawText);
    else if (unit.slug === 'knowledge-check') prompt = MODULE_PROMPTS.knowledgeCheck(source.title, source.description, source.rawText);
    else if (unit.slug === 'summary') prompt = MODULE_PROMPTS.summary(source.title, source.description, source.rawText);
    else {
      const area = mod.areas.find(a => a.slug === unit.slug);
      if (area) prompt = MODULE_PROMPTS.areaContent(source.title, source.description, source.rawText, area.name, area.description);
      else prompt = MODULE_PROMPTS.overview(source.title, source.description, source.rawText);
    }

    const content = await callAI([
      { role: 'system', content: prompt.system },
      { role: 'user', content: prompt.user },
    ], { maxTokens: 8000, temperature: 0.6 });

    mod.units[editorState.currentUnitIdx].content = content;
    mod.totalChars = mod.units.reduce((s, u) => s + u.content.length, 0);
    renderModuleOutput();
    toast('Unit regenerated', 'success');
  } catch (e) {
    body.innerHTML = `<div class="empty-state" style="padding:2rem;"><p style="color:var(--danger);">❌ Regeneration failed: ${escHtml(e.message)}</p></div>`;
  }
}

// ── Copy & Export ──

function copyModuleContent() {
  const mod = editorState.currentModule;
  if (!mod) return;
  // Copy all units as a combined document
  const combined = mod.units.map(u => `# ${u.title}\n\n${u.content}`).join('\n\n---\n\n');
  navigator.clipboard.writeText(combined).then(() => {
    toast('All units copied to clipboard', 'success');
  }).catch(() => {
    const unit = mod.units[editorState.currentUnitIdx];
    if (unit) navigator.clipboard.writeText(unit.content).then(() => toast('Current unit copied', 'success'));
  });
}

function exportModule(format) {
  const mod = editorState.currentModule;
  if (!mod) { toast('Generate a module first', 'warning'); return; }

  const dateStr = new Date().toISOString().slice(0, 10);
  const product = state.selectedProduct?.name || 'product';
  const productSlug = product.replace(/\s+/g, '-').toLowerCase();

  if (format === 'bundle') {
    // Full module bundle — all units in one file with structure
    const repo = state.selectedProduct?.repo || 'unknown-repo';
    const folder = state.selectedProduct?.folder || '';
    let bundle = `# Training Module: ${mod.title}
> Generated ${dateStr} by Team Content Gap Manager
> Product: ${product}
> Repository: MicrosoftDocs/${repo}
> Module Slug: ${mod.slug}
> Units: ${mod.units.length}
> Total Content: ${mod.totalChars.toLocaleString()} characters

---

## File Structure

\`\`\`
${folder}/${mod.slug}/
├── index.yml
├── includes/
`;
    mod.units.forEach(u => { bundle += `│   ├── ${u.name}.md\n`; });
    bundle += `\`\`\`

---

`;
    // Each unit as a section
    mod.units.forEach((u, i) => {
      bundle += `## File: includes/${u.name}.md

\`\`\`markdown
${u.content}
\`\`\`

---

`;
    });

    // index.yml
    bundle += `## File: index.yml

\`\`\`yaml
### YamlMime:Module
uid: learn.${mod.slug}
title: ${mod.title}
metadata:
  title: ${mod.title}
  description: Training module for ${product}
  ms.date: ${new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}
  author: AuthorName
  ms.author: authoralias
  ms.topic: module
summary: |
  [Module summary here]
units:
${mod.units.map(u => `  - learn.${mod.slug}.${u.slug}`).join('\n')}
\`\`\`

---

## PR Checklist

- [ ] Created index.yml with correct UIDs
- [ ] Added unit .yml files with proper metadata
- [ ] Added unit .md content files in includes/
- [ ] Verified all cross-references and links
- [ ] Added screenshots to media/ folder (if referenced)
- [ ] Ran local build/preview to verify formatting
- [ ] Updated ms.date to today's date
- [ ] Assigned reviewer

---
*Generated by [Team Content Gap Manager](https://oscarefranco.github.io/content-manager/team.html)*
`;

    const blob = new Blob([bundle], { type: 'text/markdown' });
    downloadBlob(blob, `${mod.slug}-module-bundle-${dateStr}.md`);
    toast('Module bundle exported', 'success');

  } else if (format === 'md') {
    // Export current unit as .md
    const unit = mod.units[editorState.currentUnitIdx];
    if (!unit) return;
    const header = `---\n# Unit: ${unit.title}\n# Module: ${mod.title}\n# Product: ${product}\n# Generated: ${dateStr}\n---\n\n`;
    const blob = new Blob([header + unit.content], { type: 'text/markdown' });
    downloadBlob(blob, `${unit.name}-${dateStr}.md`);
    toast(`Exported ${unit.name}.md`, 'success');

  } else if (format === 'yaml') {
    // Generate YAML metadata for all units
    let yaml = `### YamlMime:Module\nuid: learn.${mod.slug}\ntitle: ${mod.title}\nmetadata:\n  title: ${mod.title}\n  description: Training module for ${product}\n  ms.date: ${new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}\n  author: AuthorName\n  ms.author: authoralias\n  ms.topic: module\nunits:\n`;
    mod.units.forEach(u => { yaml += `  - learn.${mod.slug}.${u.slug}\n`; });
    const blob = new Blob([yaml], { type: 'text/yaml' });
    downloadBlob(blob, `${mod.slug}-index-${dateStr}.yml`);
    toast('YAML exported', 'success');

  } else if (format === 'json') {
    const blob = new Blob([JSON.stringify(mod, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `${mod.slug}-module-${dateStr}.json`);
    toast('JSON exported', 'success');
  }
}

function downloadBlob(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

// ── Content Plan (kept from original) ──

async function generateContentPlan() {
  const { token } = getAIConfig();
  if (!token) { toast('Add your GitHub token in Settings first', 'warning'); openSettings(); return; }

  if (editorState.suggestions.length === 0) {
    buildEditorSuggestions();
    if (editorState.suggestions.length === 0) {
      toast('No suggestions — load a product and run gap analysis first', 'warning');
      return;
    }
  }

  const btn = document.getElementById('generate-plan-btn');
  btn.disabled = true;
  btn.textContent = '⏳ Generating…';

  const body = document.getElementById('module-builder-body');
  body.innerHTML = '<div class="loading-overlay"><div class="loading-spinner"></div> Generating content plan…</div>';

  const newCount = editorState.suggestions.filter(s => s.type === 'new').length;
  const updateCount = editorState.suggestions.filter(s => s.type === 'update').length;
  const outdatedCount = editorState.suggestions.filter(s => s.type === 'outdated').length;

  const topItems = editorState.suggestions.slice(0, 25).map(s => {
    if (s.type === 'new') return `[NEW - ${s.priority}] ${s.title}: ${s.reason}`;
    if (s.type === 'update') return `[EXPAND - ${s.priority}] ${s.title}: ${s.reason}`;
    return `[REFRESH - ${s.priority}] ${s.title}: ${s.reason}`;
  }).join('\n');

  const prompt = `You are a content planning specialist for Microsoft Learn. Create a prioritized content plan for ${state.selectedProduct.name}.

PRODUCT: ${state.selectedProduct.name}
REPOSITORY: MicrosoftDocs/${state.selectedProduct.repo}
TOTAL TRAINING MODULES: ${state.modules.length}
DOCUMENTATION TOPICS: ${state.flatDocTopics.length}
${state.gapResults ? `COVERAGE SCORE: ${state.gapResults.coveragePct}%` : ''}

CONTENT GAPS:
- ${newCount} doc topics need new training content
- ${updateCount} modules need content expansion
- ${outdatedCount} modules are outdated (>12 months)

ITEMS (top 25 by priority):
${topItems}

Create a content plan in markdown:

## Executive Summary
(Brief assessment + key numbers)

## Priority Matrix

### 🔴 Immediate (This Sprint)
(Top 3-5 actions with specific deliverables)

### 🟡 Short-term (Next 30 Days)
(Next 5-8 items with estimated effort)

### 🟢 Long-term (Next Quarter)
(Remaining items grouped by theme)

## New Modules Roadmap
(For each: title, what it covers, estimated effort, suggested placement in repo)

## Module Refresh Schedule
(Prioritized list of outdated modules with key areas to update)

## Resource Estimates
- New content creation: estimated scope
- Content updates: estimated scope
- Reviews/QA: estimated scope

## Success Metrics
(How to measure improvement)

Be actionable. This plan will be shared with the content team.`;

  try {
    const reply = await callAI([{ role: 'user', content: prompt }], { maxTokens: 4000, temperature: 0.3 });

    editorState.contentPlan = {
      content: reply,
      generatedAt: new Date().toISOString(),
      product: state.selectedProduct.name,
    };

    // Show as a single-unit module for consistent display
    editorState.currentModule = {
      title: `Content Plan — ${state.selectedProduct.name}`,
      slug: 'content-plan',
      units: [{ name: 'content-plan', title: 'Content Plan', content: reply, slug: 'content-plan' }],
      areas: [],
      generatedAt: new Date().toISOString(),
      product: state.selectedProduct.name,
      totalChars: reply.length,
    };
    editorState.currentUnitIdx = 0;

    document.getElementById('module-builder-title').textContent = `📋 Content Plan — ${state.selectedProduct.name}`;
    document.getElementById('module-builder-progress').style.display = 'none';
    renderModuleOutput();
    document.getElementById('module-builder-footer').style.display = 'flex';
    document.getElementById('copy-module-btn').style.display = 'inline-flex';
    document.getElementById('export-plan-btn').style.display = 'inline-flex';

    toast('Content plan generated!', 'success');
  } catch (e) {
    if (e.message === 'NO_TOKEN') { toast('Add GitHub token in Settings', 'warning'); openSettings(); }
    else {
      body.innerHTML = `<div class="empty-state" style="padding:2rem;"><p style="color:var(--danger);">❌ Failed: ${escHtml(e.message)}</p></div>`;
      toast('Plan generation failed', 'warning');
    }
  }

  btn.disabled = false;
  btn.textContent = '📋 Content Plan';
}

function exportContentPlan() {
  if (!editorState.contentPlan) { toast('Generate a content plan first', 'warning'); return; }
  const name = (state.selectedProduct?.name || 'product').replace(/\s+/g, '-').toLowerCase();
  const blob = new Blob([editorState.contentPlan.content], { type: 'text/markdown' });
  downloadBlob(blob, `content-plan-${name}-${new Date().toISOString().slice(0, 10)}.md`);
  toast('Content plan exported', 'success');
}

