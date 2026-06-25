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

