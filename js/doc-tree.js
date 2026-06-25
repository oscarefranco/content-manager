// ══════════════════════════════════════════════════════════════════════════
// DOCUMENTATION TREE
// ══════════════════════════════════════════════════════════════════════════

function renderDocTree() {
  const container = document.getElementById('doc-tree-container');
  if (state.flatDocTopics.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📖</div><p>No documentation loaded. Select a product with documentation mapping.</p></div>';
    document.getElementById('doc-topic-total').textContent = '';
    return;
  }

  document.getElementById('doc-topic-total').textContent = `${state.flatDocTopics.length} topics`;

  const maxDepth = 3;
  const visible = state.flatDocTopics.filter(d => d.depth <= maxDepth);

  const productName = state.selectedProduct?.name || '';
  const tocEntry = PRODUCT_DOC_TOC[productName] || '';
  const tocPath = Array.isArray(tocEntry) ? tocEntry[0] : tocEntry;
  const basePath = tocPath.replace(/toc\.json$/, '');

  container.innerHTML = `<div class="doc-tree">${visible.map(d => {
    const indent = d.depth * 16;
    const icon = d.hasChildren ? '📁' : '📄';
    const weight = d.depth === 0 ? 'font-weight:600;' : d.depth === 1 ? 'font-weight:500;' : '';
    let docUrl = '';
    if (d.href && !d.href.startsWith('http') && d.href !== './') {
      docUrl = `https://learn.microsoft.com${basePath}${d.href}`;
    } else if (d.href && d.href.startsWith('http')) {
      docUrl = d.href;
    }
    const linkHtml = docUrl ? `<a href="${docUrl}" target="_blank" style="color:var(--primary);font-size:10px;text-decoration:none;flex-shrink:0;">open ↗</a>` : '';

    return `<div class="doc-tree-item" style="padding-left:${indent}px;">
      <span style="font-size:13px;">${icon}</span>
      <span style="flex:1;${weight}">${escHtml(d.title)}</span>
      ${linkHtml}
    </div>`;
  }).join('')}</div>`;
}

function filterDocs(q) {
  const container = document.getElementById('doc-tree-container');
  if (!q) { renderDocTree(); return; }
  const filtered = state.flatDocTopics.filter(d => d.title.toLowerCase().includes(q.toLowerCase()));
  container.innerHTML = `<div class="doc-tree">${filtered.map(d => `
    <div class="doc-tree-item">
      <span style="font-size:13px;">${d.hasChildren ? '📁' : '📄'}</span>
      <span style="flex:1;">${escHtml(d.title)}</span>
      <span class="text-xs text-muted">${escHtml(d.path)}</span>
    </div>
  `).join('')}</div>`;
}

