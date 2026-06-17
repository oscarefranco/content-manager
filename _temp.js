
// ══════════════════════════════════════════════════════════════════════════
// GITHUB OAUTH SSO
// ══════════════════════════════════════════════════════════════════════════

const OAUTH_CLIENT_ID = 'Ov23liqIsK38zHrDUlDj';
const OAUTH_PROXY_URL = 'https://github-oauth-proxy.oscarfranco.workers.dev';
const OAUTH_REDIRECT_URI = 'https://oscarefranco.github.io/content-manager/team.html';
const OAUTH_SCOPES = 'repo read:user';

function initiateGitHubLogin() {
  const state = crypto.randomUUID();
  localStorage.setItem('oauth_state', state);
  const authUrl = `https://github.com/login/oauth/authorize?client_id=${OAUTH_CLIENT_ID}&redirect_uri=${encodeURIComponent(OAUTH_REDIRECT_URI)}&scope=${encodeURIComponent(OAUTH_SCOPES)}&state=${state}`;
  window.location.href = authUrl;
}

async function handleOAuthCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const returnedState = params.get('state');
  if (!code) return false;

  // Validate state to prevent CSRF
  const savedState = localStorage.getItem('oauth_state');
  if (returnedState !== savedState) {
    console.error('OAuth state mismatch');
    toast('GitHub sign-in failed: state mismatch', 'warning');
    window.history.replaceState({}, '', window.location.pathname);
    return false;
  }
  localStorage.removeItem('oauth_state');

  // Clean URL immediately
  window.history.replaceState({}, '', window.location.pathname);

  try {
    const resp = await fetch(OAUTH_PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    const data = await resp.json();
    if (data.access_token) {
      localStorage.setItem('gh_models_token', data.access_token);
      localStorage.setItem('gh_auth_method', 'oauth');
      toast('✓ Signed in with GitHub successfully!', 'success');
      return true;
    } else {
      toast(`GitHub sign-in failed: ${data.error_description || data.error || 'Unknown error'}`, 'warning');
      return false;
    }
  } catch (e) {
    toast(`GitHub sign-in failed: ${e.message}`, 'warning');
    return false;
  }
}

function logoutGitHub() {
  localStorage.removeItem('gh_models_token');
  localStorage.removeItem('gh_auth_method');
  updateAuthBadge();
  toast('Signed out', 'info');
  location.reload();
}

// ══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ══════════════════════════════════════════════════════════════════════════

const REPOS = [
  { owner: 'MicrosoftDocs', repo: 'learn-bizapps-pr', label: 'Power Platform / Copilot Studio' },
  { owner: 'MicrosoftDocs', repo: 'learn-dynamics-pr', label: 'Dynamics 365' },
];

const FOLDER_PRODUCT_MAP = {
  // learn-bizapps-pr
  'power-virtual-agents': { name: 'Microsoft Copilot Studio', service: 'copilot-studio', repo: 'learn-bizapps-pr', catalogId: 'microsoft-copilot-studio', extraCatalogIds: ['ms-copilot'], titleMatch: /copilot studio|power virtual agent/i },
  'flow': { name: 'Power Automate', service: 'power-automate', repo: 'learn-bizapps-pr', catalogId: 'power-automate' },
  'powerapps': { name: 'Power Apps', service: 'power-apps', repo: 'learn-bizapps-pr', catalogId: 'power-apps' },
  'power-bi': { name: 'Power BI', service: 'power-bi', repo: 'learn-bizapps-pr', catalogId: 'power-bi' },
  'ai-builder': { name: 'AI Builder', service: 'ai-builder', repo: 'learn-bizapps-pr', catalogId: 'ai-builder' },
  'healthcare': { name: 'Healthcare', service: 'healthcare', repo: 'learn-bizapps-pr', catalogId: 'industry-healthcare' },
  'industry-solutions': { name: 'Industry Solutions', service: 'industry-solutions', repo: 'learn-bizapps-pr', catalogId: 'industry-solutions' },
  // learn-dynamics-pr
  'dyn365-finance': { name: 'Dynamics 365 Finance', service: 'dynamics-finance', repo: 'learn-dynamics-pr', catalogId: 'dynamics-finance' },
  'dyn365-supply-chain-management': { name: 'Dynamics 365 Supply Chain Management', service: 'dynamics-scm', repo: 'learn-dynamics-pr', catalogId: 'dynamics-scm' },
  'dyn365-commerce': { name: 'Dynamics 365 Commerce', service: 'dynamics-commerce', repo: 'learn-dynamics-pr', catalogId: 'dynamics-commerce' },
  'dyn365-sales': { name: 'Dynamics 365 Sales', service: 'dynamics-sales', repo: 'learn-dynamics-pr', catalogId: 'dynamics-sales' },
  'dyn365-customer-service': { name: 'Dynamics 365 Customer Service', service: 'dynamics-customer-service', repo: 'learn-dynamics-pr', catalogId: 'dynamics-customer-service' },
  'dyn365-field-service': { name: 'Dynamics 365 Field Service', service: 'dynamics-field-service', repo: 'learn-dynamics-pr', catalogId: 'dynamics-field-service' },
  'dyn365-business-central': { name: 'Dynamics 365 Business Central', service: 'dynamics-business-central', repo: 'learn-dynamics-pr', catalogId: 'dynamics-business-central' },
  'dyn365-human-resources': { name: 'Dynamics 365 Human Resources', service: 'dynamics-human-resources', repo: 'learn-dynamics-pr', catalogId: 'dynamics-human-resources' },
  'dyn365-project-operations': { name: 'Dynamics 365 Project Operations', service: 'dynamics-project-operations', repo: 'learn-dynamics-pr', catalogId: 'dynamics-project-operations' },
  'dyn365-finance-operations': { name: 'Dynamics 365 Finance & Operations', service: 'dynamics-finance-operations', repo: 'learn-dynamics-pr', catalogId: 'dynamics-finance' },
  'dyn365-customer-insights-data': { name: 'Customer Insights - Data', service: 'dynamics-ci-data', repo: 'learn-dynamics-pr', catalogId: 'customer-insights-data' },
  'dyn365-customer-insights-journeys': { name: 'Customer Insights - Journeys', service: 'dynamics-ci-journeys', repo: 'learn-dynamics-pr', catalogId: 'customer-insights-journeys' },
  'dyn365-contact-center': { name: 'Dynamics 365 Contact Center', service: 'dynamics-contact-center', repo: 'learn-dynamics-pr', catalogId: 'dynamics-contact-center' },
  'dyn365-fraud-protection': { name: 'Dynamics 365 Fraud Protection', service: 'dynamics-fraud-protection', repo: 'learn-dynamics-pr', catalogId: 'dynamics-fraud-protection' },
  'dyn365-intelligent-order-management': { name: 'Intelligent Order Management', service: 'dynamics-iom', repo: 'learn-dynamics-pr', catalogId: 'dynamics-iom' },
  'dyn365-fast-track': { name: 'Dynamics 365 Fast Track', service: 'dynamics-fast-track', repo: 'learn-dynamics-pr', catalogId: 'dynamics-365' },
  'copilot-for-finance': { name: 'Copilot for Finance', service: 'copilot-finance', repo: 'learn-dynamics-pr', catalogId: 'dynamics-finance' },
  'copilot-for-sales': { name: 'Copilot for Sales', service: 'copilot-sales', repo: 'learn-dynamics-pr', catalogId: 'dynamics-sales' },
  'copilot-for-service': { name: 'Copilot for Service', service: 'copilot-service', repo: 'learn-dynamics-pr', catalogId: 'dynamics-customer-service' },
  'power-platform': { name: 'Power Platform', service: 'power-platform', repo: 'learn-dynamics-pr', catalogId: 'power-platform' },
  'nuance': { name: 'Nuance', service: 'nuance', repo: 'learn-dynamics-pr', catalogId: 'nuance' },
};

const PRODUCT_DOC_TOC = {
  'Microsoft Copilot Studio': '/en-us/microsoft-copilot-studio/toc.json',
  'Power Apps': '/en-us/power-apps/toc.json',
  'Power Automate': '/en-us/power-automate/toc.json',
  'Power BI': '/en-us/power-bi/toc.json',
  'AI Builder': '/en-us/ai-builder/toc.json',
  'Dynamics 365 Finance': '/en-us/dynamics365/finance/toc.json',
  'Dynamics 365 Supply Chain Management': '/en-us/dynamics365/supply-chain/toc.json',
  'Dynamics 365 Sales': '/en-us/dynamics365/sales/toc.json',
  'Dynamics 365 Customer Service': '/en-us/dynamics365/customer-service/toc.json',
  'Dynamics 365 Commerce': '/en-us/dynamics365/commerce/toc.json',
  'Dynamics 365 Field Service': '/en-us/dynamics365/field-service/toc.json',
  'Dynamics 365 Business Central': '/en-us/dynamics365/business-central/toc.json',
  'Dynamics 365 Human Resources': '/en-us/dynamics365/human-resources/toc.json',
  'Dynamics 365 Project Operations': '/en-us/dynamics365/project-operations/toc.json',
  'Dynamics 365 Contact Center': '/en-us/dynamics365/contact-center/toc.json',
};

// ms.service value → doc TOC path (allows dynamic service-based lookup)
const SERVICE_DOC_TOC = {
  'copilot-studio': '/en-us/microsoft-copilot-studio/toc.json',
  'power-apps': '/en-us/power-apps/toc.json',
  'power-automate': '/en-us/power-automate/toc.json',
  'power-bi': '/en-us/power-bi/toc.json',
  'ai-builder': '/en-us/ai-builder/toc.json',
  'dynamics-finance': '/en-us/dynamics365/finance/toc.json',
  'dynamics-scm': '/en-us/dynamics365/supply-chain/toc.json',
  'dynamics-sales': '/en-us/dynamics365/sales/toc.json',
  'dynamics-customer-service': '/en-us/dynamics365/customer-service/toc.json',
  'dynamics-commerce': '/en-us/dynamics365/commerce/toc.json',
  'dynamics-field-service': '/en-us/dynamics365/field-service/toc.json',
  'dynamics-business-central': '/en-us/dynamics365/business-central/toc.json',
  'dynamics-human-resources': '/en-us/dynamics365/human-resources/toc.json',
  'dynamics-project-operations': '/en-us/dynamics365/project-operations/toc.json',
  'dynamics-contact-center': '/en-us/dynamics365/contact-center/toc.json',
  'power-platform': '/en-us/power-platform/toc.json',
};

const CORS_PROXIES = [
  url => `https://api.codetabs.com/v1/proxy/?quest=${url}`,
  url => `https://corsproxy.io/?${encodeURIComponent(url)}`,
];

const CONCURRENCY_LIMIT = 8;

// ══════════════════════════════════════════════════════════════════════════
// STATE
// ══════════════════════════════════════════════════════════════════════════

let state = {
  trees: {},           // { 'learn-bizapps-pr': [...], 'learn-dynamics-pr': [...] }
  repoBranches: {},    // { 'learn-bizapps-pr': 'main', 'learn-dynamics-pr': 'live' }
  discoveredProducts: [],  // [{ folder, name, repo, modules: [{path, ...}] }]
  selectedProduct: null,
  modules: [],         // Parsed module data for selected product
  docTopics: null,
  flatDocTopics: [],
  gapResults: null,
};

// ══════════════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════════════

function getToken() {
  return localStorage.getItem('gh_models_token') || '';
}

function getAIConfig() {
  return {
    token: getToken(),
    model: localStorage.getItem('gh_models_model') || 'openai/gpt-4.1-mini',
  };
}

function ghHeaders() {
  const h = { 'Accept': 'application/vnd.github.v3+json' };
  const t = getToken();
  if (t) h['Authorization'] = `Bearer ${t}`;
  return h;
}

function getCacheTTL() {
  return (parseInt(localStorage.getItem('team_cache_ttl') || '4')) * 60 * 60 * 1000;
}

function getCached(key) {
  try {
    const raw = localStorage.getItem(`team_${key}`);
    if (!raw) return null;
    const item = JSON.parse(raw);
    if (Date.now() - item.ts < getCacheTTL()) return item.data;
    localStorage.removeItem(`team_${key}`);
  } catch {}
  return null;
}

function setCache(key, data) {
  try {
    localStorage.setItem(`team_${key}`, JSON.stringify({ ts: Date.now(), data }));
  } catch {
    Object.keys(localStorage).filter(k => k.startsWith('team_')).forEach(k => localStorage.removeItem(k));
  }
}

function clearAllCache() {
  Object.keys(localStorage).filter(k => k.startsWith('team_')).forEach(k => localStorage.removeItem(k));
  toast('Cache cleared', 'info');
}

function toast(msg, type = 'info') {
  const container = document.getElementById('toasts');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  const icon = type === 'success' ? '✓' : type === 'warning' ? '⚠' : 'ℹ';
  t.innerHTML = `<span>${icon}</span> <span style="flex:1;">${msg}</span>`;
  container.appendChild(t);
  setTimeout(() => t.remove(), 4000);
}

function showLoading(el) {
  if (typeof el === 'string') el = document.getElementById(el);
  if (el) el.innerHTML = '<div class="loading-overlay"><div class="loading-spinner"></div> Loading…</div>';
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Run async tasks with concurrency limit
async function asyncPool(limit, items, fn) {
  const results = [];
  const executing = new Set();
  for (const [i, item] of items.entries()) {
    const p = Promise.resolve().then(() => fn(item, i));
    results.push(p);
    executing.add(p);
    const clean = () => executing.delete(p);
    p.then(clean, clean);
    if (executing.size >= limit) await Promise.race(executing);
  }
  return Promise.all(results);
}

// ══════════════════════════════════════════════════════════════════════════
// AI HELPER
// ══════════════════════════════════════════════════════════════════════════

async function callAI(messages, opts = {}) {
  const { token, model } = getAIConfig();
  if (!token) throw new Error('NO_TOKEN');
  const resp = await fetch('https://models.github.ai/inference/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: model,
      messages: messages,
      max_tokens: opts.maxTokens || 2000,
      temperature: opts.temperature || 0.3,
    }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message || `AI API error: ${resp.status}`);
  }
  const data = await resp.json();
  return data.choices[0].message.content;
}

// ══════════════════════════════════════════════════════════════════════════
// DATA SOURCE MODE — GitHub Trees (rich) or Catalog API (public fallback)
// ══════════════════════════════════════════════════════════════════════════

let dataSourceMode = 'catalog'; // 'github' or 'catalog'

// ── CATALOG API FALLBACK ─────────────────────────────────────────────────

async function fetchCatalog() {
  const cacheKey = 'catalog_full';
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const resp = await fetch('https://learn.microsoft.com/api/catalog/?type=modules,learningPaths');
  if (!resp.ok) throw new Error('Catalog API error ' + resp.status);
  const data = await resp.json();
  setCache(cacheKey, data);
  return data;
}

function buildProductsFromCatalog(catalog) {
  const products = [];

  for (const [folder, mapping] of Object.entries(FOLDER_PRODUCT_MAP)) {
    const catalogId = mapping.catalogId;
    if (!catalogId) continue;

    const extraIds = mapping.extraCatalogIds || [];
    const titleMatch = mapping.titleMatch || null;

    function matchesProduct(item) {
      if (!item.products) return false;
      if (item.products.some(p => p === catalogId || p.startsWith(catalogId))) return true;
      if (extraIds.length > 0) {
        const hitsExtra = item.products.some(p => extraIds.includes(p));
        if (hitsExtra && titleMatch) return titleMatch.test(item.title + ' ' + (item.summary || ''));
        return hitsExtra;
      }
      return false;
    }

    const modules = (catalog.modules || []).filter(matchesProduct);
    if (modules.length === 0) continue;

    // Convert catalog modules to our module format
    const parsedModules = modules.map(m => ({
      title: m.title || '',
      msDate: m.last_modified ? new Date(m.last_modified).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : '',
      msService: mapping.service,
      updateCycle: '',
      author: '',
      msAuthor: '',
      uid: m.uid || '',
      summary: m.summary || '',
      products: m.products || [],
      units: m.units || [],
      unitCount: (m.units || []).length,
      levels: m.levels || [],
      path: '',
      repo: mapping.repo,
      moduleFolder: m.uid ? m.uid.split('.').pop() : '',
      learnUrl: m.url || '',
      ghUrl: '',
      // Catalog-specific fields
      duration: m.duration_in_minutes || 0,
      lastModified: m.last_modified || '',
      iconUrl: m.icon_url || '',
    }));

    products.push({
      folder,
      name: mapping.name,
      service: mapping.service,
      repo: mapping.repo,
      owner: 'MicrosoftDocs',
      modules: parsedModules,
      _catalogModules: parsedModules, // Pre-parsed, no need to fetch YAML
    });
  }

  return products.sort((a, b) => a.name.localeCompare(b.name));
}

// ── GITHUB TREES API (rich mode — requires SSO auth) ─────────────────────

async function fetchRepoTree(owner, repo) {
  const cacheKey = `trees_${repo}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  if (!getToken()) throw new Error(`GitHub token required — these repos are private. Add your token in Settings.`);

  // Discover default branch first (repos may use main, master, or live)
  const repoResp = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers: ghHeaders() });
  if (!repoResp.ok) throw new Error(`Cannot access ${repo} (${repoResp.status}). These are private Microsoft repos — you need a Classic PAT with "repo" scope AND SSO authorized for the MicrosoftDocs org. Go to github.com/settings/tokens, create a Classic token, then click "Configure SSO" → Authorize for MicrosoftDocs.`);
  const repoInfo = await repoResp.json();
  const branch = repoInfo.default_branch || 'main';
  state.repoBranches[repo] = branch;

  const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
  const resp = await fetch(url, { headers: ghHeaders() });
  if (!resp.ok) throw new Error(`GitHub API error ${resp.status} for ${repo}`);
  const data = await resp.json();
  if (data.truncated) toast(`Warning: ${repo} tree was truncated — some modules may be missing`, 'warning');
  const tree = (data.tree || []).map(n => n.path);
  setCache(cacheKey, tree);
  return tree;
}

function discoverProducts(trees) {
  // Discover products by folder — each top-level folder = one product
  const products = [];

  for (const [repo, paths] of Object.entries(trees)) {
    const folderModules = {};
    const EXCLUDED_SUBFOLDERS = new Set(['includes', 'media', 'shared', 'resources', '_shared', 'zone-pivot-groups']);
    
    // Build a set of folders that contain unit yml files (hallmark of real modules)
    const foldersWithUnits = new Set();
    for (const p of paths) {
      // Unit files are typically: topFolder/moduleName/unitName.yml or topFolder/moduleName/unitName/content.yml
      const parts = p.split('/');
      if (parts.length >= 3 && parts[parts.length - 1].endsWith('.yml') && parts[parts.length - 1] !== 'index.yml') {
        // This folder has yml files besides index.yml — likely a real module
        const key = parts.slice(0, 2).join('/');
        foldersWithUnits.add(key);
      }
    }

    for (const p of paths) {
      if (p.includes('/index.yml') && !p.startsWith('paths/') && !p.includes('achievements/') && !p.includes('/includes/')) {
        const parts = p.split('/');
        // Only match direct module folders: topFolder/moduleName/index.yml (exactly 3 parts)
        if (parts.length === 3 && parts[2] === 'index.yml') {
          const topFolder = parts[0];
          const moduleName = parts[1];
          // Skip non-module subfolders
          if (EXCLUDED_SUBFOLDERS.has(moduleName)) continue;
          // Only include folders that also contain unit yml files
          const folderKey = `${topFolder}/${moduleName}`;
          if (!foldersWithUnits.has(folderKey)) continue;
          if (!folderModules[topFolder]) folderModules[topFolder] = [];
          folderModules[topFolder].push({
            path: p,
            moduleFolder: moduleName,
            fullPath: p,
          });
        }
      }
    }

    for (const [folder, modules] of Object.entries(folderModules)) {
      if (modules.length === 0) continue;
      // Use FOLDER_PRODUCT_MAP for friendly name if available
      const mapping = FOLDER_PRODUCT_MAP[folder];
      products.push({
        folder,
        name: mapping ? mapping.name : formatServiceName(folder),
        service: mapping ? mapping.service : folder,
        repo,
        owner: 'MicrosoftDocs',
        modules,
        folders: [{ name: folder, modules: [...modules] }],
      });
    }
  }

  return products.sort((a, b) => a.name.localeCompare(b.name));
}

function formatServiceName(service) {
  return service
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .replace(/\bDyn365\b/i, 'Dynamics 365')
    .replace(/\bPower\s/i, 'Power ');
}

// ══════════════════════════════════════════════════════════════════════════
// MODULE DATA FETCHING — YAML PARSING
// ══════════════════════════════════════════════════════════════════════════

function parseModuleYaml(text, path, repo) {
  const get = (pattern) => {
    const m = text.match(pattern);
    return m ? m[1].trim() : '';
  };

  const getList = (key) => {
    const pattern = new RegExp(`^${key}:\\s*\\n((?:\\s+-\\s+.+\\n?)*)`, 'm');
    const m = text.match(pattern);
    if (!m) return [];
    return m[1].split('\n').map(l => l.replace(/^\s*-\s*/, '').trim()).filter(Boolean);
  };

  const title = get(/^title:\s*(.+)$/m);
  const msDate = get(/^ms\.date:\s*(.+)$/m);
  const msService = get(/^ms\.service:\s*(.+)$/m);
  const updateCycle = get(/^ms\.update-cycle:\s*(.+)$/m);
  const author = get(/^author:\s*(.+)$/m);
  const msAuthor = get(/^ms\.author:\s*(.+)$/m);
  const uid = get(/^uid:\s*(.+)$/m);

  // Summary: multiline block scalar
  let summary = '';
  const sumMatch = text.match(/^summary:\s*\|\s*\n([\s\S]*?)(?=\n[a-zA-Z])/m);
  if (sumMatch) {
    summary = sumMatch[1].replace(/^\s{2}/gm, '').trim();
  } else {
    summary = get(/^summary:\s*(.+)$/m);
  }

  const products = getList('products');
  const units = getList('units');
  const levels = getList('levels');

  const parts = path.split('/');
  const moduleFolder = parts[parts.length - 2];
  const learnUrl = `https://learn.microsoft.com/en-us/training/modules/${moduleFolder}/`;
  const ghBranch = state.repoBranches[repo] || 'main';
  const ghUrl = `https://github.com/MicrosoftDocs/${repo}/tree/${ghBranch}/${path.replace(/\/index\.yml$/, '')}`;

  return {
    title: title || moduleFolder,
    msDate,
    msService,
    updateCycle,
    author,
    msAuthor,
    uid,
    summary,
    products,
    units,
    unitCount: units.length,
    levels,
    path,
    repo,
    moduleFolder,
    learnUrl,
    ghUrl,
  };
}

async function fetchModuleData(product, onProgress) {
  const cacheKey = `modules_${product.service || product.folder}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  let loaded = 0;
  const total = product.modules.length;

  const results = await asyncPool(CONCURRENCY_LIMIT, product.modules, async (mod) => {
    try {
      const branch = state.repoBranches[product.repo] || 'main';
      const url = `https://raw.githubusercontent.com/${product.owner}/${product.repo}/${branch}/${mod.path}`;
      const resp = await fetch(url, { headers: getToken() ? { 'Authorization': `Bearer ${getToken()}` } : {} });
      if (!resp.ok) return null;
      const text = await resp.text();
      loaded++;
      if (onProgress) onProgress(loaded, total);
      return parseModuleYaml(text, mod.path, product.repo);
    } catch {
      loaded++;
      if (onProgress) onProgress(loaded, total);
      return null;
    }
  });

  const modules = results.filter(Boolean);
  setCache(cacheKey, modules);
  return modules;
}

// ══════════════════════════════════════════════════════════════════════════
// DOCUMENTATION TOC
// ══════════════════════════════════════════════════════════════════════════

async function fetchWithCorsProxy(url) {
  try {
    const resp = await fetch(url);
    if (resp.ok) return await resp.json();
  } catch {}
  for (const makeProxy of CORS_PROXIES) {
    try {
      const proxyUrl = makeProxy(url);
      const resp = await fetch(proxyUrl);
      if (resp.ok) return await resp.json();
    } catch {}
  }
  return null;
}

async function fetchDocToc(productName) {
  const cacheKey = `toc_${productName.replace(/\s+/g, '_')}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const tocPath = PRODUCT_DOC_TOC[productName];
  if (!tocPath) return null;

  const url = `https://learn.microsoft.com${tocPath}`;
  const data = await fetchWithCorsProxy(url);
  if (data) setCache(cacheKey, data);
  return data;
}

async function fetchDocTocByPath(tocPath, cacheLabel) {
  const cacheKey = `toc_${(cacheLabel || tocPath).replace(/[\s\/]+/g, '_')}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const url = `https://learn.microsoft.com${tocPath}`;
  const data = await fetchWithCorsProxy(url);
  if (data) setCache(cacheKey, data);
  return data;
}

function flattenToc(toc, depth = 0, parentPath = '') {
  if (!toc) return [];
  const items = toc.items || toc.children || toc;
  if (!Array.isArray(items)) return [];
  let result = [];
  for (const item of items) {
    const title = item.toc_title || item.title || '';
    if (!title) continue;
    const path = parentPath ? `${parentPath} > ${title}` : title;
    result.push({
      title, path, depth,
      href: item.href || '',
      hasChildren: !!(item.children && item.children.length > 0),
    });
    if (item.children) {
      result = result.concat(flattenToc({ items: item.children }, depth + 1, path));
    }
  }
  return result;
}
// ══════════════════════════════════════════════════════════════════════════
// INIT & PRODUCT SELECTION
// ══════════════════════════════════════════════════════════════════════════

async function init() {
  // Handle OAuth callback if redirected from GitHub
  const oauthHandled = await handleOAuthCallback();
  
  loadSettings();
  updateAuthBadge();

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
      else console.warn('learn-bizapps-pr:', bizTree.reason?.message);
      if (dynTree.status === 'fulfilled') trees['learn-dynamics-pr'] = dynTree.value;
      else console.warn('learn-dynamics-pr:', dynTree.reason?.message);

      if (Object.keys(trees).length > 0) {
        state.trees = trees;
        state.discoveredProducts = discoverProducts(trees);
        dataSourceMode = 'github';
        useGitHub = true;
        const repoNames = Object.keys(trees).join(' + ');
        toast(`GitHub mode: ${state.discoveredProducts.length} folders from ${repoNames}`, 'success');
        if (bizTree.status === 'rejected') toast('⚠️ learn-bizapps-pr not accessible', 'warning');
        if (dynTree.status === 'rejected') toast('⚠️ learn-dynamics-pr not accessible', 'warning');
      }
    } catch (e) {
      console.warn('GitHub mode failed:', e);
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
      opt.value = p.folder; // Each folder is its own entry
      opt.textContent = `${p.name} (${p.modules.length} modules) · ${p.folder}`;
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
  // Find by folder (primary) or service (fallback for saved preferences)
  const product = state.discoveredProducts.find(p => p.folder === folder) 
    || state.discoveredProducts.find(p => p.service === folder);
  if (!product) { toast('Product not found', 'warning'); return; }

  state.selectedProduct = product;
  localStorage.setItem('team_selected_product', product.folder);

  document.getElementById('topbar-title').textContent = `${product.name} — Team Content Gap Manager`;
  document.getElementById('dashboard-subtitle').textContent = `Content analysis for ${product.name}`;
  document.getElementById('modules-subtitle').textContent = `Training modules for ${product.name} from ${product.repo}`;
  document.getElementById('docs-subtitle').textContent = `Documentation TOC for ${product.name}`;
  document.getElementById('stat-selected').textContent = product.name;
  document.getElementById('stat-selected').style.fontSize = product.name.length > 20 ? '13px' : '16px';
  const sourceLabel = dataSourceMode === 'github' ? product.repo : 'Catalog API';
  document.getElementById('stat-selected-sub').textContent = `${product.modules.length} modules via ${sourceLabel}`;

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

    // Load doc TOC — try service-based lookup first, then name-based
    state.docTopics = null;
    state.flatDocTopics = [];
    const tocPath = SERVICE_DOC_TOC[product.service] || PRODUCT_DOC_TOC[product.name];
    if (tocPath) {
      toast(`Loading documentation TOC for ${product.name}…`, 'info');
      try {
        const toc = await fetchDocTocByPath(tocPath, product.name);
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

  // Group modules by their source folder
  const product = state.selectedProduct;
  const folders = product && product.folders ? product.folders : null;

  let html = '';
  if (folders && folders.length > 1) {
    // Multi-folder grouping
    for (const folder of folders) {
      const folderModules = modules.filter(m => {
        // Match module to folder by checking its path
        return m.path && m.path.startsWith(folder.name + '/');
      });
      if (folderModules.length === 0) continue;
      html += `<div class="module-folder-group">
        <div class="module-folder-header" onclick="this.parentElement.classList.toggle('collapsed')">
          <span class="module-folder-icon">📁</span>
          <span class="module-folder-name">${escHtml(folder.name)}</span>
          <span class="module-folder-count">${folderModules.length} modules</span>
          <span class="module-folder-toggle">▾</span>
        </div>
        <div class="module-folder-body">
          ${folderModules.map((m, i) => renderModuleItem(m, modules.indexOf(m))).join('')}
        </div>
      </div>`;
    }
    // Any modules not matched to a folder
    const allFolderNames = folders.map(f => f.name);
    const ungrouped = modules.filter(m => !m.path || !allFolderNames.some(f => m.path.startsWith(f + '/')));
    if (ungrouped.length > 0) {
      html += `<div class="module-folder-group">
        <div class="module-folder-header" onclick="this.parentElement.classList.toggle('collapsed')">
          <span class="module-folder-icon">📁</span>
          <span class="module-folder-name">Other</span>
          <span class="module-folder-count">${ungrouped.length} modules</span>
          <span class="module-folder-toggle">▾</span>
        </div>
        <div class="module-folder-body">
          ${ungrouped.map((m, i) => renderModuleItem(m, modules.indexOf(m))).join('')}
        </div>
      </div>`;
    }
  } else {
    // Single folder or no folder info — flat list with folder label
    const folderName = folders && folders.length === 1 ? folders[0].name : '';
    if (folderName) {
      html += `<div style="padding:8px 12px;font-size:11px;color:var(--text-muted);border-bottom:1px solid var(--border);background:var(--surface2);border-radius:var(--radius) var(--radius) 0 0;">📁 ${escHtml(folderName)}</div>`;
    }
    html += modules.map((m, i) => renderModuleItem(m, i)).join('');
  }

  list.innerHTML = html;
}

function renderModuleItem(m, i) {
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
        <p>${m.unitCount} units · ${m.author || '?'} · Updated ${dateStr}  <span class="tag ${tagClass}">${dateStr}</span></p>
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
      <p><strong>Folder:</strong> <code style="font-family:'JetBrains Mono',monospace;font-size:11px;background:var(--bg);padding:2px 6px;border-radius:4px;">${escHtml(m.path || '')}</code></p>
      ${m.units.length > 0 ? `<p style="margin-top:8px;"><strong>Units (${m.unitCount}):</strong></p><ol style="margin-left:1.5rem;font-size:11.5px;color:var(--text-muted);">${m.units.map(u => `<li>${escHtml(u)}</li>`).join('')}</ol>` : ''}
    </div>
  </div>`;
}

function toggleModuleExpand(el) {
  el.classList.toggle('expanded');
}

function filterModules(q) {
  if (!q) { renderModuleList(state.modules); return; }
  const filtered = state.modules.filter(m =>
    m.title.toLowerCase().includes(q.toLowerCase()) ||
    m.summary.toLowerCase().includes(q.toLowerCase()) ||
    m.author.toLowerCase().includes(q.toLowerCase())
  );
  renderModuleList(filtered);
}

function sortModules(by) {
  const sorted = [...state.modules];
  switch (by) {
    case 'title': sorted.sort((a, b) => a.title.localeCompare(b.title)); break;
    case 'date': sorted.sort((a, b) => new Date(b.msDate || 0) - new Date(a.msDate || 0)); break;
    case 'units': sorted.sort((a, b) => b.unitCount - a.unitCount); break;
  }
  renderModuleList(sorted);
}

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
  const tocPath = PRODUCT_DOC_TOC[productName] || '';
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

// ══════════════════════════════════════════════════════════════════════════
// GAP ANALYSIS — CLIENT SIDE (KEYWORD)
// ══════════════════════════════════════════════════════════════════════════

function extractKeywords(text) {
  const stopWords = new Set(['the','a','an','and','or','but','in','on','at','to','for','of','with','by','from','is','are','was','were','be','been','being','have','has','had','do','does','did','will','would','could','should','may','might','can','this','that','these','those','i','you','he','she','it','we','they','what','which','who','when','where','why','how','all','each','every','both','few','more','most','other','some','such','no','not','only','own','same','so','than','too','very','your','about','up','out','use','using','get','set','new','overview','introduction']);
  return [...new Set(
    text.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/[\s-]+/)
      .filter(w => w.length > 2 && !stopWords.has(w))
  )];
}

function keywordOverlap(a, b) {
  if (a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b);
  const matches = a.filter(w => setB.has(w) || b.some(bw => bw.includes(w) || w.includes(bw)));
  return matches.length / Math.max(a.length, 1);
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
    const moduleKeywords = state.modules.map(m => ({
      ...m,
      keywords: extractKeywords(m.title + ' ' + m.summary)
    }));

    const results = state.flatDocTopics
      .filter(d => d.depth >= 1 && d.title.length > 3)
      .map(doc => {
        const docKeywords = extractKeywords(doc.title);
        let bestMatch = null;
        let bestScore = 0;
        for (const mod of moduleKeywords) {
          const score = keywordOverlap(docKeywords, mod.keywords);
          if (score > bestScore) { bestScore = score; bestMatch = mod; }
        }
        return {
          docTopic: doc,
          bestMatch: bestScore >= 0.3 ? bestMatch : null,
          score: bestScore,
          coverage: bestScore >= 0.5 ? 'covered' : bestScore >= 0.2 ? 'partial' : 'uncovered',
        };
      });

    const covered = results.filter(r => r.coverage === 'covered').length;
    const partial = results.filter(r => r.coverage === 'partial').length;
    const uncovered = results.filter(r => r.coverage === 'uncovered').length;
    const total = results.length;
    const coveragePct = total > 0 ? Math.round((covered + partial * 0.5) / total * 100) : 0;

    state.gapResults = { results, covered, partial, uncovered, total, coveragePct };
    moduleGapData = []; // Reset module-centric data on new scan
    document.getElementById('gap-perspective').style.display = '';
    // Ensure doc perspective is active
    document.getElementById('persp-doc-btn').classList.add('active');
    document.getElementById('persp-module-btn').classList.remove('active');
    document.getElementById('gap-module-view').style.display = 'none';
    renderGapSummary();
    renderGapHeatmap(results);
    renderGapTimeline();
    renderGapResultCards(results);
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
    return `<div class="gap-list-item" data-idx="${i}" onclick="selectGapItem(${i})">
      <div class="dot ${r.coverage}"></div>
      <div class="item-title">${escHtml(r.docTopic.title)}</div>
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

  let explanation = '';
  if (r.coverage === 'uncovered') {
    explanation = `<strong>No matching training module found.</strong> Consider creating a new module covering "${escHtml(r.docTopic.title)}".`;
  } else if (r.coverage === 'partial') {
    explanation = `<strong>Weak match:</strong> "${escHtml(r.bestMatch?.title || '—')}" (${score}% overlap). Consider expanding coverage.`;
  } else {
    explanation = `<strong>Good coverage:</strong> "${escHtml(r.bestMatch?.title || '—')}" matches with ${score}% overlap. Verify content freshness.`;
  }

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
    ${r.bestMatch ? `
    <div class="detail-row">
      <div class="detail-label">Best match</div>
      <div class="detail-value">
        <div><strong>${escHtml(r.bestMatch.title)}</strong></div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">
          ${r.bestMatch.author ? `👤 ${escHtml(r.bestMatch.author)}` : ''} · 📅 ${r.bestMatch.msDate || '?'} · 📦 ${r.bestMatch.unitCount} units
        </div>
        <a href="${r.bestMatch.ghUrl}" target="_blank" style="font-size:11px;color:var(--primary);">GitHub source ↗</a>
        · <a href="${r.bestMatch.learnUrl}" target="_blank" style="font-size:11px;color:var(--primary);">learn.microsoft.com ↗</a>
      </div>
    </div>` : ''}
    <div class="detail-row">
      <div class="detail-label">Analysis</div>
      <div class="detail-value" style="line-height:1.5;">${explanation}</div>
    </div>
  </div>`;
}

function closeGapDetail() {
  document.getElementById('gap-detail-panel').innerHTML = '';
  document.querySelectorAll('.heatmap-cell.selected').forEach(el => el.classList.remove('selected'));
  document.querySelectorAll('.gap-list-item.selected').forEach(el => el.classList.remove('selected'));
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

  const moduleSummary = state.modules.slice(0, 50).map(m =>
    `- "${m.title}" (${m.unitCount} units, author: ${m.author}, ms.date: ${m.msDate || 'unknown'})`
  ).join('\n');

  const docSummary = state.flatDocTopics.filter(d => d.depth <= 2).slice(0, 80).map(d =>
    `${'  '.repeat(d.depth)}- ${d.title}`
  ).join('\n');

  const prompt = `You are a content audit specialist for Microsoft Learn. Analyze the training modules and documentation for "${state.selectedProduct.name}" and provide a gap analysis.

TRAINING MODULES (${state.modules.length} total, showing top 50):
${moduleSummary}

DOCUMENTATION TABLE OF CONTENTS (${state.flatDocTopics.length} topics, showing top 80):
${docSummary}

Provide JSON only (no markdown):
{
  "coverage_score": 65,
  "summary": "Brief overall assessment",
  "missing_from_training": [
    { "doc_topic": "Topic name", "priority": "high|medium|low", "reason": "Why" }
  ],
  "outdated_training": [
    { "module": "Module title", "issue": "Issue", "recommendation": "Fix" }
  ],
  "recommended_new_modules": [
    { "title": "Title", "covers": "Topics", "priority": "high|medium|low" }
  ],
  "strengths": ["Well covered areas"],
  "quick_wins": [
    { "action": "What to do", "impact": "Expected benefit" }
  ]
}`;

  try {
    const reply = await callAI([{ role: 'user', content: prompt }], { maxTokens: 3000 });
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
        <p style="font-size:13.5px;">${escHtml(data.summary)}</p>
        ${data.strengths?.length ? `<div style="margin-top:10px;">${data.strengths.map(s => `<span style="display:inline-flex;align-items:center;gap:4px;font-size:12px;color:var(--success);margin-right:12px;">✓ ${escHtml(s)}</span>`).join('')}</div>` : ''}
      </div>
    </div>
  </div>
  <div class="gap-grid">
    <div class="gap-card">
      <div class="gap-card-header"><span style="font-size:18px;">🚨</span><h4>Missing from training</h4><span class="tag tag-red">${data.missing_from_training?.length || 0}</span></div>
      <div class="gap-card-body" style="max-height:400px;overflow-y:auto;">
        ${(data.missing_from_training || []).map(t => `<div class="gap-item"><span class="tag tag-${t.priority==='high'?'red':t.priority==='medium'?'yellow':'blue'}" style="flex-shrink:0;">${t.priority}</span><div class="gap-item-text"><strong>${escHtml(t.doc_topic)}</strong><br>${escHtml(t.reason)}</div></div>`).join('')}
      </div>
    </div>
    <div class="gap-card">
      <div class="gap-card-header"><span style="font-size:18px;">🔄</span><h4>Outdated training</h4><span class="tag tag-yellow">${data.outdated_training?.length || 0}</span></div>
      <div class="gap-card-body" style="max-height:400px;overflow-y:auto;">
        ${(data.outdated_training || []).map(m => `<div class="gap-item"><div class="gap-item-icon">📄</div><div class="gap-item-text"><strong>${escHtml(m.module)}</strong><br>${escHtml(m.issue)}<br><em style="color:var(--primary);">→ ${escHtml(m.recommendation)}</em></div></div>`).join('')}
      </div>
    </div>
    <div class="gap-card">
      <div class="gap-card-header"><span style="font-size:18px;">✨</span><h4>Recommended new modules</h4><span class="tag tag-purple">${data.recommended_new_modules?.length || 0}</span></div>
      <div class="gap-card-body" style="max-height:400px;overflow-y:auto;">
        ${(data.recommended_new_modules || []).map(m => `<div class="gap-item"><span class="tag tag-${m.priority==='high'?'red':m.priority==='medium'?'yellow':'blue'}" style="flex-shrink:0;">${m.priority}</span><div class="gap-item-text"><strong>${escHtml(m.title)}</strong><br>${escHtml(m.covers)}</div></div>`).join('')}
      </div>
    </div>
    <div class="gap-card">
      <div class="gap-card-header"><span style="font-size:18px;">⚡</span><h4>Quick wins</h4><span class="tag tag-green">${data.quick_wins?.length || 0}</span></div>
      <div class="gap-card-body" style="max-height:400px;overflow-y:auto;">
        ${(data.quick_wins || []).map(q => `<div class="gap-item"><div class="gap-item-icon">✓</div><div class="gap-item-text"><strong>${escHtml(q.action)}</strong><br>${escHtml(q.impact)}</div></div>`).join('')}
      </div>
    </div>
  </div>`;
  toast('AI gap analysis complete', 'success');
}

// ══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ══════════════════════════════════════════════════════════════════════════

function exportGapCSV() {
  const g = state.gapResults;
  if (!g) { toast('Run gap analysis first', 'warning'); return; }
  const rows = [['Doc Topic','Path','Coverage','Score %','Best Match','Module URL','Author','ms.date'].join(',')];
  for (const r of g.results) {
    rows.push([
      `"${(r.docTopic.title||'').replace(/"/g,'""')}"`,
      `"${(r.docTopic.path||'').replace(/"/g,'""')}"`,
      r.coverage,
      Math.round(r.score * 100),
      r.bestMatch ? `"${r.bestMatch.title.replace(/"/g,'""')}"` : '',
      r.bestMatch ? r.bestMatch.learnUrl : '',
      r.bestMatch ? r.bestMatch.author : '',
      r.bestMatch ? r.bestMatch.msDate : '',
    ].join(','));
  }
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `gap-analysis-${(state.selectedProduct?.name||'product').replace(/\s+/g,'-').toLowerCase()}-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  toast('CSV exported', 'success');
}

function exportGapHTML() {
  const g = state.gapResults;
  if (!g) { toast('Run gap analysis first', 'warning'); return; }
  const name = state.selectedProduct?.name || 'Product';
  const uncovered = g.results.filter(r => r.coverage === 'uncovered');
  const partial = g.results.filter(r => r.coverage === 'partial');
  const covered = g.results.filter(r => r.coverage === 'covered');

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Gap Analysis Report — ${escHtml(name)}</title>
<style>
  body { font-family: Segoe UI, sans-serif; max-width: 900px; margin: 2rem auto; padding: 0 1rem; color: #1a1c2e; }
  h1 { font-size: 22px; border-bottom: 2px solid #0078d4; padding-bottom: 8px; }
  h2 { font-size: 16px; margin-top: 2rem; color: #333; }
  .stats { display: flex; gap: 24px; margin: 1rem 0; }
  .stat { text-align: center; }
  .stat-val { font-size: 28px; font-weight: 700; }
  .stat-label { font-size: 11px; color: #666; text-transform: uppercase; }
  .bar { display: flex; height: 12px; border-radius: 6px; overflow: hidden; margin: 8px 0 24px; }
  .bar .g { background: #107c10; } .bar .y { background: #f59e0b; } .bar .r { background: #a4262c; opacity: 0.7; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; margin: 8px 0; }
  th { background: #f3f4f8; text-align: left; padding: 6px 10px; font-weight: 600; font-size: 11px; text-transform: uppercase; color: #666; }
  td { padding: 5px 10px; border-bottom: 1px solid #e1e4ec; }
  .footer { margin-top: 2rem; font-size: 11px; color: #999; border-top: 1px solid #e1e4ec; padding-top: 8px; }
</style></head><body>
<h1>📊 Gap Analysis Report — ${escHtml(name)}</h1>
<p>Generated ${new Date().toLocaleString()} · ${g.total} doc topics analyzed against ${state.modules.length} training modules<br>Source: ${state.selectedProduct?.repo || ''}</p>
<div class="stats">
  <div class="stat"><div class="stat-val">${g.coveragePct}%</div><div class="stat-label">Coverage</div></div>
  <div class="stat"><div class="stat-val" style="color:#107c10;">${g.covered}</div><div class="stat-label">Covered</div></div>
  <div class="stat"><div class="stat-val" style="color:#f59e0b;">${g.partial}</div><div class="stat-label">Partial</div></div>
  <div class="stat"><div class="stat-val" style="color:#a4262c;">${g.uncovered}</div><div class="stat-label">Uncovered</div></div>
</div>
<div class="bar">
  <div class="g" style="width:${(g.covered/g.total*100).toFixed(1)}%;"></div>
  <div class="y" style="width:${(g.partial/g.total*100).toFixed(1)}%;"></div>
  <div class="r" style="width:${(g.uncovered/g.total*100).toFixed(1)}%;"></div>
</div>
<h2>🚨 Not Covered (${uncovered.length})</h2>
<table><tr><th>Documentation Topic</th><th>Path</th></tr>
${uncovered.map(r => `<tr><td>${escHtml(r.docTopic.title)}</td><td style="font-size:11px;color:#666;">${escHtml(r.docTopic.path)}</td></tr>`).join('')}
</table>
<h2>⚠️ Partially Covered (${partial.length})</h2>
<table><tr><th>Documentation Topic</th><th>Closest Training</th><th>Score</th></tr>
${partial.map(r => `<tr><td>${escHtml(r.docTopic.title)}</td><td>${escHtml(r.bestMatch?.title||'—')}</td><td>${Math.round(r.score*100)}%</td></tr>`).join('')}
</table>
<h2>✅ Covered (${covered.length})</h2>
<table><tr><th>Documentation Topic</th><th>Training Match</th><th>Score</th></tr>
${covered.map(r => `<tr><td>${escHtml(r.docTopic.title)}</td><td>${escHtml(r.bestMatch?.title||'—')}</td><td>${Math.round(r.score*100)}%</td></tr>`).join('')}
</table>
<div class="footer">Generated by Team Content Gap Manager — BizApps &amp; Dynamics</div>
</body></html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `gap-report-${(name).replace(/\s+/g,'-').toLowerCase()}-${new Date().toISOString().slice(0,10)}.html`;
  a.click();
  toast('HTML report exported', 'success');
}
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

// ══════════════════════════════════════════════════════════════════════════
// MODULE-CENTRIC GAP VIEW
// ══════════════════════════════════════════════════════════════════════════

let moduleGapData = [];
let moduleGapFilter = { status: 'all', search: '' };

function toggleGapPerspective(mode) {
  const isModule = mode === 'module';

  document.getElementById('persp-doc-btn').classList.toggle('active', !isModule);
  document.getElementById('persp-module-btn').classList.toggle('active', isModule);

  // Show/hide doc-centric elements
  const docEls = ['gap-summary', 'gap-visuals', 'gap-results'];
  docEls.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (isModule) {
      el.style.display = 'none';
    } else {
      if (id === 'gap-summary') el.style.display = state.gapResults ? 'block' : 'none';
      else if (id === 'gap-visuals') el.style.display = state.gapResults ? 'block' : 'none';
      else el.style.display = '';
    }
  });

  document.getElementById('gap-module-view').style.display = isModule ? '' : 'none';

  if (isModule && moduleGapData.length === 0 && state.gapResults) {
    buildModuleGapMap();
  }
}

function buildModuleGapMap() {
  if (!state.gapResults || state.modules.length === 0) return;

  const gapResults = state.gapResults.results;

  moduleGapData = state.modules.map(mod => {
    const modKeywords = extractKeywords(mod.title + ' ' + (mod.summary || ''));

    // Find doc topics where this module is the bestMatch
    const directMatches = gapResults.filter(r => r.bestMatch && r.bestMatch.title === mod.title);

    // Find ALL related doc topics by keyword relevance to this module
    const relatedTopics = gapResults
      .map(r => {
        const docKeywords = extractKeywords(r.docTopic.title + ' ' + (r.docTopic.path || ''));
        const relevance = keywordOverlap(modKeywords, docKeywords);
        return { ...r, moduleRelevance: relevance };
      })
      .filter(r => r.moduleRelevance > 0.15)
      .sort((a, b) => b.moduleRelevance - a.moduleRelevance);

    const strongTopics = relatedTopics.filter(r => r.moduleRelevance >= 0.4);
    const moderateTopics = relatedTopics.filter(r => r.moduleRelevance >= 0.2 && r.moduleRelevance < 0.4);
    const weakTopics = relatedTopics.filter(r => r.moduleRelevance < 0.2);

    // Module's gap score: average relevance of related topics weighted by coverage
    const score = relatedTopics.length > 0
      ? Math.round(relatedTopics.reduce((s, r) => {
          const covBonus = r.coverage === 'covered' ? 1 : r.coverage === 'partial' ? 0.5 : 0.1;
          return s + r.moduleRelevance * covBonus;
        }, 0) / relatedTopics.length * 100)
      : 0;

    const hasGaps = relatedTopics.some(r => r.coverage === 'uncovered' && r.moduleRelevance >= 0.2);

    return {
      module: mod,
      directMatches,
      relatedTopics,
      strongTopics,
      moderateTopics,
      weakTopics,
      gapScore: Math.min(score, 100),
      hasGaps,
    };
  });

  // Sort: modules with gaps first, then by gap score ascending
  moduleGapData.sort((a, b) => {
    if (a.hasGaps !== b.hasGaps) return a.hasGaps ? -1 : 1;
    return a.gapScore - b.gapScore;
  });

  renderModuleGapList();
}

function renderModuleGapList() {
  const list = document.getElementById('mgap-list');
  let filtered = moduleGapData;

  if (moduleGapFilter.search) {
    const q = moduleGapFilter.search.toLowerCase();
    filtered = filtered.filter(d =>
      d.module.title.toLowerCase().includes(q) ||
      (d.module.summary || '').toLowerCase().includes(q) ||
      (d.module.author || '').toLowerCase().includes(q)
    );
  }

  if (moduleGapFilter.status === 'has-gaps') {
    filtered = filtered.filter(d => d.hasGaps);
  } else if (moduleGapFilter.status === 'good') {
    filtered = filtered.filter(d => !d.hasGaps);
  }

  document.getElementById('mgap-count').textContent = `${filtered.length} of ${moduleGapData.length}`;

  if (filtered.length === 0) {
    list.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:24px;font-size:12px;">No modules match this filter</div>';
    return;
  }

  list.innerHTML = filtered.map(d => {
    const idx = moduleGapData.indexOf(d);
    const color = d.hasGaps ? 'var(--danger)' : d.gapScore >= 40 ? 'var(--success)' : 'var(--warning)';
    const dotClass = d.hasGaps ? 'uncovered' : d.gapScore >= 40 ? 'covered' : 'partial';
    const age = d.module.msDate
      ? `${Math.floor((Date.now() - new Date(d.module.msDate).getTime()) / (30 * 24 * 60 * 60 * 1000))}mo`
      : '?';

    return `<div class="mgap-module-item" data-midx="${idx}" onclick="selectModuleGap(${idx})">
      <div class="dot ${dotClass}"></div>
      <div class="item-title">
        <h5 title="${escHtml(d.module.title)}">${escHtml(d.module.title)}</h5>
        <p>${d.relatedTopics.length} related topics · ${d.module.unitCount} units · ${age}</p>
      </div>
      <div class="item-score" style="color:${color};">${d.gapScore}%</div>
    </div>`;
  }).join('');
}

function selectModuleGap(idx) {
  const d = moduleGapData[idx];
  if (!d) return;

  // Highlight selection
  document.querySelectorAll('#mgap-list .mgap-module-item').forEach(el => el.classList.remove('selected'));
  const item = document.querySelector(`#mgap-list .mgap-module-item[data-midx="${idx}"]`);
  if (item) { item.classList.add('selected'); item.scrollIntoView({ block: 'nearest' }); }

  const body = document.getElementById('mgap-detail-body');
  document.getElementById('mgap-detail-title').textContent = d.module.title;

  const mod = d.module;
  const age = mod.msDate ? Math.floor((Date.now() - new Date(mod.msDate).getTime()) / (30 * 24 * 60 * 60 * 1000)) : null;
  const ageTag = age !== null ? (age <= 3 ? 'tag-green' : age <= 12 ? 'tag-yellow' : 'tag-red') : 'tag-blue';
  const ageLabel = age !== null ? (age <= 3 ? 'Current' : `${age}mo old`) : 'No date';
  const gapColor = d.hasGaps ? 'var(--danger)' : d.gapScore >= 40 ? 'var(--success)' : 'var(--warning)';

  function renderTopicRows(topics, showBg) {
    return topics.map(r => {
      const icon = r.coverage === 'covered' ? '✅' : r.coverage === 'partial' ? '⚠️' : '❌';
      const rel = Math.round(r.moduleRelevance * 100);
      const canFix = r.coverage === 'uncovered' || r.coverage === 'partial';
      const fixBtn = canFix
        ? `<button class="mgap-edit-btn" onclick="event.stopPropagation(); navigateToEditorForGap('${escHtml(r.docTopic.title.replace(/'/g, "\\\'"))}', '${r.coverage}');" title="Open in Content Editor">✏️ Fix</button>`
        : '';
      return `<div class="mgap-topic-row ${showBg ? 'strong' : ''}">
        <span>${icon}</span>
        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escHtml(r.docTopic.path)}">${escHtml(r.docTopic.title)}</span>
        ${fixBtn}
        <span style="font-size:10px;font-family:'JetBrains Mono',monospace;color:var(--text-muted);flex-shrink:0;">${rel}%</span>
      </div>`;
    }).join('');
  }

  const uncoveredGaps = d.relatedTopics.filter(r => r.coverage === 'uncovered' && r.moduleRelevance >= 0.2);

  body.innerHTML = `
    <div style="margin-bottom:14px;">
      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
        <span class="tag ${ageTag}">${ageLabel}</span>
        <span class="tag tag-blue">${mod.unitCount} units</span>
        ${mod.author ? `<span class="tag tag-purple">👤 ${escHtml(mod.author)}</span>` : ''}
        ${mod.msService ? `<span class="tag tag-blue">${escHtml(mod.msService)}</span>` : ''}
      </div>
      ${mod.summary ? `<p style="font-size:12px;color:var(--text-muted);margin-top:8px;line-height:1.5;">${escHtml(mod.summary)}</p>` : ''}
      <div style="display:flex;gap:8px;margin-top:8px;">
        ${mod.learnUrl ? `<a href="${mod.learnUrl}" target="_blank" class="btn btn-secondary btn-sm">Learn ↗</a>` : ''}
        ${mod.ghUrl ? `<a href="${mod.ghUrl}" target="_blank" class="btn btn-ghost btn-sm">GitHub ↗</a>` : ''}
        ${d.hasGaps ? `<button class="btn btn-primary btn-sm" onclick="navigateToEditorForModule(${idx})" style="margin-left:auto;">✏️ Fix Gaps in Editor</button>` : ''}
      </div>
    </div>

    <div style="margin-bottom:14px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
        <strong style="font-size:13px;">Documentation Coverage</strong>
        <span style="font-weight:600;color:${gapColor};font-family:'JetBrains Mono',monospace;">${d.gapScore}%</span>
      </div>
      <div class="score-bar" style="margin-bottom:4px;">
        <div class="score-fill" style="width:${d.gapScore}%;background:${gapColor};"></div>
      </div>
      <div style="font-size:11px;color:var(--text-muted);">
        ${d.relatedTopics.length} related doc topics · ${d.strongTopics.length} strong · ${d.moderateTopics.length} moderate · ${d.weakTopics.length} weak
      </div>
    </div>

    ${d.strongTopics.length > 0 ? `
    <div class="mgap-detail-section">
      <h4><span style="color:var(--success);">●</span> Strong Matches (${d.strongTopics.length})</h4>
      <div style="display:flex;flex-direction:column;gap:2px;">
        ${renderTopicRows(d.strongTopics, true)}
      </div>
    </div>` : ''}

    ${d.moderateTopics.length > 0 ? `
    <div class="mgap-detail-section">
      <h4><span style="color:var(--warning);">●</span> Moderate Matches (${d.moderateTopics.length})</h4>
      <div style="display:flex;flex-direction:column;gap:2px;">
        ${renderTopicRows(d.moderateTopics.slice(0, 20), false)}
        ${d.moderateTopics.length > 20 ? `<div style="font-size:11px;color:var(--text-muted);padding:4px 8px;">+ ${d.moderateTopics.length - 20} more</div>` : ''}
      </div>
    </div>` : ''}

    ${d.weakTopics.length > 0 ? `
    <div class="mgap-detail-section">
      <details>
        <summary style="font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px;">
          <span style="color:var(--text-light);">●</span> Weak Matches (${d.weakTopics.length})
        </summary>
        <div style="display:flex;flex-direction:column;gap:2px;margin-top:4px;">
          ${renderTopicRows(d.weakTopics.slice(0, 15), false)}
          ${d.weakTopics.length > 15 ? `<div style="font-size:10px;color:var(--text-light);padding:2px 8px;">+ ${d.weakTopics.length - 15} more</div>` : ''}
        </div>
      </details>
    </div>` : ''}

    ${d.relatedTopics.length === 0 ? `
    <div class="mgap-gap-box no-gaps">
      <p style="font-size:12px;color:var(--text-muted);">No related documentation topics found. This module may cover a niche area not reflected in the doc TOC.</p>
    </div>` : ''}

    ${uncoveredGaps.length > 0 ? `
    <div class="mgap-gap-box has-gaps">
      <h4 style="color:var(--danger);">🚨 Content Gaps (${uncoveredGaps.length})</h4>
      <p style="font-size:11px;color:var(--text-muted);margin-bottom:6px;">These documentation topics are relevant to this module but have no training coverage:</p>
      <ul>
        ${uncoveredGaps.slice(0, 10).map(r =>
          `<li>
            <span><strong>${escHtml(r.docTopic.title)}</strong> <span style="font-size:10px;color:var(--text-muted);">(${Math.round(r.moduleRelevance * 100)}% relevance)</span></span>
            <button class="mgap-edit-btn" style="opacity:1;" onclick="event.stopPropagation(); navigateToEditorForGap('${escHtml(r.docTopic.title.replace(/'/g, "\\\\'"))}', 'uncovered');" title="Create content in Editor">✏️ Fix</button>
          </li>`
        ).join('')}
        ${uncoveredGaps.length > 10 ? `<li style="color:var(--text-muted);">+ ${uncoveredGaps.length - 10} more</li>` : ''}
      </ul>
      <button class="mgap-fix-all-btn" onclick="navigateToEditorForModule(${idx})">
        🛠️ Fix All ${uncoveredGaps.length} Gaps in Content Editor
      </button>
    </div>` : !d.hasGaps && d.relatedTopics.length > 0 ? `
    <div class="mgap-gap-box no-gaps">
      <p style="font-size:12px;color:var(--success);font-weight:500;">✅ Good coverage — no major content gaps detected for related documentation topics.</p>
    </div>` : ''}
  `;
}

function filterModuleGapList(q) {
  moduleGapFilter.search = q;
  renderModuleGapList();
}

function filterModuleGapStatus(status) {
  moduleGapFilter.status = status;
  document.querySelectorAll('#mgap-filter button').forEach(btn => {
    const text = btn.textContent.toLowerCase();
    btn.classList.toggle('active',
      status === 'all' ? text.includes('all') :
      status === 'has-gaps' ? text.includes('gaps') :
      text.includes('good')
    );
  });
  renderModuleGapList();
}

// ══════════════════════════════════════════════════════════════════════════
// GAP → EDITOR NAVIGATION
// ══════════════════════════════════════════════════════════════════════════

function navigateToEditorForGap(topicTitle, coverageType) {
  // Ensure suggestions exist
  if (editorState.suggestions.length === 0) {
    buildEditorSuggestions();
  }

  // Switch to editor view
  switchView('editor');

  const targetTab = coverageType === 'uncovered' ? 'new' : coverageType === 'partial' ? 'update' : 'outdated';
  const titleLower = topicTitle.toLowerCase();
  let bestIdx = -1;

  for (let i = 0; i < editorState.suggestions.length; i++) {
    const s = editorState.suggestions[i];
    if (s.type !== targetTab) continue;

    if (s.type === 'new') {
      // Match if any topic in the group matches
      if (s.topics && s.topics.some(t => t.title.toLowerCase() === titleLower)) {
        bestIdx = i; break;
      }
      // Also match by title/category
      if (s.title.toLowerCase().includes(titleLower) || titleLower.includes(s.category.toLowerCase())) {
        bestIdx = i;
      }
    } else if (s.type === 'update') {
      if (s.docTopic && s.docTopic.title.toLowerCase() === titleLower) {
        bestIdx = i; break;
      }
      if (s.title.toLowerCase().includes(titleLower)) {
        bestIdx = i;
      }
    }
  }

  switchEditorTab(targetTab);

  if (bestIdx >= 0) {
    selectSuggestion(bestIdx);
    setTimeout(() => {
      const card = document.querySelector('.suggestion-card.selected');
      if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);
    toast(`Found matching suggestion for "${topicTitle}"`, 'success');
  } else {
    toast(`Opened editor — browse ${targetTab} suggestions for related content`, 'info');
  }
}

function navigateToEditorForModule(moduleIdx) {
  const d = moduleGapData[moduleIdx];
  if (!d) return;

  // Ensure suggestions exist
  if (editorState.suggestions.length === 0) {
    buildEditorSuggestions();
  }

  switchView('editor');

  // Collect all suggestion indices related to this module's gaps
  const modTitle = d.module.title.toLowerCase();
  const uncoveredTitles = d.relatedTopics
    .filter(r => r.coverage === 'uncovered' && r.moduleRelevance >= 0.2)
    .map(r => r.docTopic.title.toLowerCase());
  const partialTitles = d.relatedTopics
    .filter(r => r.coverage === 'partial' && r.moduleRelevance >= 0.2)
    .map(r => r.docTopic.title.toLowerCase());

  // Find the best single suggestion to highlight
  let bestIdx = -1;
  let bestTab = 'new';

  for (let i = 0; i < editorState.suggestions.length; i++) {
    const s = editorState.suggestions[i];

    // Check if this is a "new" suggestion targeting this module
    if (s.type === 'new' && s.targetModule && s.targetModule.title.toLowerCase() === modTitle) {
      bestIdx = i; bestTab = 'new'; break;
    }

    // Check if this is a "new" suggestion with matching uncovered topics
    if (s.type === 'new' && s.topics) {
      const match = s.topics.some(t => uncoveredTitles.includes(t.title.toLowerCase()));
      if (match && bestIdx === -1) { bestIdx = i; bestTab = 'new'; }
    }

    // Check if this is an update suggestion for this module
    if (s.type === 'update' && s.module && s.module.title.toLowerCase() === modTitle) {
      if (bestIdx === -1) { bestIdx = i; bestTab = 'update'; }
    }

    // Check if this is an update suggestion with matching partial topics
    if (s.type === 'update' && s.docTopic) {
      if (partialTitles.includes(s.docTopic.title.toLowerCase()) && bestIdx === -1) {
        bestIdx = i; bestTab = 'update';
      }
    }

    // Check if this is an outdated suggestion for this module
    if (s.type === 'outdated' && s.module && s.module.title.toLowerCase() === modTitle) {
      if (bestIdx === -1) { bestIdx = i; bestTab = 'outdated'; }
    }
  }

  switchEditorTab(bestTab);

  if (bestIdx >= 0) {
    selectSuggestion(bestIdx);
    setTimeout(() => {
      const card = document.querySelector('.suggestion-card.selected');
      if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);
  }

  const gapCount = uncoveredTitles.length + partialTitles.length;
  toast(`Opened editor for "${d.module.title}" — ${gapCount} gap${gapCount !== 1 ? 's' : ''} to address`, 'info');
}

// ══════════════════════════════════════════════════════════════════════════
// URL FETCHING & CONTENT EXTRACTION (ported from url_fetcher.py)
// ══════════════════════════════════════════════════════════════════════════

function parseGitHubUrl(url) {
  try {
    const u = new URL(url);
    if (!['github.com', 'www.github.com'].includes(u.hostname)) return null;
    const parts = u.pathname.replace(/^\//, '').split('/').filter(Boolean);
    if (parts.length < 2) return null;
    const info = { owner: parts[0], repo: parts[1], ref: null, path: '' };
    if (parts.length >= 4 && ['blob', 'tree'].includes(parts[2])) {
      info.ref = parts[3];
      info.path = parts.slice(4).join('/');
    } else if (parts.length > 2) {
      info.path = parts.slice(2).join('/');
    }
    return info;
  } catch { return null; }
}

function deriveSlug(url, title) {
  try {
    const u = new URL(url);
    const parts = u.pathname.replace(/^\//, '').replace(/\/$/, '').split('/').filter(Boolean);
    const base = parts.length > 0 ? parts[parts.length - 1] : title;
    return base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'untitled-module';
  } catch {
    return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'untitled-module';
  }
}

async function fetchUrlContent(url) {
  const ghInfo = parseGitHubUrl(url);
  if (ghInfo) return await fetchGitHubContentForEditor(ghInfo, url);

  // Try direct fetch first, then CORS proxies
  const proxies = [
    u => u, // direct
    u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
    u => `https://corsproxy.io/?${encodeURIComponent(u)}`,
  ];
  for (const proxy of proxies) {
    try {
      const resp = await fetch(proxy(url), {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(15000),
      });
      if (!resp.ok) continue;
      const html = await resp.text();
      if (html.length < 100) continue;
      return extractContentFromHtml(html, url);
    } catch {}
  }
  throw new Error('Failed to fetch URL. The page may block cross-origin requests.');
}

async function fetchGitHubContentForEditor(ghInfo, originalUrl) {
  const token = getToken();
  const headers = { 'Accept': 'application/vnd.github.v3+json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let apiUrl = `https://api.github.com/repos/${ghInfo.owner}/${ghInfo.repo}/contents/${ghInfo.path}`;
  if (ghInfo.ref) apiUrl += `?ref=${ghInfo.ref}`;

  const resp = await fetch(apiUrl, { headers });
  if (!resp.ok) throw new Error(`GitHub API ${resp.status} — ensure your token has repo access`);
  const data = await resp.json();

  let rawText = '';
  let title = '';
  if (data.type === 'file') {
    rawText = atob(data.content);
  } else if (Array.isArray(data)) {
    const parts = [];
    for (const item of data) {
      if (item.type !== 'file') continue;
      const fileResp = await fetch(item.url, { headers });
      if (!fileResp.ok) continue;
      const fileData = await fileResp.json();
      parts.push(`\n--- File: ${item.path} ---\n\n${atob(fileData.content)}`);
    }
    rawText = parts.join('\n');
  }

  // Extract title from first heading
  for (const line of rawText.split('\n')) {
    if (line.trim().startsWith('# ')) { title = line.trim().replace(/^#\s+/, ''); break; }
  }
  if (!title) title = ghInfo.path.split('/').pop() || ghInfo.repo;

  const slug = deriveSlug(originalUrl, title);
  const description = rawText.substring(0, 200).replace(/\n/g, ' ').trim();

  return { url: originalUrl, title, description, rawText: rawText.trim(), slug };
}

function extractContentFromHtml(html, url) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Remove noise
  doc.querySelectorAll('script, style, nav, footer, header, aside').forEach(el => el.remove());

  // Title
  let title = '';
  const h1 = doc.querySelector('h1');
  if (h1) title = h1.textContent.trim();
  if (!title) { const t = doc.querySelector('title'); if (t) title = t.textContent.trim(); }

  // Description
  let description = '';
  const metaDesc = doc.querySelector('meta[name="description"]');
  if (metaDesc) description = metaDesc.getAttribute('content') || '';

  // Main content
  const main = doc.querySelector('main') || doc.querySelector('article') || doc.querySelector('body');
  const rawText = main ? main.innerText.replace(/\n{3,}/g, '\n\n').replace(/[ \t]+/g, ' ').trim() : '';

  const slug = deriveSlug(url, title);
  return { url, title, description, rawText, slug };
}

// ══════════════════════════════════════════════════════════════════════════
// PROMPT TEMPLATES (ported from prompts.py)
// ══════════════════════════════════════════════════════════════════════════

function formatSourceContent(title, description, rawText) {
  let parts = [`# Source Material\n\n**Title:** ${title}`];
  if (description) parts.push(`**Description:** ${description}`);
  parts.push(`\n**Content:**\n${rawText.substring(0, 24000)}`);
  return parts.join('\n');
}

const ID_SYSTEM_PROMPT = `You are an expert instructional designer who creates professional \
training content following Microsoft Learn module conventions. You produce clear, \
well-structured markdown content that follows instructional design best practices:

- Use Bloom's taxonomy action verbs for learning objectives
- Apply scaffolding: build from foundational to advanced concepts
- Use clear, concise language appropriate for a professional audience
- Include real-world context and practical examples
- Format output as clean, well-structured markdown

Always output ONLY the markdown content, with no preamble or explanation.`;

const MODULE_PROMPTS = {
  overview(title, desc, text) {
    const source = formatSourceContent(title, desc, text);
    return {
      system: ID_SYSTEM_PROMPT,
      user: `${source}\n\n---\n\nBased on the source material above, generate a **Module Overview** page in markdown with:\n\n1. **Module Title** — as an H1 heading\n2. **Overview paragraph** — 2-3 sentences describing what this module covers and why it matters\n3. **Learning Objectives** — a bulleted list starting with "In this module, you'll learn to:" using Bloom's taxonomy verbs (describe, explain, identify, implement, configure, evaluate, etc.)\n4. **Prerequisites** — what learners should know or have before starting\n5. **Estimated Time** — reasonable estimate based on content depth (e.g., "30 minutes")\n\nKeep it concise and professional.`,
    };
  },

  introduction(title, desc, text) {
    const source = formatSourceContent(title, desc, text);
    return {
      system: ID_SYSTEM_PROMPT,
      user: `${source}\n\n---\n\nBased on the source material above, generate an **Introduction** unit in markdown with:\n\n1. **H1 title**: "Introduction to [topic]"\n2. **Context setting** — why this topic matters, the problem it solves, or the scenario it addresses (2-3 paragraphs)\n3. **Scope** — what this module covers and what it does not\n4. **Key terminology** — define 3-5 key terms that will appear throughout the module in a brief glossary format\n5. **What's next** — a brief sentence transitioning to the concepts unit\n\nUse engaging, professional language. Ground the content in real-world use cases.`,
    };
  },

  identifyAreas(title, desc, text) {
    const source = formatSourceContent(title, desc, text);
    return {
      system: 'You are an expert instructional designer. Analyze source material and identify its logical topic areas. Respond ONLY with a JSON array — no markdown fences, no explanation.',
      user: `${source}\n\n---\n\nAnalyze the source material above and identify **2 to 6 logical topic areas** that the content naturally divides into. Each area should be a coherent subtopic that deserves its own concepts-and-procedures section.\n\nReturn a JSON array of objects with these keys:\n- "name": a short, descriptive area title (e.g., "VM Sizing and Performance")\n- "slug": a lowercase-hyphenated identifier (e.g., "vm-sizing-and-performance")\n- "description": a one-sentence summary of what this area covers\n\nExample output:\n[\n  {"name": "VM Sizing and Performance", "slug": "vm-sizing-and-performance", "description": "Covers how to choose and configure VM sizes for workload requirements."},\n  {"name": "Networking", "slug": "networking", "description": "Explains virtual network setup, NSGs, and connectivity options."}\n]\n\nReturn ONLY the JSON array, nothing else.`,
    };
  },

  areaContent(title, desc, text, areaName, areaDesc) {
    const source = formatSourceContent(title, desc, text);
    return {
      system: ID_SYSTEM_PROMPT,
      user: `${source}\n\n---\n\nBased on the source material above, generate a training unit for the topic area **"${areaName}"** (${areaDesc}).\n\nStructure the markdown as follows:\n\n1. **H1 title**: "${areaName}"\n2. **Concepts section** (H2: "Key Concepts"):\n   - For each concept relevant to this area (2-4 concepts):\n     - **H3 heading** with the concept name\n     - **Explanation** — what it is and why it matters (concept-first: what/why before how)\n     - **Example or analogy** — concrete illustration or real-world comparison\n     - **Key takeaway** — one-sentence summary in bold\n3. **Procedures section** (H2: "Step-by-Step Procedures"):\n   - For each procedure relevant to this area (1-3 procedures):\n     - **H3 heading** describing the task\n     - **Numbered steps** — clear, actionable instructions\n     - **Expected result** — what the learner should see/achieve\n     - **Tip or Note** — helpful guidance as a blockquote (> **Tip:** ...)\n4. **Troubleshooting** (H2) — brief section with common issues and solutions for this area\n\nFocus ONLY on content relevant to "${areaName}". Do not cover other topic areas. Use clear headings, short paragraphs, and bullet points. Use imperative voice for steps.`,
    };
  },

  knowledgeCheck(title, desc, text) {
    const source = formatSourceContent(title, desc, text);
    return {
      system: ID_SYSTEM_PROMPT,
      user: `${source}\n\n---\n\nBased on the source material above, generate a **Knowledge Check** unit in markdown with:\n\n1. **H1 title**: "Knowledge Check"\n2. **3 to 5 multiple-choice questions** that test understanding (not memorization). For each question:\n   - **H2**: "Question N" (numbered)\n   - The question text in bold\n   - Four answer choices labeled A through D\n   - An "Answer" section with:\n     - **Correct answer** clearly marked\n     - **Explanation** — why the correct answer is right and briefly why others are wrong\n\nQuestions should cover different Bloom's taxonomy levels:\n- At least 1 recall/comprehension question\n- At least 1 application/analysis question\n- At least 1 evaluation/synthesis question\n\nMix difficulty levels. Distractors should be plausible but clearly incorrect upon understanding.`,
    };
  },

  summary(title, desc, text) {
    const source = formatSourceContent(title, desc, text);
    return {
      system: ID_SYSTEM_PROMPT,
      user: `${source}\n\n---\n\nBased on the source material above, generate a **Summary** unit in markdown with:\n\n1. **H1 title**: "Summary"\n2. **Recap paragraph** — 2-3 sentences summarizing what was covered in this module\n3. **Key takeaways** — bulleted list of 4-6 most important points\n4. **Next steps** — what the learner should do next or explore further\n5. **Additional resources** — 3-5 links or references for further learning (use the source URL and any related links found in the material)\n\nKeep it concise. The summary should reinforce the learning objectives stated in the overview.`,
    };
  },
};

function parseAreasResponse(raw) {
  const cleaned = raw.replace(/```(?:json)?\s*/g, '').trim().replace(/`+$/, '');
  let areas;
  try { areas = JSON.parse(cleaned); } catch (e) {
    throw new Error(`Failed to parse areas JSON: ${e.message}`);
  }
  if (!Array.isArray(areas) || areas.length === 0) throw new Error('Expected a non-empty JSON array of areas');
  return areas.map((a, i) => ({
    name: (a.name || '').trim() || `Area ${i + 1}`,
    slug: (a.slug || '').trim() || a.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    description: (a.description || '').trim(),
  }));
}

// ══════════════════════════════════════════════════════════════════════════
// CONTENT EDITOR — Module Builder with Gap Analysis & URL Support
// ══════════════════════════════════════════════════════════════════════════

let editorState = {
  suggestions: [],
  activeTab: 'new',
  selectedIdx: -1,
  currentModule: null, // generated module with units
  currentUnitIdx: 0,
  contentPlan: null,
  isGenerating: false,
};

function buildEditorSuggestions() {
  if (!state.selectedProduct) { toast('Select a product first', 'warning'); return; }
  if (state.modules.length === 0) { toast('Load modules first', 'warning'); return; }

  // Auto-run gap analysis if not done
  if (!state.gapResults && state.flatDocTopics.length > 0) {
    runClientGapAnalysis();
  }

  const suggestions = [];
  const now = Date.now();

  // ── 1. THOROUGH 3-TIER GAP CLASSIFICATION ──
  if (state.gapResults) {
    const uncovered = state.gapResults.results.filter(r => r.coverage === 'uncovered');

    const moduleCache = state.modules.map(mod => {
      const modKeywords = extractKeywords(mod.title + ' ' + (mod.summary || ''));
      const unitCache = (mod.units || []).map((unitTitle, idx) => ({
        title: unitTitle, index: idx, keywords: extractKeywords(unitTitle),
      }));
      return { mod, keywords: modKeywords, units: unitCache };
    });

    const expandUnitItems = [];
    const addUnitItems = [];
    const newModuleItems = [];

    for (const r of uncovered) {
      const topicKw = extractKeywords(r.docTopic.title + ' ' + (r.docTopic.path || ''));
      if (topicKw.length === 0) { newModuleItems.push({ topic: r.docTopic }); continue; }

      let bestUnitScore = 0, bestUnitMod = null, bestUnitUnit = null;
      let bestModScore = 0, bestModModule = null;
      const moduleCandidates = [];

      for (const mc of moduleCache) {
        const modScore = keywordOverlap(topicKw, mc.keywords);
        if (modScore > bestModScore) { bestModScore = modScore; bestModModule = mc.mod; }
        if (modScore >= 0.1) moduleCandidates.push({ mod: mc.mod, score: modScore });
        for (const uc of mc.units) {
          if (uc.keywords.length === 0) continue;
          const unitScore = keywordOverlap(topicKw, uc.keywords);
          const combined = unitScore * 0.7 + modScore * 0.3;
          if (unitScore >= 0.25 && combined > bestUnitScore) {
            bestUnitScore = combined; bestUnitMod = mc.mod; bestUnitUnit = uc;
          }
        }
      }

      if (bestUnitScore < 0.25 && bestModScore < 0.15) {
        for (const mc of moduleCache) {
          const revScore = keywordOverlap(mc.keywords, topicKw);
          const avg = (revScore + keywordOverlap(topicKw, mc.keywords)) / 2;
          if (avg > bestModScore) { bestModScore = avg; bestModModule = mc.mod; }
          for (const uc of mc.units) {
            if (uc.keywords.length === 0) continue;
            const revUnit = keywordOverlap(uc.keywords, topicKw);
            const avgUnit = (revUnit + keywordOverlap(topicKw, uc.keywords)) / 2;
            const combined = avgUnit * 0.7 + bestModScore * 0.3;
            if (avgUnit >= 0.2 && combined > bestUnitScore) {
              bestUnitScore = combined; bestUnitMod = mc.mod; bestUnitUnit = uc;
            }
          }
        }
      }

      const topCandidates = moduleCandidates.sort((a, b) => b.score - a.score).slice(0, 3);

      if (bestUnitScore >= 0.2 && bestUnitUnit) {
        expandUnitItems.push({ topic: r.docTopic, targetModule: bestUnitMod, targetUnit: bestUnitUnit, score: bestUnitScore, allCandidates: topCandidates });
      } else if (bestModScore >= 0.12) {
        addUnitItems.push({ topic: r.docTopic, targetModule: bestModModule, score: bestModScore, allCandidates: topCandidates });
      } else {
        newModuleItems.push({ topic: r.docTopic });
      }
    }

    // Group expand-unit items
    const expandGroups = {};
    for (const item of expandUnitItems) {
      const key = `${item.targetModule.title}||${item.targetUnit.title}`;
      if (!expandGroups[key]) expandGroups[key] = { ...item, topics: [] };
      expandGroups[key].topics.push(item.topic);
    }
    for (const group of Object.values(expandGroups)) {
      const n = group.topics.length;
      suggestions.push({
        type: 'new', recommendation: 'expand-unit',
        category: group.topics[0].path.split(' > ')[0] || group.topics[0].title,
        topics: group.topics, topicCount: n,
        priority: n >= 3 ? 'high' : n >= 2 ? 'medium' : 'low',
        targetModule: group.targetModule, targetUnit: group.targetUnit,
        targetOverlap: group.score, allCandidates: group.allCandidates || [],
        title: n === 1 ? group.topics[0].title : `${group.topics[0].title} (+${n - 1} more)`,
        reason: `Add as ${n > 1 ? 'subsections' : 'a subsection'} within unit "${group.targetUnit.title}" in "${group.targetModule.title}" (${Math.round(group.score * 100)}% match).`,
        suggestedPlacement: `${state.selectedProduct.folder}/`,
      });
    }

    // Group add-unit items
    const addUnitGroups = {};
    for (const item of addUnitItems) {
      const key = item.targetModule.title;
      if (!addUnitGroups[key]) addUnitGroups[key] = { ...item, topics: [] };
      addUnitGroups[key].topics.push(item.topic);
    }
    for (const [key, group] of Object.entries(addUnitGroups)) {
      const n = group.topics.length;
      suggestions.push({
        type: 'new', recommendation: 'add-unit',
        category: group.topics[0].path.split(' > ')[0] || group.topics[0].title,
        topics: group.topics, topicCount: n,
        priority: n >= 3 ? 'high' : n >= 2 ? 'medium' : 'low',
        targetModule: group.targetModule, targetOverlap: group.score,
        allCandidates: group.allCandidates || [],
        title: n === 1 ? group.topics[0].title : `${key} — ${n} new topics`,
        reason: `Add as ${n > 1 ? 'new units' : 'a new unit'} in "${group.targetModule.title}" (${Math.round(group.score * 100)}% module match).`,
        suggestedPlacement: `${state.selectedProduct.folder}/`,
      });
    }

    // Group new-module items
    const newModGroups = {};
    for (const item of newModuleItems) {
      const parentKey = item.topic.path.split(' > ')[0] || item.topic.title;
      if (!newModGroups[parentKey]) newModGroups[parentKey] = [];
      newModGroups[parentKey].push(item.topic);
    }
    for (const [parent, topics] of Object.entries(newModGroups)) {
      suggestions.push({
        type: 'new', recommendation: 'new-module',
        category: parent, topics, topicCount: topics.length,
        priority: topics.length >= 5 ? 'high' : topics.length >= 2 ? 'medium' : 'low',
        title: topics.length === 1 ? topics[0].title : `${parent} (${topics.length} topics)`,
        reason: `${topics.length} documentation topic${topics.length > 1 ? 's' : ''} under "${parent}" — checked all ${state.modules.length} modules with no match. Requires new training content.`,
        suggestedPlacement: `${state.selectedProduct.folder}/`,
      });
    }

    // 2. Update suggestions from partial coverage
    const partial = state.gapResults.results.filter(r => r.coverage === 'partial' && r.bestMatch);
    for (const r of partial) {
      suggestions.push({
        type: 'update', docTopic: r.docTopic, module: r.bestMatch, score: r.score,
        priority: r.score < 0.25 ? 'high' : 'medium',
        title: r.bestMatch.title,
        reason: `Partially covers "${r.docTopic.title}" (${Math.round(r.score * 100)}% match). Content expansion recommended.`,
      });
    }
  }

  // 3. Outdated modules (>12 months)
  for (const m of state.modules) {
    if (!m.msDate) continue;
    const ageMonths = Math.floor((now - new Date(m.msDate).getTime()) / (30 * 24 * 60 * 60 * 1000));
    if (ageMonths > 12) {
      suggestions.push({
        type: 'outdated', module: m, ageMonths,
        priority: ageMonths > 24 ? 'high' : ageMonths > 18 ? 'medium' : 'low',
        title: m.title,
        reason: `Last updated ${ageMonths} months ago (${m.msDate}). May contain outdated information.`,
      });
    }
  }

  const priorityOrder = { high: 0, medium: 1, low: 2 };
  suggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  editorState.suggestions = suggestions;
  editorState.selectedIdx = -1;
  editorState.currentModule = null;

  document.getElementById('count-suggestions').textContent = suggestions.length;
  renderEditorView();
  toast(`${suggestions.length} content suggestions generated`, 'success');
}

function renderEditorView() {
  const s = editorState.suggestions;
  if (s.length === 0) {
    document.getElementById('editor-empty').style.display = '';
    document.getElementById('editor-content').style.display = 'none';
    return;
  }
  document.getElementById('editor-empty').style.display = 'none';
  document.getElementById('editor-content').style.display = '';
  document.getElementById('tab-count-new').textContent = s.filter(x => x.type === 'new').length;
  document.getElementById('tab-count-update').textContent = s.filter(x => x.type === 'update').length;
  document.getElementById('tab-count-outdated').textContent = s.filter(x => x.type === 'outdated').length;
  renderSuggestionList();
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

// ══════════════════════════════════════════════════════════════════════════
// NAVIGATION
// ══════════════════════════════════════════════════════════════════════════

function switchView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.sidebar-nav a').forEach(a => a.classList.remove('active'));
  const view = document.getElementById('view-' + name);
  if (view) view.classList.add('active');
  const navItem = document.querySelector(`[data-view="${name}"]`);
  if (navItem) navItem.classList.add('active');

  // Lazy load insights on first visit
  if (name === 'insights') {
    const cont = document.getElementById('commits-bizapps');
    if (cont && cont.querySelector('.loading-overlay')) {
      loadInsights();
    }
  }

  // Auto-build editor suggestions on first visit
  if (name === 'editor' && editorState.suggestions.length === 0 && state.modules.length > 0) {
    buildEditorSuggestions();
  }
}

// ══════════════════════════════════════════════════════════════════════════
// SETTINGS
// ══════════════════════════════════════════════════════════════════════════

function openSettings() {
  document.getElementById('api-key-input').value = getToken();
  document.getElementById('ai-model-select').value = localStorage.getItem('gh_models_model') || 'openai/gpt-4.1-mini';
  document.getElementById('cache-ttl-select').value = localStorage.getItem('team_cache_ttl') || '4';
  document.getElementById('display-name-input').value = localStorage.getItem('team_display_name') || '';

  // Show auth status
  const authStatus = document.getElementById('settings-auth-status');
  const method = localStorage.getItem('gh_auth_method');
  if (getToken()) {
    authStatus.innerHTML = method === 'oauth'
      ? '<span style="color:var(--success);">✓ Signed in via GitHub OAuth</span> · <a href="#" onclick="logoutGitHub();return false;" style="color:var(--danger);font-size:11px;">Sign out</a>'
      : '<span style="color:var(--success);">✓ Authenticated via PAT</span>';
  } else {
    authStatus.innerHTML = '<span style="color:var(--warning);">⚠ Not authenticated — limited to 60 requests/hr</span>';
  }

  document.getElementById('settings-modal').classList.add('open');
}

function closeSettings() {
  document.getElementById('settings-modal').classList.remove('open');
}

function saveSettings() {
  const token = document.getElementById('api-key-input').value.trim();
  if (token) {
    localStorage.setItem('gh_models_token', token);
    localStorage.setItem('gh_auth_method', 'pat');
  } else if (!localStorage.getItem('gh_auth_method') || localStorage.getItem('gh_auth_method') === 'pat') {
    localStorage.removeItem('gh_models_token');
    localStorage.removeItem('gh_auth_method');
  }

  localStorage.setItem('gh_models_model', document.getElementById('ai-model-select').value);
  localStorage.setItem('team_cache_ttl', document.getElementById('cache-ttl-select').value);

  const name = document.getElementById('display-name-input').value.trim();
  if (name) localStorage.setItem('team_display_name', name);
  else localStorage.removeItem('team_display_name');

  updateAuthBadge();
  loadSettings();
  closeSettings();
  toast('Settings saved', 'success');
}

function loadSettings() {
  const model = localStorage.getItem('gh_models_model') || 'openai/gpt-4.1-mini';
  document.getElementById('model-badge').textContent = model.split('/').pop();
  const name = localStorage.getItem('team_display_name');
  if (name) {
    document.getElementById('topbar-title').textContent = `Team Content Gap Manager · ${name}`;
  }
}

// ══════════════════════════════════════════════════════════════════════════
// BOOT
// ══════════════════════════════════════════════════════════════════════════

window.addEventListener('DOMContentLoaded', init);

