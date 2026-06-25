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
  'Power Apps': [
    '/en-us/power-apps/maker/toc.json',
  ],
  'Power Automate': '/en-us/power-automate/toc.json',
  'Power BI': [
    '/en-us/power-bi/fundamentals/toc.json',
    '/en-us/power-bi/transform-model/toc.json',
    '/en-us/power-bi/create-reports/toc.json',
    '/en-us/power-bi/guidance/toc.json',
  ],
  'AI Builder': '/en-us/ai-builder/toc.json',
  'Dynamics 365 Finance': '/en-us/dynamics365/finance/toc.json',
  'Dynamics 365 Supply Chain Management': '/en-us/dynamics365/supply-chain/toc.json',
  'Dynamics 365 Sales': '/en-us/dynamics365/sales/toc.json',
  'Dynamics 365 Customer Service': [
    '/en-us/dynamics365/customer-service/implement/toc.json',
    '/en-us/dynamics365/customer-service/administer/toc.json',
    '/en-us/dynamics365/customer-service/use/toc.json',
    '/en-us/dynamics365/customer-service/develop/toc.json',
  ],
  'Dynamics 365 Commerce': '/en-us/dynamics365/commerce/toc.json',
  'Dynamics 365 Field Service': '/en-us/dynamics365/field-service/toc.json',
  'Dynamics 365 Business Central': '/en-us/dynamics365/business-central/toc.json',
  'Dynamics 365 Human Resources': '/en-us/dynamics365/human-resources/toc.json',
  'Dynamics 365 Project Operations': '/en-us/dynamics365/project-operations/toc.json',
  'Dynamics 365 Contact Center': '/en-us/dynamics365/contact-center/toc.json',
  'Industry Solutions': [
    '/en-us/industry/healthcare/toc.json',
    '/en-us/industry/financial-services/toc.json',
    '/en-us/industry/nonprofit/toc.json',
    '/en-us/industry/sustainability/toc.json',
    '/en-us/industry/mobility/toc.json',
  ],
  'Healthcare': '/en-us/industry/healthcare/toc.json',
  'Dynamics 365 Fraud Protection': '/en-us/dynamics365/fraud-protection/toc.json',
  'Power Platform': [
    '/en-us/power-platform/admin/toc.json',
    '/en-us/power-platform/guidance/toc.json',
  ],
  'Copilot for Finance': '/en-us/copilot/finance/toc.json',
  'Copilot for Sales': '/en-us/microsoft-sales-copilot/toc.json',
  'Copilot for Service': '/en-us/microsoft-copilot-service/toc.json',
  'Customer Insights - Data': '/en-us/dynamics365/customer-insights/data/toc.json',
  'Customer Insights - Journeys': '/en-us/dynamics365/customer-insights/journeys/toc.json',
  'Intelligent Order Management': '/en-us/dynamics365/intelligent-order-management/toc.json',
};

const CORS_PROXIES = [
  url => `https://github-oauth-proxy.oscarfranco.workers.dev/proxy?url=${encodeURIComponent(url)}`,
  url => `https://api.codetabs.com/v1/proxy/?quest=${url}`,
  url => `https://corsproxy.io/?${encodeURIComponent(url)}`,
];

const CONCURRENCY_LIMIT = 8;

// ══════════════════════════════════════════════════════════════════════════
// CONTENT EDITOR ACTION TYPES
// ══════════════════════════════════════════════════════════════════════════

const ACTION_TYPES = {
  EDIT_EXISTING: 'EDIT_EXISTING',   // Modify existing unit content (highest priority)
  ADD_TO_UNIT: 'ADD_TO_UNIT',       // Append new section to existing unit
  NEW_UNIT: 'NEW_UNIT',             // Create new unit in existing module
  NEW_MODULE: 'NEW_MODULE'          // Create entirely new module (last resort)
};

// ══════════════════════════════════════════════════════════════════════════
// RELEASE PLANNER CONFIGURATION
// ══════════════════════════════════════════════════════════════════════════

const RELEASE_PLANNER_PRODUCTS = {
  'Copilot Studio': {
    learnPath: '/power-platform/release-plan',
    releasePlanUrl: 'https://releaseplans.microsoft.com/en-US/?app=Microsoft+Copilot+Studio',
    waves: ['2024wave1', '2024wave2', '2025wave1', '2025wave2']
  },
  'Supply Chain Management': {
    learnPath: '/dynamics365-release-plan',
    releasePlanUrl: 'https://releaseplans.microsoft.com/en-US/?app=Supply+Chain+Management',
    waves: ['2024release-wave-1', '2024release-wave-2', '2025release-wave-1', '2025release-wave-2']
  },
  'Power Apps': {
    learnPath: '/power-platform/release-plan',
    releasePlanUrl: 'https://releaseplans.microsoft.com/en-US/?app=Power+Apps',
    waves: ['2024wave1', '2024wave2', '2025wave1', '2025wave2']
  },
  'Power BI': {
    learnPath: '/power-platform/release-plan',
    releasePlanUrl: 'https://releaseplans.microsoft.com/en-US/?app=Power+BI',
    waves: ['2024wave1', '2024wave2', '2025wave1', '2025wave2']
  },
  'Dynamics 365 Sales': {
    learnPath: '/dynamics365-release-plan',
    releasePlanUrl: 'https://releaseplans.microsoft.com/en-US/?app=Sales',
    waves: ['2024release-wave-1', '2024release-wave-2', '2025release-wave-1', '2025release-wave-2']
  },
  'Customer Service': {
    learnPath: '/dynamics365-release-plan',
    releasePlanUrl: 'https://releaseplans.microsoft.com/en-US/?app=Customer+Service',
    waves: ['2024release-wave-1', '2024release-wave-2', '2025release-wave-1', '2025release-wave-2']
  },
  'Field Service': {
    learnPath: '/dynamics365-release-plan',
    releasePlanUrl: 'https://releaseplans.microsoft.com/en-US/?app=Field+Service',
    waves: ['2024release-wave-1', '2024release-wave-2', '2025release-wave-1', '2025release-wave-2']
  },
  'Power Automate': {
    learnPath: '/power-platform/release-plan',
    releasePlanUrl: 'https://releaseplans.microsoft.com/en-US/?app=Power+Automate',
    waves: ['2024wave1', '2024wave2', '2025wave1', '2025wave2']
  }
};

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
  editorSuggestions: [],  // Content editor suggestions from gap analysis
  editorCache: {},     // Cache for AI action recommendations
  releasePlanner: {
    features: [],      // Array of feature objects from release plans
    lastFetch: null,   // Timestamp of last successful fetch
    products: [],      // List of products we're tracking
    history: [],       // Change history for tracking date shifts
    selectedProduct: null,  // Filter by product
    changesSinceLastRun: []  // Features that changed since last fetch
  }
};

