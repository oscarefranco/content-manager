// ══════════════════════════════════════════════════════════════════════════
// MODULE LIST (Modules view)
// ══════════════════════════════════════════════════════════════════════════

let currentModuleList = [];

function renderModuleList(modules) {
  currentModuleList = modules;
  const list = document.getElementById('module-list');
  if (!modules || modules.length === 0) {
    list.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📚</div><p>No training modules found</p></div>';
    return;
  }

  list.innerHTML = modules.map((m, i) => {
    const now = Date.now();
    const date = m.msDate ? new Date(m.msDate) : null;
    const ageMonths = date ? Math.floor((now - date.getTime()) / (30*24*60*60*1000)) : 99;
    const tagClass = ageMonths <= 3 ? 'tag-green' : ageMonths <= 12 ? 'tag-yellow' : 'tag-red';
    const dateStr = date ? date.toLocaleDateString('en-US', { month:'short', year:'numeric' }) : 'Unknown';

    return `
    <div class="module-item" onclick="toggleModuleExpand(this)" data-idx="${i}">
      <div class="module-item-header">
        <div class="module-item-icon">📄</div>
        <div class="module-item-meta">
          <h4>${escHtml(m.title)}</h4>
          <p>${m.unitCount} units · ${m.msAuthor ? `<strong>${escHtml(m.msAuthor)}</strong>` : '<em>no author</em>'} · Updated ${dateStr}  <span class="tag ${tagClass}">${dateStr}</span></p>
          <div class="module-tags">
            ${m.products.slice(0, 3).map(p => `<span class="tag tag-blue">${escHtml(p)}</span>`).join('')}
            ${m.msService ? `<span class="tag tag-purple">${escHtml(m.msService)}</span>` : ''}
            ${m.levels.map(l => `<span class="tag tag-green">${escHtml(l)}</span>`).join('')}
          </div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0;">
          <a href="${m.learnUrl}" target="_blank" class="btn btn-secondary btn-sm" onclick="event.stopPropagation();">Learn ↗</a>
          <a href="${m.ghUrl}" target="_blank" class="btn btn-ghost btn-sm" onclick="event.stopPropagation();" style="font-size:11px;">GitHub ↗</a>
        </div>
      </div>
      <div class="module-expand">
        ${m.summary ? `<p style="margin-bottom:8px;"><strong>Summary:</strong> ${escHtml(m.summary)}</p>` : ''}
        <p><strong>UID:</strong> <code style="font-family:'JetBrains Mono',monospace;font-size:11px;background:var(--bg);padding:2px 6px;border-radius:4px;">${escHtml(m.uid)}</code></p>
        <p><strong>Author:</strong> ${escHtml(m.author)} (ms.author: ${escHtml(m.msAuthor)})</p>
        <p><strong>ms.service:</strong> ${escHtml(m.msService)} · <strong>ms.update-cycle:</strong> ${escHtml(m.updateCycle || 'not set')}</p>
        ${m.units.length > 0 ? `<p style="margin-top:8px;"><strong>Units (${m.unitCount}):</strong></p><ol style="margin-left:1.5rem;font-size:11.5px;color:var(--text-muted);">${m.units.map(u => `<li>${escHtml(u)}</li>`).join('')}</ol>` : ''}
      </div>
    </div>`;
  }).join('');
}

function toggleModuleExpand(el) {
  el.classList.toggle('expanded');
}

function filterModules(q) {
  if (!q) { renderModuleList(getAuthorFilteredModules()); return; }
  const base = getAuthorFilteredModules();
  const filtered = base.filter(m =>
    m.title.toLowerCase().includes(q.toLowerCase()) ||
    m.summary.toLowerCase().includes(q.toLowerCase()) ||
    m.author.toLowerCase().includes(q.toLowerCase())
  );
  renderModuleList(filtered);
}

function filterByAuthor(author) {
  document.getElementById('module-search').value = '';
  renderModuleList(getAuthorFilteredModules(author));
}

function getAuthorFilteredModules(author) {
  const selected = author !== undefined ? author : document.getElementById('module-author-filter').value;
  if (!selected) return state.modules;
  return state.modules.filter(m => m.msAuthor === selected);
}

function populateAuthorFilter() {
  const select = document.getElementById('module-author-filter');
  const currentVal = select.value;
  while (select.options.length > 1) select.remove(1);
  
  // Collect unique ms.author values and count
  const authors = {};
  for (const m of state.modules) {
    const a = m.msAuthor || 'unknown';
    authors[a] = (authors[a] || 0) + 1;
  }
  
  // Sort by count descending
  const sorted = Object.entries(authors).sort((a, b) => b[1] - a[1]);
  for (const [author, count] of sorted) {
    const opt = document.createElement('option');
    opt.value = author;
    opt.textContent = `${author} (${count})`;
    select.appendChild(opt);
  }
  
  // Restore selection if still valid
  if (currentVal) select.value = currentVal;
}

function sortModules(by) {
  const sorted = [...getAuthorFilteredModules()];
  switch (by) {
    case 'title': sorted.sort((a, b) => a.title.localeCompare(b.title)); break;
    case 'date': sorted.sort((a, b) => new Date(b.msDate || 0) - new Date(a.msDate || 0)); break;
    case 'units': sorted.sort((a, b) => b.unitCount - a.unitCount); break;
  }
  renderModuleList(sorted);
}

