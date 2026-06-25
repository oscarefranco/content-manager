// ══════════════════════════════════════════════════════════════════════════
// AI GAP ANALYSIS
// ══════════════════════════════════════════════════════════════════════════

async function runAIGapAnalysis() {
  const { token } = getAIConfig();
  if (!token) { toast('Add your GitHub token in Settings first', 'warning'); openSettings(); return; }
  if (state.modules.length === 0) { toast('Load a product first', 'warning'); return; }
  if (state.flatDocTopics.length === 0) { toast('No documentation topics loaded — run Quick scan instead', 'warning'); return; }

  const btn = document.getElementById('ai-gap-btn');
  btn.disabled = true;
  btn.textContent = '⏳ Analyzing…';

  // Build rich context including summaries and units
  const moduleSummary = state.modules.slice(0, 40).map(m =>
    `- "${m.title}" [${m.unitCount} units, ms.author: ${m.msAuthor || '?'}, ms.date: ${m.msDate || '?'}]\n  Summary: ${(m.summary || 'N/A').substring(0, 120)}\n  Units: ${(m.units || []).slice(0, 4).map(u => u.split('.').pop()).join(', ')}`
  ).join('\n');

  const docSummary = state.flatDocTopics.filter(d => d.depth <= 2).slice(0, 100).map(d =>
    `${'  '.repeat(d.depth)}- ${d.title}${d.hasChildren ? ' (has sub-topics)' : ''}`
  ).join('\n');

  const prompt = `You are a senior content strategist for Microsoft Learn, specializing in "${state.selectedProduct.name}". Perform a comprehensive gap analysis comparing the training modules against the documentation.

IMPORTANT: Don't just match words. Analyze whether the CONCEPTS and SKILLS taught in training adequately prepare learners for what the documentation covers. Consider:
- Is the training teaching the right depth? (conceptual overview vs hands-on implementation)
- Are there documentation areas that represent NEW features not yet in training?
- Are modules outdated relative to current documentation?
- Are there critical user journeys documented but not trained on?

TRAINING MODULES (${state.modules.length} total, showing top 40 with details):
${moduleSummary}

DOCUMENTATION TABLE OF CONTENTS (${state.flatDocTopics.length} topics, top-level structure):
${docSummary}

Provide JSON only (no markdown fences):
{
  "coverage_score": <0-100>,
  "summary": "<2-3 sentence executive summary of the content health>",
  "key_insight": "<1 sentence: the most important finding>",
  "missing_from_training": [
    { "doc_topic": "<topic>", "priority": "high|medium|low", "reason": "<WHY this gap matters — what learners can't do without this>", "suggested_approach": "<expand existing module X OR create new module>" }
  ],
  "outdated_training": [
    { "module": "<title>", "issue": "<specific problem>", "evidence": "<what in the docs indicates this is outdated>", "recommendation": "<specific fix>" }
  ],
  "recommended_new_modules": [
    { "title": "<suggested title>", "covers": "<doc topics it would address>", "priority": "high|medium|low", "rationale": "<why this deserves its own module>" }
  ],
  "depth_gaps": [
    { "area": "<topic area>", "current_depth": "conceptual|overview|hands-on", "needed_depth": "hands-on|advanced|troubleshooting", "suggestion": "<what to add>" }
  ],
  "strengths": ["<specific well-covered areas with explanation>"],
  "quick_wins": [
    { "action": "<specific actionable step>", "impact": "<measurable benefit>", "effort": "low|medium|high" }
  ]
}`;

  try {
    const reply = await callAI([{ role: 'user', content: prompt }], { maxTokens: 4000 });
    try {
      const clean = reply.replace(/```json|```/g, '').trim();
      const analysis = JSON.parse(clean);
      renderAIGapResults(analysis);
    } catch {
      document.getElementById('gap-results').innerHTML = `<div class="card"><div class="card-body"><pre style="font-size:12px;white-space:pre-wrap;">${escHtml(reply)}</pre></div></div>`;
    }
  } catch (e) {
    if (e.message === 'NO_TOKEN') { toast('Add your GitHub token in Settings', 'warning'); openSettings(); }
    else toast(`AI analysis failed: ${e.message}`, 'warning');
  }

  btn.disabled = false;
  btn.textContent = '🤖 AI deep analysis';
}

function renderAIGapResults(data) {
  const container = document.getElementById('gap-results');
  const scoreColor = data.coverage_score >= 70 ? 'var(--success)' : data.coverage_score >= 40 ? 'var(--warning)' : 'var(--danger)';

  container.innerHTML = `
  <div style="margin-bottom:16px;">
    <div class="card">
      <div class="card-header"><span>📊</span><h3>AI Analysis Summary</h3><span style="margin-left:auto;font-size:20px;font-weight:600;color:${scoreColor};">${data.coverage_score}%</span></div>
      <div class="card-body">
        <p style="font-size:13.5px;margin-bottom:8px;">${escHtml(data.summary)}</p>
        ${data.key_insight ? `<p style="font-size:12.5px;padding:8px 12px;background:var(--primary)10;border-left:3px solid var(--primary);border-radius:4px;margin-bottom:8px;"><strong>Key insight:</strong> ${escHtml(data.key_insight)}</p>` : ''}
        ${data.strengths?.length ? `<div style="margin-top:10px;">${data.strengths.map(s => `<span style="display:inline-flex;align-items:center;gap:4px;font-size:12px;color:var(--success);margin-right:12px;margin-bottom:4px;">✓ ${escHtml(s)}</span>`).join('')}</div>` : ''}
      </div>
    </div>
  </div>
  <div class="gap-grid">
    <div class="gap-card">
      <div class="gap-card-header"><span style="font-size:18px;">🚨</span><h4>Missing from training</h4><span class="tag tag-red">${data.missing_from_training?.length || 0}</span></div>
      <div class="gap-card-body" style="max-height:400px;overflow-y:auto;">
        ${(data.missing_from_training || []).map(t => `<div class="gap-item" style="flex-direction:column;align-items:stretch;">
          <div style="display:flex;align-items:center;gap:8px;">
            <span class="tag tag-${t.priority==='high'?'red':t.priority==='medium'?'yellow':'blue'}" style="flex-shrink:0;">${t.priority}</span>
            <strong style="font-size:12px;">${escHtml(t.doc_topic)}</strong>
          </div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:4px;line-height:1.5;">${escHtml(t.reason)}</div>
          ${t.suggested_approach ? `<div style="font-size:11px;color:var(--primary);margin-top:2px;">→ ${escHtml(t.suggested_approach)}</div>` : ''}
        </div>`).join('')}
      </div>
    </div>
    <div class="gap-card">
      <div class="gap-card-header"><span style="font-size:18px;">🔄</span><h4>Outdated training</h4><span class="tag tag-yellow">${data.outdated_training?.length || 0}</span></div>
      <div class="gap-card-body" style="max-height:400px;overflow-y:auto;">
        ${(data.outdated_training || []).map(m => `<div class="gap-item" style="flex-direction:column;align-items:stretch;">
          <strong style="font-size:12px;">${escHtml(m.module)}</strong>
          <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">${escHtml(m.issue)}</div>
          ${m.evidence ? `<div style="font-size:10px;color:var(--warning);margin-top:2px;">Evidence: ${escHtml(m.evidence)}</div>` : ''}
          <div style="font-size:11px;color:var(--primary);margin-top:2px;">→ ${escHtml(m.recommendation)}</div>
        </div>`).join('')}
      </div>
    </div>
    <div class="gap-card">
      <div class="gap-card-header"><span style="font-size:18px;">✨</span><h4>Recommended new modules</h4><span class="tag tag-purple">${data.recommended_new_modules?.length || 0}</span></div>
      <div class="gap-card-body" style="max-height:400px;overflow-y:auto;">
        ${(data.recommended_new_modules || []).map(m => `<div class="gap-item" style="flex-direction:column;align-items:stretch;">
          <div style="display:flex;align-items:center;gap:8px;">
            <span class="tag tag-${m.priority==='high'?'red':m.priority==='medium'?'yellow':'blue'}" style="flex-shrink:0;">${m.priority}</span>
            <strong style="font-size:12px;">${escHtml(m.title)}</strong>
          </div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">Covers: ${escHtml(m.covers)}</div>
          ${m.rationale ? `<div style="font-size:11px;color:var(--text-light);margin-top:2px;">${escHtml(m.rationale)}</div>` : ''}
        </div>`).join('')}
      </div>
    </div>
    ${data.depth_gaps?.length ? `
    <div class="gap-card">
      <div class="gap-card-header"><span style="font-size:18px;">📐</span><h4>Depth gaps</h4><span class="tag tag-purple">${data.depth_gaps.length}</span></div>
      <div class="gap-card-body" style="max-height:400px;overflow-y:auto;">
        ${data.depth_gaps.map(d => `<div class="gap-item" style="flex-direction:column;align-items:stretch;">
          <strong style="font-size:12px;">${escHtml(d.area)}</strong>
          <div style="font-size:11px;margin-top:4px;display:flex;gap:8px;align-items:center;">
            <span class="tag tag-yellow">${escHtml(d.current_depth)}</span> → <span class="tag tag-green">${escHtml(d.needed_depth)}</span>
          </div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">${escHtml(d.suggestion)}</div>
        </div>`).join('')}
      </div>
    </div>` : ''}
    <div class="gap-card">
      <div class="gap-card-header"><span style="font-size:18px;">⚡</span><h4>Quick wins</h4><span class="tag tag-green">${data.quick_wins?.length || 0}</span></div>
      <div class="gap-card-body" style="max-height:400px;overflow-y:auto;">
        ${(data.quick_wins || []).map(q => `<div class="gap-item" style="flex-direction:column;align-items:stretch;">
          <div style="display:flex;align-items:center;gap:8px;">
            ${q.effort ? `<span class="tag tag-${q.effort==='low'?'green':q.effort==='medium'?'yellow':'red'}" style="flex-shrink:0;">${q.effort} effort</span>` : ''}
            <strong style="font-size:12px;">${escHtml(q.action)}</strong>
          </div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">${escHtml(q.impact)}</div>
        </div>`).join('')}
      </div>
    </div>
  </div>`;
  toast('AI gap analysis complete', 'success');
}

