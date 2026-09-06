// ─── Cloudflare Worker — BES LinkedIn OAuth Proxy ────────────────────────────
// Déployer sur https://dash.cloudflare.com -> Workers & Pages -> Create Worker
//
// Variables d'environnement à configurer dans le Worker (Settings -> Variables) :
//   LI_CLIENT_SECRET  →  ton Client Secret LinkedIn (jamais visible dans le code)
//
// Client ID : 78n87entgvqaup
// Redirect URI : https://eynorsite.github.io/bes-app/callback.html

const LI_CLIENT_ID   = '78n87entgvqaup';
const REDIRECT_URI   = 'https://eynorsite.github.io/bes-app/callback.html';
const ALLOWED_ORIGIN = 'https://eynorsite.github.io';

function cors(origin) {
  const allow = origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN;
  return {
    'Access-Control-Allow-Origin':  allow,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function json(data, status = 200, origin = '') {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors(origin) }
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const url    = new URL(request.url);

    if (request.method === 'OPTIONS') return new Response(null, { headers: cors(origin) });

    // ── POST /token : échange code → access_token ─────────────────────────────
    if (url.pathname === '/token' && request.method === 'POST') {
      const { code } = await request.json().catch(() => ({}));
      if (!code) return json({ error: 'code manquant' }, 400, origin);

      const secret = env.LI_CLIENT_SECRET;
      if (!secret) return json({ error: 'LI_CLIENT_SECRET non configuré dans les variables du Worker' }, 500, origin);

      const body = new URLSearchParams({
        grant_type:    'authorization_code',
        code,
        redirect_uri:  REDIRECT_URI,
        client_id:     LI_CLIENT_ID,
        client_secret: secret
      });

      const r = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:    body.toString()
      });
      const d = await r.json();
      if (d.error) return json(d, 400, origin);
      return json({ access_token: d.access_token, expires_in: d.expires_in }, 200, origin);
    }

    // ── GET /profile : récupérer le profil connecté ───────────────────────────
    if (url.pathname === '/profile' && request.method === 'GET') {
      const token = (request.headers.get('Authorization') || '').replace('Bearer ', '');
      if (!token) return json({ error: 'Token manquant' }, 401, origin);
      const r = await fetch('https://api.linkedin.com/v2/userinfo', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return json(await r.json(), r.status, origin);
    }

    // ── POST /post : publier un post LinkedIn ─────────────────────────────────
    if (url.pathname === '/post' && request.method === 'POST') {
      const { access_token, text, author_urn } = await request.json().catch(() => ({}));
      if (!access_token || !text || !author_urn) {
        return json({ error: 'access_token, text et author_urn requis' }, 400, origin);
      }
      const r = await fetch('https://api.linkedin.com/v2/ugcPosts', {
        method:  'POST',
        headers: {
          'Authorization':               `Bearer ${access_token}`,
          'Content-Type':                'application/json',
          'X-Restli-Protocol-Version':   '2.0.0'
        },
        body: JSON.stringify({
          author: author_urn,
          lifecycleState: 'PUBLISHED',
          specificContent: {
            'com.linkedin.ugc.ShareContent': {
              shareCommentary:    { text },
              shareMediaCategory: 'NONE'
            }
          },
          visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' }
        })
      });
      const d = await r.json();
      if (!r.ok) return json(d, r.status, origin);
      return json({ ok: true, id: d.id }, 200, origin);
    }

    // ── GET /health ────────────────────────────────────────────────────────────
    if (url.pathname === '/health') {
      return json({ ok: true, client_id: LI_CLIENT_ID }, 200, origin);
    }

    return json({ error: 'Route non trouvée' }, 404, origin);
  }
};
