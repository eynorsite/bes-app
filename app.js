// ─── BES App v2 — Style Reakly ───────────────────────────────────────────────

const S = {
  get(k, d) { try { return JSON.parse(localStorage.getItem('bes_' + k)) || d; } catch { return d; } },
  set(k, v) { localStorage.setItem('bes_' + k, JSON.stringify(v)); }
};

const K0 = { prospects: 0, reponses: 0, formations: 0, posts: 0, ca: 0 };
const COLORS = ['#6D1FE0','#2563eb','#16a34a','#ea580c','#dc2626','#0891b2','#7c3aed','#059669'];

// ─── Navigation ───────────────────────────────────────────────────────────────

function goPage(id) {
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.p === id));
  document.querySelectorAll('.page').forEach(p => p.classList.toggle('on', p.id === 'p-' + id));
  if (id === 'dash') renderDash();
  if (id === 'pipe') renderPipe();
  if (id === 'posts') renderPosts();
  if (id === 'studio') renderStudio();
}

document.querySelectorAll('.nav-btn').forEach(b => b.addEventListener('click', () => goPage(b.dataset.p)));
window.goPage = goPage;

// ─── Toast ────────────────────────────────────────────────────────────────────

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('on');
  setTimeout(() => t.classList.remove('on'), 2800);
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function closeMo(id) { document.getElementById(id).classList.remove('on'); }
window.closeMo = closeMo;

// ─── Clipboard ────────────────────────────────────────────────────────────────

function cp(text) {
  navigator.clipboard.writeText(text)
    .then(() => toast('✓ Copié !'))
    .catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
      toast('✓ Copié !');
    });
}
window.cp = cp;

function esc(s) { return (s || '').replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$').replace(/\n/g, '\\n'); }

// ─── Status tag ───────────────────────────────────────────────────────────────

function stTag(s) {
  const m = { 'à envoyer': 't-send', 'envoyé': 't-sent', 'répondu': 't-rep', 'relance J4': 't-rel', 'relance J12': 't-rel', 'fermé positif': 't-pos', 'fermé négatif': 't-neg' };
  return `<span class="tag ${m[s] || 't-send'}">${s}</span>`;
}

// ─── Mini bar chart (canvas) ──────────────────────────────────────────────────

function drawMiniLine(canvasId, values, color = '#6D1FE0') {
  const c = document.getElementById(canvasId);
  if (!c) return;
  const ctx = c.getContext('2d');
  c.width = c.offsetWidth || 200; c.height = 40;
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => [i / (values.length - 1) * c.width, c.height - (v / max) * (c.height - 4) - 2]);
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.beginPath();
  ctx.moveTo(...pts[0]);
  pts.slice(1).forEach(p => ctx.lineTo(...p));
  ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
  ctx.lineTo(c.width, c.height); ctx.lineTo(0, c.height);
  ctx.fillStyle = color + '20'; ctx.fill();
}

function drawBars(containerId, data) {
  const wrap = document.getElementById(containerId);
  if (!wrap) return;
  const maxH = 90;
  const max = Math.max(...data.map(d => d.inv + d.msg), 1);
  wrap.innerHTML = data.map(d => {
    const hi = Math.max(4, Math.round((d.inv / max) * maxH));
    const hm = Math.max(4, Math.round((d.msg / max) * maxH));
    return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;justify-content:flex-end">
      <div class="bar inv" style="height:${hi}px"></div>
      <div class="bar msg" style="height:${hm}px"></div>
    </div>`;
  }).join('');
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

let _period = 7;

document.querySelectorAll('.period-btn').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('.period-btn').forEach(x => x.classList.remove('active'));
  b.classList.add('active');
  _period = parseInt(b.dataset.days);
  document.getElementById('activity-period').textContent = `${_period} derniers jours`;
  document.getElementById('ks-prospects').textContent = `${_period} derniers jours`;
  document.getElementById('ks-formations').textContent = `${_period} derniers jours`;
  renderDash();
}));

function renderDash() {
  const kpis = S.get('kpis', K0);
  const leads = S.get('leads', []);

  // Date
  const now = new Date();
  const days = ['DIMANCHE', 'LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI', 'SAMEDI'];
  const months = ['JANVIER','FÉVRIER','MARS','AVRIL','MAI','JUIN','JUILLET','AOÛT','SEPTEMBRE','OCTOBRE','NOVEMBRE','DÉCEMBRE'];
  document.getElementById('d-date').textContent = `${days[now.getDay()]} ${now.getDate()} ${months[now.getMonth()]}`;

  // KPIs
  document.getElementById('kv-prospects').textContent = kpis.prospects || 0;
  document.getElementById('kv-reponses').textContent = kpis.reponses || 0;
  document.getElementById('kv-formations').textContent = kpis.formations || 0;
  const pct = kpis.prospects ? Math.round((kpis.reponses / kpis.prospects) * 100) : 0;
  document.getElementById('kv-pct').textContent = pct + ' %';

  // Activité total
  document.getElementById('activity-total').textContent = kpis.prospects || 0;

  // Mini line chart (données fictives progressives basées sur les KPIs)
  const pts = Array.from({ length: 7 }, (_, i) => Math.round((kpis.prospects || 0) * (i + 1) / 7));
  drawMiniLine('chart-prospects', pts);

  // Bar chart activité
  const barData = Array.from({ length: Math.min(_period, 7) }, (_, i) => ({
    inv: Math.round(Math.random() * (kpis.prospects / 7 || 5)),
    msg: Math.round(Math.random() * (kpis.prospects / 14 || 2))
  }));
  drawBars('bar-chart', barData);

  // À faire : prospects à relancer
  const todo = leads.filter(l => ['à envoyer', 'relance J4', 'relance J12'].includes(l.statut)).slice(0, 8);
  document.getElementById('todo-count').textContent = todo.length;
  const todoList = document.getElementById('todo-list');
  if (!todo.length) {
    todoList.innerHTML = '<div style="padding:20px 18px;font-size:13px;color:var(--txm);text-align:center">Aucun prospect à relancer.<br>Allez dans Moteur d\'acquisition.</div>';
  } else {
    todoList.innerHTML = todo.map((l, i) => {
      const col = COLORS[i % COLORS.length];
      const initials = (l.nom || '?').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
      const action = l.statut === 'à envoyer' ? 'Envoyer' : 'Répondre';
      return `<div class="todo-item" onclick="openLeadAction(${i})">
        <div class="todo-av" style="background:${col}">${initials}</div>
        <div>
          <div class="todo-name">${l.nom || ''}</div>
          <div style="font-size:11px;color:var(--txm)">${l.ent || ''}</div>
        </div>
        <div class="todo-action">${action}</div>
      </div>`;
    }).join('');
  }
}

function openLeadAction(idx) {
  const leads = S.get('leads', []).filter(l => ['à envoyer', 'relance J4', 'relance J12'].includes(l.statut));
  const lead = leads[idx];
  if (!lead) return;
  const msg = lead.msg || '';
  if (msg) cp(msg);
  const q = encodeURIComponent((lead.nom || '') + ' ' + (lead.ent || ''));
  window.open('https://www.linkedin.com/search/results/people/?keywords=' + q, '_blank');
  toast('📋 Message copié + LinkedIn ouvert');
}
window.openLeadAction = openLeadAction;

// KPI edit
let _kpiKey = '';
const kpiLabels = { prospects: 'Prospects contactés', reponses: 'Réponses reçues', formations: 'Prospects qualifiés', posts: 'Posts publiés', ca: 'CA signé (€)' };

function editKpi(k) {
  _kpiKey = k;
  const kpis = S.get('kpis', K0);
  document.getElementById('kpi-lbl').textContent = kpiLabels[k] || k;
  document.getElementById('kpi-input').value = kpis[k] || 0;
  document.getElementById('mo-kpi').classList.add('on');
}
window.editKpi = editKpi;

function saveKpi() {
  const kpis = S.get('kpis', K0);
  kpis[_kpiKey] = parseInt(document.getElementById('kpi-input').value) || 0;
  S.set('kpis', kpis);
  closeMo('mo-kpi');
  toast('KPI mis à jour ✓');
  renderDash();
}
window.saveKpi = saveKpi;

// ─── Prospection ──────────────────────────────────────────────────────────────

const msgTemplates = {
  drh: {
    emploi: {
      li: (nom, ent) => `${nom.split(' ')[0]}, j'ai vu votre offre chez ${ent}. La question de l'habilitation électrique se pose vite. Je forme en Gironde sous 2 semaines, devis 24h.`,
      obj: `Habilitation électrique pour votre futur technicien`,
      j0: (nom, ent) => `Bonjour ${nom.split(' ')[0]},\n\nVotre offre chez ${ent} m'a interpellé.\n\nQuand on recrute un technicien, l'habilitation électrique arrive vite. Trouver un formateur disponible en Gironde sous 2 semaines, c'est souvent plus compliqué qu'il n'y paraît.\n\nJe suis formateur Qualiopi NF C 18-510. Devis sous 24h.\n\nVos techniciens qui travaillent sur des installations électriques — ils ont une habilitation à jour ?`,
      j4: (nom) => `Bonjour ${nom.split(' ')[0]},\n\nJe reviens sur l'habilitation électrique pour votre recrutement.\n\nSi le besoin se précise, je reste disponible sous 2 semaines en Gironde.\n\nUlrich — EYNOR Formation`
    },
    securite: {
      li: (nom, ent) => `${nom.split(' ')[0]}, votre post sur la sécurité chez ${ent} résonne. Je forme en Gironde sur NF C 18-510 — disponible sous 2 semaines, devis 24h.`,
      obj: `Habilitation électrique — conformité employeur`,
      j0: (nom, ent) => `Bonjour ${nom.split(' ')[0]},\n\nVotre publication sur la sécurité chez ${ent} m'a amené à vous contacter.\n\nL'habilitation électrique NF C 18-510 est une obligation légale employeur. Un défaut de formation engage la responsabilité pénale personnelle du dirigeant — pas seulement de l'entreprise.\n\nJe suis formateur Qualiopi en Gironde. Réponse 24h, intervention en 2 semaines.\n\nVos équipes sont à jour ?`,
      j4: (nom) => `Bonjour ${nom.split(' ')[0]},\n\nJe reviens sur les habilitations électriques chez vous.\n\nSi des recyclages arrivent à échéance, mieux vaut anticiper — les fins d'année se remplissent vite.\n\nUlrich — EYNOR Formation`
    },
    default: {
      li: (nom, ent) => `${nom.split(' ')[0]}, formateur habilitation électrique NF C 18-510 en Gironde. Devis 24h, disponible sous 2 semaines en intra chez ${ent}.`,
      obj: `Habilitation électrique NF C 18-510 — Gironde`,
      j0: (nom, ent) => `Bonjour ${nom.split(' ')[0]},\n\nJe suis formateur Qualiopi spécialisé habilitation électrique NF C 18-510, basé en Gironde.\n\nJe me déplace en intra chez vous. Réponse sous 24h, disponible sous 2 semaines.\n\nUn besoin de formation ou de recyclage chez ${ent} cette année ?`,
      j4: (nom) => `Bonjour ${nom.split(' ')[0]},\n\nJe reviens sur la formation habilitation électrique.\n\nSi un besoin se précise, je reste disponible rapidement en Gironde.\n\nUlrich — EYNOR Formation`
    }
  },
  ve: {
    ve: {
      li: (nom, ent) => `${nom.split(' ')[0]}, avec les VE chez ${ent}, vos équipes ont-elles l'habilitation NF C 18-550 ? Je suis le seul formateur positionné dessus en Gironde.`,
      obj: `Habilitation VE NF C 18-550 — vos équipes sont-elles en règle ?`,
      j0: (nom, ent) => `Bonjour ${nom.split(' ')[0]},\n\nLes entreprises qui gèrent une flotte électrique ou des bornes IRVE sont concernées par la NF C 18-550 — moins connue que la 18-510 classique mais tout aussi obligatoire.\n\nJe suis formateur Qualiopi spécialisé sur ce point en Gironde. Aucun OF local ne le propose clairement.\n\nDiagnostic gratuit : vos équipes chez ${ent} sont-elles concernées ?`,
      j4: (nom) => `Bonjour ${nom.split(' ')[0]},\n\nJe reviens sur l'habilitation VE.\n\nSi vous n'avez pas encore formé vos équipes sur la NF C 18-550, je peux faire un point de 15 min — sans engagement.\n\nUlrich — EYNOR Formation`
    },
    default: {
      li: (nom, ent) => `${nom.split(' ')[0]}, chez ${ent} — vos équipes sur les bornes IRVE ont-elles une habilitation NF C 18-550 ? Je suis formateur Qualiopi, seul sur ce créneau en Gironde.`,
      obj: `Habilitation VE / IRVE — êtes-vous en règle ?`,
      j0: (nom, ent) => `Bonjour ${nom.split(' ')[0]},\n\nVous gérez des bornes de recharge ou une flotte VE chez ${ent}.\n\nCe que beaucoup ignorent : il existe une habilitation spécifique pour les personnes qui interviennent sur ou à proximité des VE — la NF C 18-550.\n\nJe suis le seul formateur Qualiopi positionné dessus en Gironde. Diagnostic gratuit de 15 minutes pour savoir si vous êtes concerné.\n\nVos techniciens touchent les câbles et les bornes ?`,
      j4: (nom) => `Bonjour ${nom.split(' ')[0]},\n\nJe reviens sur la question de l'habilitation VE.\n\nUn point rapide par message peut suffire à clarifier si vos équipes sont concernées.\n\nUlrich — EYNOR Formation`
    }
  },
  tech: {
    emploi: {
      li: (nom, ent) => `${nom.split(' ')[0]}, besoin d'habiliter un technicien rapidement chez ${ent} ? Formateur NF C 18-510 en Gironde, demi-journée intra possible, devis 24h.`,
      obj: `Habilitation électrique rapide — intra Gironde`,
      j0: (nom, ent) => `Bonjour ${nom.split(' ')[0]},\n\nUn recrutement chez ${ent} — et l'habilitation électrique suit souvent.\n\nJe suis formateur Qualiopi NF C 18-510, je me déplace en Gironde. Demi-journée ou journée complète selon les niveaux. Réponse sous 24h.\n\nQuels niveaux cherchez-vous ? B1, BR, BC ?`,
      j4: (nom) => `Bonjour ${nom.split(' ')[0]},\n\nSi le besoin en habilitation se confirme chez vous, je reste dispo pour un devis rapide.\n\nUlrich — EYNOR Formation`
    },
    expire: {
      li: (nom, ent) => `${nom.split(' ')[0]}, les habilitations durent 3 ans. Si des recyclages arrivent à échéance chez ${ent}, je suis dispo sous 2 semaines en Gironde.`,
      obj: `Recyclage habilitation électrique — Gironde`,
      j0: (nom, ent) => `Bonjour ${nom.split(' ')[0]},\n\nLes habilitations électriques NF C 18-510 ont une validité de 3 ans. Passé ce délai, l'employeur est en défaut légal.\n\nJe propose des sessions de recyclage en intra chez vous en Gironde. Réponse 24h.\n\nDes recyclages à prévoir chez ${ent} d'ici la fin de l'année ?`,
      j4: (nom) => `Bonjour ${nom.split(' ')[0]},\n\nJe reviens sur le recyclage habilitation.\n\nSi des dates approchent, anticipez — les agendas se remplissent en fin d'année.\n\nUlrich — EYNOR Formation`
    },
    default: {
      li: (nom, ent) => `${nom.split(' ')[0]}, formateur NF C 18-510 en Gironde. Intra chez ${ent} possible sous 2 semaines, devis sous 24h.`,
      obj: `Habilitation électrique intra — ${ent || 'votre équipe'}`,
      j0: (nom, ent) => `Bonjour ${nom.split(' ')[0]},\n\nJe suis formateur Qualiopi habilitation électrique NF C 18-510 en Gironde.\n\nJe me déplace en intra chez vous. Réponse sous 24h, disponible sous 2 semaines.\n\nUn besoin de formation ou de recyclage chez ${ent} ?`,
      j4: (nom) => `Bonjour ${nom.split(' ')[0]},\n\nJe reviens sur la formation habilitation.\n\nDisponible rapidement en Gironde si le besoin se précise.\n\nUlrich — EYNOR Formation`
    }
  },
  qhse: {
    securite: {
      li: (nom, ent) => `${nom.split(' ')[0]}, formateur NF C 18-510 Qualiopi en Gironde. Si votre OF habituel n'est pas disponible, je peux intervenir sous 2 semaines.`,
      obj: `Habilitation électrique — disponibilité immédiate Gironde`,
      j0: (nom, ent) => `Bonjour ${nom.split(' ')[0]},\n\nJe vous contacte en tant que formateur Qualiopi NF C 18-510 basé en Gironde.\n\nBeaucoup de responsables QHSE me contactent quand leur OF habituel n'a plus de session rapidement disponible. Devis 24h, intervention en 2 semaines, intra ou inter.\n\nVous anticipez des besoins en habilitation chez ${ent} ce trimestre ?`,
      j4: (nom) => `Bonjour ${nom.split(' ')[0]},\n\nJe reviens sur les besoins en formation habilitation chez vous.\n\nSi votre planning se précise, je reste disponible sur un devis rapide.\n\nUlrich — EYNOR Formation`
    },
    default: {
      li: (nom, ent) => `${nom.split(' ')[0]}, formateur Qualiopi habilitation électrique Gironde — réponse 24h, intra possible chez ${ent} sous 2 semaines.`,
      obj: `Formation habilitation NF C 18-510 — Gironde`,
      j0: (nom, ent) => `Bonjour ${nom.split(' ')[0]},\n\nJe suis formateur Qualiopi habilitation électrique NF C 18-510 en Gironde.\n\nRéponse sous 24h. Intervention en 2 semaines. Intra chez vous ou inter.\n\nUn besoin prévu chez ${ent} pour les prochains mois ?`,
      j4: (nom) => `Bonjour ${nom.split(' ')[0]},\n\nJe reviens sur la formation habilitation.\n\nDisponible rapidement si le besoin se confirme.\n\nUlrich — EYNOR Formation`
    }
  },
  of: {
    autre: {
      li: (nom, ent) => `${nom.split(' ')[0]}, vous avez des clients en Gironde sur l'habilitation électrique ? Je suis formateur Qualiopi local, je fais de la sous-traitance pédagogique.`,
      obj: `Sous-traitance habilitation électrique — Gironde`,
      j0: (nom, ent) => `Bonjour ${nom.split(' ')[0]},\n\nJe suis formateur Qualiopi spécialisé habilitation électrique NF C 18-510 en Gironde.\n\nPlusieurs OF hors région me contactent pour honorer leurs clients locaux sans mobiliser leurs propres formateurs. Devis 24h, bonne disponibilité.\n\nVous avez des clients en Gironde ou Nouvelle-Aquitaine sur ce besoin ?`,
      j4: (nom) => `Bonjour ${nom.split(' ')[0]},\n\nJe reviens sur ma proposition de relais pédagogique en Gironde.\n\nSi un besoin client se présente, je suis disponible rapidement.\n\nUlrich — EYNOR Formation (Qualiopi)`
    },
    default: {
      li: (nom) => `${nom.split(' ')[0]}, formateur Qualiopi habilitation électrique Gironde — disponible pour sous-traitance pédagogique si vous avez des clients locaux.`,
      obj: `Relais pédagogique habilitation — Gironde`,
      j0: (nom, ent) => `Bonjour ${nom.split(' ')[0]},\n\nJe suis formateur Qualiopi NF C 18-510 en Gironde.\n\nJe travaille régulièrement en relais pour des OF qui ont des clients locaux mais pas de formateur disponible sur site.\n\nVous avez ce type de besoin chez ${ent} ?`,
      j4: (nom) => `Bonjour ${nom.split(' ')[0]},\n\nJe reviens sur le relais pédagogique en Gironde.\n\nDispo si un besoin se présente.\n\nUlrich — EYNOR Formation`
    }
  }
};

function getTemplate(icp, signal, nom, ent) {
  const icpT = msgTemplates[icp] || msgTemplates.drh;
  const sigT = icpT[signal] || icpT.default || Object.values(icpT)[0];
  return {
    li: typeof sigT.li === 'function' ? sigT.li(nom, ent) : sigT.li,
    obj: sigT.obj || 'Habilitation électrique — EYNOR Formation',
    j0: typeof sigT.j0 === 'function' ? sigT.j0(nom, ent) : sigT.j0,
    j4: typeof sigT.j4 === 'function' ? sigT.j4(nom, ent) : sigT.j4
  };
}

let _lastPros = null;

document.getElementById('btn-gen-p').addEventListener('click', () => {
  const nom = document.getElementById('r-nom').value.trim();
  const ent = document.getElementById('r-ent').value.trim();
  if (!nom || !ent) { toast('⚠ Nom et entreprise requis'); return; }

  const icp = document.getElementById('r-icp').value;
  const signal = document.getElementById('r-signal').value;
  const poste = document.getElementById('r-poste').value.trim();
  const detail = document.getElementById('r-detail').value.trim();
  const t = getTemplate(icp, signal, nom, ent);

  // Afficher
  const liEl = document.getElementById('out-li');
  liEl.innerHTML = `<button class="copy-btn" onclick="cp(\`${esc(t.li)}\`)">Copier</button>${t.li}`;
  document.getElementById('li-count').textContent = `(${t.li.length}/200)`;
  document.getElementById('out-obj').textContent = t.obj;
  const j0El = document.getElementById('out-j0');
  j0El.innerHTML = `<button class="copy-btn" onclick="cp(\`${esc(t.j0)}\`)">Copier</button>${t.j0}`;
  const j4El = document.getElementById('out-j4');
  j4El.innerHTML = `<button class="copy-btn" onclick="cp(\`${esc(t.j4)}\`)">Copier</button>${t.j4}`;

  // Prompt Claude
  const prompt = `Génère un message LinkedIn (< 200 car.) + email J0 + relance J4 pour :\n- Nom : ${nom}\n- Entreprise : ${ent}\n- Poste : ${poste || 'non précisé'}\n- Signal : ${signal}\n${detail ? '- Contexte : ' + detail : ''}\n\nStyle EYNOR Formation : pair expert, concret, jamais vendeur. Pas de RDV au 1er message. Gironde uniquement.`;
  document.getElementById('prompt-txt').textContent = prompt;
  document.getElementById('prompt-box').classList.add('on');

  _lastPros = { nom, ent, poste, canal: icp === 'of' ? 'Email' : 'LinkedIn', msg: t.li, j0: t.j0, j4: t.j4, statut: 'à envoyer', date: new Date().toLocaleDateString('fr-FR') };
  document.getElementById('btn-save-p').disabled = false;
});

document.getElementById('btn-save-p').addEventListener('click', () => {
  if (!_lastPros) return;
  const leads = S.get('leads', []);
  leads.push(_lastPros);
  S.set('leads', leads);
  const k = S.get('kpis', K0); k.prospects = (k.prospects || 0) + 1; S.set('kpis', k);
  toast('✓ Prospect ajouté au CRM');
  document.getElementById('btn-save-p').disabled = true;
  _lastPros = null;
});

// ─── CRM / Pipeline ───────────────────────────────────────────────────────────

let _pf = 'all';

function renderPipe(f) {
  if (f !== undefined) _pf = f;
  const all = S.get('leads', []);
  const leads = _pf === 'all' ? all : all.filter(l => l.statut === _pf);

  document.querySelectorAll('#pipe-filters button').forEach(b => {
    const active = b.dataset.f === _pf;
    b.className = active ? 'btn btn-p' : 'btn btn-s';
    b.style.fontSize = '12px'; b.style.padding = '5px 12px';
  });

  const tb = document.getElementById('pipe-body');
  if (!leads.length) {
    tb.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--txm);padding:24px">Aucun prospect ici.</td></tr>`;
    return;
  }

  tb.innerHTML = leads.map((l, i) => {
    const realIdx = _pf === 'all' ? i : S.get('leads', []).indexOf(l);
    return `<tr>
      <td style="font-weight:500">${l.nom || ''}</td>
      <td style="color:var(--txm)">${l.ent || ''}</td>
      <td style="color:var(--txm)">${l.poste || ''}</td>
      <td style="color:var(--txm)">${l.canal || ''}</td>
      <td>
        <select style="border:1px solid var(--brd);border-radius:6px;padding:3px 7px;font-size:12px;background:var(--surf);color:var(--tx);outline:none" onchange="updStatus(${realIdx},this.value)">
          ${['à envoyer','envoyé','répondu','relance J4','relance J12','fermé positif','fermé négatif'].map(s => `<option${s === l.statut ? ' selected' : ''}>${s}</option>`).join('')}
        </select>
      </td>
      <td style="color:var(--txm);font-size:12px">${l.date || ''}</td>
      <td style="display:flex;gap:5px;align-items:center">
        <button class="pipe-li-btn" onclick="sendViaExt(${realIdx})" title="Envoyer sur LinkedIn">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="#fff"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
        </button>
        <button class="btn btn-g" style="color:var(--red);font-size:13px;padding:3px 7px" onclick="delLead(${realIdx})">✕</button>
      </td>
    </tr>`;
  }).join('');
}

function updStatus(i, s) {
  const leads = S.get('leads', []);
  if (!leads[i]) return;
  leads[i].statut = s;
  S.set('leads', leads);
  if (s === 'répondu') { const k = S.get('kpis', K0); k.reponses = (k.reponses || 0) + 1; S.set('kpis', k); }
  toast('Statut mis à jour');
  renderPipe();
}
window.updStatus = updStatus;

function delLead(i) {
  if (!confirm('Supprimer ce prospect ?')) return;
  const leads = S.get('leads', []); leads.splice(i, 1); S.set('leads', leads);
  renderPipe(); toast('Supprimé');
}
window.delLead = delLead;

function sendViaExt(i) {
  const leads = S.get('leads', []);
  const lead = leads[i];
  if (!lead) return;
  const msg = lead.msg || '';
  if (typeof EXT !== 'undefined' && EXT.isAvailable()) {
    EXT.sendMessage(lead);
    toast('📤 Ouverture LinkedIn pour ' + lead.nom);
  } else {
    if (msg) cp(msg);
    const q = encodeURIComponent((lead.nom || '') + ' ' + (lead.ent || ''));
    window.open('https://www.linkedin.com/search/results/people/?keywords=' + q, '_blank');
    toast('📋 Message copié + LinkedIn ouvert');
  }
  leads[i].statut = 'envoyé'; S.set('leads', leads); renderPipe();
}
window.sendViaExt = sendViaExt;

document.querySelectorAll('#pipe-filters button').forEach(b => b.addEventListener('click', () => renderPipe(b.dataset.f)));

function openAddModal() { document.getElementById('mo-lead').classList.add('on'); }
window.openAddModal = openAddModal;

function saveAddLead() {
  const nom = document.getElementById('al-nom').value.trim();
  const ent = document.getElementById('al-ent').value.trim();
  if (!nom || !ent) { toast('Nom et entreprise requis'); return; }
  const leads = S.get('leads', []);
  leads.push({ nom, ent, poste: document.getElementById('al-poste').value, canal: document.getElementById('al-canal').value, statut: document.getElementById('al-statut').value, date: new Date().toLocaleDateString('fr-FR') });
  S.set('leads', leads);
  closeMo('mo-lead');
  ['al-nom','al-ent','al-poste'].forEach(id => document.getElementById(id).value = '');
  renderPipe(); toast('Prospect ajouté');
}
window.saveAddLead = saveAddLead;

// ─── Posts LinkedIn ───────────────────────────────────────────────────────────

const postTpl = {
  regl: [
    `Un électricien sans habilitation.\n\nUn accident.\n\nL'inspection arrive.\n\nLe chef d'entreprise est mis en cause personnellement.\n\nPas parce qu'il était là.\nParce qu'il n'avait pas formé.\n\nNF C 18-510. Obligation légale. 3 ans de validité.\nAprès — l'employeur est en défaut.\n\nJe forme en Gironde sous 2 semaines.\nDevis sous 24h.\n\nVos habilitations sont à jour ?`,
    `64 % des accidents électriques graves touchent des salariés non habilités.\n\nL'obligation est claire.\nNF C 18-510, valable 3 ans.\n\nAprès, l'employeur est en défaut.\nPas l'employé. L'employeur.\n\nEt l'inspection du travail ne prévient pas.\n\nFormateur Qualiopi en Gironde.\nRéponse 24h. Intervention 2 semaines.\n\nC'est le bon moment pour faire le point.`
  ],
  ve: [
    `Vous venez d'installer des bornes de recharge.\nVos équipes touchent les câbles.\n\nSavez-vous qu'il existe une habilitation spécifique ?\nLa NF C 18-550.\n\nPas la même que la 18-510 classique.\nPas interchangeable.\n\nEt pourtant — en Gironde, aucun organisme ne la propose clairement.\n\nSauf EYNOR Formation.\n\nVotre flotte est électrique. Vos habilitations doivent l'être aussi.`,
    `12 Kangoo électriques dans la flotte.\n4 bornes sur le parking.\n\nUn technicien branche un câble mal fixé.\n\nIl n'est pas habilité NF C 18-550.\nSon employeur ne savait pas que c'était requis.\n\nEt pourtant.\n\nJe suis le seul formateur positionné sur cette habilitation VE en Gironde.\nDiagnostic gratuit — êtes-vous concerné ?\n\nUn message suffit.`
  ],
  react: [
    `Mon OF habituel a répondu en 8 jours.\nSession disponible dans 3 mois.\n\nC'est ce que j'entends souvent.\n\nMoi je réponds sous 24h.\nJe peux intervenir sous 2 semaines en Gironde.\nJe viens chez vous.\n\nPas de déplacement pour vos équipes.\nPas d'attente à rallonge.\n\nEYNOR Formation. Devis 24h. Intra Gironde.`,
    `Mercredi matin : demande de formation.\nMercredi midi : devis envoyé.\nVendredi : date confirmée.\n\nC'est comme ça que ça devrait toujours fonctionner.\n\nFormateur Qualiopi en Gironde depuis 10 ans.\nPrise en charge OPCO possible.\n\nLe mois prochain — vous avez des habilitations à renouveler ?`
  ],
  preuve: [
    `6 techniciens à habiliter.\nUne journée.\nUn seul déplacement.\n\n6 titres BR délivrés.\nL'inspection peut passer.\n\nFormation intra PME Mérignac, mai 2026.\n\nPas de grande salle.\nPas de PowerPoint poussiéreux.\nDu concret, du terrain, du réel.\n\nCe type de mission en Gironde — un message.`,
    `Un client m'a appelé un lundi.\n3 techniciens devaient intervenir jeudi sur un chantier ATEX.\nAucune habilitation valide.\n\nJe les ai formés le mardi.\nIls sont intervenus le jeudi.\n\nPas une histoire inventée.\nC'est pour ça que je me suis spécialisé.\n\nDisponibilité réelle. Réactivité réelle. Qualiopi.\n\nEYNOR Formation.`
  ]
};

let _lastPost = null;

document.getElementById('btn-gen-post').addEventListener('click', () => {
  const angle = document.getElementById('pa-angle').value;
  const key = ['regl','ve','react','preuve'].find(k => angle.startsWith(k)) || 'regl';
  const arr = postTpl[key];
  const txt = arr[Math.floor(Math.random() * arr.length)];
  document.getElementById('out-post').textContent = txt;
  _lastPost = { texte: txt, angle: key, icp: document.getElementById('pa-icp').value, date: new Date().toLocaleDateString('fr-FR') };
});

document.getElementById('btn-cp-post').addEventListener('click', () => {
  const t = document.getElementById('out-post').textContent;
  if (t && !t.includes('apparaîtra')) cp(t);
});

document.getElementById('btn-li-send-post').addEventListener('click', async () => {
  const text = document.getElementById('out-post').textContent;
  if (!text || text.includes('apparaîtra')) { toast('Génère un post d\'abord'); return; }
  document.getElementById('li-test-post').value = text;
  goPage('linkedin');
  toast('Post copié dans l\'onglet LinkedIn — cliquez Publier');
});

document.getElementById('btn-save-post').addEventListener('click', () => {
  if (!_lastPost || _lastPost.texte.includes('apparaîtra')) { toast('Génère un post d\'abord'); return; }
  const posts = S.get('posts', []);
  posts.unshift(_lastPost);
  S.set('posts', posts);
  const k = S.get('kpis', K0); k.posts = (k.posts || 0) + 1; S.set('kpis', k);
  renderPosts();
  toast('Post sauvegardé ✓');
});

function renderPosts() {
  const posts = S.get('posts', []);
  document.getElementById('posts-cnt').textContent = posts.length ? `(${posts.length})` : '';
  const list = document.getElementById('posts-list');
  if (!posts.length) { list.innerHTML = '<div style="font-size:13px;color:var(--txm);text-align:center;padding:20px">Aucun post sauvegardé.</div>'; return; }
  const agl = { regl: '⚖️ Réglementaire', ve: '🔋 VE', react: '⚡ Réactivité', preuve: '🌟 Preuve' };
  list.innerHTML = posts.map((p, i) => `
    <div style="border:1px solid var(--brd);border-radius:10px;padding:14px;margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div style="display:flex;gap:7px;align-items:center">
          <span class="tag t-send">${agl[p.angle] || p.angle}</span>
          <span style="font-size:11px;color:var(--txm)">${p.icp || ''}</span>
        </div>
        <span style="font-size:11px;color:var(--txm)">${p.date || ''}</span>
      </div>
      <div style="font-size:13px;line-height:1.75;white-space:pre-wrap;color:var(--tx);margin-bottom:10px">${p.texte || ''}</div>
      <div style="display:flex;gap:7px">
        <button class="btn btn-s" style="font-size:12px;padding:5px 11px" onclick="cp(\`${esc(p.texte || '')}\`)">📋 Copier</button>
        <button class="btn btn-g" style="font-size:12px;color:var(--red)" onclick="delPost(${i})">✕</button>
      </div>
    </div>`).join('');
}

function delPost(i) { const p = S.get('posts', []); p.splice(i, 1); S.set('posts', p); renderPosts(); toast('Post supprimé'); }
window.delPost = delPost;

// ─── Studio ───────────────────────────────────────────────────────────────────

document.querySelectorAll('.stab').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('.stab').forEach(x => x.classList.remove('active'));
  b.classList.add('active');
  ['styles','templates','sources','brief'].forEach(k => {
    const el = document.getElementById('st-' + k);
    if (el) el.style.display = b.dataset.st === k ? '' : 'none';
  });
}));

function addStyleProfile() { document.getElementById('mo-style').classList.add('on'); }
window.addStyleProfile = addStyleProfile;

function saveStyle() {
  const nom = document.getElementById('style-nom').value.trim();
  const url = document.getElementById('style-url').value.trim();
  const posts = document.getElementById('style-posts').value.trim().split('\n').filter(Boolean);
  if (!nom) { toast('Nom requis'); return; }
  const styles = S.get('styles', []);
  styles.push({ nom, url, posts, date: new Date().toLocaleDateString('fr-FR') });
  S.set('styles', styles);
  closeMo('mo-style');
  ['style-nom','style-url','style-posts'].forEach(id => document.getElementById(id).value = '');
  renderStudio();
  toast('Profil analysé ajouté ✓');
}
window.saveStyle = saveStyle;

function addTemplate() { document.getElementById('mo-tpl').classList.add('on'); }
window.addTemplate = addTemplate;

function saveTemplate() {
  const nom = document.getElementById('tpl-nom').value.trim();
  const txt = document.getElementById('tpl-txt').value.trim();
  if (!nom || !txt) { toast('Nom et texte requis'); return; }
  const tpls = S.get('templates', []);
  tpls.push({ nom, txt, date: new Date().toLocaleDateString('fr-FR') });
  S.set('templates', tpls);
  closeMo('mo-tpl');
  ['tpl-nom','tpl-txt'].forEach(id => document.getElementById(id).value = '');
  renderStudio();
  toast('Template sauvegardé ✓');
}
window.saveTemplate = saveTemplate;

function delStyle(i) { const s = S.get('styles', []); s.splice(i, 1); S.set('styles', s); renderStudio(); }
window.delStyle = delStyle;

function delTpl(i) { const t = S.get('templates', []); t.splice(i, 1); S.set('templates', t); renderStudio(); }
window.delTpl = delTpl;

function toggleSection(el) {
  el.closest('.sc-section').classList.toggle('open');
}
window.toggleSection = toggleSection;

function renderStudio() {
  // Styles
  const styles = S.get('styles', []);
  const grid = document.getElementById('styles-grid');
  if (styles.length === 0) {
    // Cartes exemples prédéfinies (style EYNOR)
    const defaults = [
      { nom: 'Ulrich Calmo', url: 'https://linkedin.com/in/ulrich-calmo', posts: ['Texte de votre style...', 'Exemple de post 2', 'Exemple de post 3'], analysed: true }
    ];
    grid.innerHTML = defaults.map((s, i) => renderStyleCard(s, i, true)).join('');
  } else {
    grid.innerHTML = styles.map((s, i) => renderStyleCard(s, i, false)).join('');
  }

  // Templates
  const tpls = S.get('templates', []);
  const tplGrid = document.getElementById('tpl-grid');
  if (tpls.length === 0) {
    tplGrid.innerHTML = '<div style="font-size:13px;color:var(--txm);text-align:center;padding:20px;grid-column:1/-1">Aucun template. Créez-en un.</div>';
  } else {
    tplGrid.innerHTML = tpls.map((t, i) => `
      <div class="studio-card">
        <div class="sc-head"><div class="sc-name">${t.nom}</div><button class="sc-del" onclick="delTpl(${i})">🗑</button></div>
        <div style="font-size:12px;color:var(--txm);margin-bottom:10px">${t.date || ''}</div>
        <div style="font-size:12px;line-height:1.6;white-space:pre-wrap;color:var(--txs)">${(t.txt || '').substring(0, 200)}...</div>
        <button class="btn btn-s btn-full" style="font-size:12px;margin-top:10px" onclick="cp(\`${esc(t.txt)}\`)">📋 Utiliser ce template</button>
      </div>`).join('');
  }
}

function renderStyleCard(s, i, isDefault) {
  const posts = s.posts || [];
  return `
  <div class="studio-card">
    <div class="sc-head">
      <div>
        <div class="sc-name">${s.nom}</div>
        ${s.url ? `<div class="sc-sub" onclick="window.open('${s.url}','_blank')">Profil LinkedIn ↗</div>` : '<div style="height:16px"></div>'}
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <span class="tag t-analyse">Analysé</span>
        ${!isDefault ? `<button class="sc-del" onclick="delStyle(${i})">🗑</button>` : ''}
      </div>
    </div>
    <div class="sc-section" id="sc-prompt-${i}">
      <div class="sc-section-head" onclick="toggleSection(this)">
        <span class="sc-section-icon">⚡</span> Prompt IA
        <span class="sc-chevron">▾</span>
      </div>
      <div class="sc-section-body">Rédige un post LinkedIn dans le style de ${s.nom}. Ton : direct, expert, concret. Pas de gras Markdown. Accroche fragmentée.</div>
    </div>
    <div style="font-size:11px;font-weight:500;color:var(--txm);padding:8px 0 4px">${posts.length} exemples de post</div>
    ${posts.map((p, pi) => `
      <div class="sc-section" id="sc-ex-${i}-${pi}">
        <div class="sc-section-head" onclick="toggleSection(this)">
          <span style="font-size:13px;color:var(--txm)">📄</span> Exemple ${pi + 1}
          <span class="sc-chevron">▾</span>
        </div>
        <div class="sc-section-body sc-examples">
          <div class="sc-example" onclick="cp(\`${esc(p)}\`)">${p.substring(0, 120)}${p.length > 120 ? '...' : ''}</div>
        </div>
      </div>`).join('')}
  </div>`;
}

// ─── LinkedIn config handlers ─────────────────────────────────────────────────

document.getElementById('btn-li-save-config')?.addEventListener('click', () => {
  const workerUrl = document.getElementById('li-worker-url').value.trim();
  if (workerUrl) localStorage.setItem('bes_worker_url', workerUrl);
  if (typeof updateLinkedInUI === 'function') updateLinkedInUI();
  toast('Configuration sauvegardée ✓');
});

document.getElementById('btn-li-connect')?.addEventListener('click', () => {
  if (typeof LI !== 'undefined') LI.connect();
  else toast('Module LinkedIn non chargé');
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
  btn.innerHTML = '<span class="sp"></span> Publication...';
  btn.disabled = true;
  try {
    if (typeof LI !== 'undefined') {
      const ok = await LI.publishPost(text);
      if (ok) { toast('✅ Post publié sur LinkedIn !'); document.getElementById('li-test-post').value = ''; }
    } else { toast('Configure d\'abord le Worker Cloudflare'); }
  } finally { btn.innerHTML = '📤 Publier maintenant'; btn.disabled = false; }
});

document.getElementById('btn-li-copy-post')?.addEventListener('click', () => {
  const t = document.getElementById('li-test-post').value;
  if (t) cp(t);
});

function loadLinkedInConfig() {
  const wUrl = localStorage.getItem('bes_worker_url');
  const extId = localStorage.getItem('bes_ext_id');
  if (wUrl) { const el = document.getElementById('li-worker-url'); if (el) el.value = wUrl; }
  if (extId) { const el = document.getElementById('li-ext-id'); if (el) el.value = extId; }
}

// ─── Init ─────────────────────────────────────────────────────────────────────

const dateEl = document.getElementById('d-date');
if (dateEl) {
  const now = new Date();
  const days = ['DIMANCHE','LUNDI','MARDI','MERCREDI','JEUDI','VENDREDI','SAMEDI'];
  const months = ['JANVIER','FÉVRIER','MARS','AVRIL','MAI','JUIN','JUILLET','AOÛT','SEPTEMBRE','OCTOBRE','NOVEMBRE','DÉCEMBRE'];
  dateEl.textContent = `${days[now.getDay()]} ${now.getDate()} ${months[now.getMonth()]}`;
}

loadLinkedInConfig();
renderDash();
renderStudio();
