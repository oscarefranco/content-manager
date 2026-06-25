// ══════════════════════════════════════════════════════════════════════════
// RELEASE PLANNER
// ══════════════════════════════════════════════════════════════════════════

async function fetchReleaseFeatures(productKey) {
  console.log(`Fetching release features for ${productKey}...`);
  
  const config = RELEASE_PLANNER_PRODUCTS[productKey];
  if (!config) {
    toast(`Unknown product: ${productKey}`, 'error');
    return [];
  }

  const allFeatures = [];
  
  // Fetch for all configured waves
  for (const wave of config.waves) {
    try {
      const url = `https://learn.microsoft.com/en-us${config.learnPath}/${wave}/microsoft-copilot-studio/planned-features`;
      console.log(`Fetching ${wave}: ${url}`);
      
      const proxyUrl = CORS_PROXIES[0](url);
      const response = await fetch(proxyUrl);
      const html = await response.text();
      
      // Parse HTML to extract features from markdown tables
      const features = parseReleasePlanHTML(html, productKey, wave, url, config.releasePlanUrl);
      allFeatures.push(...features);
      
      console.log(`Found ${features.length} features in ${wave}`);
      
      // Rate limiting to avoid overwhelming servers
      await new Promise(r => setTimeout(r, 1000));
      
    } catch (err) {
      console.warn(`Failed to fetch ${wave}:`, err);
      toast(`Warning: Could not fetch ${wave} data`, 'warning');
    }
  }
  
  return allFeatures;
}

function parseReleasePlanHTML(html, productKey, wave, learnUrl, releasePlanUrl) {
  const features = [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  // Find all tables in the document
  const tables = doc.querySelectorAll('table');
  
  tables.forEach(table => {
    const rows = table.querySelectorAll('tbody tr');
    
    rows.forEach(row => {
      try {
        const cells = row.querySelectorAll('td');
        if (cells.length < 4) return; // Not a feature row
        
        // Column structure: Feature | Enabled for | Public preview | General availability
        const featureCell = cells[0];
        const enabledFor = cells[1]?.textContent.trim() || '';
        const publicPreview = cells[2]?.textContent.trim() || '';
        const ga = cells[3]?.textContent.trim() || '';
        
        // Extract feature name and URL from first column
        const featureLink = featureCell.querySelector('a');
        if (!featureLink) return;
        
        const featureName = featureLink.textContent.trim();
        const featureUrl = featureLink.getAttribute('href');
        const fullFeatureUrl = featureUrl.startsWith('http') 
          ? featureUrl 
          : `https://learn.microsoft.com${featureUrl}`;
        
        // Check for green checkmarks (completed features)
        const previewCheckmark = cells[2]?.querySelector('img[src*="green-checkmark"]') !== null;
        const gaCheckmark = cells[3]?.querySelector('img[src*="green-checkmark"]') !== null;
        
        // Create feature object
        const feature = {
          id: `${productKey}-${wave}-${featureName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
          product: productKey,
          wave: wave,
          name: featureName,
          enabledFor: enabledFor,
          publicPreview: parseDate(publicPreview),
          publicPreviewCompleted: previewCheckmark,
          ga: parseDate(ga),
          gaCompleted: gaCheckmark,
          learnUrl: fullFeatureUrl,
          releasePlanUrl: releasePlanUrl,
          hasDocumentation: false, // Will be checked later
          documentationUrl: null,
          lastFetched: Date.now()
        };
        
        features.push(feature);
        
      } catch (err) {
        console.warn('Error parsing feature row:', err);
      }
    });
  });
  
  return features;
}

function parseDate(dateStr) {
  if (!dateStr || dateStr === '-') return null;
  
  // Remove checkmark images
  const cleaned = dateStr.replace(/\[.*?\]/g, '').trim();
  if (!cleaned || cleaned === '-') return null;
  
  try {
    // Try parsing common date formats
    const parsed = new Date(cleaned);
    return isNaN(parsed.getTime()) ? cleaned : parsed.toISOString().split('T')[0];
  } catch {
    return cleaned; // Return as-is if parsing fails
  }
}

async function loadReleasePlannerData(productKey) {
  if (!productKey) {
    toast('Please select a product', 'warning');
    return;
  }
  
  toast(`Loading release features for ${productKey}...`, 'info');
  
  try {
    // Get previous features for comparison
    const previousFeatures = state.releasePlanner.features.filter(f => f.product === productKey);
    
    // Fetch new features
    const features = await fetchReleaseFeatures(productKey);
    
    // Detect changes if we had previous data
    let changes = [];
    if (previousFeatures.length > 0) {
      changes = detectFeatureChanges(previousFeatures, features);
      if (changes.length > 0) {
        console.log(`Detected ${changes.length} changes for ${productKey}`);
        toast(`Found ${changes.length} changes since last fetch`, 'info');
        
        // Store changes in history
        state.releasePlanner.history.push({
          timestamp: Date.now(),
          product: productKey,
          changes: changes
        });
        
        // Track recent changes for UI highlighting
        state.releasePlanner.changesSinceLastRun = changes;
      } else {
        toast('No changes detected', 'info');
        state.releasePlanner.changesSinceLastRun = [];
      }
    }
    
    // Update state with new features
    state.releasePlanner.features = state.releasePlanner.features.filter(f => f.product !== productKey);
    state.releasePlanner.features.push(...features);
    state.releasePlanner.lastFetch = Date.now();
    state.releasePlanner.selectedProduct = productKey;
    
    if (!state.releasePlanner.products.includes(productKey)) {
      state.releasePlanner.products.push(productKey);
    }
    
    // Save to localStorage for persistence
    saveReleasePlannerToCache();
    
    toast(`Loaded ${features.length} features for ${productKey}`, 'success');
    
    // Render the view
    renderReleasePlannerView();
    
  } catch (err) {
    console.error('Failed to load release planner data:', err);
    toast('Failed to load release plan data', 'error');
  }
}

function detectFeatureChanges(previousFeatures, newFeatures) {
  const changes = [];
  
  // Create lookup map for new features
  const newFeaturesMap = new Map(newFeatures.map(f => [f.id, f]));
  
  // Check each previous feature
  previousFeatures.forEach(prevFeature => {
    const newFeature = newFeaturesMap.get(prevFeature.id);
    
    if (!newFeature) {
      // Feature was removed (rare)
      changes.push({
        type: 'removed',
        featureId: prevFeature.id,
        featureName: prevFeature.name,
        previous: prevFeature,
        current: null
      });
      return;
    }
    
    // Check for date changes
    if (prevFeature.publicPreview !== newFeature.publicPreview) {
      changes.push({
        type: 'date_change',
        field: 'publicPreview',
        featureId: newFeature.id,
        featureName: newFeature.name,
        previous: prevFeature.publicPreview,
        current: newFeature.publicPreview
      });
    }
    
    if (prevFeature.ga !== newFeature.ga) {
      changes.push({
        type: 'date_change',
        field: 'ga',
        featureId: newFeature.id,
        featureName: newFeature.name,
        previous: prevFeature.ga,
        current: newFeature.ga
      });
    }
    
    // Check for status changes (preview completed, GA completed)
    if (prevFeature.publicPreviewCompleted !== newFeature.publicPreviewCompleted) {
      changes.push({
        type: 'status_change',
        field: 'publicPreviewCompleted',
        featureId: newFeature.id,
        featureName: newFeature.name,
        previous: prevFeature.publicPreviewCompleted,
        current: newFeature.publicPreviewCompleted
      });
    }
    
    if (prevFeature.gaCompleted !== newFeature.gaCompleted) {
      changes.push({
        type: 'status_change',
        field: 'gaCompleted',
        featureId: newFeature.id,
        featureName: newFeature.name,
        previous: prevFeature.gaCompleted,
        current: newFeature.gaCompleted
      });
    }
    
    // Check for documentation changes
    if (prevFeature.hasDocumentation !== newFeature.hasDocumentation) {
      changes.push({
        type: 'documentation_change',
        featureId: newFeature.id,
        featureName: newFeature.name,
        previous: prevFeature.hasDocumentation,
        current: newFeature.hasDocumentation
      });
    }
  });
  
  // Check for new features
  newFeatures.forEach(newFeature => {
    const prevFeature = previousFeatures.find(f => f.id === newFeature.id);
    if (!prevFeature) {
      changes.push({
        type: 'added',
        featureId: newFeature.id,
        featureName: newFeature.name,
        previous: null,
        current: newFeature
      });
    }
  });
  
  return changes;
}

function saveReleasePlannerToCache() {
  try {
    const data = {
      features: state.releasePlanner.features,
      lastFetch: state.releasePlanner.lastFetch,
      products: state.releasePlanner.products,
      history: state.releasePlanner.history,
      changesSinceLastRun: state.releasePlanner.changesSinceLastRun
    };
    localStorage.setItem('release_planner_data', JSON.stringify(data));
  } catch (err) {
    console.warn('Failed to cache release planner data:', err);
  }
}

function loadReleasePlannerFromCache() {
  try {
    const cached = localStorage.getItem('release_planner_data');
    if (cached) {
      const data = JSON.parse(cached);
      state.releasePlanner.features = data.features || [];
      state.releasePlanner.lastFetch = data.lastFetch;
      state.releasePlanner.products = data.products || [];
      state.releasePlanner.history = data.history || [];
      state.releasePlanner.changesSinceLastRun = data.changesSinceLastRun || [];
      console.log(`Loaded ${state.releasePlanner.features.length} cached features, ${state.releasePlanner.history.length} history entries`);
    }
  } catch (err) {
    console.warn('Failed to load cached release planner data:', err);
  }
}

function checkDocumentationForFeatures() {
  if (state.flatDocTopics.length === 0) {
    toast('Load documentation first (select a product and load docs)', 'warning');
    return 0;
  }
  
  const selectedProduct = state.releasePlanner.selectedProduct;
  if (!selectedProduct) {
    toast('Select a product in Release Planner first', 'warning');
    return 0;
  }
  
  const features = state.releasePlanner.features.filter(f => f.product === selectedProduct);
  let foundCount = 0;
  
  features.forEach(feature => {
    const hasDoc = checkDocumentationExists(feature);
    if (hasDoc.found) {
      feature.hasDocumentation = true;
      feature.documentationUrl = hasDoc.url;
      foundCount++;
    } else {
      feature.hasDocumentation = false;
      feature.documentationUrl = null;
    }
  });
  
  // Save updated features
  saveReleasePlannerToCache();
  
  toast(`Documentation check complete: ${foundCount}/${features.length} features have training`, 'success');
  
  // Re-render
  renderReleasePlannerView();
  
  return foundCount;
}

function checkDocumentationExists(feature) {
  // Search for the feature name in documentation topics
  const featureName = feature.name.toLowerCase();
  const searchTerms = featureName.split(/\s+/).filter(term => term.length > 3); // Words longer than 3 chars
  
  // Search in flatDocTopics for matches
  for (const topic of state.flatDocTopics) {
    const topicTitle = topic.title.toLowerCase();
    
    // Check if topic title contains multiple search terms (higher confidence)
    const matchCount = searchTerms.filter(term => topicTitle.includes(term)).length;
    
    if (matchCount >= 2 || (searchTerms.length === 1 && matchCount === 1)) {
      // Found a likely match
      return {
        found: true,
        url: `https://learn.microsoft.com${topic.path}`,
        topic: topic,
        confidence: matchCount / searchTerms.length
      };
    }
  }
  
  // Also check module titles if we have modules loaded
  if (state.modules.length > 0) {
    for (const module of state.modules) {
      const moduleTitle = (module.title || '').toLowerCase();
      const moduleSummary = (module.summary || '').toLowerCase();
      
      const matchCount = searchTerms.filter(term => 
        moduleTitle.includes(term) || moduleSummary.includes(term)
      ).length;
      
      if (matchCount >= 2 || (searchTerms.length === 1 && matchCount === 1)) {
        return {
          found: true,
          url: module.learnUrl || module.ghUrl,
          module: module,
          confidence: matchCount / searchTerms.length
        };
      }
    }
  }
  
  return { found: false, url: null, confidence: 0 };
}

function renderReleasePlannerView() {
  const container = document.getElementById('release-planner-content');
  if (!container) return;
  
  const selectedProduct = state.releasePlanner.selectedProduct;
  const features = selectedProduct 
    ? state.releasePlanner.features.filter(f => f.product === selectedProduct)
    : state.releasePlanner.features;
  
  if (features.length === 0) {
    container.innerHTML = `
    <div class="empty-state" style="padding:3rem;">
      <div class="empty-state-icon">📅</div>
      <h3>No Release Features Loaded</h3>
      <p>Select a product above and click "Load Features" to get started.</p>
    </div>`;
    return;
  }
  
  // Get changes for highlighting
  const changes = state.releasePlanner.changesSinceLastRun || [];
  const changedFeatureIds = new Set(changes.map(c => c.featureId));
  
  // Show change summary if there are recent changes
  let changeSummaryHtml = '';
  if (changes.length > 0) {
    const dateChanges = changes.filter(c => c.type === 'date_change').length;
    const statusChanges = changes.filter(c => c.type === 'status_change').length;
    const newFeatures = changes.filter(c => c.type === 'added').length;
    
    changeSummaryHtml = `
    <div class="card" style="margin-bottom:16px;background:#fff3cd;border:1px solid #ffc107;">
      <div class="card-body" style="padding:12px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
          <span style="font-size:20px;">🔔</span>
          <strong style="font-size:14px;">Changes Detected Since Last Refresh</strong>
        </div>
        <div style="font-size:12px;color:var(--text-muted);">
          ${dateChanges > 0 ? `📅 ${dateChanges} date change(s) ` : ''}
          ${statusChanges > 0 ? `✅ ${statusChanges} status change(s) ` : ''}
          ${newFeatures > 0 ? `🆕 ${newFeatures} new feature(s)` : ''}
        </div>
        <button class="btn btn-ghost btn-sm" onclick="showChangesDetail()" style="margin-top:8px;font-size:11px;">View Details</button>
      </div>
    </div>`;
  }
  
  // Group features by wave
  const byWave = {};
  features.forEach(f => {
    if (!byWave[f.wave]) byWave[f.wave] = [];
    byWave[f.wave].push(f);
  });
  
  const wavesHtml = Object.keys(byWave).sort().reverse().map(wave => {
    const waveFeatures = byWave[wave];
    
    const tableRows = waveFeatures.map(f => {
      // Check if this feature has changes
      const hasChanges = changedFeatureIds.has(f.id);
      const changeIndicator = hasChanges ? '<span style="color:#ffc107;font-size:14px;margin-right:4px;">🔔</span>' : '';
      
      // Get specific changes for this feature
      const featureChanges = changes.filter(c => c.featureId === f.id);
      const changeTooltip = hasChanges 
        ? `title="${featureChanges.map(c => {
            if (c.type === 'date_change') return `${c.field}: ${c.previous || 'none'} → ${c.current || 'none'}`;
            if (c.type === 'status_change') return `${c.field}: ${c.previous ? 'completed' : 'pending'} → ${c.current ? 'completed' : 'pending'}`;
            return c.type;
          }).join(', ')}"` 
        : '';
      
      const rowStyle = hasChanges ? 'background:#fffbf0;' : '';
      
      const previewBadge = f.publicPreviewCompleted 
        ? `<span class="tag" style="background:#28a745;color:#fff;font-size:10px;">✓</span>`
        : f.publicPreview 
          ? `<span class="tag tag-yellow" style="font-size:10px;">${f.publicPreview}</span>`
          : `<span style="color:var(--text-muted);font-size:10px;">-</span>`;
      
      const gaBadge = f.gaCompleted
        ? `<span class="tag" style="background:#28a745;color:#fff;font-size:10px;">✓</span>`
        : f.ga
          ? `<span class="tag tag-blue" style="font-size:10px;">${f.ga}</span>`
          : `<span style="color:var(--text-muted);font-size:10px;">-</span>`;
      
      const docBadge = f.hasDocumentation
        ? `<a href="${escHtml(f.documentationUrl)}" target="_blank" class="tag" style="background:#28a745;color:#fff;font-size:10px;text-decoration:none;">✓ View</a>`
        : `<span class="tag" style="background:#dc3545;color:#fff;font-size:10px;">✗ None</span>`;
      
      return `
      <tr style="${rowStyle}" ${changeTooltip}>
        <td style="padding:8px;">${changeIndicator}<a href="${escHtml(f.learnUrl)}" target="_blank" style="color:var(--primary);text-decoration:none;">${escHtml(f.name)}</a></td>
        <td style="padding:8px;text-align:center;">${previewBadge}</td>
        <td style="padding:8px;text-align:center;">${gaBadge}</td>
        <td style="padding:8px;text-align:center;">${docBadge}</td>
        <td style="padding:8px;text-align:center;">
          <button class="btn btn-ghost btn-sm" onclick="analyzeFeatureGap('${escHtml(f.id)}')" style="font-size:10px;padding:4px 8px;">🔍 Analyze</button>
        </td>
      </tr>`;
    }).join('');
    
    return `
    <div class="card" style="margin-bottom:16px;">
      <div class="card-header">
        <h3 style="margin:0;font-size:14px;text-transform:capitalize;">${wave.replace(/-/g, ' ')}</h3>
        <span class="tag tag-blue">${waveFeatures.length} features</span>
      </div>
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:var(--bg-muted);border-bottom:1px solid var(--border);">
              <th style="padding:8px;text-align:left;font-size:11px;font-weight:600;">Feature</th>
              <th style="padding:8px;text-align:center;font-size:11px;font-weight:600;">Public Preview</th>
              <th style="padding:8px;text-align:center;font-size:11px;font-weight:600;">GA</th>
              <th style="padding:8px;text-align:center;font-size:11px;font-weight:600;">Documentation</th>
              <th style="padding:8px;text-align:center;font-size:11px;font-weight:600;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </div>
    </div>`;
  }).join('');
  
  const lastFetch = state.releasePlanner.lastFetch 
    ? new Date(state.releasePlanner.lastFetch).toLocaleString()
    : 'Never';
  
  container.innerHTML = `
  <div style="margin-bottom:16px;padding:12px;background:var(--bg-muted);border-radius:8px;display:flex;align-items:center;justify-content:space-between;">
    <div>
      <div style="font-size:12px;color:var(--text-muted);">Last updated: ${lastFetch}</div>
      <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">Showing ${features.length} features for ${selectedProduct || 'all products'}</div>
    </div>
    <button class="btn btn-primary btn-sm" onclick="loadReleasePlannerData('${selectedProduct || ''}')">
      🔄 Refresh
    </button>
  </div>
  ${changeSummaryHtml}
  ${wavesHtml}`;
}

function showChangesDetail() {
  const changes = state.releasePlanner.changesSinceLastRun || [];
  if (changes.length === 0) {
    toast('No changes to show', 'info');
    return;
  }
  
  const changesHtml = changes.map(c => {
    let icon = '📝';
    let label = 'Changed';
    
    switch(c.type) {
      case 'date_change':
        icon = '📅';
        label = 'Date Changed';
        break;
      case 'status_change':
        icon = '✅';
        label = 'Status Changed';
        break;
      case 'documentation_change':
        icon = '📚';
        label = 'Documentation Changed';
        break;
      case 'added':
        icon = '🆕';
        label = 'New Feature';
        break;
      case 'removed':
        icon = '🗑️';
        label = 'Removed';
        break;
    }
    
    let details = '';
    if (c.type === 'date_change') {
      const fieldLabel = c.field === 'publicPreview' ? 'Public Preview' : 'GA';
      details = `${fieldLabel}: ${c.previous || 'none'} → ${c.current || 'none'}`;
    } else if (c.type === 'status_change') {
      const fieldLabel = c.field === 'publicPreviewCompleted' ? 'Public Preview' : 'GA';
      details = `${fieldLabel}: ${c.previous ? '✓ completed' : 'pending'} → ${c.current ? '✓ completed' : 'pending'}`;
    } else if (c.type === 'documentation_change') {
      details = c.current ? 'Documentation now available' : 'Documentation removed';
    }
    
    return `
    <div style="padding:12px;margin:8px 0;background:var(--bg-muted);border-radius:6px;border-left:3px solid #ffc107;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
        <span style="font-size:18px;">${icon}</span>
        <strong style="font-size:13px;">${label}</strong>
      </div>
      <div style="font-size:12px;margin-left:26px;">${escHtml(c.featureName)}</div>
      ${details ? `<div style="font-size:11px;color:var(--text-muted);margin-left:26px;margin-top:4px;">${escHtml(details)}</div>` : ''}
    </div>`;
  }).join('');
  
  const modalHtml = `
  <div class="modal-overlay" id="changes-modal" style="display:flex;z-index:9999;">
    <div class="modal" style="max-width:700px;">
      <div class="modal-header">
        <h2>🔔 Changes Since Last Refresh</h2>
        <button class="btn btn-ghost" onclick="closeChangesModal()">✕</button>
      </div>
      <div class="modal-body" style="max-height:500px;overflow-y:auto;">
        <p style="margin:0 0 16px 0;font-size:13px;color:var(--text-muted);">
          ${changes.length} change(s) detected for ${state.releasePlanner.selectedProduct || 'selected product'}
        </p>
        ${changesHtml}
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeChangesModal()">Close</button>
        <button class="btn btn-primary" onclick="clearChangesHistory()">Clear History</button>
      </div>
    </div>
  </div>`;
  
  const existing = document.getElementById('changes-modal');
  if (existing) existing.remove();
  
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  
  window.closeChangesModal = () => {
    const modal = document.getElementById('changes-modal');
    if (modal) modal.remove();
  };
  
  window.clearChangesHistory = () => {
    state.releasePlanner.changesSinceLastRun = [];
    saveReleasePlannerToCache();
    toast('Change history cleared', 'info');
    closeChangesModal();
    renderReleasePlannerView();
  };
}

async function analyzeFeatureGap(featureId) {
  const feature = state.releasePlanner.features.find(f => f.id === featureId);
  if (!feature) {
    toast('Feature not found', 'error');
    return;
  }
  
  // Check if we have documentation and modules loaded
  if (state.flatDocTopics.length === 0 && state.modules.length === 0) {
    toast('Load documentation first: select product in Dashboard and load docs/modules', 'warning');
    return;
  }
  
  toast(`Analyzing gap for: ${feature.name}...`, 'info');
  
  try {
    // Search for related documentation
    const docCheck = checkDocumentationExists(feature);
    
    // Search for related modules
    const moduleCheck = findRelatedModules(feature);
    
    // Determine gap status
    let gapStatus = 'no_coverage';
    let recommendations = [];
    
    if (docCheck.found && docCheck.confidence >= 0.7) {
      gapStatus = 'full_coverage';
      recommendations.push({
        type: 'existing',
        message: `✅ Documentation exists: ${docCheck.topic.title}`,
        url: docCheck.url,
        confidence: docCheck.confidence
      });
    } else if (docCheck.found && docCheck.confidence >= 0.4) {
      gapStatus = 'partial_coverage';
      recommendations.push({
        type: 'update',
        message: `⚠️ Partial match found: ${docCheck.topic.title} (${Math.round(docCheck.confidence * 100)}% confidence)`,
        url: docCheck.url,
        action: 'Consider updating this topic to add more coverage',
        confidence: docCheck.confidence
      });
    } else if (moduleCheck.found) {
      gapStatus = 'partial_coverage';
      recommendations.push({
        type: 'add_to_module',
        message: `📦 Related module found: ${moduleCheck.module.title}`,
        url: moduleCheck.module.learnUrl,
        action: 'Add new unit to this module to cover the feature',
        confidence: moduleCheck.confidence
      });
    } else {
      gapStatus = 'no_coverage';
      recommendations.push({
        type: 'new_module',
        message: '❌ No related training found',
        action: 'Create new training module for this feature',
        confidence: 0
      });
    }
    
    // Add content editor recommendation
    if (gapStatus !== 'full_coverage') {
      recommendations.push({
        type: 'action',
        message: '💡 Recommended Action',
        action: gapStatus === 'partial_coverage' 
          ? 'Use Content Editor to generate updates to existing training'
          : 'Use Content Editor to generate new training module',
        button: 'Go to Content Editor'
      });
    }
    
    // Show results in a modal or expand section
    showFeatureGapAnalysis(feature, gapStatus, recommendations);
    
    toast(`Gap analysis complete for: ${feature.name}`, 'success');
    
  } catch (err) {
    console.error('Gap analysis failed:', err);
    toast(`Analysis failed: ${err.message}`, 'error');
  }
}

function findRelatedModules(feature) {
  if (state.modules.length === 0) {
    return { found: false };
  }
  
  const featureName = feature.name.toLowerCase();
  const searchTerms = featureName.split(/\s+/).filter(term => term.length > 3);
  
  for (const module of state.modules) {
    const moduleTitle = (module.title || '').toLowerCase();
    const moduleSummary = (module.summary || '').toLowerCase();
    
    const matchCount = searchTerms.filter(term => 
      moduleTitle.includes(term) || moduleSummary.includes(term)
    ).length;
    
    if (matchCount >= 2 || (searchTerms.length === 1 && matchCount === 1)) {
      return {
        found: true,
        module: module,
        confidence: matchCount / searchTerms.length
      };
    }
  }
  
  return { found: false };
}

function showFeatureGapAnalysis(feature, gapStatus, recommendations) {
  // Show analysis in a popup or dedicated section
  const statusColors = {
    'full_coverage': '#28a745',
    'partial_coverage': '#ffc107',
    'no_coverage': '#dc3545'
  };
  
  const statusLabels = {
    'full_coverage': '✅ Full Coverage',
    'partial_coverage': '⚠️ Partial Coverage',
    'no_coverage': '❌ No Coverage'
  };
  
  const statusColor = statusColors[gapStatus];
  const statusLabel = statusLabels[gapStatus];
  
  const recommendationsHtml = recommendations.map(rec => {
    let html = `<div style="padding:12px;margin:8px 0;background:var(--bg-muted);border-radius:6px;border-left:3px solid ${statusColor};">`;
    html += `<div style="font-weight:600;margin-bottom:4px;">${escHtml(rec.message)}</div>`;
    
    if (rec.url) {
      html += `<div style="margin:4px 0;"><a href="${escHtml(rec.url)}" target="_blank" style="color:var(--primary);font-size:11px;">View documentation ↗</a></div>`;
    }
    
    if (rec.action) {
      html += `<div style="font-size:11px;color:var(--text-muted);margin-top:4px;">${escHtml(rec.action)}</div>`;
    }
    
    if (rec.button) {
      html += `<button class="btn btn-primary btn-sm" onclick="switchView('editor')" style="margin-top:8px;font-size:11px;">${escHtml(rec.button)}</button>`;
    }
    
    html += '</div>';
    return html;
  }).join('');
  
  // Create modal content
  const modalHtml = `
  <div class="modal-overlay" id="feature-gap-modal" style="display:flex;z-index:9999;">
    <div class="modal" style="max-width:600px;">
      <div class="modal-header">
        <h2>🔍 Feature Gap Analysis</h2>
        <button class="btn btn-ghost" onclick="closeFeatureGapModal()">✕</button>
      </div>
      <div class="modal-body">
        <h3 style="margin:0 0 8px 0;font-size:16px;">${escHtml(feature.name)}</h3>
        <div style="margin-bottom:16px;">
          <a href="${escHtml(feature.learnUrl)}" target="_blank" style="font-size:12px;color:var(--primary);">View feature details ↗</a>
        </div>
        
        <div style="padding:12px;background:${statusColor}15;border-radius:6px;border:1px solid ${statusColor};">
          <div style="font-weight:600;font-size:14px;color:${statusColor};">${statusLabel}</div>
        </div>
        
        <div style="margin-top:16px;">
          <h4 style="margin:0 0 8px 0;font-size:13px;">Findings & Recommendations:</h4>
          ${recommendationsHtml}
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeFeatureGapModal()">Close</button>
      </div>
    </div>
  </div>`;
  
  // Remove existing modal if present
  const existing = document.getElementById('feature-gap-modal');
  if (existing) existing.remove();
  
  // Add modal to page
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  
  // Add close handler
  window.closeFeatureGapModal = () => {
    const modal = document.getElementById('feature-gap-modal');
    if (modal) modal.remove();
  };
}

