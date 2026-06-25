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
  const products = [];

  for (const [repo, paths] of Object.entries(trees)) {
    const folderModules = {};
    const seen = new Set();

    // Detect if the repo has a top-level folder matching the repo name
    // e.g. learn-bizapps-pr/power-virtual-agents/module/index.yml
    // In that case, product folder is at depth 1, module at depth 2
    const repoFolderCount = paths.filter(p => p.startsWith(repo + '/')).length;
    const hasRepoFolder = repoFolderCount > paths.length * 0.5;
    const offset = hasRepoFolder ? 1 : 0;

    for (const p of paths) {
      if (!p.endsWith('/index.yml')) continue;
      // Skip non-content paths
      if (p.includes('/includes/') || p.includes('/media/') || p.includes('achievements/')) continue;

      const parts = p.split('/');
      // Need: [repoFolder?]/productFolder/moduleFolder/index.yml
      const minParts = offset + 3; // e.g. 4 if repo folder present
      if (parts.length < minParts) continue;

      const productFolder = parts[offset];     // e.g. 'power-virtual-agents'
      const moduleFolder = parts[offset + 1];  // e.g. 'build-chatbot'

      // Skip utility folders
      if (productFolder === 'includes' || productFolder === 'media' || productFolder === 'paths') continue;
      if (moduleFolder === 'includes' || moduleFolder === 'media') continue;

      // Only count one index.yml per product/module combo
      const moduleKey = `${productFolder}/${moduleFolder}`;
      if (seen.has(moduleKey)) continue;
      seen.add(moduleKey);

      if (!folderModules[productFolder]) folderModules[productFolder] = [];
      folderModules[productFolder].push({
        path: p,
        moduleFolder,
        fullPath: p,
      });
    }

    for (const [folder, modules] of Object.entries(folderModules)) {
      if (modules.length === 0) continue;
      const mapping = FOLDER_PRODUCT_MAP[folder];
      products.push({
        folder,
        name: mapping ? mapping.name : formatFolderName(folder),
        service: mapping ? mapping.service : folder,
        repo,
        owner: 'MicrosoftDocs',
        modules,
      });
    }
  }

  return products.sort((a, b) => a.name.localeCompare(b.name));
}

function formatFolderName(folder) {
  return folder
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

// ══════════════════════════════════════════════════════════════════════════
// MODULE DATA FETCHING — YAML PARSING
// ══════════════════════════════════════════════════════════════════════════

function parseModuleYaml(text, path, repo) {
  // Normalize line endings
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');

  // Simple key-value extractor: finds first occurrence of "key: value" at any indentation
  const get = (key) => {
    const escaped = key.replace(/\./g, '\\.');
    const re = new RegExp(`^\\s*${escaped}:\\s*(.+)$`);
    for (const line of lines) {
      const m = line.match(re);
      if (m) return m[1].trim();
    }
    return '';
  };

  // List extractor: finds "key:" then collects all "- value" lines until next non-list line
  const getList = (key) => {
    const escaped = key.replace(/\./g, '\\.');
    const keyRe = new RegExp(`^\\s*${escaped}:\\s*$`);
    let collecting = false;
    let keyIndent = -1;
    const items = [];
    for (const line of lines) {
      if (!collecting) {
        const km = line.match(keyRe);
        if (km) {
          collecting = true;
          keyIndent = line.search(/\S/);
        }
      } else {
        // Check if this line is a list item
        const itemMatch = line.match(/^(\s*)-\s+(.+)/);
        if (itemMatch && itemMatch[1].length >= keyIndent) {
          items.push(itemMatch[2].trim());
        } else if (line.trim() === '' || line.trim().startsWith('#')) {
          continue; // skip blank lines and comments
        } else if (/^\s*\S+:/.test(line)) {
          break; // hit another YAML key — stop collecting
        } else {
          break;
        }
      }
    }
    return items;
  };

  const title = get('title');
  const msDate = get('ms.date');
  const msService = get('ms.service');
  const updateCycle = get('ms.update-cycle');
  const author = get('author');
  const msAuthor = get('ms.author');
  const uid = get('uid');

  // Summary: collect lines after "summary:" — handle both inline and block scalar (|)
  let summary = '';
  const sumInline = get('summary');
  if (sumInline && sumInline !== '|' && sumInline !== '>') {
    summary = sumInline;
  } else {
    // Block scalar: find summary: then collect indented lines
    let collecting = false;
    let sumIndent = -1;
    const sumLines = [];
    for (const line of lines) {
      if (!collecting) {
        if (/^\s*summary:\s*[|>]?\s*$/.test(line)) {
          collecting = true;
          sumIndent = line.search(/\S/);
        }
      } else {
        if (line.trim() === '') { sumLines.push(''); continue; }
        const indent = line.search(/\S/);
        if (indent > sumIndent) {
          sumLines.push(line.trim());
        } else {
          break;
        }
      }
    }
    summary = sumLines.join(' ').trim();
  }
  // Remove module-banner include lines
  summary = summary.replace(/\[!include\[.*?\]\(.*?\)\]/gi, '').trim();

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
  const cacheKey = `modules_${product.folder}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  let loaded = 0;
  const total = product.modules.length;
  let failCount = 0;

  const results = await asyncPool(CONCURRENCY_LIMIT, product.modules, async (mod) => {
    try {
      const branch = state.repoBranches[product.repo] || 'main';
      // Use Contents API (reliable with PATs) instead of raw.githubusercontent.com
      const apiUrl = `https://api.github.com/repos/${product.owner}/${product.repo}/contents/${mod.path}?ref=${branch}`;
      const resp = await fetch(apiUrl, { headers: ghHeaders() });
      if (!resp.ok) {
        failCount++;
        if (failCount <= 3) console.warn(`[fetchModule] ${resp.status} for ${mod.path}`);
        loaded++;
        if (onProgress) onProgress(loaded, total);
        return null;
      }
      const json = await resp.json();
      // Contents API returns base64-encoded content — decode as UTF-8
      const raw = json.content.replace(/\n/g, '');
      const bytes = Uint8Array.from(atob(raw), c => c.charCodeAt(0));
      const text = new TextDecoder('utf-8').decode(bytes);
      if (loaded === 0) {
        console.log('[SAMPLE YAML]', mod.path, '\n', text.substring(0, 600));
        const parsed = parseModuleYaml(text, mod.path, product.repo);
        console.log('[PARSED]', { title: parsed.title, msAuthor: parsed.msAuthor, msDate: parsed.msDate, unitCount: parsed.unitCount, units: parsed.units.slice(0, 3), summary: parsed.summary?.substring(0, 100) });
        loaded++;
        if (onProgress) onProgress(loaded, total);
        return parsed;
      }
      loaded++;
      if (onProgress) onProgress(loaded, total);
      return parseModuleYaml(text, mod.path, product.repo);
    } catch (e) {
      failCount++;
      if (failCount <= 3) console.warn(`[fetchModule] Error for ${mod.path}:`, e.message);
      loaded++;
      if (onProgress) onProgress(loaded, total);
      return null;
    }
  });

  if (failCount > 0) console.warn(`[fetchModuleData] ${failCount}/${total} modules failed to load for ${product.folder}`);

  const modules = results.filter(Boolean);
  setCache(cacheKey, modules);
  return modules;
}

