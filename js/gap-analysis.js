// ══════════════════════════════════════════════════════════════════════════
// GAP ANALYSIS — CLIENT SIDE (KEYWORD)
// ══════════════════════════════════════════════════════════════════════════

function extractKeywords(text) {
  const stopWords = new Set(['the','a','an','and','or','but','in','on','at','to','for','of','with','by','from','is','are','was','were','be','been','being','have','has','had','do','does','did','will','would','could','should','may','might','can','this','that','these','those','i','you','he','she','it','we','they','what','which','who','when','where','why','how','all','each','every','both','few','more','most','other','some','such','no','not','only','own','same','so','than','too','very','your','about','up','out','use','using','get','set','new','overview','introduction','learn','module','unit','describe','explain','define']);
  const words = text.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter(w => w.length > 2 && !stopWords.has(w));
  
  // Generate bigrams for phrase matching
  const bigrams = [];
  for (let i = 0; i < words.length - 1; i++) {
    bigrams.push(words[i] + ' ' + words[i + 1]);
  }
  
  return { words: [...new Set(words)], bigrams: [...new Set(bigrams)] };
}

function semanticScore(docKeywords, moduleData) {
  // Score how well a module covers a doc topic using multiple signals
  const { words: docWords, bigrams: docBigrams } = docKeywords;
  if (docWords.length === 0) return 0;

  // Extract module keywords from title + summary + units
  const moduleText = [
    moduleData.title,
    moduleData.summary || '',
    (moduleData.units || []).join(' '),
  ].join(' ');
  const modKw = extractKeywords(moduleText);

  // 1. Word overlap (basic)
  const modWordSet = new Set(modKw.words);
  const wordMatches = docWords.filter(w => modWordSet.has(w) || modKw.words.some(mw => (mw.includes(w) && w.length > 3) || (w.includes(mw) && mw.length > 3)));
  const wordScore = wordMatches.length / Math.max(docWords.length, 1);

  // 2. Bigram overlap (phrase-level)
  const modBigramSet = new Set(modKw.bigrams);
  const bigramMatches = docBigrams.filter(bg => modBigramSet.has(bg));
  const bigramScore = docBigrams.length > 0 ? bigramMatches.length / docBigrams.length : 0;

  // 3. Title direct match (high weight if doc topic appears in module title)
  const docTitleLower = docWords.join(' ');
  const modTitleLower = moduleData.title.toLowerCase();
  const titleContains = modTitleLower.includes(docTitleLower) || docTitleLower.includes(modTitleLower.replace(/[^a-z0-9\s]/g, ''));
  const titleBonus = titleContains ? 0.3 : 0;

  // Combined score with weights
  const combined = (wordScore * 0.4) + (bigramScore * 0.35) + titleBonus + Math.min(wordScore * bigramScore * 0.5, 0.25);
  return Math.min(combined, 1.0);
}

function keywordOverlap(a, b) {
  // Legacy compatibility — now unused by main analysis but kept for other callers
  const aWords = a.words || a;
  const bWords = b.words || b;
  if (aWords.length === 0 || bWords.length === 0) return 0;
  const setB = new Set(bWords);
  const matches = aWords.filter(w => setB.has(w) || bWords.some(bw => bw.includes(w) || w.includes(bw)));
  return matches.length / Math.max(aWords.length, 1);
}

function runClientGapAnalysis() {
  if (state.modules.length === 0 || state.flatDocTopics.length === 0) {
    toast('Load a product with both training and documentation first', 'warning');
    return;
  }

  const btn = document.getElementById('client-gap-btn');
  btn.disabled = true;
  btn.textContent = '⏳ Scanning…';

  setTimeout(() => {
    const results = state.flatDocTopics
      .filter(d => d.depth >= 1 && d.title.length > 3)
      .map(doc => {
        const docKeywords = extractKeywords(doc.title + (doc.path ? ' ' + doc.path : ''));
        let bestMatch = null;
        let bestScore = 0;
        let topMatches = [];

        for (const mod of state.modules) {
          const score = semanticScore(docKeywords, mod);
          if (score > bestScore) { bestScore = score; bestMatch = mod; }
          if (score >= 0.15) topMatches.push({ module: mod, score });
        }

        // Sort top matches and keep top 3
        topMatches = topMatches.sort((a, b) => b.score - a.score).slice(0, 3);

        const coverage = bestScore >= 0.45 ? 'covered' : bestScore >= 0.18 ? 'partial' : 'uncovered';

        // Generate contextual explanation
        let explanation = '';
        if (coverage === 'uncovered') {
          const docWords = docKeywords.words.slice(0, 5).join(', ');
          explanation = `No training module addresses the concepts of "${doc.title}". Key topics (${docWords}) are not covered in any existing module's title, summary, or units.`;
        } else if (coverage === 'partial') {
          const matchedWords = docKeywords.words.filter(w => 
            bestMatch && (bestMatch.title + ' ' + (bestMatch.summary || '')).toLowerCase().includes(w)
          );
          const missingWords = docKeywords.words.filter(w => !matchedWords.includes(w)).slice(0, 4);
          explanation = `"${bestMatch?.title}" touches on this topic but doesn't fully cover it. `;
          if (missingWords.length > 0) {
            explanation += `Missing aspects: ${missingWords.join(', ')}. `;
          }
          explanation += `Consider expanding the module or creating supplementary content.`;
        } else {
          explanation = `"${bestMatch?.title}" provides good coverage with ${bestMatch?.unitCount || 0} units. `;
          const ageMonths = bestMatch?.msDate ? Math.floor((Date.now() - new Date(bestMatch.msDate).getTime()) / (30*24*60*60*1000)) : null;
          if (ageMonths && ageMonths > 12) {
            explanation += `⚠️ Last updated ${ageMonths} months ago — verify content freshness.`;
          } else if (ageMonths) {
            explanation += `Content is recent (${ageMonths} months old).`;
          }
        }

        return {
          docTopic: doc,
          bestMatch: bestScore >= 0.15 ? bestMatch : null,
          topMatches,
          score: bestScore,
          coverage,
          explanation,
        };
      });

    const covered = results.filter(r => r.coverage === 'covered').length;
    const partial = results.filter(r => r.coverage === 'partial').length;
    const uncovered = results.filter(r => r.coverage === 'uncovered').length;
    const total = results.length;
    const coveragePct = total > 0 ? Math.round((covered + partial * 0.5) / total * 100) : 0;

    state.gapResults = { results, covered, partial, uncovered, total, coveragePct };
    moduleGapData = [];
    document.getElementById('gap-perspective').style.display = '';
    document.getElementById('persp-doc-btn').classList.add('active');
    document.getElementById('persp-module-btn').classList.remove('active');
    document.getElementById('gap-module-view').style.display = 'none';
    renderGapSummary();
    renderGapHeatmap(results);
    renderGapTimeline();
    renderGapResultCards(results);
    updateChatContextBar();
    document.getElementById('export-csv-btn').style.display = 'inline-flex';
    document.getElementById('export-html-btn').style.display = 'inline-flex';
    toast(`Gap analysis complete: ${coveragePct}% coverage`, 'success');

    btn.disabled = false;
    btn.textContent = '⚡ Quick scan';
  }, 100);
}

function renderGapSummary() {
  const g = state.gapResults;
  if (!g) return;
  const summary = document.getElementById('gap-summary');
  summary.style.display = 'block';
  document.getElementById('gap-total-docs').textContent = g.total;
  document.getElementById('gap-covered').textContent = g.covered;
  document.getElementById('gap-partial').textContent = g.partial;
  document.getElementById('gap-uncovered').textContent = g.uncovered;
  document.getElementById('gap-pct').textContent = g.coveragePct + '%';
  document.getElementById('gap-pct').style.color = g.coveragePct >= 70 ? 'var(--success)' : g.coveragePct >= 40 ? 'var(--warning)' : 'var(--danger)';

  const bar = document.getElementById('gap-coverage-bar');
  bar.innerHTML = `
    <div class="covered" style="width:${(g.covered/g.total*100).toFixed(1)}%;" title="Covered: ${g.covered}"></div>
    <div class="partial" style="width:${(g.partial/g.total*100).toFixed(1)}%;" title="Partial: ${g.partial}"></div>
    <div class="uncovered" style="width:${(g.uncovered/g.total*100).toFixed(1)}%;" title="Uncovered: ${g.uncovered}"></div>
  `;
}

function renderGapHeatmap(results) {
  const container = document.getElementById('gap-heatmap');
  const visuals = document.getElementById('gap-visuals');
  if (!results || results.length === 0) { visuals.style.display = 'none'; return; }
  visuals.style.display = 'block';

  container.innerHTML = results.map((r, i) => {
    const title = escHtml(r.docTopic.title);
    return `<div class="heatmap-cell ${r.coverage}" data-idx="${i}" onclick="selectGapItem(${i})" title="${title}"></div>`;
  }).join('');

  renderGapListUI(results, 'all');
}

function renderGapListUI(results, filter) {
  const container = document.getElementById('gap-list');
  const filtered = filter === 'all' ? results : results.filter(r => r.coverage === filter);
  container.innerHTML = filtered.map(r => {
    const i = state.gapResults.results.indexOf(r);
    const score = Math.round(r.score * 100);
    const matchTitle = r.bestMatch ? r.bestMatch.title : '';
    return `<div class="gap-list-item" data-idx="${i}" onclick="selectGapItem(${i})">
      <div class="dot ${r.coverage}"></div>
      <div style="flex:1;min-width:0;">
        <div class="item-title">${escHtml(r.docTopic.title)}</div>
        ${matchTitle ? `<div style="font-size:10px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">↳ ${escHtml(matchTitle)}</div>` : ''}
      </div>
      <div class="item-score">${score}%</div>
    </div>`;
  }).join('');
  if (filtered.length === 0) {
    container.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:20px;font-size:12px;">No topics in this category</div>';
  }
}

function filterGapList(filter) {
  if (!state.gapResults) return;
  document.querySelectorAll('#gap-list-filter button').forEach(btn => {
    const text = btn.textContent.toLowerCase();
    btn.classList.toggle('active', text.includes(filter === 'all' ? 'all' : filter));
  });
  renderGapListUI(state.gapResults.results, filter);
}

function selectGapItem(idx) {
  const g = state.gapResults;
  if (!g || !g.results[idx]) return;
  const r = g.results[idx];
  const panel = document.getElementById('gap-detail-panel');

  document.querySelectorAll('.heatmap-cell.selected').forEach(el => el.classList.remove('selected'));
  const cell = document.querySelector(`.heatmap-cell[data-idx="${idx}"]`);
  if (cell) cell.classList.add('selected');

  document.querySelectorAll('.gap-list-item.selected').forEach(el => el.classList.remove('selected'));
  const listItem = document.querySelector(`.gap-list-item[data-idx="${idx}"]`);
  if (listItem) { listItem.classList.add('selected'); listItem.scrollIntoView({ block: 'nearest' }); }

  const score = Math.round(r.score * 100);
  const statusIcon = r.coverage === 'covered' ? '✅' : r.coverage === 'partial' ? '⚠️' : '❌';
  const statusLabel = r.coverage === 'covered' ? 'Covered' : r.coverage === 'partial' ? 'Partially Covered' : 'Not Covered';
  const statusColor = r.coverage === 'covered' ? 'var(--success)' : r.coverage === 'partial' ? 'var(--warning)' : 'var(--danger)';

  // Top matches section
  let matchesHtml = '';
  if (r.topMatches && r.topMatches.length > 0) {
    matchesHtml = `
    <div class="detail-row">
      <div class="detail-label">Related modules</div>
      <div class="detail-value">
        ${r.topMatches.map((tm, i) => {
          const tmScore = Math.round(tm.score * 100);
          const tmColor = tm.score >= 0.45 ? 'var(--success)' : tm.score >= 0.18 ? 'var(--warning)' : 'var(--text-muted)';
          return `<div style="margin-bottom:6px;padding:6px 8px;background:var(--bg);border-radius:6px;border-left:3px solid ${tmColor};">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <strong style="font-size:12px;">${i === 0 ? '🏆 ' : ''}${escHtml(tm.module.title)}</strong>
              <span style="font-size:11px;color:${tmColor};font-weight:600;">${tmScore}%</span>
            </div>
            <div style="font-size:10px;color:var(--text-muted);margin-top:2px;">
              ${tm.module.msAuthor ? `👤 ${escHtml(tm.module.msAuthor)}` : ''} · 📅 ${tm.module.msDate || '?'} · 📦 ${tm.module.unitCount} units
            </div>
            <div style="margin-top:3px;">
              <a href="${tm.module.learnUrl}" target="_blank" style="font-size:10px;color:var(--primary);">Learn ↗</a>
              · <a href="${tm.module.ghUrl}" target="_blank" style="font-size:10px;color:var(--primary);">GitHub ↗</a>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }

  // AI explain button
  const aiExplainBtn = `<button class="btn btn-ghost btn-sm" style="margin-top:8px;font-size:11px;" onclick="aiExplainGap(${idx})">🤖 Get AI explanation</button>`;

  panel.innerHTML = `
  <div class="gap-detail-panel">
    <div class="detail-header">
      <span style="font-size:20px;">${statusIcon}</span>
      <h4>${escHtml(r.docTopic.title)}</h4>
      <button class="detail-close" onclick="closeGapDetail()">✕</button>
    </div>
    <div class="detail-row">
      <div class="detail-label">Status</div>
      <div class="detail-value"><span class="tag" style="background:${statusColor}20;color:${statusColor};">${statusLabel}</span></div>
    </div>
    <div class="detail-row">
      <div class="detail-label">Doc path</div>
      <div class="detail-value" style="font-size:11px;color:var(--text-muted);">${escHtml(r.docTopic.path)}</div>
    </div>
    <div class="detail-row">
      <div class="detail-label">Match score</div>
      <div class="detail-value">
        <div style="display:flex;align-items:center;gap:8px;">
          <div class="score-bar" style="flex:1;"><div class="score-fill" style="width:${score}%;background:${statusColor};"></div></div>
          <span style="font-weight:600;font-size:13px;">${score}%</span>
        </div>
      </div>
    </div>
    ${matchesHtml}
    <div class="detail-row">
      <div class="detail-label">Analysis</div>
      <div class="detail-value" style="line-height:1.6;font-size:12.5px;">${escHtml(r.explanation)}</div>
    </div>
    <div class="detail-row" id="gap-ai-explain-${idx}">
      <div class="detail-value">${aiExplainBtn}</div>
    </div>
  </div>`;
}

function closeGapDetail() {
  document.getElementById('gap-detail-panel').innerHTML = '';
  document.querySelectorAll('.heatmap-cell.selected').forEach(el => el.classList.remove('selected'));
  document.querySelectorAll('.gap-list-item.selected').forEach(el => el.classList.remove('selected'));
}

async function aiExplainGap(idx) {
  const g = state.gapResults;
  if (!g || !g.results[idx]) return;
  const r = g.results[idx];
  const container = document.getElementById(`gap-ai-explain-${idx}`);
  if (!container) return;

  const { token } = getAIConfig();
  if (!token) { toast('Add your GitHub token in Settings for AI features', 'warning'); return; }

  container.innerHTML = '<div class="detail-value"><span style="color:var(--text-muted);font-size:12px;">🤖 Analyzing…</span></div>';

  const modulesContext = (r.topMatches || []).map(tm =>
    `- "${tm.module.title}" (${tm.module.unitCount} units, score: ${Math.round(tm.score*100)}%)\n  Summary: ${(tm.module.summary || 'N/A').substring(0, 150)}\n  Units: ${(tm.module.units || []).slice(0, 5).join(', ')}`
  ).join('\n');

  const prompt = `You are a Microsoft Learn content strategist. Analyze this specific content gap and provide actionable insights.

DOCUMENTATION TOPIC: "${r.docTopic.title}"
Topic path: ${r.docTopic.path}
Coverage status: ${r.coverage} (${Math.round(r.score * 100)}% match)

CLOSEST TRAINING MODULES:
${modulesContext || 'None found — this topic has no related training content.'}

ALL AVAILABLE MODULES FOR THIS PRODUCT (${state.modules.length} total):
${state.modules.slice(0, 30).map(m => `- "${m.title}"`).join('\n')}

Provide a brief but insightful analysis (3-5 sentences) covering:
1. WHY this gap exists (is the topic too new, too niche, or was it overlooked?)
2. What SPECIFIC content would be needed to fill this gap
3. Whether existing modules could be EXPANDED vs needing a new module
4. PRIORITY level (high/medium/low) and reasoning

Respond in plain text, no JSON or markdown formatting.`;

  try {
    const reply = await callAI([{ role: 'user', content: prompt }], { maxTokens: 500 });
    container.innerHTML = `
    <div class="detail-label">🤖 AI Analysis</div>
    <div class="detail-value" style="line-height:1.6;font-size:12px;background:var(--bg);padding:10px;border-radius:8px;border-left:3px solid var(--primary);">
      ${escHtml(reply).replace(/\n/g, '<br>')}
    </div>`;
  } catch (e) {
    container.innerHTML = `<div class="detail-value" style="color:var(--danger);font-size:11px;">AI analysis failed: ${escHtml(e.message)}</div>`;
  }
}

