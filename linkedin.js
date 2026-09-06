// ─── LinkedIn Integration — BES ───────────────────────────────────────────────
// Gère : OAuth2 login, publication de posts, détection extension Chrome

const LI = {
  // Remplace par tes vraies valeurs après création de l'app LinkedIn Developer
  CLIENT_ID: localStorage.getItem('bes_li_client_id') || '',
  REDIRECT_URI: 'https://eynorsite.github.io/bes-app/callback.html',
  SCOPE: 'w_member_social r_liteprofile',

  // État de connexion
  isConnected() {
    return !!localStorage.getItem('bes_li_token');
  },

  getToken() {
    return localStorage.getItem('bes_li_token');
  },

  // Lance le flow OAuth2
  connect() {
    const clientId = localStorage.getItem('bes_li_client_id');
    if (!clientId) {
      besToast('Configure ton Client ID LinkedIn dans Paramètres');
      document.getElementById('modal-li-setup').classList.add('open');
      return;
    }
    const state = Math.random().toString(36).slice(2);
    localStorage.setItem('bes_li_state', state);
    const url = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(this.REDIRECT_URI)}&scope=${encodeURIComponent(this.SCOPE)}&state=${state}`;
    window.open(url, '_blank', 'width=600,height=700');
  },

  disconnect() {
    localStorage.removeItem('bes_li_token');
    localStorage.removeItem('bes_li_profile');
    updateLinkedInUI();
    besToast('Déconnecté de LinkedIn');
  },

  // Publier un post (nécessite token valide)
  async publishPost(text) {
    const token = this.getToken();
    if (!token) {
      besToast('Connecte ton compte LinkedIn d\'abord');
      return false;
    }

    // LinkedIn UGC Posts API
    const profile = JSON.parse(localStorage.getItem('bes_li_profile') || '{}');
    const authorUrn = profile.id ? `urn:li:person:${profile.id}` : null;
    if (!authorUrn) {
      besToast('Profil LinkedIn non chargé — reconnecte-toi');
      return false;
    }

    try {
      const resp = await fetch('https://api.linkedin.com/v2/ugcPosts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0'
        },
        body: JSON.stringify({
          author: authorUrn,
          lifecycleState: 'PUBLISHED',
          specificContent: {
            'com.linkedin.ugc.ShareContent': {
              shareCommentary: { text },
              shareMediaCategory: 'NONE'
            }
          },
          visibility: {
            'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
          }
        })
      });

      if (resp.ok) {
        return true;
      } else {
        const err = await resp.json();
        console.error('LinkedIn API error:', err);
        besToast('Erreur LinkedIn : ' + (err.message || resp.status));
        return false;
      }
    } catch (e) {
      besToast('Erreur réseau : ' + e.message);
      return false;
    }
  }
};

// ─── Extension Chrome détection ──────────────────────────────────────────────

const EXT = {
  EXTENSION_ID: localStorage.getItem('bes_ext_id') || '',

  isAvailable() {
    return typeof chrome !== 'undefined' && chrome.runtime && !!this.EXTENSION_ID;
  },

  // Envoyer un message de prospection via l'extension
  sendMessage(lead) {
    if (!this.isAvailable()) return false;
    try {
      chrome.runtime.sendMessage(this.EXTENSION_ID, {
        type: 'BES_SEND_MESSAGE',
        data: {
          profileUrl: lead.linkedinUrl || `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent((lead.nom || '') + ' ' + (lead.ent || ''))}`,
          message: lead.msg || lead.message || '',
          prospectName: lead.nom
        }
      });
      return true;
    } catch (e) {
      return false;
    }
  }
};

// ─── UI LinkedIn ─────────────────────────────────────────────────────────────

function updateLinkedInUI() {
  const connected = LI.isConnected();
  const extOk = EXT.isAvailable();

  // Statuts dans la barre LinkedIn
  const liStatus = document.getElementById('li-status-badge');
  const extStatus = document.getElementById('ext-status-badge');

  if (liStatus) {
    liStatus.textContent = connected ? '✅ LinkedIn connecté' : '⚪ LinkedIn non connecté';
    liStatus.className = 'li-badge ' + (connected ? 'li-ok' : 'li-off');
  }
  if (extStatus) {
    extStatus.textContent = extOk ? '✅ Extension active' : '⚪ Extension non installée';
    extStatus.className = 'li-badge ' + (extOk ? 'li-ok' : 'li-off');
  }

  // Boutons connect/disconnect
  const btnConnect = document.getElementById('btn-li-connect');
  const btnDisconnect = document.getElementById('btn-li-disconnect');
  if (btnConnect) btnConnect.style.display = connected ? 'none' : 'inline-flex';
  if (btnDisconnect) btnDisconnect.style.display = connected ? 'inline-flex' : 'none';
}

// Vérifier si retour OAuth (linkedin=ok dans l'URL)
function checkLinkedInCallback() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('linkedin') === 'ok') {
    const code = localStorage.getItem('bes_li_code');
    if (code) {
      // Le token doit être échangé côté serveur normalement.
      // Pour GitHub Pages (statique), on stocke le code et on informe l'utilisateur.
      localStorage.removeItem('bes_li_code');
      besToast('✅ LinkedIn autorisé ! Configure ton token dans Paramètres.');
      // Nettoyer l'URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }
}

// ─── Init LinkedIn ────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  checkLinkedInCallback();
  updateLinkedInUI();
});
