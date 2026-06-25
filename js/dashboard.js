// ══════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════════════════════════════════

function renderQuickStats() {
  const body = document.getElementById('quick-stats-body');
  const badge = document.getElementById('quick-stats-product');
  if (!state.selectedProduct || state.modules.length === 0) {
    body.innerHTML = '<div class="empty-state" style="padding:1.5rem;"><p>Select a product to see stats</p></div>';
    badge.textContent = '';
    return;
  }

  badge.textContent = state.selectedProduct.name;
  const mods = state.modules;
  const dates = mods.filter(m => m.msDate).map(m => new Date(m.msDate));
  const now = Date.now();
  const avgAge = dates.length > 0 ? Math.round(dates.reduce((s, d) => s + (now - d.getTime()), 0) / dates.length / (30*24*60*60*1000)) : 0;
  const oldest = dates.length > 0 ? new Date(Math.min(...dates.map(d => d.getTime()))) : null;
  const totalUnits = mods.reduce((s, m) => s + m.unitCount, 0);

  body.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      <div><div style="font-size:11px;color:var(--text-light);text-transform:uppercase;letter-spacing:0.05em;">Modules</div><div style="font-size:22px;font-weight:600;font-family:'JetBrains Mono',monospace;">${mods.length}</div></div>
      <div><div style="font-size:11px;color:var(--text-light);text-transform:uppercase;letter-spacing:0.05em;">Total Units</div><div style="font-size:22px;font-weight:600;font-family:'JetBrains Mono',monospace;color:var(--primary);">${totalUnits}</div></div>
      <div><div style="font-size:11px;color:var(--text-light);text-transform:uppercase;letter-spacing:0.05em;">Avg Age</div><div style="font-size:22px;font-weight:600;font-family:'JetBrains Mono',monospace;color:${avgAge <= 6 ? 'var(--success)' : avgAge <= 12 ? 'var(--warning)' : 'var(--danger)'};">${avgAge}mo</div></div>
      <div><div style="font-size:11px;color:var(--text-light);text-transform:uppercase;letter-spacing:0.05em;">Oldest Module</div><div style="font-size:13px;font-weight:500;margin-top:4px;">${oldest ? oldest.toLocaleDateString('en-US',{month:'short',year:'numeric'}) : '—'}</div></div>
    </div>
    ${state.flatDocTopics.length > 0 ? `<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border);font-size:12px;color:var(--text-muted);">📖 ${state.flatDocTopics.length} documentation topics available for gap analysis</div>` : ''}
  `;
}

function renderHealthList() {
  const list = document.getElementById('health-list');
  if (state.modules.length === 0) {
    list.innerHTML = '<div class="empty-state" style="padding:2rem;"><p>No modules loaded</p></div>';
    return;
  }

  // Sort by date ascending = oldest first
  const sorted = [...state.modules]
    .filter(m => m.msDate)
    .sort((a, b) => new Date(a.msDate) - new Date(b.msDate))
    .slice(0, 10);

  const now = Date.now();
  list.innerHTML = sorted.map(m => {
    const date = new Date(m.msDate);
    const ageMonths = Math.floor((now - date.getTime()) / (30*24*60*60*1000));
    const color = ageMonths <= 3 ? 'var(--success)' : ageMonths <= 12 ? 'var(--warning)' : 'var(--danger)';
    const tagClass = ageMonths <= 3 ? 'tag-green' : ageMonths <= 12 ? 'tag-yellow' : 'tag-red';
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    const label = ageMonths <= 3 ? 'Current' : `${ageMonths}mo old`;

    return `
    <div style="padding:10px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;">
      <span style="font-size:14px;">📄</span>
      <div style="flex:1;min-width:0;">
        <p style="font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${escHtml(m.title)}">${escHtml(m.title)}</p>
        <p style="font-size:10px;color:var(--text-muted);margin-top:2px;">${m.author || '?'} · ${m.unitCount} units · ${dateStr}</p>
      </div>
      <span class="tag ${tagClass}">${label}</span>
    </div>`;
  }).join('');

  if (sorted.length === 0) {
    list.innerHTML = '<div class="empty-state" style="padding:2rem;"><p>No modules with dates found</p></div>';
  }
}
