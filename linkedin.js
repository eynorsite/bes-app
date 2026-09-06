// ─── LinkedIn Integration — BES ───────────────────────────────────────────────

const LI = {
  CLIENT_ID: '78n87entgvqaup',
  REDIRECT_URI: 'https://eynorsite.github.io/bes-app/callback.html',
  SCOPE: 'openid profile w_member_social',
  get WORKER_URL() { return localStorage.getItem('bes_worker_url') || ''; },

  isConnected() {
    const token = localStorage.getItem('bes_li_token');
    const exp = parseInt(localStorage.getItem('bes_li_token_exp') || '0');
    return !!token && (exp === 0 || Date.now() < exp);
  },

  getToken() { return localStorage.getItem('bes_li_token'); },

  getProfile() {
    try { return JSON.parse(localStorage.getItem('bes_li_profile') || '{}'); }
    catch { return {}; }
  },

  connect() {
    const state = Math.random().toString(36).slice(2);
    localStorage.setItem('bes_li_state', state);
    const url = `https://www.linkedin.com/oauth/v2/authorization`
      + `?response_type=code`
      + `&client_id=${this.CLIENT_ID}`
      + `&redirect_uri=${encodeURIComponent(this.REDIRECT_URI)}`
      + `&scope=${encodeURIComponent(this.SCOPE)}`
      + `&state=${state}`;
    const popup = window.open(url, 'li_auth', 'width=600,height=700,left=200,top=80');
    const t = setInterval(() => {
      try {
        if (popup.closed) {
          clearInterval(t);
          const code = localStorage.getItem('bes_li_code_pending');
          if (code) { localStorage.removeItem('bes_li_code_pending'); this.exchangeCode(code); }
        }
      } catch(e) { clearInterval(t); }
    }, 600);
  },

  async exchangeCode(code) {
    if (!this.WORKER_URL) {
      showLiToast('⚠ Configure l\'URL du Worker Cloudflare ci-dessous', false);
      return;
    }
    try {
      const r = await fetch(`${this.WORKER_URL}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      });
      const d = await r.json();
      if (d.access_token) {
        localStorage.setItem('bes_li_token', d.access_token);
        if (d.expires_in) localStorage.setItem('bes_li_token_exp', Date.now() + d.expires_in * 1000);
        await this.fetchProfile(d.access_token);
        showLiToast('✅ LinkedIn connecté !');
        updateLinkedInUI();
      } else {
        showLiToast('Erreur : ' + (d.error_description || d.error || JSON.stringify(d)), false);
      }
    } catch(e) { showLiToast('Erreur réseau : ' + e.message, false); }
  },

  async fetchProfile(token) {
    if (!this.WORKER_URL) return null;
    try {
      const r = await fetch(`${this.WORKER_URL}/profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const p = await r.json();
      localStorage.setItem('bes_li_profile', JSON.stringify(p));
      return p;
    } catch { return null; }
  },

  disconnect() {
    ['bes_li_token','bes_li_token_exp','bes_li_profile','bes_li_state'].forEach(k => localStorage.removeItem(k));
    updateLinkedInUI();
    showLiToast('Déconnecté de LinkedIn');
  },

  async publishPost(text) {
    const token = this.getToken();
    if (!token) { showLiToast('Connecte LinkedIn d\'abord', false); return false; }
    if (!this.WORKER_URL) { showLiToast('Configure l\'URL du Worker', false); return false; }
    const profile = this.getProfile();
    const urn = profile.sub ? `urn:li:person:${profile.sub}` : null;
    if (!urn) { showLiToast('Profil non chargé — reconnecte-toi', false); return false; }
    try {
      const r = await fetch(`${this.WORKER_URL}/post`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: token, text, author_urn: urn })
      });
      const d = await r.json();
      if (d.ok) return true;
      showLiToast('Erreur LinkedIn : ' + (d.message || JSON.stringify(d)), false);
      return false;
    } catch(e) { showLiToast('Erreur réseau', false); return false; }
  }
};

// ─── Extension Chrome ─────────────────────────────────────────────────────────

const EXT = {
  get ID() { return localStorage.getItem('bes_ext_id') || ''; },
  isAvailable() {
    return typeof chrome !== 'undefined' && chrome.runtime && !!this.ID;
  },
  sendMessage(lead) {
    if (!this.isAvailable()) return false;
    try {
      const q = encodeURIComponent((lead.nom||'') + ' ' + (lead.ent||''));
      chrome.runtime.sendMessage(this.ID, {
        type: 'BES_SEND_MESSAGE',
        data: {
          profileUrl: lead.linkedinUrl || `https://www.linkedin.com/search/results/people/?keywords=${q}`,
          message: lead.msg || lead.message || '',
          prospectName: lead.nom
        }
      });
      return true;
    } catch { return false; }
  }
};

// ─── UI ───────────────────────────────────────────────────────────────────────

function showLiToast(msg) {
  if (typeof toast === 'function') toast(msg);
}

function updateLinkedInUI() {
  const connected = LI.isConnected();
  const extOk = !!localStorage.getItem('bes_ext_id');
  const profile = LI.getProfile();

  const liEl = document.getElementById('li-status-badge');
  const extEl = document.getElementById('ext-status-badge');
  const profEl = document.getElementById('li-profile-info');

  if (liEl) {
    liEl.textContent = connected
      ? (profile.name ? `✅ ${profile.name}` : '✅ Connecté')
      : '⚪ Non connecté';
    liEl.className = 'li-badge ' + (connected ? 'li-ok' : 'li-off');
  }
  if (extEl) {
    extEl.textContent = extOk ? '✅ Extension configurée' : '⚪ Extension non installée';
    extEl.className = 'li-badge ' + (extOk ? 'li-ok' : 'li-off');
  }
  if (profEl) {
    profEl.style.display = (connected && profile.name) ? 'block' : 'none';
    if (connected && profile.name) profEl.innerHTML =
      `<img src="${profile.picture||''}" style="width:32px;height:32px;border-radius:50%;vertical-align:middle;margin-right:8px">${profile.name}`;
  }

  const bc = document.getElementById('btn-li-connect');
  const bd = document.getElementById('btn-li-disconnect');
  if (bc) bc.style.display = connected ? 'none' : 'inline-flex';
  if (bd) bd.style.display = connected ? 'inline-flex' : 'none';

  // Pré-remplir
  const cidEl = document.getElementById('li-client-id');
  if (cidEl) cidEl.value = LI.CLIENT_ID;
  const wEl = document.getElementById('li-worker-url');
  if (wEl && LI.WORKER_URL) wEl.value = LI.WORKER_URL;
  const extEl2 = document.getElementById('li-ext-id');
  if (extEl2 && this.ID) extEl2.value = localStorage.getItem('bes_ext_id');
}

function checkLinkedInCallback() {
  const p = new URLSearchParams(window.location.search);
  if (p.get('linkedin') === 'ok') {
    const code = localStorage.getItem('bes_li_code');
    if (code) { localStorage.removeItem('bes_li_code'); LI.exchangeCode(code); }
    window.history.replaceState({}, '', window.location.pathname);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  checkLinkedInCallback();
  updateLinkedInUI();
});
