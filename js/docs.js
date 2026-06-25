// ══════════════════════════════════════════════════════════════════════════
// DOCUMENTATION TOC
// ══════════════════════════════════════════════════════════════════════════

async function fetchWithCorsProxy(url) {
  // Skip direct fetch — learn.microsoft.com has no CORS headers
  // Go straight to proxy
  for (const makeProxy of CORS_PROXIES) {
    try {
      const proxyUrl = makeProxy(url);
      const resp = await fetch(proxyUrl);
      if (resp.ok) {
        const data = await resp.json();
        if (data && (data.items || data.children)) return data;
        // If proxy returned non-TOC data (e.g. error object), try next
        if (data && !data.error) return data;
      }
      console.warn(`[fetchWithCorsProxy] Proxy returned ${resp.status} for ${url}`);
    } catch (e) {
      console.warn(`[fetchWithCorsProxy] Proxy error for ${url}:`, e.message);
    }
  }
  console.warn(`[fetchWithCorsProxy] All proxies failed for ${url}`);
  return null;
}

async function fetchDocToc(productName) {
  const cacheKey = `toc_${productName.replace(/\s+/g, '_')}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const tocEntry = PRODUCT_DOC_TOC[productName];
  if (!tocEntry) return null;

  // Support single path or array of paths (for products with multiple sub-TOCs)
  const tocPaths = Array.isArray(tocEntry) ? tocEntry : [tocEntry];
  const allItems = [];

  for (const tocPath of tocPaths) {
    const url = `https://learn.microsoft.com${tocPath}`;
    const data = await fetchWithCorsProxy(url);
    if (data) {
      // Wrap sub-TOC items under a section name derived from the path
      if (tocPaths.length > 1) {
        const sectionName = tocPath.split('/').filter(Boolean).slice(-2, -1)[0] || 'Section';
        const prettyName = sectionName.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        allItems.push({
          toc_title: prettyName,
          children: data.items || data.children || [],
        });
      } else {
        // Single TOC — return as-is
        setCache(cacheKey, data);
        return data;
      }
    }
  }

  if (allItems.length === 0) return null;
  const merged = { items: allItems };
  setCache(cacheKey, merged);
  return merged;
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
