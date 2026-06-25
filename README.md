# 📊 Team Content Gap Manager

A web-based dashboard for Microsoft Learn content authors to identify gaps between documentation and training content, generate AI-powered content suggestions, and manage content across BizApps & Dynamics products.

**Live site:** https://oscarefranco.github.io/content-manager/team.html

---

## Table of Contents

- [Getting Started](#getting-started)
- [Authentication Setup](#authentication-setup)
- [Features](#features)
- [How to Use](#how-to-use)
- [FAQ](#faq)

---

## Getting Started

1. Open the tool at https://oscarefranco.github.io/content-manager/team.html
2. Set up authentication (see below) for full access to private repos and AI features
3. Select a product from the sidebar dropdown
4. Explore your content landscape across all views

---

## Authentication Setup

The tool uses a **GitHub Personal Access Token (PAT)** for two purposes:
- **GitHub API access** — reading training module content from private MicrosoftDocs repos
- **AI features** — powering the Content Editor, AI Chat, and gap analysis via GitHub Models API

### Option A: OAuth Sign-In (Recommended)

1. Click **🔑 Sign in with GitHub** in the top bar
2. Authorize the app when GitHub prompts you
3. You'll be redirected back — the tool stores your token automatically
4. If accessing MicrosoftDocs org repos, you may need to **authorize SSO** for your token (GitHub will prompt you)

### Option B: Personal Access Token (PAT)

If OAuth doesn't work (e.g., SSO restrictions), use a PAT:

#### Step 1: Generate a PAT

1. Go to https://github.com/settings/tokens
2. Click **"Generate new token"** → choose **"Fine-grained token"** or **"Classic token"**
3. For a **Classic token**:
   - Give it a descriptive name (e.g., `Content Gap Manager`)
   - Set expiration (90 days recommended)
   - Select scopes:
     - ✅ `repo` (full control of private repositories)
     - ✅ `read:user` (read user profile)
   - Click **Generate token**
   - **Copy the token immediately** — you won't see it again!

4. For a **Fine-grained token**:
   - Set resource owner to your org (e.g., `MicrosoftDocs`)
   - Select the repositories you need (e.g., `learn-bizapps-pr`, `learn-dynamics-pr`)
   - Under Permissions → Repository:
     - Contents: **Read-only**
     - Metadata: **Read-only**
   - Click **Generate token**

#### Step 2: Authorize SSO (for MicrosoftDocs org repos)

If you're accessing repos in the `MicrosoftDocs` organization:

1. Go to https://github.com/settings/tokens
2. Find your token in the list
3. Click **"Configure SSO"** next to it
4. Click **"Authorize"** next to `MicrosoftDocs`
5. Complete any additional authentication prompts

> ⚠️ Without SSO authorization, you'll get 404 errors when trying to access private org repos.

#### Step 3: Add the token to the tool

1. Click **⚙ Settings** in the top-right corner of the dashboard
2. Expand **"Or use a Personal Access Token instead"**
3. Paste your token in the input field (starts with `ghp_` or `github_pat_`)
4. Click **Save**
5. The tool will store the token in your browser's `localStorage` (key: `gh_models_token`)

> 💡 The token stays in your browser only — it's never sent to any third-party server. It's used directly for GitHub API calls and the GitHub Models AI endpoint.

#### Step 4: Verify it works

1. Click **⚙ Settings** → **🔍 Test Connection**
2. The diagnostic output will show:
   - ✅ Token detected
   - ✅ GitHub API accessible
   - ✅ Repository access confirmed
   - ✅ GitHub Models AI working

---

## Features

### 📊 Dashboard
The home view showing:
- Total modules across `learn-bizapps-pr` and `learn-dynamics-pr` repos
- Products discovered in both repos
- Health check showing oldest (most stale) modules
- Quick stats for the selected product

### 📚 Training Modules
Browse all training modules for your selected product:
- View module titles, unit counts, authors, and last-modified dates
- Filter by author or search by title
- Sort by title, date, or unit count
- Expand modules to see individual units

### 📖 Documentation
View the documentation Table of Contents (TOC) structure:
- Hierarchical tree of all doc topics for the product
- Search and filter documentation topics
- See topic depth and breadcrumb paths

### 🔍 Gap Analysis
Compare training content against documentation to find gaps:
- **Quick scan** — keyword-based matching (instant, no AI cost)
- **AI deep analysis** — uses AI to semantically compare topics
- **Module-centric view** — see gaps organized by training module
- Coverage heatmap and timeline visualizations
- Export results as CSV or HTML report

### ✏️ Content Editor
AI-powered content generation to address gaps:
- **Generate Suggestions** — AI analyzes each gap and recommends actions:
  - `EDIT_EXISTING` — modify an existing unit
  - `ADD_TO_UNIT` — add a section to an existing unit
  - `NEW_UNIT` — create a new unit in an existing module
  - `NEW_MODULE` — create an entirely new training module
- **Generate from URL** — paste a doc URL to generate a training module
- **Browse Repo** — select files directly from private repos
- **Create PR** — push generated content directly as a GitHub Pull Request
- **Doc Reference Panel** — toggle to see related documentation while editing

### 📅 Release Planner
Track upcoming product features and their documentation status:
- Fetch features from Microsoft Release Plans
- Cross-reference with existing documentation
- Detect changes between refreshes
- Batch refresh all products at once

### 💬 AI Chat
Conversational AI assistant connected to your live data:
- Ask questions about content gaps, coverage, and priorities
- The AI has full context of your loaded modules, docs, and gap results
- Suggestion chips for common questions
- Export conversation history

### 🔗 GitHub Insights
View contribution patterns and commit history for the source repos.

---

## How to Use

### Basic Workflow

1. **Select a product** from the sidebar dropdown (e.g., "Copilot Studio")
2. Wait for modules and documentation to load
3. Go to **Gap Analysis** → click **⚡ Quick scan**
4. Review the coverage percentage and uncovered topics
5. Go to **Content Editor** → click **🔄 Generate Suggestions**
6. Select a suggestion → click **Generate** to create draft content
7. Review the generated content → click **Create PR** to submit it

### Tips

- **Cache**: Data is cached for 4 hours by default (configurable in Settings)
- **Clear cache** in Settings if you need fresh data
- **AI model**: Change the model in Settings — GPT-4.1 Mini is fast, GPT-4.1 is more capable
- **Multiple products**: Switch products freely; data is cached per product
- **Export**: Use gap analysis export buttons for CSV/HTML reports to share with your team

---

## FAQ

**Q: I see "⚠ Unauthenticated (60 req/hr)" — what does this mean?**
A: You haven't set up a token yet. Without authentication, GitHub limits you to 60 API requests per hour. Add a PAT or sign in via OAuth to get 5,000 requests/hour.

**Q: I get 404 errors when loading modules — why?**
A: Most likely your token doesn't have SSO authorization for the MicrosoftDocs organization. Follow the [SSO setup steps](#step-2-authorize-sso-for-microsoftdocs-org-repos) above.

**Q: How do AI features work? Do they cost money?**
A: AI features use the free [GitHub Models API](https://github.com/marketplace/models). The same GitHub token that accesses repos also powers AI. Free tier limits: 150 requests/day for GPT-4.1 Mini, 50/day for GPT-4.1.

**Q: Where is my token stored?**
A: In your browser's `localStorage` under the key `gh_models_token`. It never leaves your browser except to make direct API calls to `api.github.com` and `models.github.ai`. Clear it anytime via Settings → Clear cache, or by signing out.

**Q: Can I use this for products not in the dropdown?**
A: Yes — the tool auto-discovers products from the repository folder structure. If your product has a folder in `learn-bizapps-pr` or `learn-dynamics-pr`, it will appear automatically.

**Q: The page is slow to load — what can I do?**
A: Try reducing the Cache TTL in Settings, or clear the cache if stale data is causing issues. The initial load fetches repository trees which can take a few seconds on slow connections.

---

## Technical Details

- **Hosting**: Static GitHub Pages — no backend server
- **Data sources**: GitHub API (private repos), Microsoft Learn Catalog API (public fallback), Doc TOC JSON files
- **AI**: GitHub Models API (OpenAI-compatible endpoint)
- **Architecture**: Single HTML page + modular JS files (no build step required)
- **Browser support**: Modern browsers (Chrome, Edge, Firefox, Safari)
- **Storage**: All data in browser localStorage (nothing stored server-side)
