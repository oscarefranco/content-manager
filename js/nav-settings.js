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

  // Load Release Planner from cache on first visit
  if (name === 'release-planner') {
    const featuresCount = state.releasePlanner.features.length;
    const countEl = document.getElementById('count-features');
    if (countEl) countEl.textContent = featuresCount || '';
    if (featuresCount > 0) {
      renderReleasePlannerView();
    }
  }
}

function updateReleasePlannerProduct() {
  const select = document.getElementById('rp-product-select');
  state.releasePlanner.selectedProduct = select.value;
  if (state.releasePlanner.features.length > 0) {
    renderReleasePlannerView();
  }
}

function refreshReleasePlanner() {
  const productKey = state.releasePlanner.selectedProduct || document.getElementById('rp-product-select').value;
  if (!productKey) {
    toast('Please select a product first', 'warning');
    return;
  }
  loadReleasePlannerData(productKey);
}

async function batchRefreshAllProducts() {
  const products = Object.keys(RELEASE_PLANNER_PRODUCTS);
  
  if (products.length === 0) {
    toast('No products configured', 'error');
    return;
  }
  
  // Show progress modal
  const modalHtml = `
  <div class="modal-overlay" id="batch-refresh-modal" style="display:flex;z-index:9999;">
    <div class="modal" style="max-width:600px;">
      <div class="modal-header">
        <h2>📥 Batch Refresh All Products</h2>
      </div>
      <div class="modal-body">
        <p style="margin:0 0 16px 0;">Loading features from all ${products.length} configured products...</p>
        <div id="batch-progress-container"></div>
        <div style="margin-top:16px;padding:12px;background:var(--bg-muted);border-radius:6px;">
          <div style="font-size:12px;color:var(--text-muted);">
            ⚠️ This may take several minutes. Rate limiting applied to avoid server overload.
          </div>
        </div>
      </div>
    </div>
  </div>`;
  
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  const progressContainer = document.getElementById('batch-progress-container');
  
  let successCount = 0;
  let failCount = 0;
  
  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    
    // Update progress UI
    const status = `<div style="padding:8px;margin:4px 0;border-radius:4px;background:var(--bg-muted);font-size:12px;">
      <span style="font-weight:600;">${i + 1}/${products.length}</span> - ${product} 
      <span style="color:#ffc107;">⏳ Loading...</span>
    </div>`;
    progressContainer.insertAdjacentHTML('beforeend', status);
    progressContainer.lastElementChild.scrollIntoView({ behavior: 'smooth' });
    
    try {
      // Load features for this product
      const features = await fetchReleaseFeatures(product);
      
      // Detect changes if we had previous data
      const previousFeatures = state.releasePlanner.features.filter(f => f.product === product);
      if (previousFeatures.length > 0) {
        const changes = detectFeatureChanges(previousFeatures, features);
        if (changes.length > 0) {
          state.releasePlanner.history.push({
            timestamp: Date.now(),
            product: product,
            changes: changes
          });
          state.releasePlanner.changesSinceLastRun.push(...changes);
        }
      }
      
      // Update state
      state.releasePlanner.features = state.releasePlanner.features.filter(f => f.product !== product);
      state.releasePlanner.features.push(...features);
      
      if (!state.releasePlanner.products.includes(product)) {
        state.releasePlanner.products.push(product);
      }
      
      // Update UI to show success
      progressContainer.lastElementChild.innerHTML = `<span style="font-weight:600;">${i + 1}/${products.length}</span> - ${product} <span style="color:#28a745;">✓ ${features.length} features</span>`;
      successCount++;
      
    } catch (err) {
      console.error(`Failed to load ${product}:`, err);
      progressContainer.lastElementChild.innerHTML = `<span style="font-weight:600;">${i + 1}/${products.length}</span> - ${product} <span style="color:#dc3545;">✗ Failed</span>`;
      failCount++;
    }
    
    // Rate limiting: wait 2 seconds between products
    if (i < products.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  // Update last fetch time and save
  state.releasePlanner.lastFetch = Date.now();
  saveReleasePlannerToCache();
  
  // Show completion message
  progressContainer.insertAdjacentHTML('beforeend', `
    <div style="margin-top:16px;padding:12px;background:#d4edda;border:1px solid #28a745;border-radius:6px;text-align:center;">
      <strong>✓ Batch refresh complete!</strong><br>
      <span style="font-size:12px;">Success: ${successCount} | Failed: ${failCount}</span>
    </div>
  `);
  
  // Add close button
  const modal = document.getElementById('batch-refresh-modal');
  const closeBtn = `<div class="modal-footer"><button class="btn btn-primary" onclick="closeBatchRefreshModal()">Close</button></div>`;
  modal.querySelector('.modal').insertAdjacentHTML('beforeend', closeBtn);
  
  window.closeBatchRefreshModal = () => {
    modal.remove();
    renderReleasePlannerView();
    toast(`Batch refresh complete: ${successCount} products loaded`, 'success');
  };
  
  toast(`Loaded ${successCount} products successfully`, 'success');
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
  let token = document.getElementById('api-key-input').value.trim();
  // Clean up common mistakes: remove "Bearer " or "token " prefix if user pasted it
  token = token.replace(/^(Bearer|token)\s+/i, '');
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
// DIAGNOSTICS — Test Connection
// ══════════════════════════════════════════════════════════════════════════

async function runDiagnostics() {
  const token = getToken();
  const lines = [];
  const log = (msg) => { lines.push(msg); console.log('[DIAG]', msg); };

  log('=== Connection Diagnostics ===');
  log(`Token present: ${!!token}`);
  if (token) {
    log(`Token prefix: ${token.substring(0, 8)}...`);
    log(`Token length: ${token.length}`);
    log(`Auth method: ${localStorage.getItem('gh_auth_method') || 'unknown'}`);
    if (token.startsWith('ghp_')) log('Token type: Classic PAT ✓');
    else if (token.startsWith('github_pat_')) log('Token type: Fine-grained PAT (⚠ may not work with SSO orgs)');
    else if (token.startsWith('gho_')) log('Token type: OAuth token (⚠ may get 403 on SSO-protected orgs)');
    else log('Token type: Unknown format');
  } else {
    log('❌ No token found. Enter a PAT in Settings first.');
    alert(lines.join('\n'));
    return;
  }

  // Test 1: Verify token works at all
  log('\n--- Test 1: Token validity (GET /user) ---');
  try {
    const r = await fetch('https://api.github.com/user', { headers: ghHeaders() });
    if (r.ok) {
      const u = await r.json();
      log(`✅ Token valid. Authenticated as: ${u.login} (${u.name || 'no name'})`);
      log(`   Scopes: ${r.headers.get('x-oauth-scopes') || '(not returned)'}`);
    } else {
      log(`❌ Token invalid (${r.status}). Response: ${await r.text()}`);
      alert(lines.join('\n'));
      return;
    }
  } catch (e) {
    log(`❌ Network error: ${e.message}`);
    alert(lines.join('\n'));
    return;
  }

  // Test 2: Check repo access
  for (const repo of ['learn-bizapps-pr', 'learn-dynamics-pr']) {
    log(`\n--- Test 2: Repo access (${repo}) ---`);
    try {
      const r = await fetch(`https://api.github.com/repos/MicrosoftDocs/${repo}`, { headers: ghHeaders() });
      if (r.ok) {
        const info = await r.json();
        log(`✅ Can access ${repo}. Default branch: ${info.default_branch}, Private: ${info.private}`);

        // Test 3: Try tree API
        log(`--- Test 3: Tree API (${repo}, branch: ${info.default_branch}) ---`);
        const tr = await fetch(`https://api.github.com/repos/MicrosoftDocs/${repo}/git/trees/${info.default_branch}?recursive=1`, { headers: ghHeaders() });
        if (tr.ok) {
          const td = await tr.json();
          const allPaths = (td.tree || []).map(n => n.path);
          const indexPaths = allPaths.filter(p => p.endsWith('/index.yml'));
          log(`✅ Tree loaded: ${allPaths.length} total paths, ${indexPaths.length} index.yml files, truncated: ${td.truncated}`);
          // Show top-level folders
          const topFolders = [...new Set(allPaths.map(p => p.split('/')[0]))].sort();
          log(`   Top-level folders (${topFolders.length}): ${topFolders.slice(0, 15).join(', ')}${topFolders.length > 15 ? '...' : ''}`);
          // Show sample index.yml paths
          log(`   Sample index.yml paths:`);
          indexPaths.slice(0, 8).forEach(p => log(`     ${p}`));

          // Test folder discovery
          const testTrees = { [repo]: allPaths };
          const products = discoverProducts(testTrees);
          log(`   discoverProducts found: ${products.length} products`);
          products.forEach(p => log(`     📁 ${p.folder} → "${p.name}" (${p.modules.length} modules)`));
        } else {
          log(`❌ Tree API failed (${tr.status}): ${await tr.text()}`);
        }
      } else if (r.status === 403) {
        log(`❌ 403 Forbidden. Your token lacks access.`);
        log(`   → For MicrosoftDocs org repos, you need a Classic PAT (ghp_...) with "repo" scope`);
        log(`   → AND you must authorize SSO: github.com/settings/tokens → Configure SSO → Authorize for MicrosoftDocs`);
        log(`   Response: ${await r.text()}`);
      } else if (r.status === 404) {
        log(`❌ 404 Not Found. Repo doesn't exist or token has no access at all.`);
      } else {
        log(`❌ Error ${r.status}: ${await r.text()}`);
      }
    } catch (e) {
      log(`❌ Network error: ${e.message}`);
    }
  }

  // Test 4: Rate limit check
  log('\n--- Rate Limit ---');
  try {
    const r = await fetch('https://api.github.com/rate_limit', { headers: ghHeaders() });
    if (r.ok) {
      const d = await r.json();
      log(`Core: ${d.resources.core.remaining}/${d.resources.core.limit} remaining (resets ${new Date(d.resources.core.reset * 1000).toLocaleTimeString()})`);
    }
  } catch (e) { /* ignore */ }

  log('\n=== End Diagnostics ===');

  // Show results in a modal-like alert (also logged to console)
  const resultText = lines.join('\n');
  console.log(resultText);

  // Create a nicer display
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:20000;display:flex;align-items:center;justify-content:center;';
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  const box = document.createElement('div');
  box.style.cssText = 'background:var(--bg-primary,#1e1e2e);color:var(--text-primary,#cdd6f4);border-radius:12px;padding:24px;max-width:700px;max-height:80vh;overflow:auto;font-family:monospace;font-size:12px;white-space:pre-wrap;line-height:1.6;box-shadow:0 8px 32px rgba(0,0,0,0.5);';
  box.textContent = resultText;
  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Close';
  closeBtn.style.cssText = 'margin-top:16px;padding:8px 24px;background:var(--primary,#89b4fa);color:#000;border:none;border-radius:6px;cursor:pointer;font-size:13px;';
  closeBtn.onclick = () => overlay.remove();
  box.appendChild(document.createElement('br'));
  box.appendChild(closeBtn);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

// ══════════════════════════════════════════════════════════════════════════
// BOOT
// ══════════════════════════════════════════════════════════════════════════

window.addEventListener('DOMContentLoaded', init);
