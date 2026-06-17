/**
 * Cloudflare Worker: GitHub OAuth proxy + CORS proxy for learn.microsoft.com
 * Deploy at: github-oauth-proxy.oscarfranco.workers.dev
 * 
 * Routes:
 *   POST /             — OAuth code→token exchange (existing)
 *   GET  /proxy?url=X  — CORS proxy for learn.microsoft.com TOC JSON
 */

const ALLOWED_ORIGINS = [
  'https://oscarefranco.github.io',
  'http://localhost:3000',
  'http://127.0.0.1:5500',
];

const ALLOWED_PROXY_DOMAINS = [
  'learn.microsoft.com',
];

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const allowedOrigin = ALLOWED_ORIGINS.find(o => origin.startsWith(o)) || ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    // CORS Proxy route: GET /proxy?url=<encoded_url>
    if (url.pathname === '/proxy' && request.method === 'GET') {
      const targetUrl = url.searchParams.get('url');
      if (!targetUrl) {
        return new Response(JSON.stringify({ error: 'Missing ?url= parameter' }), {
          status: 400,
          headers: { ...corsHeaders(request), 'Content-Type': 'application/json' },
        });
      }

      // Validate domain
      let parsed;
      try { parsed = new URL(targetUrl); } catch {
        return new Response(JSON.stringify({ error: 'Invalid URL' }), {
          status: 400,
          headers: { ...corsHeaders(request), 'Content-Type': 'application/json' },
        });
      }
      if (!ALLOWED_PROXY_DOMAINS.includes(parsed.hostname)) {
        return new Response(JSON.stringify({ error: `Domain not allowed: ${parsed.hostname}` }), {
          status: 403,
          headers: { ...corsHeaders(request), 'Content-Type': 'application/json' },
        });
      }

      // Fetch and relay
      try {
        const resp = await fetch(targetUrl, {
          headers: { 'User-Agent': 'ContentGapManager/1.0' },
        });
        const body = await resp.text();
        return new Response(body, {
          status: resp.status,
          headers: {
            ...corsHeaders(request),
            'Content-Type': resp.headers.get('Content-Type') || 'application/json',
            'Cache-Control': 'public, max-age=3600',
          },
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: `Fetch failed: ${e.message}` }), {
          status: 502,
          headers: { ...corsHeaders(request), 'Content-Type': 'application/json' },
        });
      }
    }

    // OAuth token exchange route: POST /
    if (request.method === 'POST') {
      const { code } = await request.json();
      if (!code) {
        return new Response(JSON.stringify({ error: 'Missing code' }), {
          status: 400,
          headers: { ...corsHeaders(request), 'Content-Type': 'application/json' },
        });
      }

      const tokenResp = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code,
        }),
      });

      const tokenData = await tokenResp.json();
      return new Response(JSON.stringify(tokenData), {
        status: tokenResp.status,
        headers: { ...corsHeaders(request), 'Content-Type': 'application/json' },
      });
    }

    return new Response('Not found', { status: 404, headers: corsHeaders(request) });
  },
};
