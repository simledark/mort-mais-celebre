/* ============================================================
   MORT & CELEBRE -- Previsions 2026
   Backend : Supabase (Auth + PostgreSQL)
   Multi-equipes via table team_members
   ============================================================ */

'use strict';

function imgFallback(el, cls) { el.outerHTML = '<div class="' + cls + '">&#x271D;</div>'; }


const SUPABASE_URL  = 'https://mudmucjhiclyukhebeqm.supabase.co';
const SUPABASE_ANON = 'sb_publishable_AMBoNSWZ3iiagHK1G-OX4g_T-qYvTIB';
const WIKIDATA_SPARQL = 'https://query.wikidata.org/sparql';
const WIKIDATA_API    = 'https://www.wikidata.org/w/api.php';
const MAX_PREDICTIONS = 20;

const DOMAIN_QIDS = {
  music      : ['Q177220', 'Q639669', 'Q36834'],
  cinema     : ['Q33999', 'Q2526255', 'Q28389'],
  politics   : ['Q82955', 'Q43845', 'Q15711870'],
  sport      : ['Q2066131', 'Q937857', 'Q10843402'],
  literature : ['Q36180', 'Q49757', 'Q6625963'],
  science    : ['Q901', 'Q169470', 'Q593644'],
};

let sb               = null;
let currentUser      = null;
let currentProfile   = null;
let currentTeam      = null;
let currentUserTeams = [];
let selectedCeleb    = null;
let selectedVis      = 'public';
let searchTimer      = null;
let selectedDomain   = '';

/* ── INIT ─────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('footer-year').textContent = new Date().getFullYear();
  await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js');
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

  setupAuthTabs();
  setupMainTabs();
  setupDomainFilters();

  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    currentUser = session.user;
    // Masquer l'écran auth avant de charger le profil
    document.getElementById('screen-auth').classList.add('hidden');
    await loadProfileAndEnter();
  } else {
    // screen-auth déjà visible par défaut dans le HTML
    loadPalmares();
  }

  const params = new URLSearchParams(window.location.search);
  const invite = params.get('invite');
  if (invite && currentUser) { document.getElementById('join-code').value = invite; switchMainTab('rejoindre'); }

  sb.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session && !currentUser) { currentUser = session.user; await loadProfileAndEnter(); }
    if (event === 'SIGNED_OUT') { currentUser = null; currentProfile = null; currentTeam = null; currentUserTeams = [];
    // Afficher screen-auth, masquer les autres
    document.querySelectorAll('.prev-screen').forEach(function(s) { s.classList.add('hidden'); });
    document.getElementById('screen-auth').classList.remove('hidden');
    loadPalmares();
  }
  });
});

function loadScript(src) {
  return new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) return res();
    const s = document.createElement('script');
    s.src = src; s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
}

/* ── NAVIGATION ──────────────────────────────────────────── */
function showScreen(id) {
  document.querySelectorAll('.prev-screen').forEach(s => s.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setupAuthTabs() {
  // Les onglets auth sont maintenant gérés via switchAuthTab()
}

function switchAuthTab(name) {
  document.querySelectorAll('.auth-tab-mini').forEach(function(t) {
    t.classList.toggle('active', t.dataset.tab === name);
  });
  document.getElementById('tab-login').classList.toggle('hidden', name !== 'login');
  document.getElementById('tab-register').classList.toggle('hidden', name !== 'register');
}

function setupMainTabs() {
  document.querySelectorAll('.main-tab').forEach(tab => {
    tab.addEventListener('click', () => switchMainTab(tab.dataset.tab));
  });
}

function switchMainTab(name) {
  document.querySelectorAll('.main-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.main-tab-content').forEach(c => c.classList.add('hidden'));
  const t = document.querySelector('.main-tab[data-tab="' + name + '"]');
  if (t) t.classList.add('active');
  const c = document.getElementById('tab-' + name);
  if (c) c.classList.remove('hidden');
  if (name === 'mon-equipe') renderTeamTab();
}

function setupDomainFilters() {
  document.querySelectorAll('.domain-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.domain-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedDomain = btn.dataset.domain;
      const q = document.getElementById('search-input').value.trim();
      if (q.length >= 2) performSearch(q); else loadSuggestions(selectedDomain);
    });
  });
}

/* ═══════════════════════════════════════════════════════════
   AUTH
   ═══════════════════════════════════════════════════════════ */

async function doRegister() {
  const firstname  = document.getElementById('reg-firstname').value.trim();
  const lastname   = document.getElementById('reg-lastname').value.trim();
  const birthdate  = document.getElementById('reg-birthdate').value;
  const pseudo     = document.getElementById('reg-pseudo').value.trim();
  const email      = document.getElementById('reg-email').value.trim();
  const pass       = document.getElementById('reg-password').value;
  const pass2      = document.getElementById('reg-password2').value;
  const newsletter = document.getElementById('reg-newsletter').checked;
  const errEl      = document.getElementById('reg-error');
  errEl.classList.add('hidden');
  const err = function(msg) { errEl.textContent = msg; errEl.classList.remove('hidden'); };

  if (!pseudo || pseudo.length < 2)              return err('Le pseudonyme doit faire au moins 2 caracteres.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return err('Adresse email invalide.');
  if (pass.length < 8)                            return err('Le mot de passe doit faire au moins 8 caracteres.');
  if (pass !== pass2)                             return err('Les mots de passe ne correspondent pas.');

  const { data: existing } = await sb.from('profiles').select('pseudo').eq('pseudo', pseudo).maybeSingle();
  if (existing) return err('Ce pseudonyme est deja utilise.');

  const { error } = await sb.auth.signUp({
    email, password: pass,
    options: {
      data: { pseudo, newsletter, first_name: firstname, last_name: lastname, birth_date: birthdate },
      emailRedirectTo: window.location.href
    }
  });
  if (error) return err(error.message);
  showConfirmEmail(email);
}

function showConfirmEmail(email) {
  document.getElementById('tab-register').innerHTML =
    '<div style="text-align:center;padding:2rem 0">' +
    '<div style="font-size:2.5rem;margin-bottom:0.75rem;color:var(--gold)">&#x2709;</div>' +
    '<div style="font-family:var(--font-display);font-size:1.2rem;font-weight:700;color:var(--cream);margin-bottom:0.75rem">Verifiez votre boite mail</div>' +
    '<p style="color:var(--gray);font-style:italic;font-size:0.95rem;line-height:1.7">Un lien de confirmation a ete envoye a<br><strong>' + esc(email) + '</strong>.<br>Cliquez dessus pour activer votre compte.</p>' +
    '</div>';
}

async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  errEl.classList.add('hidden');
  const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
  if (error) { errEl.textContent = error.message.includes('Invalid') ? 'Email ou mot de passe incorrect.' : error.message; errEl.classList.remove('hidden'); return; }
  currentUser = data.user;
  await loadProfileAndEnter();
}

async function doLogout() { await sb.auth.signOut(); }


/* ═══════════════════════════════════════════════════════════
   GESTION DU COMPTE
   ═══════════════════════════════════════════════════════════ */

async function showAccountScreen() {
  if (!currentProfile) return;
  // Pré-remplir les champs
  document.getElementById('acc-firstname').value  = currentProfile.first_name  || '';
  document.getElementById('acc-lastname').value   = currentProfile.last_name   || '';
  document.getElementById('acc-birthdate').value  = currentProfile.birth_date  || '';
  document.getElementById('acc-pseudo').value     = currentProfile.pseudo      || '';
  document.getElementById('acc-email').value      = currentUser.email          || '';
  document.getElementById('acc-newsletter').checked = currentProfile.newsletter !== false;
  // Masquer les messages
  document.getElementById('account-success').classList.add('hidden');
  document.getElementById('account-error').classList.add('hidden');
  document.getElementById('newsletter-success').classList.add('hidden');
  document.getElementById('password-error').classList.add('hidden');
  document.getElementById('password-success').classList.add('hidden');
  showScreen('screen-account');
}

async function saveAccount() {
  const pseudo     = document.getElementById('acc-pseudo').value.trim();
  const firstname  = document.getElementById('acc-firstname').value.trim();
  const lastname   = document.getElementById('acc-lastname').value.trim();
  const birthdate  = document.getElementById('acc-birthdate').value;
  const errEl      = document.getElementById('account-error');
  const okEl       = document.getElementById('account-success');
  errEl.classList.add('hidden');
  okEl.classList.add('hidden');

  if (!pseudo || pseudo.length < 2) {
    errEl.textContent = 'Le pseudonyme doit faire au moins 2 caracteres.';
    errEl.classList.remove('hidden'); return;
  }

  // Verifier unicite pseudo si change
  if (pseudo !== currentProfile.pseudo) {
    const { data: existing } = await sb.from('profiles').select('pseudo').eq('pseudo', pseudo).maybeSingle();
    if (existing) {
      errEl.textContent = 'Ce pseudonyme est deja utilise.';
      errEl.classList.remove('hidden'); return;
    }
  }

  const { error } = await sb.from('profiles').update({
    pseudo     : pseudo,
    first_name : firstname || null,
    last_name  : lastname  || null,
    birth_date : birthdate || null,
  }).eq('id', currentUser.id);

  if (error) {
    errEl.textContent = 'Erreur : ' + error.message;
    errEl.classList.remove('hidden'); return;
  }

  // Mettre a jour le profil local
  currentProfile.pseudo     = pseudo;
  currentProfile.first_name = firstname;
  currentProfile.last_name  = lastname;
  currentProfile.birth_date = birthdate;

  // Mettre a jour l'affichage dans la barre utilisateur
  document.getElementById('user-avatar-main').textContent   = pseudo[0].toUpperCase();
  document.getElementById('user-pseudo-display').textContent = pseudo;

  okEl.classList.remove('hidden');
  setTimeout(function() { okEl.classList.add('hidden'); }, 3000);
}

async function saveNewsletter() {
  const checked = document.getElementById('acc-newsletter').checked;
  const okEl    = document.getElementById('newsletter-success');
  okEl.classList.add('hidden');

  await sb.from('profiles').update({ newsletter: checked }).eq('id', currentUser.id);
  currentProfile.newsletter = checked;

  okEl.classList.remove('hidden');
  setTimeout(function() { okEl.classList.add('hidden'); }, 3000);
}

async function changePassword() {
  const pass  = document.getElementById('acc-newpass').value;
  const pass2 = document.getElementById('acc-newpass2').value;
  const errEl = document.getElementById('password-error');
  const okEl  = document.getElementById('password-success');
  errEl.classList.add('hidden');
  okEl.classList.add('hidden');

  if (pass.length < 8) {
    errEl.textContent = 'Le mot de passe doit faire au moins 8 caracteres.';
    errEl.classList.remove('hidden'); return;
  }
  if (pass !== pass2) {
    errEl.textContent = 'Les mots de passe ne correspondent pas.';
    errEl.classList.remove('hidden'); return;
  }

  const { error } = await sb.auth.updateUser({ password: pass });
  if (error) {
    errEl.textContent = 'Erreur : ' + error.message;
    errEl.classList.remove('hidden'); return;
  }

  document.getElementById('acc-newpass').value  = '';
  document.getElementById('acc-newpass2').value = '';
  okEl.classList.remove('hidden');
  setTimeout(function() { okEl.classList.add('hidden'); }, 3000);
}

async function deleteAccount() {
  if (!confirm('Supprimer definitivement votre compte ?\nToutes vos previsions seront supprimees. Cette action est irreversible.')) return;
  if (!confirm('Derniere confirmation : supprimer le compte de ' + (currentProfile.pseudo || currentUser.email) + ' ?')) return;

  // Supprimer les previsions
  await sb.from('predictions').delete().eq('user_id', currentUser.id);
  // Quitter toutes les equipes
  await sb.from('team_members').delete().eq('user_id', currentUser.id);
  // Supprimer le profil
  await sb.from('profiles').delete().eq('id', currentUser.id);
  // Deconnexion (le compte auth est supprime cote serveur via trigger ou manuellement)
  await sb.auth.signOut();
  alert('Votre compte a ete supprime. A bientot !');
}

async function loadProfileAndEnter() {
  await reloadProfile();
  showScreen('screen-main');
  await renderMyPredictions();
  loadSuggestions('');
}

/* ═══════════════════════════════════════════════════════════
   PROFIL
   ═══════════════════════════════════════════════════════════ */

async function reloadProfile() {
  const { data: profile } = await sb.from('profiles').select('*').eq('id', currentUser.id).maybeSingle();
  currentProfile = profile;

  const { data: memberships } = await sb.from('team_members').select('teams(*)').eq('user_id', currentUser.id);
  currentUserTeams = (memberships || []).map(function(m) { return m.teams; }).filter(Boolean);

  if (!currentTeam && currentUserTeams.length > 0) currentTeam = currentUserTeams[0];
  if (currentTeam && !currentUserTeams.find(function(t) { return t.id === currentTeam.id; })) {
    currentTeam = currentUserTeams[0] || null;
  }

  // Toujours utiliser le pseudo enregistré en base, jamais l'email
  const displayName = (profile && profile.pseudo) ? profile.pseudo : '?';
  document.getElementById('user-avatar-main').textContent   = displayName[0].toUpperCase();
  document.getElementById('user-pseudo-display').textContent = displayName;
  document.getElementById('user-mode-display').textContent  = currentUserTeams.length > 0
    ? currentUserTeams.length + ' equipe' + (currentUserTeams.length > 1 ? 's' : '') : 'Predicteur solo';
}

/* ═══════════════════════════════════════════════════════════
   PREDICTIONS
   ═══════════════════════════════════════════════════════════ */

async function renderMyPredictions() {
  const { data: preds } = await sb.from('predictions').select('*')
    .eq('user_id', currentUser.id).eq('year', 2026).order('created_at', { ascending: true });

  const listEl  = document.getElementById('my-predictions-list');
  const emptyEl = document.getElementById('my-predictions-empty');
  const fillEl  = document.getElementById('score-fill');
  const countEl = document.getElementById('score-count');
  const list    = preds || [];
  const limit   = (currentTeam && currentTeam.pred_limit) ? currentTeam.pred_limit : MAX_PREDICTIONS;

  countEl.textContent = list.length;
  fillEl.style.width  = Math.min((list.length / limit) * 100, 100) + '%';

  if (list.length === 0) { listEl.innerHTML = ''; emptyEl.classList.remove('hidden'); return; }
  emptyEl.classList.add('hidden');
  listEl.innerHTML = '';

  list.forEach(function(p, i) {
    const item = document.createElement('div');
    item.className = 'prediction-item';
    item.style.animationDelay = (i * 0.05) + 's';
    const imgHtml = p.celeb_image
      ? '<img class="pred-thumb" src="' + esc(p.celeb_image) + '" alt="' + esc(p.celeb_name) + '" onerror=\"imgFallback(this,\'pred-thumb-placeholder\')\">'
      : '<div class="pred-thumb-placeholder">&#x271D;</div>';
    const statusClass = p.status === 'correct' ? 'pred-status-correct' : p.status === 'wrong' ? 'pred-status-wrong' : 'pred-status-pending';
    const statusText  = p.status === 'correct' ? '&#x2713; Juste' : p.status === 'wrong' ? '&#x2717; Faux' : '&mdash;';
    const visLabel    = p.visibility === 'group' ? '&#x1F465; groupe' : p.visibility === 'private' ? '&#x1F512; priv&eacute;e' : '&#x1F30D; public';
    const isLocked    = currentTeam && currentTeam.locked && currentTeam.admin_id !== currentUser.id;
    item.innerHTML =
      '<div class="pred-rank">' + (i + 1) + '</div>' +
      imgHtml +
      '<div class="pred-info"><div class="pred-name">' + esc(p.celeb_name) + '</div>' +
      '<div class="pred-meta">' + [p.celeb_domain, p.celeb_nationality, p.celeb_age ? p.celeb_age + ' ans' : null].filter(Boolean).join(' &middot; ') + '</div></div>' +
      '<div class="pred-visibility">' + visLabel + '</div>' +
      '<div class="pred-status ' + statusClass + '">' + statusText + '</div>' +
      (!isLocked && p.status === 'pending' ? '<button class="pred-delete" title="Supprimer" onclick="deletePrediction(\'' + p.id + '\')">&#x2715;</button>' : '');
    listEl.appendChild(item);
  });
}

async function deletePrediction(id) {
  if (!confirm('Supprimer cette prevision ?')) return;
  await sb.from('predictions').delete().eq('id', id).eq('user_id', currentUser.id);
  await renderMyPredictions();
}

async function confirmPrediction() {
  if (!selectedCeleb) return;
  const { count } = await sb.from('predictions').select('id', { count: 'exact', head: true })
    .eq('user_id', currentUser.id).eq('year', 2026);
  const limit = (currentTeam && currentTeam.pred_limit) ? currentTeam.pred_limit : MAX_PREDICTIONS;
  if (count >= limit) { alert('Limite de ' + limit + ' previsions atteinte.'); return; }

  await sb.from('celebrities').upsert({
    wikidata_id: selectedCeleb.wikidataId, name: selectedCeleb.name,
    domain: selectedCeleb.domain, nationality: selectedCeleb.nationality,
    birth_date: selectedCeleb.birthDate, age: selectedCeleb.age,
    image_url: selectedCeleb.imageUrl, wiki_url: selectedCeleb.wikipediaUrl,
    is_alive: true, last_checked: new Date().toISOString(),
  }, { onConflict: 'wikidata_id' });

  const { error } = await sb.from('predictions').insert({
    user_id: currentUser.id, team_id: currentTeam ? currentTeam.id : null, year: 2026,
    wikidata_id: selectedCeleb.wikidataId, celeb_name: selectedCeleb.name,
    celeb_domain: selectedCeleb.domain, celeb_nationality: selectedCeleb.nationality,
    celeb_age: selectedCeleb.age, celeb_image: selectedCeleb.imageUrl,
    celeb_wiki: selectedCeleb.wikipediaUrl, visibility: selectedVis, status: 'pending',
  });

  if (error) { alert(error.code === '23505' ? selectedCeleb.name + ' est deja dans vos previsions.' : error.message); return; }
  document.getElementById('modal-celeb-name').textContent = selectedCeleb.name;
  document.getElementById('modal-confirm').classList.remove('hidden');
}

async function closeModal() {
  document.getElementById('modal-confirm').classList.add('hidden');
  clearSelection();
  showScreen('screen-main');
  await renderMyPredictions();
}


/* ═══════════════════════════════════════════════════════════
   PALMARES PUBLIC (visible sans connexion)
   ═══════════════════════════════════════════════════════════ */

var allPublicPredictions = [];
var activeFilterDomain  = '';
var activeFilterCountry = '';

/* ═══════════════════════════════════════════════════════════
   EQUIPES -- MULTI-EQUIPES
   ═══════════════════════════════════════════════════════════ */

async function createTeam() {
  const name  = document.getElementById('new-team-name').value.trim();
  const errEl = document.getElementById('create-team-error');
  errEl.classList.add('hidden');
  if (!name || name.length < 2) { errEl.textContent = 'Nom trop court.'; errEl.classList.remove('hidden'); return; }

  const { data: existing } = await sb.from('teams').select('id').eq('name', name).maybeSingle();
  if (existing) { errEl.textContent = 'Ce nom est deja utilise.'; errEl.classList.remove('hidden'); return; }

  const { data: team, error } = await sb.from('teams').insert({ name: name, admin_id: currentUser.id }).select().single();
  if (error) { errEl.textContent = error.message; errEl.classList.remove('hidden'); return; }

  await sb.from('team_members').insert({ team_id: team.id, user_id: currentUser.id });
  currentTeam = team;
  await reloadProfile();
  document.getElementById('new-team-name').value = '';
  switchMainTab('mon-equipe');
}

async function joinTeam() {
  const raw   = document.getElementById('join-code').value.trim().toUpperCase();
  const errEl = document.getElementById('join-team-error');
  errEl.classList.add('hidden');

  const m    = raw.match(/([A-Z0-9]{6})/);
  const code = m ? m[1] : raw;

  const { data: team } = await sb.from('teams').select('*').eq('invite_code', code).maybeSingle();
  if (!team) { errEl.textContent = 'Code invalide.'; errEl.classList.remove('hidden'); return; }

  const { data: already } = await sb.from('team_members')
    .select('team_id').eq('team_id', team.id).eq('user_id', currentUser.id).maybeSingle();
  if (already) { errEl.textContent = 'Vous etes deja membre de cette equipe.'; errEl.classList.remove('hidden'); return; }

  await sb.from('team_members').insert({ team_id: team.id, user_id: currentUser.id });
  currentTeam = team;
  await reloadProfile();
  document.getElementById('join-code').value = '';
  switchMainTab('mon-equipe');
}

async function renderTeamTab() {
  const { data: memberships } = await sb.from('team_members').select('teams(*)').eq('user_id', currentUser.id);
  currentUserTeams = (memberships || []).map(function(m) { return m.teams; }).filter(Boolean);

  const noTeamEl  = document.getElementById('equipe-no-team');
  const contentEl = document.getElementById('equipe-content');

  if (currentUserTeams.length === 0) { noTeamEl.classList.remove('hidden'); contentEl.classList.add('hidden'); return; }
  noTeamEl.classList.add('hidden'); contentEl.classList.remove('hidden');

  if (!currentTeam || !currentUserTeams.find(function(t) { return t.id === currentTeam.id; })) {
    currentTeam = currentUserTeams[0];
  }

  renderTeamSelector();
  await renderCurrentTeam();
}

function renderTeamSelector() {
  var el = document.getElementById('team-selector-wrap');
  if (!el) {
    el = document.createElement('div');
    el.id = 'team-selector-wrap';
    el.style.cssText = 'display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:1.25rem;';
    const contentEl = document.getElementById('equipe-content');
    contentEl.insertBefore(el, contentEl.firstChild);
  }
  el.innerHTML = '';
  if (currentUserTeams.length <= 1) { el.style.display = 'none'; return; }
  el.style.display = 'flex';

  currentUserTeams.forEach(function(team) {
    const btn = document.createElement('button');
    btn.className = 'domain-btn' + (currentTeam && team.id === currentTeam.id ? ' active' : '');
    btn.textContent = team.name;
    btn.onclick = async function() { currentTeam = team; renderTeamSelector(); await renderCurrentTeam(); };
    el.appendChild(btn);
  });
}

async function renderCurrentTeam() {
  if (!currentTeam) return;

  const { data: memberships } = await sb.from('team_members').select('profiles(id, pseudo)').eq('team_id', currentTeam.id);
  const members = (memberships || []).map(function(m) { return m.profiles; }).filter(Boolean);
  const isAdmin = currentTeam.admin_id === currentUser.id;

  document.getElementById('equipe-name-display').textContent = currentTeam.name;
  document.getElementById('equipe-meta-display').textContent =
    members.length + ' membre' + (members.length > 1 ? 's' : '') + ' - Code : ' + currentTeam.invite_code;
  document.getElementById('equipe-admin-badge').classList.toggle('hidden', !isAdmin);
  document.getElementById('equipe-admin-panel').classList.toggle('hidden', !isAdmin);

  // Bouton supprimer / quitter
  var actionBtn = document.getElementById('equipe-action-btn');
  if (!actionBtn) {
    actionBtn = document.createElement('button');
    actionBtn.id = 'equipe-action-btn';
    const headerEl = document.getElementById('equipe-header');
    if (headerEl) headerEl.appendChild(actionBtn);
  }
  if (actionBtn) {
    if (isAdmin) {
      actionBtn.className = 'prev-btn prev-btn-sm';
      actionBtn.style.cssText = 'border-color:rgba(184,42,34,0.4);color:var(--red-death);margin-left:0.5rem;';
      actionBtn.textContent = 'Supprimer';
      actionBtn.onclick = deleteTeam;
    } else {
      actionBtn.className = 'prev-btn prev-btn-sm prev-btn-ghost';
      actionBtn.style.cssText = 'margin-left:0.5rem;';
      actionBtn.textContent = 'Quitter';
      actionBtn.onclick = leaveTeam;
    }
  }

  if (isAdmin) {
    document.getElementById('toggle-lock').checked = currentTeam.locked;
    document.getElementById('limit-val-display').textContent = currentTeam.pred_limit;
    const inviteUrl = window.location.origin + window.location.pathname + '?invite=' + currentTeam.invite_code;
    document.getElementById('invite-link-display').textContent = inviteUrl;
    document.getElementById('invite-qr').innerHTML =
      '<img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=' + encodeURIComponent(inviteUrl) + '" width="100" height="100" alt="QR" />';
    renderMembersList(members, isAdmin);
  }

  await renderTeamPredictions(members);
  await renderTeamRanking(members);
}

async function deleteTeam() {
  if (!confirm('Supprimer definitvement "' + currentTeam.name + '" ?\nTous les membres perdront acces. Cette action est irreversible.')) return;
  const { error } = await sb.from('teams').delete().eq('id', currentTeam.id).eq('admin_id', currentUser.id);
  if (error) { alert('Erreur : ' + error.message); return; }
  currentTeam = null;
  await reloadProfile();
  switchMainTab(currentUserTeams.length > 0 ? 'mon-equipe' : 'rejoindre');
}

async function leaveTeam() {
  if (!confirm('Quitter "' + currentTeam.name + '" ?')) return;
  await sb.from('team_members').delete().eq('team_id', currentTeam.id).eq('user_id', currentUser.id);
  currentTeam = null;
  await reloadProfile();
  switchMainTab(currentUserTeams.length > 0 ? 'mon-equipe' : 'rejoindre');
}

function renderMembersList(members, isAdmin) {
  const listEl = document.getElementById('equipe-members-list');
  listEl.innerHTML = '';
  members.forEach(function(m) {
    const isMe  = m.id === currentUser.id;
    const isAdm = m.id === currentTeam.admin_id;
    const row   = document.createElement('div');
    row.className = 'member-row';
    row.innerHTML =
      '<div class="member-avatar">' + ((m.pseudo || '?')[0]).toUpperCase() + '</div>' +
      '<div class="member-name">' + esc(m.pseudo || '-') +
        (isMe  ? ' <em style="color:var(--gold-dim2);font-size:0.72rem">(vous)</em>' : '') +
        (isAdm ? ' <em style="color:var(--gold-dim2);font-size:0.72rem">Admin</em>'  : '') +
      '</div>' +
      (isAdmin && !isMe ? '<button class="pred-delete" onclick="removeMember(\'' + m.id + '\',\'' + esc(m.pseudo || '') + '\')">&#x2715;</button>' : '');
    listEl.appendChild(row);
  });
}

async function removeMember(userId, pseudo) {
  if (!confirm('Retirer ' + pseudo + ' ?')) return;
  await sb.from('team_members').delete().eq('team_id', currentTeam.id).eq('user_id', userId);
  await renderCurrentTeam();
}

async function toggleTeamLock(locked) {
  await sb.from('teams').update({ locked: locked }).eq('id', currentTeam.id);
  currentTeam.locked = locked;
}

async function changeTeamLimit(delta) {
  const newLimit = Math.max(1, Math.min(50, ((currentTeam.pred_limit || 20) + delta)));
  await sb.from('teams').update({ pred_limit: newLimit }).eq('id', currentTeam.id);
  currentTeam.pred_limit = newLimit;
  document.getElementById('limit-val-display').textContent = newLimit;
}

async function copyInviteLink() {
  await navigator.clipboard.writeText(document.getElementById('invite-link-display').textContent);
  const btn = event.target; const orig = btn.textContent;
  btn.textContent = 'Copie !'; setTimeout(function() { btn.textContent = orig; }, 2000);
}

async function renderTeamPredictions(members) {
  const { data: preds } = await sb.from('predictions')
    .select('*, profiles(pseudo)').eq('team_id', currentTeam.id)
    .in('visibility', ['public', 'group']).eq('year', 2026)
    .order('created_at', { ascending: false });

  const listEl = document.getElementById('equipe-predictions-list');
  listEl.innerHTML = '';
  const list = preds || [];
  if (list.length === 0) {
    listEl.innerHTML = '<div class="prev-empty" style="padding:1.5rem"><p>Aucune prevision partagee.</p></div>'; return;
  }
  const counts = {};
  list.forEach(function(p) { counts[p.wikidata_id] = (counts[p.wikidata_id] || 0) + 1; });
  const seen = new Set();
  list.forEach(function(p, i) {
    if (seen.has(p.wikidata_id)) return;
    seen.add(p.wikidata_id);
    const item = document.createElement('div');
    item.className = 'prediction-item';
    item.style.animationDelay = (i * 0.04) + 's';
    const imgHtml = p.celeb_image
      ? '<img class="pred-thumb" src="' + esc(p.celeb_image) + '" alt="' + esc(p.celeb_name) + '" onerror=\"imgFallback(this,\'pred-thumb-placeholder\')\">'
      : '<div class="pred-thumb-placeholder">&#x271D;</div>';
    const statusClass = p.status === 'correct' ? 'pred-status-correct' : p.status === 'wrong' ? 'pred-status-wrong' : 'pred-status-pending';
    const pseudo = (p.profiles && p.profiles.pseudo) ? p.profiles.pseudo : '-';
    const cited  = counts[p.wikidata_id] > 1 ? ' &middot; ' + counts[p.wikidata_id] + ' membres' : '';
    item.innerHTML =
      imgHtml +
      '<div class="pred-info"><div class="pred-name">' + esc(p.celeb_name) + '</div>' +
      '<div class="pred-meta">' + esc(p.celeb_domain || '') + ' &middot; par ' + esc(pseudo) + cited + '</div></div>' +
      '<div class="pred-status ' + statusClass + '">' + (p.status === 'correct' ? '&#x2713;' : p.status === 'wrong' ? '&#x2717;' : '&mdash;') + '</div>';
    listEl.appendChild(item);
  });
}

async function renderTeamRanking(members) {
  const { data: preds } = await sb.from('predictions')
    .select('user_id, status').eq('team_id', currentTeam.id).eq('year', 2026);
  const rankEl = document.getElementById('equipe-ranking');
  rankEl.innerHTML = '';
  const scores = {};
  members.forEach(function(m) { scores[m.id] = { pseudo: m.pseudo || '?', correct: 0, total: 0 }; });
  (preds || []).forEach(function(p) {
    if (!scores[p.user_id]) return;
    scores[p.user_id].total++;
    if (p.status === 'correct') scores[p.user_id].correct++;
  });
  const sorted   = Object.values(scores).sort(function(a, b) { return b.correct - a.correct || b.total - a.total; });
  const maxScore = (sorted[0] && sorted[0].correct) ? sorted[0].correct : 1;
  const medals   = ['&#x1F947;', '&#x1F948;', '&#x1F949;'];
  sorted.forEach(function(s, i) {
    const row = document.createElement('div');
    row.className = 'ranking-row';
    const pct = Math.round((s.correct / maxScore) * 100);
    row.innerHTML =
      '<div class="ranking-rank">' + (medals[i] || (i + 1)) + '</div>' +
      '<div class="member-avatar" style="width:28px;height:28px;font-size:0.75rem">' + s.pseudo[0].toUpperCase() + '</div>' +
      '<div class="ranking-name">' + esc(s.pseudo) + '</div>' +
      '<div class="ranking-bar-wrap"><div class="ranking-bar-fill" style="width:' + pct + '%"></div></div>' +
      '<div class="ranking-score">' + s.correct + ' / ' + s.total + '</div>';
    rankEl.appendChild(row);
  });
}

/* ═══════════════════════════════════════════════════════════
   WIKIDATA
   ═══════════════════════════════════════════════════════════ */

function onSearchInput(value) {
  clearTimeout(searchTimer);
  const q = value.trim();
  document.getElementById('search-results').innerHTML = '';
  document.getElementById('search-empty').classList.add('hidden');
  if (q.length < 2) { document.getElementById('search-suggestions').style.display = ''; return; }
  document.getElementById('search-suggestions').style.display = 'none';
  document.getElementById('search-spinner').classList.remove('hidden');
  searchTimer = setTimeout(function() { performSearch(q); }, 500);
}

async function performSearch(query) {
  try {
    const url = new URL(WIKIDATA_API);
    url.searchParams.set('action', 'wbsearchentities');
    url.searchParams.set('search', query);
    url.searchParams.set('language', 'fr');
    url.searchParams.set('type', 'item');
    url.searchParams.set('limit', '15');
    url.searchParams.set('format', 'json');
    url.searchParams.set('origin', '*');

    const res  = await fetch(url);
    const data = await res.json();
    const qids = (data.search || []).map(function(r) { return r.id; });
    if (qids.length === 0) { showSearchEmpty(); return; }

    const { data: cached } = await sb.from('celebrities').select('*').in('wikidata_id', qids).eq('is_alive', true);
    const cachedIds = new Set((cached || []).map(function(c) { return c.wikidata_id; }));
    const uncached  = qids.filter(function(q) { return !cachedIds.has(q); });
    var fresh = [];
    if (uncached.length > 0) fresh = await fetchLivingFromWikidata(uncached);

    const cacheFormatted = (cached || []).map(function(c) { return {
      wikidataId: c.wikidata_id, name: c.name, domain: c.domain,
      nationality: c.nationality, birthDate: c.birth_date, age: c.age,
      imageUrl: c.image_url, wikipediaUrl: c.wiki_url,
    }; });
    const all     = cacheFormatted.concat(fresh);
    const ordered = qids.map(function(id) { return all.find(function(r) { return r.wikidataId === id; }); }).filter(Boolean);
    if (ordered.length === 0) showSearchEmpty(); else renderSearchResults(ordered);
  } catch (err) { console.error(err); showSearchEmpty(); }
  finally { document.getElementById('search-spinner').classList.add('hidden'); }
}

async function fetchLivingFromWikidata(qids) {
  const values = qids.map(function(q) { return 'wd:' + q; }).join(' ');
  const sparql = 'SELECT DISTINCT ?person ?personLabel ?birthDate ?age ?nationalityLabel ?occupationLabel ?image WHERE {' +
    'VALUES ?person { ' + values + ' }' +
    '?person wdt:P31 wd:Q5 .' +
    'FILTER NOT EXISTS { ?person wdt:P570 [] }' +
    '?person wdt:P569 ?birthDate .' +
    'BIND(YEAR(NOW()) - YEAR(?birthDate) AS ?age)' +
    'OPTIONAL { ?person wdt:P27 ?nationality . }' +
    'OPTIONAL { ?person wdt:P106 ?occupation . }' +
    'OPTIONAL { ?person wdt:P18 ?image . }' +
    'SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en" . }' +
    '} LIMIT 10';
  return runSparql(sparql);
}


/* ═══════════════════════════════════════════════════════════
   PALMARÈS PUBLIC (écran d'accueil)
   ═══════════════════════════════════════════════════════════ */

var palmaresTab     = 'citations'; // 'citations' | 'scores'
var palmaresFilters = { domain: '', country: '' };
var palmaresData    = { citations: [], scores: [] };

async function loadPalmares() {
  try {
    // Appel REST direct avec la clé anon — fonctionne sans session active
    const res = await fetch(
      SUPABASE_URL + '/rest/v1/predictions?year=eq.2026&select=wikidata_id,celeb_name,celeb_domain,celeb_nationality,celeb_image,celeb_age,status',
      {
        headers: {
          'apikey': SUPABASE_ANON,
          'Authorization': 'Bearer ' + SUPABASE_ANON,
          'Content-Type': 'application/json',
        }
      }
    );

    if (!res.ok) {
      console.error('Palmares HTTP error:', res.status, await res.text());
      document.getElementById('palmares-list').innerHTML =
        '<div class="palmares-empty">Palmarès indisponible (' + res.status + ').</div>';
      return;
    }

    const preds = await res.json();

    if (!preds || preds.length === 0) {
      renderPalmares([]);
      return;
    }

    // Compter les citations par célébrité
    var citCounts = {};
    var scoreCounts = {};

    preds.forEach(function(p) {
      var key = p.wikidata_id;
      if (!citCounts[key]) {
        citCounts[key] = {
          wikidataId  : p.wikidata_id,
          name        : p.celeb_name,
          domain      : p.celeb_domain || '',
          nationality : p.celeb_nationality || '',
          imageUrl    : p.celeb_image,
          age         : p.celeb_age,
          citations   : 0,
          confirmed   : 0,
        };
      }
      citCounts[key].citations++;
      if (p.status === 'correct') citCounts[key].confirmed++;
    });

    palmaresData.citations = Object.values(citCounts)
      .sort(function(a, b) { return b.citations - a.citations; });

    palmaresData.scores = Object.values(citCounts)
      .filter(function(c) { return c.confirmed > 0; })
      .sort(function(a, b) { return b.confirmed - a.confirmed || b.citations - a.citations; });

    renderPalmares(getFilteredData());
  } catch(e) {
    console.error('Palmarès error:', e);
    document.getElementById('palmares-list').innerHTML =
      '<div class="palmares-empty">Impossible de charger le palmarès.</div>';
  }
}

function getFilteredData() {
  var data = palmaresTab === 'scores' ? palmaresData.scores : palmaresData.citations;
  return data.filter(function(item) {
    var domainOk = true;
    var countryOk = true;
    if (palmaresFilters.domain) {
      domainOk = item.domain && item.domain.toLowerCase().indexOf(palmaresFilters.domain.toLowerCase()) !== -1;
    }
    if (palmaresFilters.country) {
      countryOk = item.nationality && item.nationality.toLowerCase().indexOf(palmaresFilters.country.toLowerCase()) !== -1;
    }
    return domainOk && countryOk;
  });
}

function renderPalmares(items) {
  var listEl = document.getElementById('palmares-list');
  if (!listEl) return;

  if (items.length === 0) {
    listEl.innerHTML = '<div class="palmares-empty">Aucune prévision disponible pour l instant.</div>';
    return;
  }

  var maxVal = palmaresTab === 'scores'
    ? (items[0] ? items[0].confirmed : 1)
    : (items[0] ? items[0].citations : 1);
  if (maxVal === 0) maxVal = 1;

  var medals = ['🥇', '🥈', '🥉'];
  var rankClasses = ['gold', 'silver', 'bronze'];

  listEl.innerHTML = '';
  items.slice(0, 30).forEach(function(item, i) {
    var row = document.createElement('div');
    row.className = 'pub-row';
    row.style.animationDelay = (i * 0.04) + 's';

    var val   = palmaresTab === 'scores' ? item.confirmed : item.citations;
    var label = palmaresTab === 'scores' ? 'confirmé' + (val > 1 ? 's' : '') : 'prédiction' + (val > 1 ? 's' : '');
    var pct   = Math.round((val / maxVal) * 100);
    var rankHtml = i < 3
      ? '<div class="pub-rank ' + rankClasses[i] + '">' + medals[i] + '</div>'
      : '<div class="pub-rank">' + (i + 1) + '</div>';

    var imgHtml = item.imageUrl
      ? '<img class="pub-thumb" src="' + esc(item.imageUrl) + '" alt="' + esc(item.name) + '" onerror=\"imgFallback(this,\'pub-thumb-placeholder\')\">'
      : '<div class="pub-thumb-placeholder">&#x271D;</div>';

    var barClass = palmaresTab === 'scores' ? 'pub-bar-fill confirmed' : 'pub-bar-fill';
    var metaParts = [item.domain, item.nationality, item.age ? item.age + ' ans' : null].filter(Boolean);

    row.innerHTML =
      rankHtml +
      imgHtml +
      '<div class="pub-info">' +
        '<div class="pub-name">' + esc(item.name) + '</div>' +
        '<div class="pub-meta">' + esc(metaParts.join(' &middot; ')) + '</div>' +
      '</div>' +
      '<div style="text-align:right;flex-shrink:0;">' +
        '<div class="pub-count">' + val + '</div>' +
        '<div class="pub-count-label">' + label + '</div>' +
        '<div class="pub-bar-wrap" style="margin-top:4px;">' +
          '<div class="' + barClass + '" style="width:' + pct + '%"></div>' +
        '</div>' +
      '</div>';

    listEl.appendChild(row);
  });
}

function switchPalmaresTab(tab) {
  palmaresTab = tab;
  document.querySelectorAll('.palmares-tab').forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.ptab === tab);
  });
  renderPalmares(getFilteredData());
}

function setPalmaresFilter(type, value) {
  palmaresFilters[type] = value;
  if (type === 'domain') {
    document.querySelectorAll('.pfilter-btn').forEach(function(btn) {
      btn.classList.toggle('active', btn.dataset.domain === value);
    });
  }
  renderPalmares(getFilteredData());
}

async function loadSuggestions(domain) {
  const listEl = document.getElementById('suggestions-list');
  listEl.innerHTML = '<div class="prev-hint-text">Chargement...</div>';
  try {
    const domainFilter = domain && DOMAIN_QIDS[domain]
      ? 'VALUES ?occ { ' + DOMAIN_QIDS[domain].map(function(q) { return 'wd:' + q; }).join(' ') + ' } ?person wdt:P106 ?occ .' : '';
    const sparql =
      'SELECT DISTINCT ?person ?personLabel ?birthDate ?age ?image ?nationalityLabel ?occupationLabel (COUNT(?sl) AS ?pop) WHERE {' +
      '?person wdt:P31 wd:Q5 . ' + domainFilter +
      'FILTER NOT EXISTS { ?person wdt:P570 [] }' +
      '?person wdt:P569 ?birthDate .' +
      'BIND(YEAR(NOW()) - YEAR(?birthDate) AS ?age)' +
      'FILTER(?age >= 70)' +
      'OPTIONAL { ?person wdt:P27 ?nationality . }' +
      'OPTIONAL { ?person wdt:P106 ?occupation . }' +
      'OPTIONAL { ?person wdt:P18 ?image . }' +
      '?sl schema:about ?person .' +
      'SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en" . }' +
      '} GROUP BY ?person ?personLabel ?birthDate ?age ?image ?nationalityLabel ?occupationLabel' +
      ' ORDER BY DESC(?pop) LIMIT 24';
    renderSuggestions(await runSparql(sparql));
  } catch(e) { listEl.innerHTML = '<div class="prev-hint-text">Suggestions non disponibles.</div>'; }
}

async function runSparql(sparql) {
  const url = new URL(WIKIDATA_SPARQL);
  url.searchParams.set('query', sparql); url.searchParams.set('format', 'json');
  const res = await fetch(url, { headers: { 'Accept': 'application/sparql-results+json' } });
  if (!res.ok) throw new Error('SPARQL ' + res.status);
  const json = await res.json();
  const seen = new Set();
  return (json.results && json.results.bindings || []).filter(function(r) {
    const id = r.person && r.person.value && r.person.value.split('/').pop();
    if (!id || seen.has(id)) return false;
    seen.add(id); return true;
  }).map(function(r) { return {
    wikidataId  : r.person.value.split('/').pop(),
    name        : (r.personLabel && r.personLabel.value) || '-',
    birthDate   : r.birthDate && r.birthDate.value && r.birthDate.value.slice(0, 10),
    age         : r.age && r.age.value ? parseInt(r.age.value) : null,
    nationality : (r.nationalityLabel && r.nationalityLabel.value) || null,
    domain      : (r.occupationLabel && r.occupationLabel.value) || null,
    imageUrl    : (r.image && r.image.value) || null,
    wikipediaUrl: 'https://fr.wikipedia.org/wiki/' + encodeURIComponent((r.personLabel && r.personLabel.value) || ''),
  }; });
}

function renderSearchResults(results) {
  const listEl = document.getElementById('search-results');
  listEl.innerHTML = '';
  results.forEach(function(p, i) {
    const item = document.createElement('div');
    item.className = 'search-result-item';
    item.style.animationDelay = (i * 0.04) + 's';
    const imgHtml = p.imageUrl
      ? '<img class="result-img" src="' + esc(p.imageUrl) + '" alt="' + esc(p.name) + '" onerror=\"imgFallback(this,\'result-img-placeholder\')\">'
      : '<div class="result-img-placeholder">&#x271D;</div>';
    item.innerHTML = imgHtml +
      '<div class="result-info"><div class="result-name">' + esc(p.name) + '</div>' +
      '<div class="result-meta">' + [p.domain, p.nationality, p.age ? p.age + ' ans' : null].filter(Boolean).join(' &middot; ') + '</div></div>' +
      '<button class="result-add-btn">Choisir</button>';
    item.addEventListener('click', function() { selectCelebrity(p); });
    listEl.appendChild(item);
  });
}

function renderSuggestions(results) {
  const listEl = document.getElementById('suggestions-list');
  listEl.innerHTML = '';
  if (!results.length) { listEl.innerHTML = '<div class="prev-hint-text">Aucune suggestion.</div>'; return; }
  results.forEach(function(p) {
    const item = document.createElement('div');
    item.className = 'suggestion-item';
    const imgHtml = p.imageUrl ? '<img class="suggestion-img" src="' + esc(p.imageUrl) + '" alt="' + esc(p.name) + '" onerror="this.style.display=\'none\'">' : '';
    item.innerHTML = imgHtml + '<div class="suggestion-name">' + esc(p.name) + '</div>' + (p.age ? '<div class="suggestion-age">' + p.age + ' ans</div>' : '');
    item.addEventListener('click', function() { selectCelebrity(p); });
    listEl.appendChild(item);
  });
}

function showSearchEmpty() {
  document.getElementById('search-results').innerHTML = '';
  document.getElementById('search-empty').classList.remove('hidden');
}

function selectCelebrity(celeb) {
  selectedCeleb = celeb;
  const imgEl = document.getElementById('selected-img');
  imgEl.src = celeb.imageUrl || ''; imgEl.style.display = celeb.imageUrl ? '' : 'none';
  document.getElementById('selected-name').textContent = celeb.name;
  document.getElementById('selected-meta').textContent = [celeb.domain, celeb.nationality, celeb.age ? celeb.age + ' ans' : null].filter(Boolean).join(' · ');
  document.getElementById('selected-wiki').href = celeb.wikipediaUrl || '#';
  document.getElementById('selected-celebrity').classList.remove('hidden');
  document.getElementById('visibility-block').style.display = '';
  document.getElementById('search-suggestions').style.display = 'none';
  document.getElementById('search-results').innerHTML = '';
  document.getElementById('search-input').value = '';
  document.getElementById('selected-celebrity').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function clearSelection() {
  selectedCeleb = null;
  document.getElementById('selected-celebrity').classList.add('hidden');
  document.getElementById('visibility-block').style.display = 'none';
  document.getElementById('search-input').value = '';
  document.getElementById('search-results').innerHTML = '';
  document.getElementById('search-empty').classList.add('hidden');
  document.getElementById('search-suggestions').style.display = '';
}

function setVisibility(vis) {
  selectedVis = vis;
  document.querySelectorAll('.vis-opt').forEach(function(b) { b.classList.toggle('active', b.dataset.vis === vis); });
}

function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
