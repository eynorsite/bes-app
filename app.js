// ─── BES App v3 — Fonctionnalités complètes ──────────────────────────────────

// Config API — serveur local si disponible, sinon mode offline
const API_BASE = (() => {
  const saved = localStorage.getItem('bes_api_url');
  return saved || '';
})();

let _apiAvailable = false;

async function checkApi() {
  const url = localStorage.getItem('bes_api_url') || 'http://localhost:3737';
  try {
    const r = await fetch(url + '/api/health', { signal: AbortSignal.timeout(2000) });
    if (r.ok) { _apiAvailable = true; window._apiBase = url; return true; }
  } catch {}
  _apiAvailable = false;
  return false;
}

async function api(path, method = 'GET', body = null) {
  const base = window._apiBase || localStorage.getItem('bes_api_url') || 'http://localhost:3737';
  if (!_apiAvailable) return null;
  try {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const r = await fetch(base + path, opts);
    return r.json();
  } catch { return null; }
}

// LocalStorage fallback
const S = {
  get(k, d) { try { return JSON.parse(localStorage.getItem('bes_' + k)) || d; } catch { return d; } },
  set(k, v) { localStorage.setItem('bes_' + k, JSON.stringify(v)); }
};

const K0 = { prospects:0, reponses:0, formations:0, posts:0, ca:0 };
const COLORS = ['#6D1FE0','#2563eb','#16a34a','#ea580c','#dc2626','#0891b2','#7c3aed','#059669','#d97706','#be185d'];

// ─── Navigation ───────────────────────────────────────────────────────────────

function goPage(id) {
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.p === id));
  document.querySelectorAll('.page').forEach(p => p.classList.toggle('on', p.id === 'p-' + id));
  const handlers = { dash: renderDash, pipe: renderPipe, posts: renderPosts, studio: renderStudio, camp: renderCampaigns };
  if (handlers[id]) handlers[id]();
}
document.querySelectorAll('.nav-btn').forEach(b => b.addEventListener('click', () => goPage(b.dataset.p)));
window.goPage = goPage;

// ─── Toast ────────────────────────────────────────────────────────────────────

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('on');
  setTimeout(() => t.classList.remove('on'), 3000);
}

function closeMo(id) { document.getElementById(id).classList.remove('on'); }
window.closeMo = closeMo;

function cp(text) {
  navigator.clipboard.writeText(text).then(() => toast('✓ Copié !')).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); document.body.removeChild(ta); toast('✓ Copié !');
  });
}
window.cp = cp;
function esc(s) { return (s||'').replace(/\\/g,'\\\\').replace(/`/g,'\\`').replace(/\$/g,'\\$').replace(/\n/g,'\\n'); }

// ─── Status indicator ─────────────────────────────────────────────────────────

function updateApiStatus() {
  const el = document.getElementById('api-status');
  if (!el) return;
  el.textContent = _apiAvailable ? '🟢 IA connectée' : '🟡 Mode hors-ligne';
  el.style.color = _apiAvailable ? '#16a34a' : '#ea580c';
}

// ─── Data layer (API ou localStorage) ────────────────────────────────────────

async function getLeads() {
  if (_apiAvailable) { const d = await api('/api/leads'); if (d) return d; }
  return S.get('leads', []);
}
async function saveLeadLocal(lead) {
  const leads = S.get('leads', []); leads.push({ ...lead, id: Date.now(), messages: [] }); S.set('leads', leads);
}
async function updateLeadLocal(id, data) {
  const leads = S.get('leads', []);
  const idx = leads.findIndex(l => l.id == id);
  if (idx >= 0) { leads[idx] = { ...leads[idx], ...data }; S.set('leads', leads); }
}

async function getKpis() {
  if (_apiAvailable) { const d = await api('/api/kpis'); if (d) return d; }
  return S.get('kpis', K0);
}
async function saveKpis(data) {
  S.set('kpis', data);
  if (_apiAvailable) await api('/api/kpis', 'PUT', data);
}

async function getStyles() {
  if (_apiAvailable) { const d = await api('/api/styles'); if (d) return d; }
  return S.get('styles', []);
}
async function saveStyle(style) {
  if (_apiAvailable) { await api('/api/styles', 'POST', style); } else {
    const s = S.get('styles', []); s.push({ ...style, id: Date.now() }); S.set('styles', s);
  }
}
async function deleteStyle(id) {
  if (_apiAvailable) { await api('/api/styles/' + id, 'DELETE'); } else {
    const s = S.get('styles', []).filter(x => x.id != id); S.set('styles', s);
  }
}

async function getCampaigns() {
  if (_apiAvailable) { const d = await api('/api/campaigns'); if (d) return d; }
  return S.get('campaigns', []);
}
async function saveCampaign(camp) {
  if (_apiAvailable) { return api('/api/campaigns', 'POST', camp); }
  const c = S.get('campaigns', []); const nc = { ...camp, id: Date.now(), createdAt: new Date().toLocaleDateString('fr-FR'), status:'active', sent:0, replies:0 }; c.push(nc); S.set('campaigns', c); return { ok:true, campaign:nc };
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

let _period = 7;

document.querySelectorAll('.period-btn').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('.period-btn').forEach(x => x.classList.remove('active'));
  b.classList.add('active'); _period = parseInt(b.dataset.days);
  document.getElementById('activity-period').textContent = `${_period} derniers jours`;
  renderDash();
}));

async function renderDash() {
  const kpis = await getKpis();
  const leads = await getLeads();

  const now = new Date();
  const DAY = ['DIMANCHE','LUNDI','MARDI','MERCREDI','JEUDI','VENDREDI','SAMEDI'];
  const MON = ['JANVIER','FÉVRIER','MARS','AVRIL','MAI','JUIN','JUILLET','AOÛT','SEPTEMBRE','OCTOBRE','NOVEMBRE','DÉCEMBRE'];
  const dEl = document.getElementById('d-date');
  if (dEl) dEl.textContent = `${DAY[now.getDay()]} ${now.getDate()} ${MON[now.getMonth()]}`;

  document.getElementById('kv-prospects').textContent = kpis.prospects || 0;
  document.getElementById('kv-reponses').textContent = kpis.reponses || 0;
  document.getElementById('kv-formations').textContent = kpis.formations || 0;
  const pct = kpis.prospects ? Math.round((kpis.reponses / kpis.prospects) * 100) : 0;
  document.getElementById('kv-pct').textContent = pct + ' %';
  document.getElementById('activity-total').textContent = kpis.prospects || 0;

  // Bar chart
  const barData = Array.from({ length: Math.min(_period, 14) }, (_, i) => ({
    inv: Math.max(0, Math.round((kpis.prospects || 0) / _period * (0.5 + Math.random()))),
    msg: Math.max(0, Math.round((kpis.reponses || 0) / _period * (0.5 + Math.random())))
  }));
  renderBarChart(barData);

  // À faire
  const todo = leads.filter(l => ['à envoyer','relance J4','relance J12'].includes(l.statut));
  document.getElementById('todo-count').textContent = todo.length;
  const tEl = document.getElementById('todo-list');
  if (!todo.length) {
    tEl.innerHTML = '<div style="padding:20px 18px;font-size:13px;color:var(--txm);text-align:center">Aucun prospect à relancer.</div>';
  } else {
    tEl.innerHTML = todo.slice(0, 8).map((l, i) => {
      const col = COLORS[i % COLORS.length];
      const init = (l.nom||'?').split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase();
      const action = l.statut === 'à envoyer' ? 'Envoyer' : 'Répondre';
      return `<div class="todo-item" onclick="openTodoAction(${JSON.stringify(l).replace(/"/g,'&quot;')})">
        <div class="todo-av" style="background:${col}">${init}</div>
        <div style="flex:1">
          <div class="todo-name">${l.nom||''}</div>
          <div style="font-size:11px;color:var(--txm)">${l.ent||''}</div>
        </div>
        <div class="todo-action">${action}</div>
      </div>`;
    }).join('');
  }
}

function renderBarChart(data) {
  const wrap = document.getElementById('bar-chart');
  if (!wrap) return;
  const maxH = 90;
  const max = Math.max(...data.map(d => Math.max(d.inv, d.msg)), 1);
  wrap.innerHTML = data.map(d => {
    const hi = Math.max(3, Math.round((d.inv/max)*maxH));
    const hm = Math.max(2, Math.round((d.msg/max)*maxH/2));
    return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;justify-content:flex-end">
      <div style="width:100%;border-radius:3px 3px 0 0;background:#111;height:${hi}px"></div>
      <div style="width:70%;border-radius:3px 3px 0 0;background:#d1d5db;height:${hm}px"></div>
    </div>`;
  }).join('');
}

function openTodoAction(lead) {
  const msg = lead.msg || '';
  if (msg) cp(msg);
  const q = encodeURIComponent((lead.nom||'') + ' ' + (lead.ent||''));
  window.open('https://www.linkedin.com/search/results/people/?keywords=' + q, '_blank');
  toast('📋 Message copié + LinkedIn ouvert');
}
window.openTodoAction = openTodoAction;

let _kpiKey = '';
const kpiLabels = { prospects:'Prospects contactés', reponses:'Réponses reçues', formations:'Qualifiés', posts:'Posts publiés', ca:'CA signé (€)' };
function editKpi(k) {
  _kpiKey = k;
  getKpis().then(kpis => {
    document.getElementById('kpi-lbl').textContent = kpiLabels[k]||k;
    document.getElementById('kpi-input').value = kpis[k]||0;
    document.getElementById('mo-kpi').classList.add('on');
  });
}
window.editKpi = editKpi;
async function saveKpi() {
  const kpis = await getKpis();
  kpis[_kpiKey] = parseInt(document.getElementById('kpi-input').value)||0;
  await saveKpis(kpis);
  closeMo('mo-kpi'); toast('KPI mis à jour ✓'); renderDash();
}
window.saveKpi = saveKpi;

// ─── Prospection ──────────────────────────────────────────────────────────────

// Templates locaux (fallback sans API)
const msgTpl = {
  drh_emploi: (n,e) => ({ li:`${n.split(' ')[0]}, j'ai vu votre offre chez ${e}. L'habilitation électrique se pose vite. Formateur Qualiopi en Gironde, devis 24h.`, obj:`Habilitation électrique pour votre recrutement`, j0:`Bonjour ${n.split(' ')[0]},\n\nVotre offre chez ${e} m'a interpellé.\n\nQuand on recrute un technicien, l'habilitation électrique NF C 18-510 arrive vite. Trouver quelqu'un de disponible en Gironde sous 2 semaines, c'est rarement simple.\n\nJe suis formateur Qualiopi, réponse 24h. Vos techniciens sur installations électriques sont à jour ?`, j4:`Bonjour ${n.split(' ')[0]},\n\nJe reviens sur l'habilitation électrique pour votre recrutement.\n\nDisponible sous 2 semaines en Gironde si le besoin se précise.\n\nUlrich — EYNOR Formation` }),
  ve_ve: (n,e) => ({ li:`${n.split(' ')[0]}, avec les VE chez ${e}, vos équipes ont-elles la NF C 18-550 ? Seul formateur positionné dessus en Gironde.`, obj:`Habilitation VE NF C 18-550`, j0:`Bonjour ${n.split(' ')[0]},\n\nLes entreprises qui gèrent des VE ou des bornes IRVE sont concernées par la NF C 18-550 — obligation souvent ignorée.\n\nJe suis le seul formateur Qualiopi positionné dessus en Gironde. Diagnostic gratuit 15 min pour savoir si vous êtes concerné chez ${e}.`, j4:`Bonjour ${n.split(' ')[0]},\n\nJe reviens sur l'habilitation VE. Un point rapide suffit à clarifier si vos équipes sont concernées.\n\nUlrich — EYNOR Formation` }),
  default: (n,e) => ({ li:`${n.split(' ')[0]}, formateur habilitation électrique NF C 18-510 en Gironde. Devis 24h, intra possible chez ${e} sous 2 semaines.`, obj:`Formation habilitation électrique — EYNOR Formation`, j0:`Bonjour ${n.split(' ')[0]},\n\nJe suis formateur Qualiopi NF C 18-510 basé en Gironde.\n\nRéponse 24h. Disponible en intra chez vous sous 2 semaines.\n\nUn besoin de formation ou de recyclage chez ${e} cette année ?`, j4:`Bonjour ${n.split(' ')[0]},\n\nJe reviens sur la formation habilitation.\n\nDisponible rapidement en Gironde si le besoin se confirme.\n\nUlrich — EYNOR Formation` })
};

function getLocalTemplate(icp, signal, nom, ent) {
  const key = icp + '_' + signal;
  const fn = msgTpl[key] || msgTpl[icp + '_default'] || msgTpl.default;
  return fn(nom, ent);
}

let _lastPros = null;

document.getElementById('btn-gen-p').addEventListener('click', async () => {
  const nom = document.getElementById('r-nom').value.trim();
  const ent = document.getElementById('r-ent').value.trim();
  if (!nom || !ent) { toast('⚠ Nom et entreprise requis'); return; }

  const btn = document.getElementById('btn-gen-p');
  btn.innerHTML = '<span class="sp"></span> Génération...'; btn.disabled = true;

  const icp = document.getElementById('r-icp').value;
  const signal = document.getElementById('r-signal').value;
  const poste = document.getElementById('r-poste').value.trim();

  let t;
  if (_apiAvailable) {
    const d = await api('/api/generate/prospect', 'POST', { nom, entreprise: ent, poste, signal, icp });
    if (d && d.linkedin) {
      t = { li: d.linkedin, obj: d.email_objet, j0: d.email_j0, j4: d.email_j4 };
    }
  }
  if (!t) t = getLocalTemplate(icp, signal, nom, ent);

  document.getElementById('out-li').innerHTML = `<button class="copy-btn" onclick="cp(\`${esc(t.li)}\`)">Copier</button>${t.li}`;
  document.getElementById('li-count').textContent = `(${t.li.length}/200)`;
  document.getElementById('out-obj').textContent = t.obj;
  document.getElementById('out-j0').innerHTML = `<button class="copy-btn" onclick="cp(\`${esc(t.j0)}\`)">Copier</button>${t.j0}`;
  document.getElementById('out-j4').innerHTML = `<button class="copy-btn" onclick="cp(\`${esc(t.j4)}\`)">Copier</button>${t.j4}`;
  document.getElementById('prompt-box').classList.add('on');
  document.getElementById('prompt-txt').textContent = `Génère un message LinkedIn (< 200 car.) + email J0 + relance J4 pour :\n- Nom : ${nom}\n- Entreprise : ${ent}\n- Poste : ${poste||'non précisé'}\n- Signal : ${signal}\n\nTon EYNOR : pair expert, concret, jamais vendeur. Pas de RDV au 1er contact.`;

  _lastPros = { nom, ent, poste, canal: icp==='of'?'Email':'LinkedIn', msg:t.li, j0:t.j0, j4:t.j4, statut:'à envoyer', date:new Date().toLocaleDateString('fr-FR') };
  document.getElementById('btn-save-p').disabled = false;
  btn.innerHTML = '⚡ Générer les messages'; btn.disabled = false;
});

document.getElementById('btn-save-p').addEventListener('click', async () => {
  if (!_lastPros) return;
  if (_apiAvailable) { await api('/api/leads', 'POST', _lastPros); } else { saveLeadLocal(_lastPros); }
  const k = await getKpis(); k.prospects = (k.prospects||0)+1; await saveKpis(k);
  toast('✓ Prospect ajouté au CRM');
  document.getElementById('btn-save-p').disabled = true;
  _lastPros = null;
});

// ─── CRM avec historique ──────────────────────────────────────────────────────

let _pf = 'all';
let _selectedLead = null;

function stTag(s) {
  const m = {'à envoyer':'t-send','envoyé':'t-sent','répondu':'t-rep','relance J4':'t-rel','relance J12':'t-rel','fermé positif':'t-pos','fermé négatif':'t-neg'};
  return `<span class="tag ${m[s]||'t-send'}">${s}</span>`;
}

async function renderPipe(f) {
  if (f !== undefined) _pf = f;
  const all = await getLeads();
  const leads = _pf === 'all' ? all : all.filter(l => l.statut === _pf);

  document.querySelectorAll('#pipe-filters button').forEach(b => {
    b.className = b.dataset.f === _pf ? 'btn btn-p' : 'btn btn-s';
    b.style.fontSize = '12px'; b.style.padding = '5px 12px';
  });

  const tb = document.getElementById('pipe-body');
  if (!leads.length) { tb.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--txm);padding:24px">Aucun prospect ici.</td></tr>`; return; }

  tb.innerHTML = leads.map((l, i) => `
    <tr style="cursor:pointer" onclick="openLeadDetail(${JSON.stringify(l).replace(/"/g,'&quot;')})">
      <td><div style="display:flex;align-items:center;gap:8px">
        <div style="width:28px;height:28px;border-radius:50%;background:${COLORS[i%COLORS.length]};display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:600;flex-shrink:0">${(l.nom||'?').split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase()}</div>
        <div>
          <div style="font-weight:500">${l.nom||''}</div>
          ${l.messages?.length ? `<div style="font-size:10px;color:var(--txm)">${l.messages.length} message${l.messages.length>1?'s':''}</div>` : ''}
        </div>
      </div></td>
      <td style="color:var(--txm)">${l.ent||''}</td>
      <td style="color:var(--txm)">${l.poste||''}</td>
      <td style="color:var(--txm)">${l.canal||''}</td>
      <td>
        <select style="border:1px solid var(--brd);border-radius:6px;padding:3px 7px;font-size:12px;background:var(--surf);outline:none" onchange="updStatus(${l.id},this.value);event.stopPropagation()" onclick="event.stopPropagation()">
          ${['à envoyer','envoyé','répondu','relance J4','relance J12','fermé positif','fermé négatif'].map(s=>`<option${s===l.statut?' selected':''}>${s}</option>`).join('')}
        </select>
      </td>
      <td style="color:var(--txm);font-size:12px">${l.date||''}</td>
      <td style="display:flex;gap:5px" onclick="event.stopPropagation()">
        <button class="pipe-li-btn" onclick="sendViaExt(${JSON.stringify(l).replace(/"/g,'&quot;')})" title="Envoyer">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="#fff"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
        </button>
        <button class="btn btn-g" style="color:var(--red);font-size:12px;padding:3px 7px" onclick="delLead(${l.id})">✕</button>
      </td>
    </tr>`).join('');
}

function openLeadDetail(lead) {
  _selectedLead = lead;
  document.getElementById('detail-nom').textContent = lead.nom || '';
  document.getElementById('detail-ent').textContent = lead.ent || '';
  document.getElementById('detail-poste').textContent = lead.poste || '';
  document.getElementById('detail-canal').textContent = lead.canal || '';
  document.getElementById('detail-statut').textContent = lead.statut || '';
  document.getElementById('detail-date').textContent = lead.date || '';

  // Messages LinkedIn pré-générés
  document.getElementById('detail-msg-li').textContent = lead.msg || '—';
  document.getElementById('detail-msg-j0').textContent = lead.j0 || '—';
  document.getElementById('detail-msg-j4').textContent = lead.j4 || '—';

  // Historique
  renderLeadHistory(lead.messages || []);
  document.getElementById('mo-lead-detail').classList.add('on');
}
window.openLeadDetail = openLeadDetail;

function renderLeadHistory(messages) {
  const el = document.getElementById('lead-history');
  if (!messages.length) { el.innerHTML = '<div style="font-size:12px;color:var(--txm);text-align:center;padding:12px">Aucun message envoyé pour l\'instant.</div>'; return; }
  el.innerHTML = messages.map(m => `
    <div style="padding:8px 0;border-bottom:1px solid #f3f4f6">
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:4px">
        <span class="tag ${m.type==='entrant'?'t-rep':'t-sent'}">${m.type==='entrant'?'Reçu':'Envoyé'}</span>
        <span class="tag t-send">${m.etape||'message'}</span>
        <span style="font-size:11px;color:var(--txm);margin-left:auto">${m.date||''}</span>
      </div>
      <div style="font-size:12px;color:var(--txs);line-height:1.5;white-space:pre-wrap">${(m.texte||'').substring(0,200)}${(m.texte||'').length>200?'...':''}</div>
    </div>`).join('');
}

async function addLeadMessage() {
  if (!_selectedLead) return;
  const texte = document.getElementById('detail-new-msg').value.trim();
  const type = document.getElementById('detail-msg-type').value;
  const etape = document.getElementById('detail-msg-etape').value;
  if (!texte) { toast('Message vide'); return; }

  const msg = { type, etape, texte, ts: Date.now(), date: new Date().toLocaleString('fr-FR') };

  if (_apiAvailable) {
    await api(`/api/leads/${_selectedLead.id}/messages`, 'POST', msg);
  } else {
    const leads = S.get('leads', []);
    const idx = leads.findIndex(l => l.id == _selectedLead.id);
    if (idx >= 0) { if (!leads[idx].messages) leads[idx].messages = []; leads[idx].messages.push(msg); S.set('leads', leads); }
    _selectedLead = { ..._selectedLead, messages: [...(_selectedLead.messages||[]), msg] };
  }

  document.getElementById('detail-new-msg').value = '';
  renderLeadHistory(_selectedLead.messages || []);
  toast('Message ajouté ✓');
}
window.addLeadMessage = addLeadMessage;

async function updStatus(id, s) {
  if (_apiAvailable) { await api('/api/leads/'+id, 'PUT', { statut: s }); } else { updateLeadLocal(id, { statut: s }); }
  if (s === 'répondu') { const k = await getKpis(); k.reponses=(k.reponses||0)+1; await saveKpis(k); }
  toast('Statut mis à jour'); renderPipe();
}
window.updStatus = updStatus;

async function delLead(id) {
  if (!confirm('Supprimer ce prospect ?')) return;
  if (_apiAvailable) { await api('/api/leads/'+id, 'DELETE'); } else {
    const leads = S.get('leads',[]).filter(l=>l.id!=id); S.set('leads',leads);
  }
  renderPipe(); toast('Supprimé');
}
window.delLead = delLead;

function sendViaExt(lead) {
  const msg = lead.msg || '';
  if (typeof EXT !== 'undefined' && EXT.isAvailable()) { EXT.sendMessage(lead); toast('📤 LinkedIn ouvert'); }
  else {
    if (msg) cp(msg);
    const q = encodeURIComponent((lead.nom||'') + ' ' + (lead.ent||''));
    window.open('https://www.linkedin.com/search/results/people/?keywords='+q,'_blank');
    toast('📋 Message copié + LinkedIn ouvert');
  }
  updStatus(lead.id, 'envoyé');
}
window.sendViaExt = sendViaExt;

document.querySelectorAll('#pipe-filters button').forEach(b => b.addEventListener('click', () => renderPipe(b.dataset.f)));

function openAddModal() { document.getElementById('mo-lead').classList.add('on'); }
window.openAddModal = openAddModal;

async function saveAddLead() {
  const nom = document.getElementById('al-nom').value.trim();
  const ent = document.getElementById('al-ent').value.trim();
  if (!nom || !ent) { toast('Nom et entreprise requis'); return; }
  const lead = { nom, ent, poste:document.getElementById('al-poste').value, canal:document.getElementById('al-canal').value, statut:document.getElementById('al-statut').value, date:new Date().toLocaleDateString('fr-FR') };
  if (_apiAvailable) { await api('/api/leads','POST',lead); } else { saveLeadLocal(lead); }
  closeMo('mo-lead');
  ['al-nom','al-ent','al-poste'].forEach(id=>document.getElementById(id).value='');
  renderPipe(); toast('Prospect ajouté');
}
window.saveAddLead = saveAddLead;

// ─── Posts LinkedIn ───────────────────────────────────────────────────────────

const postTplLocal = {
  regl: [`Un électricien sans habilitation.\n\nUn accident.\n\nL'inspection arrive.\n\nLe chef d'entreprise est mis en cause personnellement.\nPas parce qu'il était là.\nParce qu'il n'avait pas formé.\n\nNF C 18-510. Obligation légale. 3 ans de validité.\n\nJe forme en Gironde sous 2 semaines.\nDevis sous 24h.\n\nVos habilitations sont à jour ?`, `64 % des accidents électriques graves touchent des salariés non habilités.\n\nL'obligation est claire.\n3 ans. Après — l'employeur est en défaut.\n\nL'inspection ne prévient pas.\n\nFormateur Qualiopi en Gironde.\nRéponse 24h. Intervention 2 semaines.\n\nC'est le bon moment.`],
  ve: [`Vous venez d'installer des bornes de recharge.\nVos équipes touchent les câbles.\n\nIl existe une habilitation spécifique.\nLa NF C 18-550.\n\nPas la même que la 18-510.\nEn Gironde — aucun OF ne la propose clairement.\n\nSauf EYNOR Formation.\n\nVotre flotte est électrique. Vos habilitations aussi.`],
  react: [`Mon OF habituel a répondu en 8 jours.\nSession dans 3 mois.\n\nC'est ce que j'entends souvent.\n\nMoi — réponse sous 24h.\nIntervention sous 2 semaines.\nJe viens chez vous en Gironde.\n\nEYNOR Formation.`],
  preuve: [`6 techniciens à habiliter.\nUne journée.\nUn seul déplacement.\n\n6 titres BR délivrés.\n\nFormation intra PME Mérignac, mai 2026.\nDu concret. Du terrain. Du réel.\n\nCe type de mission — un message.`]
};

let _lastPost = null;
let _selectedStyleId = null;

async function genPost() {
  const btn = document.getElementById('btn-gen-post');
  btn.innerHTML = '<span class="sp"></span> Génération...'; btn.disabled = true;
  document.getElementById('out-post').innerHTML = '<span class="out-ph">Génération en cours...</span>';

  const angle = document.getElementById('pa-angle').value;
  const key = ['regl','ve','react','preuve'].find(k => angle.startsWith(k)) || 'regl';
  const icp = document.getElementById('pa-icp').value;
  const detail = document.getElementById('pa-detail').value.trim();

  try {
    // Si un style est sélectionné ET API disponible → génération avec style
    if (_selectedStyleId && _apiAvailable) {
      const styles = await getStyles();
      const style = styles.find(s => s.id == _selectedStyleId);
      if (style?.prompt) {
        const d = await api('/api/generate/post-with-style', 'POST', {
          stylePrompt: style.prompt, styleName: style.nom, angle, icp, detail
        });
        if (d?.texte) {
          document.getElementById('out-post').textContent = d.texte;
          _lastPost = { texte:d.texte, angle:key, icp, styleName:style.nom, date:new Date().toLocaleDateString('fr-FR') };
          toast(`✓ Post généré avec le style de ${style.nom}`);
          btn.innerHTML = '✍️ Générer le post'; btn.disabled = false;
          return;
        }
      }
    }

    // Si API disponible → génération Claude classique
    if (_apiAvailable) {
      const d = await api('/api/generate/post', 'POST', { angle, icp, detail });
      if (d?.texte) {
        document.getElementById('out-post').textContent = d.texte;
        _lastPost = { texte:d.texte, angle:key, icp, date:new Date().toLocaleDateString('fr-FR') };
        btn.innerHTML = '✍️ Générer le post'; btn.disabled = false;
        return;
      }
    }

    // Fallback local
    const arr = postTplLocal[key] || postTplLocal.regl;
    const txt = arr[Math.floor(Math.random()*arr.length)];
    document.getElementById('out-post').textContent = txt;
    _lastPost = { texte:txt, angle:key, icp, date:new Date().toLocaleDateString('fr-FR') };
  } finally {
    btn.innerHTML = '✍️ Générer le post'; btn.disabled = false;
  }
}

document.getElementById('btn-gen-post').addEventListener('click', genPost);
document.getElementById('btn-cp-post').addEventListener('click', () => {
  const t = document.getElementById('out-post').textContent;
  if (t && !t.includes('apparaîtra') && !t.includes('cours')) cp(t);
});
document.getElementById('btn-li-send-post').addEventListener('click', () => {
  const t = document.getElementById('out-post').textContent;
  if (!t || t.includes('apparaîtra')) { toast('Génère un post d\'abord'); return; }
  document.getElementById('li-test-post').value = t;
  goPage('linkedin');
  toast('Post transféré vers LinkedIn');
});
document.getElementById('btn-save-post').addEventListener('click', async () => {
  if (!_lastPost || _lastPost.texte?.includes('apparaîtra')) { toast('Génère un post d\'abord'); return; }
  const posts = S.get('posts',[]); posts.unshift(_lastPost); S.set('posts',posts);
  const k = await getKpis(); k.posts=(k.posts||0)+1; await saveKpis(k);
  renderPosts(); toast('Post sauvegardé ✓');
});

function renderPosts() {
  const posts = S.get('posts',[]);
  document.getElementById('posts-cnt').textContent = posts.length?`(${posts.length})`:'';
  const list = document.getElementById('posts-list');
  if (!posts.length) { list.innerHTML='<div style="font-size:13px;color:var(--txm);text-align:center;padding:20px">Aucun post sauvegardé.</div>'; return; }
  const agl={regl:'⚖️ Réglementaire',ve:'🔋 VE',react:'⚡ Réactivité',preuve:'🌟 Preuve'};
  list.innerHTML = posts.map((p,i) => `
    <div style="border:1px solid var(--brd);border-radius:10px;padding:14px;margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div style="display:flex;gap:7px;align-items:center">
          <span class="tag t-send">${agl[p.angle]||p.angle||''}</span>
          <span style="font-size:11px;color:var(--txm)">${p.icp||''}</span>
          ${p.styleName?`<span style="font-size:11px;color:var(--v)">Style : ${p.styleName}</span>`:''}
        </div>
        <span style="font-size:11px;color:var(--txm)">${p.date||''}</span>
      </div>
      <div style="font-size:13px;line-height:1.75;white-space:pre-wrap;color:var(--tx);margin-bottom:10px">${p.texte||''}</div>
      <div style="display:flex;gap:7px">
        <button class="btn btn-s" style="font-size:12px;padding:5px 11px" onclick="cp(\`${esc(p.texte||'')}\`)">📋 Copier</button>
        <button class="btn btn-g" style="font-size:12px;color:var(--red)" onclick="delPost(${i})">✕</button>
      </div>
    </div>`).join('');
}
function delPost(i){const p=S.get('posts',[]);p.splice(i,1);S.set('posts',p);renderPosts();toast('Post supprimé');}
window.delPost = delPost;

// ─── Studio ───────────────────────────────────────────────────────────────────

document.querySelectorAll('.stab').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('.stab').forEach(x => x.classList.remove('active'));
  b.classList.add('active');
  ['styles','templates','sources','brief'].forEach(k => {
    const el = document.getElementById('st-'+k); if (el) el.style.display = b.dataset.st===k?'':'none';
  });
}));

function addStyleProfile() { document.getElementById('mo-style').classList.add('on'); }
window.addStyleProfile = addStyleProfile;

async function saveStyle2() {
  const nom = document.getElementById('style-nom').value.trim();
  const url = document.getElementById('style-url').value.trim();
  const postsRaw = document.getElementById('style-posts').value.trim();
  const posts = postsRaw.split('\n---\n').filter(Boolean).map(s => s.trim());
  if (!nom || !posts.length) { toast('Nom et au moins 1 exemple requis'); return; }

  const btn = document.getElementById('btn-analyze-style');
  btn.innerHTML = '<span class="sp"></span> Analyse...'; btn.disabled = true;

  let analysisResult = { prompt: `Rédige dans le style de ${nom} : direct, concret, phrases courtes alternées avec longues, ancrage terrain.`, caracteristiques: [], eviter: [] };

  // Analyse via Claude si API disponible
  if (_apiAvailable) {
    const d = await api('/api/analyze-style', 'POST', { nom, url, posts });
    if (d?.prompt) analysisResult = d;
  }

  const styleData = { nom, url, posts, ...analysisResult, date: new Date().toLocaleDateString('fr-FR') };
  await saveStyle(styleData);
  closeMo('mo-style');
  ['style-nom','style-url','style-posts'].forEach(id => document.getElementById(id).value='');
  renderStudio();
  toast(_apiAvailable ? `Style de ${nom} analysé par Claude ✓` : `Profil ${nom} ajouté ✓`);
  btn.innerHTML = 'Analyser'; btn.disabled = false;
}
window.saveStyle2 = saveStyle2;

async function delStyleById(id) {
  await deleteStyle(id);
  if (_selectedStyleId == id) { _selectedStyleId = null; document.getElementById('selected-style-name').textContent = 'Aucun'; }
  renderStudio(); toast('Profil supprimé');
}
window.delStyleById = delStyleById;

function selectStyle(id, nom) {
  _selectedStyleId = id;
  document.getElementById('selected-style-name').textContent = nom;
  toast(`Style "${nom}" sélectionné pour la génération`);
}
window.selectStyle = selectStyle;

function toggleSection(el) { el.closest('.sc-section').classList.toggle('open'); }
window.toggleSection = toggleSection;

async function renderStudio() {
  const styles = await getStyles();
  const grid = document.getElementById('styles-grid');

  if (!styles.length) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:32px;color:var(--txm);font-size:13px">
      Cliquez "+ Analyser un Profil" pour ajouter un style d'écriture.<br>
      <span style="font-size:12px">Collez 3 exemples de posts LinkedIn d'une personne dont vous aimez le style.</span>
    </div>`;
    return;
  }

  grid.innerHTML = styles.map((s, i) => {
    const isSelected = s.id == _selectedStyleId;
    return `
    <div class="studio-card" style="${isSelected?'border-color:var(--v);box-shadow:0 0 0 2px var(--vd)':''}">
      <div class="sc-head">
        <div>
          <div class="sc-name">${s.nom}</div>
          ${s.url?`<div class="sc-sub" onclick="window.open('${s.url}','_blank')">Profil LinkedIn ↗</div>`:'<div style="height:14px"></div>'}
        </div>
        <div style="display:flex;align-items:center;gap:7px">
          <span class="tag t-analyse">Analysé</span>
          <button class="sc-del" onclick="delStyleById(${s.id})">🗑</button>
        </div>
      </div>

      ${s.prompt?`
      <div class="sc-section" id="sc-prompt-${i}">
        <div class="sc-section-head" onclick="toggleSection(this)">
          <span class="sc-section-icon">⚡</span> Prompt IA
          <span class="sc-chevron">▾</span>
        </div>
        <div class="sc-section-body" style="font-size:11px">${s.prompt}</div>
      </div>`:''}

      ${s.caracteristiques?.length?`
      <div class="sc-section">
        <div class="sc-section-head" onclick="toggleSection(this)">
          <span class="sc-section-icon">🎯</span> Caractéristiques
          <span class="sc-chevron">▾</span>
        </div>
        <div class="sc-section-body">
          ${s.caracteristiques.map(c=>`<div style="font-size:11px;padding:2px 0;color:var(--txs)">• ${c}</div>`).join('')}
        </div>
      </div>`:''}

      <div style="font-size:11px;font-weight:500;color:var(--txm);padding:8px 0 4px">${(s.posts||[]).length} exemple${(s.posts||[]).length>1?'s':''} de post</div>
      ${(s.posts||[]).map((p,pi)=>`
        <div class="sc-section">
          <div class="sc-section-head" onclick="toggleSection(this)">
            <span style="font-size:13px;color:var(--txm)">📄</span> Exemple ${pi+1}
            <span class="sc-chevron">▾</span>
          </div>
          <div class="sc-section-body"><div class="sc-example" onclick="cp(\`${esc(p)}\`)">${p.substring(0,150)}${p.length>150?'...':''}</div></div>
        </div>`).join('')}

      <button class="btn btn-p btn-full" style="margin-top:10px;font-size:12px${isSelected?';background:#16a34a':''}" onclick="selectStyle(${s.id},'${s.nom.replace(/'/g,"\\'")}')">
        ${isSelected?'✓ Style sélectionné':'Utiliser ce style pour générer'}
      </button>
    </div>`;
  }).join('');
}

function addTemplate() { document.getElementById('mo-tpl').classList.add('on'); }
window.addTemplate = addTemplate;

function saveTemplate() {
  const nom = document.getElementById('tpl-nom').value.trim();
  const txt = document.getElementById('tpl-txt').value.trim();
  if (!nom||!txt){toast('Nom et texte requis');return;}
  const t=S.get('templates',[]);t.push({nom,txt,date:new Date().toLocaleDateString('fr-FR')});S.set('templates',t);
  closeMo('mo-tpl');['tpl-nom','tpl-txt'].forEach(id=>document.getElementById(id).value='');
  renderStudio();toast('Template sauvegardé ✓');
}
window.saveTemplate = saveTemplate;

// ─── Campagnes ────────────────────────────────────────────────────────────────

async function renderCampaigns() {
  const camps = await getCampaigns();
  const el = document.getElementById('camp-list');
  if (!el) return;
  if (!camps.length) {
    el.innerHTML = `<div style="text-align:center;padding:32px;color:var(--txm);font-size:13px">
      Aucune campagne. Créez votre première séquence.
    </div>`;
    return;
  }
  el.innerHTML = camps.map(c => `
    <div style="border:1px solid var(--brd);border-radius:10px;padding:16px;margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
        <div>
          <div style="font-size:14px;font-weight:600;color:var(--tx)">${c.nom}</div>
          <div style="font-size:12px;color:var(--txm);margin-top:2px">${c.icp||''} · Créée le ${c.createdAt||''}</div>
        </div>
        <span class="tag ${c.status==='active'?'t-rep':'t-send'}">${c.status==='active'?'Active':'Pausée'}</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:12px">
        <div style="background:#f9fafb;border-radius:8px;padding:10px;text-align:center">
          <div style="font-size:18px;font-weight:700;color:var(--tx)">${c.sent||0}</div>
          <div style="font-size:11px;color:var(--txm)">Messages envoyés</div>
        </div>
        <div style="background:#f9fafb;border-radius:8px;padding:10px;text-align:center">
          <div style="font-size:18px;font-weight:700;color:var(--tx)">${c.replies||0}</div>
          <div style="font-size:11px;color:var(--txm)">Réponses</div>
        </div>
        <div style="background:#f9fafb;border-radius:8px;padding:10px;text-align:center">
          <div style="font-size:18px;font-weight:700;color:var(--tx)">${c.sent?Math.round((c.replies||0)/c.sent*100):0} %</div>
          <div style="font-size:11px;color:var(--txm)">Taux de réponse</div>
        </div>
      </div>
      <div style="font-size:12px;color:var(--txm);margin-bottom:12px">
        Séquence : J0 → J4 → J12 · ${c.dailyLimit||10} envois/jour max
        ${c.lastRun?` · Dernière exécution : ${c.lastRun}`:''}
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-p" style="font-size:12px" onclick="runCampaign(${c.id})">▶ Exécuter maintenant</button>
        <button class="btn btn-s" style="font-size:12px" onclick="toggleCampaign(${c.id},'${c.status}')">${c.status==='active'?'⏸ Mettre en pause':'▶ Réactiver'}</button>
        <button class="btn btn-g" style="font-size:12px;color:var(--red)" onclick="deleteCampaign(${c.id})">✕</button>
      </div>
    </div>`).join('');
}

async function runCampaign(id) {
  if (_apiAvailable) {
    const d = await api(`/api/campaigns/${id}/run`,'POST');
    if (d?.ok) { toast(`✓ ${d.sent} messages marqués envoyés`); renderCampaigns(); renderDash(); return; }
  }
  // Mode offline : simulation
  const camps = S.get('campaigns',[]);
  const idx = camps.findIndex(c=>c.id==id);
  if (idx>=0) { camps[idx].sent=(camps[idx].sent||0)+5; camps[idx].lastRun=new Date().toLocaleDateString('fr-FR'); S.set('campaigns',camps); }
  toast('✓ Campagne exécutée (simulation)'); renderCampaigns();
}
window.runCampaign = runCampaign;

async function toggleCampaign(id, status) {
  const newStatus = status==='active'?'paused':'active';
  if (_apiAvailable) { await api(`/api/campaigns/${id}`,'PUT',{status:newStatus}); } else {
    const camps=S.get('campaigns',[]); const idx=camps.findIndex(c=>c.id==id); if(idx>=0){camps[idx].status=newStatus;S.set('campaigns',camps);}
  }
  renderCampaigns(); toast(newStatus==='active'?'Campagne réactivée':'Campagne mise en pause');
}
window.toggleCampaign = toggleCampaign;

async function deleteCampaign(id) {
  if(!confirm('Supprimer cette campagne ?'))return;
  if(_apiAvailable){await api(`/api/campaigns/${id}`,'DELETE');}else{const c=S.get('campaigns',[]).filter(x=>x.id!=id);S.set('campaigns',c);}
  renderCampaigns(); toast('Campagne supprimée');
}
window.deleteCampaign = deleteCampaign;

function openCreateCampaign() { document.getElementById('mo-camp').classList.add('on'); }
window.openCreateCampaign = openCreateCampaign;

async function saveNewCampaign() {
  const nom = document.getElementById('camp-nom').value.trim();
  const icp = document.getElementById('camp-icp').value;
  const limit = parseInt(document.getElementById('camp-limit').value)||10;
  if(!nom){toast('Nom de la campagne requis');return;}
  const camp = { nom, icp, dailyLimit:limit };
  await saveCampaign(camp);
  closeMo('mo-camp'); document.getElementById('camp-nom').value='';
  renderCampaigns(); toast('Campagne créée ✓');
}
window.saveNewCampaign = saveNewCampaign;

// ─── LinkedIn ─────────────────────────────────────────────────────────────────

document.getElementById('btn-li-save-config')?.addEventListener('click', () => {
  const w = document.getElementById('li-worker-url').value.trim();
  if(w) localStorage.setItem('bes_worker_url',w);
  if(typeof updateLinkedInUI==='function') updateLinkedInUI();
  toast('Configuration sauvegardée ✓');
});
document.getElementById('btn-li-connect')?.addEventListener('click', () => { if(typeof LI!=='undefined') LI.connect(); });
document.getElementById('btn-li-disconnect')?.addEventListener('click', () => { if(typeof LI!=='undefined') LI.disconnect(); });
document.getElementById('btn-ext-save')?.addEventListener('click', () => {
  const id=document.getElementById('li-ext-id').value.trim();
  if(id){localStorage.setItem('bes_ext_id',id); toast('ID sauvegardé ✓');}
  if(typeof updateLinkedInUI==='function') updateLinkedInUI();
});
document.getElementById('btn-li-publish')?.addEventListener('click', async () => {
  const text=document.getElementById('li-test-post').value.trim();
  if(!text){toast('Entre le texte du post');return;}
  const btn=document.getElementById('btn-li-publish');
  btn.innerHTML='<span class="sp"></span> Publication...'; btn.disabled=true;
  try { if(typeof LI!=='undefined'){const ok=await LI.publishPost(text);if(ok){toast('✅ Post publié sur LinkedIn !');document.getElementById('li-test-post').value='';}} }
  finally{btn.innerHTML='📤 Publier maintenant';btn.disabled=false;}
});
document.getElementById('btn-li-copy-post')?.addEventListener('click', () => { const t=document.getElementById('li-test-post').value; if(t)cp(t); });

function loadLinkedInConfig() {
  const w=localStorage.getItem('bes_worker_url');
  const e=localStorage.getItem('bes_ext_id');
  if(w){const el=document.getElementById('li-worker-url');if(el)el.value=w;}
  if(e){const el=document.getElementById('li-ext-id');if(el)el.value=e;}
}

// ─── Init ─────────────────────────────────────────────────────────────────────

const _now = new Date();
const _DAY=['DIMANCHE','LUNDI','MARDI','MERCREDI','JEUDI','VENDREDI','SAMEDI'];
const _MON=['JANVIER','FÉVRIER','MARS','AVRIL','MAI','JUIN','JUILLET','AOÛT','SEPTEMBRE','OCTOBRE','NOVEMBRE','DÉCEMBRE'];
const _dEl = document.getElementById('d-date');
if(_dEl) _dEl.textContent=`${_DAY[_now.getDay()]} ${_now.getDate()} ${_MON[_now.getMonth()]}`;

loadLinkedInConfig();

// Vérifier l'API puis initialiser
checkApi().then(ok => {
  updateApiStatus();
  renderDash();
  renderStudio();
});
