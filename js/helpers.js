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

// Debounce utility
function debounce(fn, ms) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  };
}

