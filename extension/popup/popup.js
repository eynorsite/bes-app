// Popup BES Extension

function toast(msg, ok = true) {
  const el = document.getElementById('status-msg');
  el.textContent = msg;
  el.style.color = ok ? '#4ade80' : '#f87171';
  el.style.display = 'block';
  setTimeout(() => el.style.display = 'none', 3000);
}

// Vérifier si on est sur LinkedIn
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const url = tabs[0]?.url || '';
  const st = document.getElementById('linkedin-status');
  if (url.includes('linkedin.com')) {
    st.className = 'li-on';
    st.textContent = '✅ LinkedIn ouvert — envoi direct possible';
  } else {
    st.className = 'li-off';
    st.textContent = '⚠️ Ouvrez LinkedIn pour envoyer les messages';
  }
});

// Charger les leads depuis localStorage de la webapp via storage
function loadLeads() {
  // D'abord essayer le storage local de l'extension
  chrome.storage.local.get(['bes_synced_leads'], (result) => {
    const leads = result.bes_synced_leads || [];
    renderLeads(leads.filter(l => l.statut === 'à envoyer' || !l.statut));
  });

  // Essayer aussi d'injecter un script pour lire le localStorage de la webapp
  chrome.tabs.query({ url: 'https://eynorsite.github.io/bes-app/*' }, (tabs) => {
    if (tabs.length > 0) {
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: () => {
          try {
            return JSON.parse(localStorage.getItem('bes_leads') || '[]');
          } catch { return []; }
        }
      }, (results) => {
        if (results && results[0]?.result) {
          const leads = results[0].result;
          chrome.storage.local.set({ bes_synced_leads: leads });
          renderLeads(leads.filter(l => l.statut === 'à envoyer' || !l.statut));
        }
      });
    }
  });
}

function renderLeads(leads) {
  const list = document.getElementById('leads-list');
  if (!leads.length) {
    list.innerHTML = '<div class="empty">Aucun prospect "à envoyer".<br>Créez-en dans la webapp.</div>';
    return;
  }

  list.innerHTML = leads.slice(0, 6).map((l, i) => `
    <div class="lead-item" onclick="sendToLinkedIn(${i}, ${JSON.stringify(l).replace(/"/g, '&quot;')})">
      <div class="lead-name">${l.nom || ''}</div>
      <div class="lead-sub">${l.ent || ''} · ${l.poste || ''}</div>
      <span class="tag t-send">à envoyer</span>
      <span style="font-size:10px;color:#5f6880;margin-left:6px">${l.canal || 'LinkedIn'}</span>
    </div>
  `).join('');
}

function sendToLinkedIn(idx, lead) {
  const message = lead.msg || lead.message || '';
  if (!message) {
    toast('Pas de message généré pour ce prospect', false);
    return;
  }

  // Construire l'URL de recherche LinkedIn si pas d'URL directe
  const searchQuery = encodeURIComponent(`${lead.nom} ${lead.ent}`);
  const profileUrl = lead.linkedinUrl ||
    `https://www.linkedin.com/search/results/people/?keywords=${searchQuery}`;

  // Envoyer au background pour ouvrir le profil et injecter le message
  chrome.runtime.sendMessage({
    type: 'SEND_LINKEDIN_MESSAGE',
    profileUrl,
    message,
    prospectName: lead.nom
  });

  toast(`Ouverture du profil de ${lead.nom}...`);
}

document.getElementById('btn-refresh').addEventListener('click', () => {
  loadLeads();
  toast('Leads mis à jour');
});

// Init
loadLeads();
