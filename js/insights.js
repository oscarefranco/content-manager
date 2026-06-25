// ══════════════════════════════════════════════════════════════════════════
// GITHUB INSIGHTS VIEW
// ══════════════════════════════════════════════════════════════════════════

async function loadInsights() {
  const containers = ['commits-bizapps', 'commits-dynamics'];
  containers.forEach(id => showLoading(id));

  const fetchCommits = async (owner, repo, containerId) => {
    try {
      const url = `https://api.github.com/repos/${owner}/${repo}/commits?per_page=10`;
      const resp = await fetch(url, { headers: ghHeaders() });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const commits = await resp.json();
      const container = document.getElementById(containerId);
      container.innerHTML = commits.map(c => {
        const msg = (c.commit?.message || '').split('\n')[0];
        const author = c.commit?.author?.name || c.author?.login || '?';
        const date = c.commit?.author?.date ? new Date(c.commit.author.date).toLocaleDateString('en-US', {month:'short',day:'numeric',year:'numeric'}) : '?';
        const avatar = c.author?.avatar_url ? `<img src="${c.author.avatar_url}" width="28" height="28" style="border-radius:50%;">` : '<div class="commit-avatar">👤</div>';
        const sha = (c.sha || '').substring(0, 7);
        const commitUrl = c.html_url || '#';
        return `<div class="commit-item">
          ${avatar}
          <div class="commit-meta">
            <div class="commit-msg" title="${escHtml(msg)}">${escHtml(msg)}</div>
            <div class="commit-info">${escHtml(author)} · ${date} · <a href="${commitUrl}" target="_blank" style="color:var(--primary);text-decoration:none;font-family:'JetBrains Mono',monospace;">${sha}</a></div>
          </div>
        </div>`;
      }).join('');
    } catch (e) {
      document.getElementById(containerId).innerHTML = `<div class="empty-state" style="padding:1rem;"><p>Failed to load: ${escHtml(e.message)}</p></div>`;
    }
  };

  await Promise.all([
    fetchCommits('MicrosoftDocs', 'learn-bizapps-pr', 'commits-bizapps'),
    fetchCommits('MicrosoftDocs', 'learn-dynamics-pr', 'commits-dynamics'),
  ]);
}

function renderModulesByAuthor() {
  const container = document.getElementById('modules-by-author');
  if (state.modules.length === 0) {
    container.innerHTML = '<div class="empty-state" style="padding:1rem;"><p>Load a product first</p></div>';
    return;
  }

  const byAuthor = {};
  for (const m of state.modules) {
    const author = m.author || m.msAuthor || 'Unknown';
    if (!byAuthor[author]) byAuthor[author] = [];
    byAuthor[author].push(m);
  }

  const sorted = Object.entries(byAuthor).sort((a, b) => b[1].length - a[1].length);

  container.innerHTML = sorted.map(([author, mods]) => {
    const pct = Math.round(mods.length / state.modules.length * 100);
    return `<div style="padding:8px 0;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;">
      <div class="commit-avatar" style="font-size:10px;width:28px;height:28px;">👤</div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:12px;font-weight:500;">${escHtml(author)}</div>
        <div style="font-size:11px;color:var(--text-muted);">${mods.length} module${mods.length>1?'s':''} (${pct}%)</div>
      </div>
      <div style="width:80px;">
        <div class="progress-bar-wrap"><div class="progress-bar-fill" style="width:${pct}%;"></div></div>
      </div>
    </div>`;
  }).join('');
}

function renderUpdateCycles() {
  const container = document.getElementById('update-cycle-dist');
  if (state.modules.length === 0) {
    container.innerHTML = '<div class="empty-state" style="padding:1rem;"><p>Load a product first</p></div>';
    return;
  }

  const cycles = {};
  for (const m of state.modules) {
    const cycle = m.updateCycle || 'Not set';
    cycles[cycle] = (cycles[cycle] || 0) + 1;
  }

  const sorted = Object.entries(cycles).sort((a, b) => b[1] - a[1]);
  const total = state.modules.length;

  container.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:8px;">
      ${sorted.map(([cycle, count]) => {
        const pct = Math.round(count / total * 100);
        const color = cycle.includes('90') ? 'var(--success)' : cycle.includes('180') ? 'var(--warning)' : 'var(--primary)';
        return `<div style="display:flex;align-items:center;gap:10px;">
          <div style="width:120px;font-size:12px;font-weight:500;">${escHtml(cycle)}</div>
          <div style="flex:1;">
            <div class="progress-bar-wrap"><div class="progress-bar-fill" style="width:${pct}%;background:${color};"></div></div>
          </div>
          <div style="width:60px;text-align:right;font-size:12px;font-family:'JetBrains Mono',monospace;">${count} <span style="color:var(--text-light);font-size:10px;">(${pct}%)</span></div>
        </div>`;
      }).join('')}
    </div>
    <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border);font-size:11px;color:var(--text-muted);">
      Total: ${total} modules across ${sorted.length} update cycle categories
    </div>
  `;
}

