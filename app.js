// ─── Navigation ───────────────────────────────────────────────────────────────

let currentFilter = 'all';
let lastGeneratedProspect = null;

document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('page-' + btn.dataset.page).classList.add('active');
    if (btn.dataset.page === 'pipeline') loadPipeline();
    if (btn.dataset.page === 'dashboard') loadDashboard();
    if (btn.dataset.page === 'posts') loadPosts();
  });
});

// ─── Toast ────────────────────────────────────────────────────────────────────

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusTag(s) {
  const map = {
    'à envoyer': 'tag-envoyer',
    'envoyé': 'tag-envoye',
    'répondu': 'tag-repondu',
    'relance J4': 'tag-relance',
    'relance J12': 'tag-relance',
    'fermé positif': 'tag-positif',
    'fermé négatif': 'tag-negatif'
  };
  return `<span class="tag ${map[s] || 'tag-envoyer'}">${s}</span>`;
}

async function api(url, method = 'GET', body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(url, opts);
  return r.json();
}

function copyText(text) {
  navigator.clipboard.writeText(text).then(() => toast('✓ Copié dans le presse-papier'));
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

async function loadDashboard() {
  const kpis = await api('/api/kpis');
  const leads = await api('/api/leads');

  document.getElementById('dash-mois').textContent = kpis.mois || '';
  document.getElementById('k-ca').textContent = (kpis.ca || 0).toLocaleString('fr-FR') + ' €';
  document.getElementById('k-formations').textContent = kpis.formations || 0;
  document.getElementById('k-devis').textContent = kpis.devis || 0;
  document.getElementById('k-prospects').textContent = kpis.prospects || 0;
  document.getElementById('k-reponses').textContent = kpis.reponses || 0;
  document.getElementById('k-posts').textContent = kpis.posts || 0;

  // Progress
  const pct = Math.min(100, Math.round((kpis.ca || 0) / 3000 * 100));
  document.getElementById('dash-progress').style.width = pct + '%';
  document.getElementById('dash-progress-label').textContent = pct + ' % de l\'objectif septembre (3 000 €)';

  // Relances
  const relances = leads.filter(l => l.statut === 'relance J4').length;
  document.getElementById('dash-relances').textContent = relances + (relances > 1 ? ' prospects' : ' prospect');

  // Table derniers leads
  const tbody = document.getElementById('dash-leads-body');
  const recent = [...leads].reverse().slice(0, 5);
  if (recent.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="color:var(--text-muted);text-align:center;padding:20px;">Aucun prospect. Allez dans Prospection.</td></tr>';
  } else {
    tbody.innerHTML = recent.map(l => `
      <tr>
        <td style="font-weight:500;">${l.nom || ''}</td>
        <td style="color:var(--text-muted);">${l.entreprise || ''}</td>
        <td style="color:var(--text-muted);">${l.poste || ''}</td>
        <td style="color:var(--text-muted);">${l.canal || ''}</td>
        <td>${statusTag(l.statut || 'à envoyer')}</td>
        <td style="color:var(--text-muted);">${l.date || ''}</td>
      </tr>`).join('');
  }
}

// KPI edits
document.querySelectorAll('.kpi-edit').forEach(btn => {
  btn.addEventListener('click', () => {
    document.getElementById('kpi-key').value = btn.dataset.kpi;
    document.getElementById('kpi-val').value = '';
    document.getElementById('modal-kpi').classList.add('open');
  });
});
document.getElementById('btn-kpi-cancel').addEventListener('click', () => {
  document.getElementById('modal-kpi').classList.remove('open');
});
document.getElementById('btn-kpi-save').addEventListener('click', async () => {
  const key = document.getElementById('kpi-key').value;
  const val = parseInt(document.getElementById('kpi-val').value) || 0;
  await api('/api/kpis', 'PUT', { [key]: val });
  document.getElementById('modal-kpi').classList.remove('open');
  toast('KPI mis à jour');
  loadDashboard();
});

// ─── Prospection ──────────────────────────────────────────────────────────────

document.getElementById('btn-generate-prospect').addEventListener('click', async () => {
  const nom = document.getElementById('p-nom').value.trim();
  const entreprise = document.getElementById('p-entreprise').value.trim();
  if (!nom || !entreprise) { toast('⚠ Nom et entreprise requis'); return; }

  const btn = document.getElementById('btn-generate-prospect');
  btn.innerHTML = '<span class="spinner"></span> Génération...';
  btn.disabled = true;

  // Reset outputs
  ['out-linkedin', 'out-email-j0', 'out-email-j4'].forEach(id => {
    document.getElementById(id).innerHTML = '<span class="output-placeholder">Génération en cours...</span>';
  });
  document.getElementById('out-objet').textContent = '—';

  try {
    const data = await api('/api/generate/prospect', 'POST', {
      nom, entreprise,
      poste: document.getElementById('p-poste').value.trim(),
      canal: document.getElementById('p-canal').value,
      signal: document.getElementById('p-signal').value.trim()
    });

    if (data.error) { toast('Erreur : ' + data.error); return; }

    lastGeneratedProspect = { nom, entreprise, poste: document.getElementById('p-poste').value, canal: document.getElementById('p-canal').value, ...data };

    const liDiv = document.getElementById('out-linkedin');
    liDiv.innerHTML = `<button class="output-copy" onclick="copyText(\`${data.linkedin.replace(/`/g, '\\`')}\`)">Copier</button>${data.linkedin}`;
    document.getElementById('count-linkedin').textContent = `${data.linkedin.length} caractères`;

    document.getElementById('out-objet').textContent = data.email_objet || '';
    document.getElementById('out-email-j0').innerHTML = `<button class="output-copy" onclick="copyText(\`${(data.email_j0 || '').replace(/`/g, '\\`')}\`)">Copier</button>${data.email_j0 || ''}`;
    document.getElementById('out-email-j4').innerHTML = `<button class="output-copy" onclick="copyText(\`${(data.email_j4 || '').replace(/`/g, '\\`')}\`)">Copier</button>${data.email_j4 || ''}`;

    document.getElementById('btn-save-lead').disabled = false;
  } catch (e) {
    toast('Erreur réseau');
  } finally {
    btn.innerHTML = '<span>⚡</span> Générer les messages';
    btn.disabled = false;
  }
});

document.getElementById('btn-save-lead').addEventListener('click', async () => {
  if (!lastGeneratedProspect) return;
  await api('/api/leads', 'POST', {
    nom: lastGeneratedProspect.nom,
    entreprise: lastGeneratedProspect.entreprise,
    poste: lastGeneratedProspect.poste,
    canal: lastGeneratedProspect.canal,
    message: lastGeneratedProspect.linkedin,
    email_j0: lastGeneratedProspect.email_j0,
    email_j4: lastGeneratedProspect.email_j4,
    statut: 'à envoyer'
  });
  // Update prospect KPI
  const kpis = await api('/api/kpis');
  await api('/api/kpis', 'PUT', { prospects: (kpis.prospects || 0) + 1 });
  toast('✓ Prospect ajouté au pipeline');
  document.getElementById('btn-save-lead').disabled = true;
});

// ─── Pipeline ─────────────────────────────────────────────────────────────────

async function loadPipeline(filter = currentFilter) {
  currentFilter = filter;
  const leads = await api('/api/leads');
  const filtered = filter === 'all' ? leads : leads.filter(l => l.statut === filter);

  // Update filter buttons
  document.querySelectorAll('#pipeline-filters button').forEach(b => {
    b.classList.toggle('btn-secondary', b.dataset.filter === filter);
    b.classList.toggle('btn-ghost', b.dataset.filter !== filter);
  });

  const tbody = document.getElementById('pipeline-body');
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="color:var(--text-muted);text-align:center;padding:24px;">Aucun prospect dans cette catégorie.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(l => `
    <tr>
      <td style="font-weight:500;">${l.nom || ''}</td>
      <td style="color:var(--text-muted);">${l.entreprise || ''}</td>
      <td style="color:var(--text-muted);">${l.poste || ''}</td>
      <td style="color:var(--text-muted);">${l.canal || ''}</td>
      <td>
        <select class="form-select" style="padding:4px 8px;font-size:12px;background:var(--surface);" 
          onchange="updateStatus(${l._id}, this.value)" data-current="${l.statut || ''}">
          ${['à envoyer','envoyé','répondu','relance J4','relance J12','fermé positif','fermé négatif']
            .map(s => `<option${s === l.statut ? ' selected' : ''}>${s}</option>`).join('')}
        </select>
      </td>
      <td style="color:var(--text-muted);">${l.date || ''}</td>
      <td style="display:flex;gap:5px;align-items:center">
        <button class="btn btn-secondary" style="font-size:11px;padding:4px 8px;background:#0077b5;color:#fff;border:none" onclick="sendViaExtension(${l._id - 1})" title="Envoyer sur LinkedIn">📤</button>
        <button class="btn btn-ghost" style="color:var(--red);font-size:12px;" onclick="deleteLead(${l._id})">✕</button>
      </td>
    </tr>`).join('');
}

async function updateStatus(id, status) {
  await api('/api/leads/' + id, 'PUT', { statut: status });
  if (status === 'répondu') {
    const kpis = await api('/api/kpis');
    await api('/api/kpis', 'PUT', { reponses: (kpis.reponses || 0) + 1 });
  }
  toast('Statut mis à jour');
}

async function deleteLead(id) {
  if (!confirm('Supprimer ce prospect ?')) return;
  await api('/api/leads/' + id, 'DELETE');
  loadPipeline();
  toast('Prospect supprimé');
}

document.querySelectorAll('#pipeline-filters button').forEach(b => {
  b.addEventListener('click', () => loadPipeline(b.dataset.filter));
});

// Modal ajout manuel
document.getElementById('btn-add-lead-manual').addEventListener('click', () => {
  document.getElementById('modal-add-lead').classList.add('open');
});
document.getElementById('btn-modal-cancel').addEventListener('click', () => {
  document.getElementById('modal-add-lead').classList.remove('open');
});
document.getElementById('btn-modal-save').addEventListener('click', async () => {
  const nom = document.getElementById('m-nom').value.trim();
  const entreprise = document.getElementById('m-entreprise').value.trim();
  if (!nom || !entreprise) { toast('Nom et entreprise requis'); return; }
  await api('/api/leads', 'POST', {
    nom, entreprise,
    poste: document.getElementById('m-poste').value,
    canal: document.getElementById('m-canal').value,
    statut: document.getElementById('m-statut').value,
    message: '', email_j0: '', email_j4: ''
  });
  document.getElementById('modal-add-lead').classList.remove('open');
  ['m-nom','m-entreprise','m-poste'].forEach(id => document.getElementById(id).value = '');
  loadPipeline();
  toast('Prospect ajouté');
});

// ─── Posts LinkedIn ───────────────────────────────────────────────────────────

let lastPostAngle = null;

async function genPost() {
  const btn = document.getElementById('btn-gen-post');
  btn.innerHTML = '<span class="spinner"></span> Génération...';
  btn.disabled = true;
  document.getElementById('btn-regen-post').disabled = true;
  document.getElementById('out-post').innerHTML = '<span class="output-placeholder">Génération en cours...</span>';

  const angle = document.getElementById('post-angle').value;
  lastPostAngle = angle;

  try {
    const data = await api('/api/generate/post', 'POST', {
      angle,
      icp: document.getElementById('post-icp').value,
      detail: document.getElementById('post-detail').value.trim()
    });

    if (data.error) { toast('Erreur : ' + data.error); return; }
    document.getElementById('out-post').textContent = data.texte || '';

    // Update KPI posts
    const kpis = await api('/api/kpis');
    await api('/api/kpis', 'PUT', { posts: (kpis.posts || 0) + 1 });

    loadPosts();
  } catch (e) {
    toast('Erreur réseau');
  } finally {
    btn.innerHTML = '<span>✍️</span> Générer le post';
    btn.disabled = false;
    document.getElementById('btn-regen-post').disabled = false;
  }
}

document.getElementById('btn-gen-post').addEventListener('click', genPost);
document.getElementById('btn-regen-post').addEventListener('click', genPost);
document.getElementById('btn-copy-post').addEventListener('click', () => {
  const t = document.getElementById('out-post').textContent;
  if (t && !t.includes('apparaîtra')) copyText(t);
});

async function loadPosts() {
  const posts = await api('/api/posts');
  const list = document.getElementById('posts-list');
  document.getElementById('posts-count').textContent = posts.length ? `(${posts.length})` : '';

  if (posts.length === 0) {
    list.innerHTML = '<div style="color:var(--text-muted);font-size:13px;text-align:center;padding:24px;">Aucun post généré pour l\'instant.</div>';
    return;
  }

  const angleLabels = {
    reglementaire: '⚖️ Réglementaire',
    ve: '🔋 VE / NF C 18-550',
    reactivite: '⚡ Réactivité 24h',
    preuve: '🌟 Preuve sociale'
  };

  list.innerHTML = posts.map((p, i) => `
    <div class="post-card">
      <div class="post-card-header">
        <div style="display:flex;gap:8px;align-items:center;">
          <span class="tag tag-envoyer">${angleLabels[p.angle] || p.angle}</span>
          <span style="font-size:11px;color:var(--text-muted);">${p.icp || ''}</span>
        </div>
        <div class="post-card-meta">${p.date || ''} · ${p.créneau || ''}</div>
      </div>
      <div class="post-card-body">${p.texte || ''}</div>
      <div class="post-card-actions">
        <button class="btn btn-secondary" style="font-size:12px;padding:6px 12px;" onclick="copyText(\`${(p.texte || '').replace(/`/g, '\\`').replace(/\n/g, '\\n')}\`)">📋 Copier</button>
        <button class="btn btn-ghost" style="font-size:12px;color:var(--red);" onclick="deletePost(${i})">✕ Supprimer</button>
      </div>
    </div>`).join('');
}

async function deletePost(idx) {
  await api('/api/posts/' + idx, 'DELETE');
  loadPosts();
  toast('Post supprimé');
}

// ─── Init ─────────────────────────────────────────────────────────────────────

loadDashboard();

// ─── LinkedIn handlers ────────────────────────────────────────────────────────

document.getElementById('btn-li-save-config')?.addEventListener('click', () => {
  const clientId = document.getElementById('li-client-id').value.trim();
  const token = document.getElementById('li-token').value.trim();
  if (clientId) localStorage.setItem('bes_li_client_id', clientId);
  if (token && !token.includes('***')) localStorage.setItem('bes_li_token', token);
  if (typeof updateLinkedInUI === 'function') updateLinkedInUI();
  toast('Configuration LinkedIn sauvegardée ✓');
});

document.getElementById('btn-li-connect')?.addEventListener('click', () => {
  if (typeof LI !== 'undefined') LI.connect();
  else toast('Sauvegarde ton Client ID d\'abord');
});
document.getElementById('btn-li-disconnect')?.addEventListener('click', () => {
  if (typeof LI !== 'undefined') LI.disconnect();
});

document.getElementById('btn-ext-save')?.addEventListener('click', () => {
  const id = document.getElementById('li-ext-id').value.trim();
  if (id) { localStorage.setItem('bes_ext_id', id); toast('ID extension sauvegardé ✓'); }
  if (typeof updateLinkedInUI === 'function') updateLinkedInUI();
});

document.getElementById('btn-li-publish')?.addEventListener('click', async () => {
  const text = document.getElementById('li-test-post').value.trim();
  if (!text) { toast('Entre le texte du post'); return; }
  const btn = document.getElementById('btn-li-publish');
  btn.innerHTML = '<span class="spinner"></span> Publication...';
  btn.disabled = true;
  try {
    if (typeof LI !== 'undefined') {
      const ok = await LI.publishPost(text);
      if (ok) { toast('✅ Post publié sur LinkedIn !'); document.getElementById('li-test-post').value = ''; }
    }
  } finally {
    btn.innerHTML = '📤 Publier sur LinkedIn';
    btn.disabled = false;
  }
});

document.getElementById('btn-li-copy-post')?.addEventListener('click', () => {
  const t = document.getElementById('li-test-post').value;
  if (t) copyText(t);
});

function sendViaExtension(idx) {
  const leads = JSON.parse(localStorage.getItem('bes_leads') || '[]');
  const lead = leads[idx];
  if (!lead) return;
  const msg = lead.msg || lead.message || '';
  if (typeof EXT !== 'undefined' && EXT.isAvailable()) {
    EXT.sendMessage(lead);
    toast('📤 Ouverture LinkedIn pour ' + lead.nom);
  } else {
    if (msg) copyText(msg);
    const query = encodeURIComponent((lead.nom || '') + ' ' + (lead.ent || ''));
    window.open('https://www.linkedin.com/search/results/people/?keywords=' + query, '_blank');
    toast('📋 Message copié + LinkedIn ouvert');
  }
  lead.statut = 'envoyé';
  leads[idx] = lead;
  localStorage.setItem('bes_leads', JSON.stringify(leads));
  renderPipeline();
}
window.sendViaExtension = sendViaExtension;

function loadLinkedInConfig() {
  const cid = localStorage.getItem('bes_li_client_id');
  const tok = localStorage.getItem('bes_li_token');
  const ext = localStorage.getItem('bes_ext_id');
  if (cid && document.getElementById('li-client-id')) document.getElementById('li-client-id').value = cid;
  if (tok && document.getElementById('li-token')) document.getElementById('li-token').placeholder = '•••• (token sauvegardé)';
  if (ext && document.getElementById('li-ext-id')) document.getElementById('li-ext-id').value = ext;
}
loadLinkedInConfig();
