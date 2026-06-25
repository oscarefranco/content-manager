// ══════════════════════════════════════════════════════════════════════════
// INIT & PRODUCT SELECTION
// ══════════════════════════════════════════════════════════════════════════

async function init() {
  try {
    // Handle OAuth callback if redirected from GitHub
    await handleOAuthCallback();
  } catch (e) {
    console.warn('OAuth callback error:', e);
  }

  try { loadSettings(); } catch (e) { console.warn('loadSettings error:', e); }
  try { updateAuthBadge(); } catch (e) { console.warn('updateAuthBadge error:', e); }
  try { loadReleasePlannerFromCache(); } catch (e) { console.warn('loadReleasePlannerFromCache error:', e); }

  // Try GitHub Trees API first (rich data), fall back to public Catalog API
  let useGitHub = false;

   if (getToken()) {
    try {
      toast('Trying GitHub repo access…', 'info');
      const [bizTree, dynTree] = await Promise.allSettled([
        fetchRepoTree('MicrosoftDocs', 'learn-bizapps-pr'),
        fetchRepoTree('MicrosoftDocs', 'learn-dynamics-pr'),
      ]);

      const trees = {};
      if (bizTree.status === 'fulfilled') trees['learn-bizapps-pr'] = bizTree.value;
      else {
        console.warn('learn-bizapps-pr:', bizTree.reason?.message);
        toast(`learn-bizapps-pr: ${bizTree.reason?.message || 'access failed'}`, 'error');
      }
      if (dynTree.status === 'fulfilled') trees['learn-dynamics-pr'] = dynTree.value;
      else {
        console.warn('learn-dynamics-pr:', dynTree.reason?.message);
        toast(`learn-dynamics-pr: ${dynTree.reason?.message || 'access failed'}`, 'error');
      }

      if (Object.keys(trees).length > 0) {
        state.trees = trees;
        state.discoveredProducts = discoverProducts(trees);
        dataSourceMode = 'github';
        useGitHub = true;
        const repoNames = Object.keys(trees).join(' + ');
        toast(`GitHub mode: ${state.discoveredProducts.length} products from ${repoNames}`, 'success');
      } else {
        toast('Could not access either repo. Use Settings → Test Connection to diagnose.', 'error');
      }
    } catch (e) {
      console.warn('GitHub mode failed:', e);
      toast(`GitHub error: ${e.message}`, 'error');
    }
  }

  // Fallback (or supplement) with public Catalog API
  // ONLY use catalog if GitHub mode completely failed (no access to repos)
  if (!useGitHub) {
    try {
      toast('Loading from Microsoft Learn Catalog API…', 'info');
      const catalog = await fetchCatalog();
      const catalogProducts = buildProductsFromCatalog(catalog);
      dataSourceMode = 'catalog';
      state.discoveredProducts = catalogProducts;
      toast(`Catalog API: ${state.discoveredProducts.length} products loaded`, 'success');
    } catch (e) {
      toast(`Catalog API error: ${e.message}`, 'warning');
      console.error(e);
    }
  }

  renderProductSelector();
  renderDashboardTreeStats();

  const saved = localStorage.getItem('team_selected_product');
  if (saved) {
    document.getElementById('product-select').value = saved;
    onProductChange(saved);
  }
}

function updateAuthBadge() {
  const badge = document.getElementById('auth-badge');
  const loginBtn = document.getElementById('github-login-btn');
  const logoutBtn = document.getElementById('github-logout-btn');
  const hasToken = !!getToken();
  badge.style.display = hasToken ? 'none' : 'inline';
  loginBtn.style.display = hasToken ? 'none' : 'inline-block';
  logoutBtn.style.display = hasToken ? 'inline-block' : 'none';
}

function renderProductSelector() {
  const select = document.getElementById('product-select');
  while (select.options.length > 1) select.remove(1);

  const byRepo = {};
  for (const p of state.discoveredProducts) {
    if (!byRepo[p.repo]) byRepo[p.repo] = [];
    byRepo[p.repo].push(p);
  }

  for (const r of REPOS) {
    const products = byRepo[r.repo] || [];
    if (products.length === 0) continue;
    const grp = document.createElement('optgroup');
    grp.label = `${r.repo} — ${r.label}`;
    for (const p of products) {
      const opt = document.createElement('option');
      opt.value = p.folder;
      opt.textContent = `${p.folder} — ${p.name} (${p.modules.length} modules)`;
      grp.appendChild(opt);
    }
    select.appendChild(grp);
  }
}

function renderDashboardTreeStats() {
  const bizCount = state.discoveredProducts.filter(p => p.repo === 'learn-bizapps-pr').reduce((s, p) => s + p.modules.length, 0);
  const dynCount = state.discoveredProducts.filter(p => p.repo === 'learn-dynamics-pr').reduce((s, p) => s + p.modules.length, 0);
  document.getElementById('stat-bizapps').textContent = bizCount;
  document.getElementById('stat-dynamics').textContent = dynCount;
  document.getElementById('stat-products').textContent = state.discoveredProducts.length;
}

async function onProductChange(folder) {
  if (!folder) return;
  const product = state.discoveredProducts.find(p => p.folder === folder);
  if (!product) { toast('Product not found', 'warning'); return; }

  state.selectedProduct = product;
  localStorage.setItem('team_selected_product', folder);

  document.getElementById('topbar-title').textContent = `${product.folder} — Team Content Gap Manager`;
  document.getElementById('dashboard-subtitle').textContent = `Content analysis for ${product.folder} (${product.name})`;
  document.getElementById('modules-subtitle').textContent = `Training modules in ${product.folder}/ from ${product.repo}`;
  document.getElementById('docs-subtitle').textContent = `Documentation TOC for ${product.name}`;
  document.getElementById('stat-selected').textContent = product.folder;
  document.getElementById('stat-selected').style.fontSize = product.folder.length > 20 ? '13px' : '16px';
  const sourceLabel = dataSourceMode === 'github' ? product.repo : 'Catalog API';
  document.getElementById('stat-selected-sub').textContent = `${product.name} · ${product.modules.length} modules via ${sourceLabel}`;

  // Show progress and fetch modules
  showLoading('health-list');
  showLoading('module-list');
  const progressEl = document.getElementById('module-progress');
  const progressBar = document.getElementById('module-progress-bar');
  const progressText = document.getElementById('module-progress-text');
  progressEl.style.display = 'block';

  toast(`Loading ${product.modules.length} modules for ${product.name}…`, 'info');

  try {
    let modules;
    if (dataSourceMode === 'catalog' && product._catalogModules) {
      // Catalog mode: modules already parsed
      modules = product._catalogModules;
      progressBar.style.width = '100%';
      progressText.textContent = `Loaded ${modules.length} modules from Catalog API`;
    } else {
      // GitHub mode: fetch individual index.yml files
      modules = await fetchModuleData(product, (loaded, total) => {
        const pct = Math.round(loaded / total * 100);
        progressBar.style.width = pct + '%';
        progressText.textContent = `Loading ${total} modules… ${loaded}/${total}`;
      });
    }

    state.modules = modules;
    progressEl.style.display = 'none';
    populateAuthorFilter();

    // Load doc TOC
    state.docTopics = null;
    state.flatDocTopics = [];
    if (PRODUCT_DOC_TOC[product.name]) {
      toast(`Loading documentation TOC for ${product.name}…`, 'info');
      try {
        const toc = await fetchDocToc(product.name);
        if (toc) {
          state.docTopics = toc;
          state.flatDocTopics = flattenToc(toc);
        } else {
          toast('Documentation TOC could not be loaded', 'warning');
        }
      } catch (e) {
        toast('Documentation TOC fetch failed (CORS)', 'warning');
      }
    }

    state.gapResults = null;
    renderAll();
    toast(`Loaded ${modules.length} modules, ${state.flatDocTopics.length} doc topics`, 'success');
  } catch (e) {
    progressEl.style.display = 'none';
    toast(`Error: ${e.message}`, 'warning');
  }
}

async function refreshData() {
  clearAllCache();
  state.trees = {};
  state.discoveredProducts = [];
  await init();
}

// ══════════════════════════════════════════════════════════════════════════
// RENDER ALL
// ══════════════════════════════════════════════════════════════════════════

function renderAll() {
  renderQuickStats();
  renderHealthList();
  renderModuleList(state.modules);
  renderDocTree();
  renderModulesByAuthor();
  renderUpdateCycles();
  updateChatContextBar();
  document.getElementById('count-modules').textContent = state.modules.length;
  document.getElementById('count-docs').textContent = state.flatDocTopics.length;
  // Reset gap UI
  document.getElementById('gap-summary').style.display = 'none';
  document.getElementById('gap-visuals').style.display = 'none';
  document.getElementById('gap-results').innerHTML = '<div class="empty-state"><div class="empty-state-icon">🔍</div><p>Click Quick scan or AI deep analysis to compare training vs docs.</p></div>';
  document.getElementById('export-csv-btn').style.display = 'none';
  document.getElementById('export-html-btn').style.display = 'none';
  document.getElementById('gap-perspective').style.display = 'none';
  document.getElementById('gap-module-view').style.display = 'none';
  moduleGapData = [];
}

