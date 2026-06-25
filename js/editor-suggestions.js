// ══════════════════════════════════════════════════════════════════════════
// CONTENT EDITOR - AI ACTION RECOMMENDATION
// ══════════════════════════════════════════════════════════════════════════

async function analyzeGapAction(gap, modules) {
  // Check cache first
  const cacheKey = `action_${gap.docTopic.title}_${modules.length}`;
  if (state.editorCache[cacheKey]) {
    return state.editorCache[cacheKey];
  }

  const { token } = getAIConfig();
  if (!token) throw new Error('NO_TOKEN');

  // Build modules context (include ALL modules for better decision making)
  const modulesContext = modules.map(m => 
    `- Module: "${m.title}"
  Summary: ${(m.summary || 'No summary').substring(0, 200)}
  Units (${m.unitCount}): ${(m.units || []).slice(0, 6).join(', ')}${m.units.length > 6 ? '...' : ''}
  Path: ${m.path}`
  ).join('\n\n');

  const prompt = `You are a Microsoft Learn content strategist. Analyze this content gap and recommend the best action to address it.

GAP DETAILS:
- Documentation Topic: "${gap.docTopic.title}"
- Description: ${gap.docTopic.description || gap.docTopic.path || 'No description'}
- Current Coverage: ${gap.coverage} (score: ${Math.round((gap.score || 0) * 100)}%)
- Best Matching Module: ${gap.bestMatch ? `"${gap.bestMatch.title}" (${Math.round((gap.bestScore || 0) * 100)}% match)` : 'None'}

AVAILABLE MODULES (${modules.length} total):
${modulesContext}

ACTION TYPE PRIORITY ORDER:
1. EDIT_EXISTING - Modify existing unit content (MOST EFFICIENT - prefer if possible)
   Use when: Gap can be covered by updating/expanding an existing unit in a related module
   
2. ADD_TO_UNIT - Append new section to existing unit
   Use when: Gap needs distinct new section but fits within scope of existing unit
   
3. NEW_UNIT - Create new unit in existing module
   Use when: Gap needs standalone unit treatment but fits module's overall theme
   
4. NEW_MODULE - Create entirely new module (LAST RESORT - avoid if possible)
   Use when: No existing module is appropriate for this content

INSTRUCTIONS:
Recommend ONE action. Prefer actions higher in the priority order when possible.
Consider:
- Can existing content be expanded to cover this gap? → EDIT_EXISTING
- Does this fit naturally into an existing unit as a new section? → ADD_TO_UNIT
- Does this need its own unit but fits a module? → NEW_UNIT
- Is this completely unrelated to all existing modules? → NEW_MODULE

Return ONLY a JSON object with this exact structure:
{
  "actionType": "EDIT_EXISTING" | "ADD_TO_UNIT" | "NEW_UNIT" | "NEW_MODULE",
  "targetModule": "Module title here" or null,
  "targetUnit": "Unit title here" or null,
  "reasoning": "2-3 sentence explanation of why this action",
  "confidence": 0.0 to 1.0,
  "estimatedEffort": "low" | "medium" | "high"
}`;

  try {
    const reply = await callAI([{ role: 'user', content: prompt }], { 
      maxTokens: 600,
      temperature: 0.2  // Lower temperature for more consistent JSON output
    });
    
    // Parse JSON response
    let parsed;
    try {
      // Try to extract JSON if wrapped in markdown code blocks
      const jsonMatch = reply.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : reply);
    } catch (parseErr) {
      console.error('JSON parse failed:', reply);
      throw new Error('AI returned invalid JSON');
    }

    // Validate required fields
    if (!parsed.actionType || !ACTION_TYPES[parsed.actionType]) {
      throw new Error('Invalid actionType in AI response');
    }

    // Find actual module objects if targetModule is specified
    if (parsed.targetModule) {
      const foundModule = modules.find(m => 
        m.title.toLowerCase() === parsed.targetModule.toLowerCase()
      );
      if (foundModule) {
        parsed.targetModuleObject = foundModule;
      }
    }

    // Cache the result
    state.editorCache[cacheKey] = parsed;
    
    return parsed;
  } catch (e) {
    console.error('analyzeGapAction error:', e);
    throw new Error(`AI recommendation failed: ${e.message}`);
  }
}

function renderGapTimeline() {
  const container = document.getElementById('gap-timeline');
  if (state.modules.length === 0) return;
  const now = Date.now();
  const withDates = state.modules.filter(m => m.msDate);
  if (withDates.length === 0) { container.innerHTML = '<p class="text-xs text-muted">No modules with dates</p>'; return; }

  const oldest = Math.min(...withDates.map(m => new Date(m.msDate).getTime()));
  const range = now - oldest || 1;

  const sorted = [...withDates].sort((a, b) => new Date(a.msDate) - new Date(b.msDate)).slice(0, 25);
  container.innerHTML = sorted.map(m => {
    const date = new Date(m.msDate);
    const ageMonths = Math.floor((now - date.getTime()) / (30*24*60*60*1000));
    const pct = ((date.getTime() - oldest) / range * 100).toFixed(1);
    const color = ageMonths <= 3 ? 'var(--success)' : ageMonths <= 12 ? 'var(--warning)' : 'var(--danger)';
    const dateStr = date.toLocaleDateString('en-US', { month:'short', year:'numeric' });

    return `<div class="timeline-row">
      <div class="timeline-label" title="${escHtml(m.title)}">${escHtml(m.title)}</div>
      <div class="timeline-bar-wrap"><div class="timeline-bar" style="width:${Math.max(pct,3)}%;background:${color};"></div></div>
      <div class="timeline-date">${dateStr}</div>
    </div>`;
  }).join('');
}

function renderGapResultCards(results) {
  const container = document.getElementById('gap-results');
  const uncovered = results.filter(r => r.coverage === 'uncovered');
  const partial = results.filter(r => r.coverage === 'partial');
  const covered = results.filter(r => r.coverage === 'covered');

  container.innerHTML = `
  <div class="gap-grid">
    <div class="gap-card">
      <div class="gap-card-header"><span style="font-size:18px;">🚨</span><h4>Not covered</h4><span class="tag tag-red">${uncovered.length}</span></div>
      <div class="gap-card-body" style="max-height:400px;overflow-y:auto;">
        ${uncovered.slice(0, 30).map(r => `<div class="gap-item"><div class="gap-item-icon">❌</div><div class="gap-item-text"><strong>${escHtml(r.docTopic.title)}</strong><br><span style="font-size:10px;color:var(--text-light);">${escHtml(r.docTopic.path)}</span></div></div>`).join('')}
        ${uncovered.length > 30 ? `<p class="text-xs text-muted" style="padding:8px 0;">+ ${uncovered.length - 30} more</p>` : ''}
        ${uncovered.length === 0 ? '<p class="text-xs text-muted" style="padding:8px;">All topics have some coverage!</p>' : ''}
      </div>
    </div>
    <div class="gap-card">
      <div class="gap-card-header"><span style="font-size:18px;">⚠️</span><h4>Partially covered</h4><span class="tag tag-yellow">${partial.length}</span></div>
      <div class="gap-card-body" style="max-height:400px;overflow-y:auto;">
        ${partial.slice(0, 30).map(r => `<div class="gap-item"><div class="gap-item-icon">🔶</div><div class="gap-item-text"><strong>${escHtml(r.docTopic.title)}</strong>${r.bestMatch ? `<br><span style="font-size:10px;color:var(--primary);">Closest: ${escHtml(r.bestMatch.title)}</span>` : ''}</div></div>`).join('')}
      </div>
    </div>
    <div class="gap-card">
      <div class="gap-card-header"><span style="font-size:18px;">✅</span><h4>Covered</h4><span class="tag tag-green">${covered.length}</span></div>
      <div class="gap-card-body" style="max-height:400px;overflow-y:auto;">
        ${covered.slice(0, 30).map(r => `<div class="gap-item"><div class="gap-item-icon">✅</div><div class="gap-item-text"><strong>${escHtml(r.docTopic.title)}</strong>${r.bestMatch ? `<br><span style="font-size:10px;color:var(--success);">Match: ${escHtml(r.bestMatch.title)} (${Math.round(r.score*100)}%)</span>` : ''}</div></div>`).join('')}
      </div>
    </div>
  </div>`;
}
