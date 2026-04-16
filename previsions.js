/* ============================================================
   MORT & CÉLÈBRE — Prévisions 2026
   Backend : Supabase (Auth + PostgreSQL)
   ============================================================ */

'use strict';

/* ── CONFIG SUPABASE ────────────────────────────────────────── */
const SUPABASE_URL  = 'https://mudmucjhiclyukhebeqm.supabase.co';
const SUPABASE_ANON = 'sb_publishable_AMBoNSWZ3iiagHK1G-OX4g_T-qYvTIB';

/* ── CONFIG WIKIDATA ─────────────────────────────────────────── */
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

/* ── ÉTAT ────────────────────────────────────────────────────── */
let sb             = null;
let currentUser    = null;
let currentProfile = null;
let currentTeam    = null;
let selectedCeleb  = null;
let selectedVis    = 'public';
let searchTimer    = null;
let selectedDomain = '';

/* ── INIT ────────────────────────────────────────────────────── */
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
    await loadProfileAndEnter();
  } else {
    showScreen('screen-auth');
  }

  const params = new URLSearchParams(window.location.search);
  const invite = params.get('invite');
  if (invite && currentUser) {
    document.getElementById('join-code').value = invite;
    switchMainTab('rejoindre');
  }

  sb.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session && !currentUser) {
      currentUser = session.user;
      await loadProfileAndEnter();
    }
    if (event === 'SIGNED_OUT') {
      currentUser = null; currentProfile = null; currentTeam = null;
      showScreen('screen-auth');
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

/* ── NAVIGATION ─────────────────────────────────────────────── */
function showScreen(id) {
  document.querySelectorAll('.prev-screen').forEach(s => s.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setupAuthTabs() {
  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('tab-login').classList.add('hidden');
      document.getElementById('tab-register').classList.add('hidden');
      document.getElementById(`tab-${tab.dataset.tab}`).classList.remove('hidden');
    });
  });
}

function setupMainTabs() {
  document.querySelectorAll('.main-tab').forEach(tab => {
    tab.addEventListener('click', () => switchMainTab(tab.dataset.tab));
  });
}

function switchMainTab(name) {
  document.querySelectorAll('.main-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.main-tab-content').forEach(c => c.classList.add('hidden'));
  const t = document.querySelector(`.main-tab[data-tab="${name}"]`);
  if (t) t.classList.add('active');
  const c = document.getElementById(`tab-${name}`);
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
      if (q.length >= 2) performSearch(q);
      else loadSuggestions(selectedDomain);
    });
  });
}

/* ═══════════════════════════════════════════════════════════════
   AUTHENTIFICATION
   ═══════════════════════════════════════════════════════════════ */

async function doRegister() {
  const pseudo     = document.getElementById('reg-pseudo').value.trim();
  const email      = document.getElementById('reg-email').value.trim();
  const pass       = document.getElementById('reg-password').value;
  const pass2      = document.getElementById('reg-password2').value;
  const newsletter = document.getElementById('reg-newsletter').checked;
  const errEl      = document.getElementById('reg-error');
  errEl.classList.add('hidden');

  const err = (msg) => { errEl.textContent = msg; errEl.classList.remove('hidden'); };

  if (!pseudo || pseudo.length < 2)             return err('Le pseudonyme doit faire au moins 2 caractères.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return err('Adresse email invalide.');
  if (pass.length < 8)                           return err('Le mot de passe doit faire au moins 8 caractères.');
  if (pass !== pass2)                            return err('Les mots de passe ne correspondent pas.');

  // Vérifier unicité du pseudo
  const { data: existing } = await sb.from('profiles').select('pseudo').eq('pseudo', pseudo).maybeSingle();
  if (existing) return err('Ce pseudonyme est déjà utilisé.');

  const { error } = await sb.auth.signUp({
    email,
    password: pass,
    options: {
      data: { pseudo, newsletter },
      emailRedirectTo: window.location.href,
    }
  });

  if (error) return err(error.message);
  showConfirmEmail(email);
}

function showConfirmEmail(email) {
  document.getElementById('tab-register').innerHTML = `
    <div style="text-align:center;padding:2rem 0">
      <div style="font-size:2.5rem;margin-bottom:0.75rem;color:var(--gold)">✉</div>
      <div style="font-family:var(--font-display);font-size:1.2rem;font-weight:700;color:var(--cream);margin-bottom:0.75rem">Vérifiez votre boîte mail</div>
      <p style="color:var(--gray);font-style:italic;font-size:0.95rem;line-height:1.7">
        Un lien de confirmation a été envoyé à<br><strong>${esc(email)}</strong>.<br>
        Cliquez dessus pour activer votre compte.
      </p>
    </div>`;
}

async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  errEl.classList.add('hidden');

  const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
  if (error) {
    errEl.textContent = error.message.includes('Invalid') ? 'Email ou mot de passe incorrect.' : error.message;
    errEl.classList.remove('hidden');
    return;
  }
  currentUser = data.user;
  await loadProfileAndEnter();
}

async function doLogout() {
  await sb.auth.signOut();
}

async function loadProfileAndEnter() {
  await reloadProfile();
  showScreen('screen-main');
  await renderMyPredictions();
  loadSuggestions('');
}

/* ═══════════════════════════════════════════════════════════════
   PRÉDICTIONS
   ═══════════════════════════════════════════════════════════════ */

async function renderMyPredictions() {
  const { data: preds } = await sb
    .from('predictions')
    .select('*')
    .eq('user_id', currentUser.id)
    .eq('year', 2026)
    .order('created_at', { ascending: true });

  const listEl  = document.getElementById('my-predictions-list');
  const emptyEl = document.getElementById('my-predictions-empty');
  const fillEl  = document.getElementById('score-fill');
  const countEl = document.getElementById('score-count');
  const list    = preds ?? [];
  const limit   = currentTeam?.pred_limit ?? MAX_PREDICTIONS;

  countEl.textContent = list.length;
  fillEl.style.width  = `${Math.min((list.length / limit) * 100, 100)}%`;

  if (list.length === 0) {
    listEl.innerHTML = '';
    emptyEl.classList.remove('hidden');
    return;
  }
  emptyEl.classList.add('hidden');
  listEl.innerHTML = '';

  const isLocked = currentTeam?.locked && currentTeam?.admin_id !== currentUser.id;

  list.forEach((p, i) => {
    const item = document.createElement('div');
    item.className = 'prediction-item';
    item.style.animationDelay = `${i * 0.05}s`;

    const imgHtml = p.celeb_image
      ? `<img class="pred-thumb" src="${esc(p.celeb_image)}" alt="${esc(p.celeb_name)}" onerror="this.outerHTML='<div class=\\'pred-thumb-placeholder\\'>✝</div>'">`
      : `<div class="pred-thumb-placeholder">✝</div>`;

    const statusClass = p.status === 'correct' ? 'pred-status-correct'
                      : p.status === 'wrong'   ? 'pred-status-wrong' : 'pred-status-pending';
    const statusText  = p.status === 'correct' ? '✓ Juste' : p.status === 'wrong' ? '✗ Faux' : '—';
    const visLabel    = p.visibility === 'group' ? '👥 groupe' : p.visibility === 'private' ? '🔒 privée' : '🌍 public';

    item.innerHTML = `
      <div class="pred-rank">${i + 1}</div>
      ${imgHtml}
      <div class="pred-info">
        <div class="pred-name">${esc(p.celeb_name)}</div>
        <div class="pred-meta">${[p.celeb_domain, p.celeb_nationality, p.celeb_age ? p.celeb_age + ' ans' : null].filter(Boolean).join(' · ')}</div>
      </div>
      <div class="pred-visibility">${visLabel}</div>
      <div class="pred-status ${statusClass}">${statusText}</div>
      ${!isLocked && p.status === 'pending' ? `<button class="pred-delete" title="Supprimer" onclick="deletePrediction('${p.id}')">✕</button>` : ''}
    `;
    listEl.appendChild(item);
  });
}

async function deletePrediction(id) {
  if (!confirm('Supprimer cette prévision ?')) return;
  await sb.from('predictions').delete().eq('id', id).eq('user_id', currentUser.id);
  await renderMyPredictions();
}

async function confirmPrediction() {
  if (!selectedCeleb) return;

  const { count } = await sb
    .from('predictions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', currentUser.id)
    .eq('year', 2026);

  const limit = currentTeam?.pred_limit ?? MAX_PREDICTIONS;
  if (count >= limit) { alert(`Limite de ${limit} prévisions atteinte.`); return; }

  // Cache célébrité
  await sb.from('celebrities').upsert({
    wikidata_id: selectedCeleb.wikidataId,
    name: selectedCeleb.name, domain: selectedCeleb.domain,
    nationality: selectedCeleb.nationality, birth_date: selectedCeleb.birthDate,
    age: selectedCeleb.age, image_url: selectedCeleb.imageUrl,
    wiki_url: selectedCeleb.wikipediaUrl, is_alive: true,
    last_checked: new Date().toISOString(),
  }, { onConflict: 'wikidata_id' });

  const { error } = await sb.from('predictions').insert({
    user_id: currentUser.id, team_id: currentTeam?.id ?? null, year: 2026,
    wikidata_id: selectedCeleb.wikidataId, celeb_name: selectedCeleb.name,
    celeb_domain: selectedCeleb.domain, celeb_nationality: selectedCeleb.nationality,
    celeb_age: selectedCeleb.age, celeb_image: selectedCeleb.imageUrl,
    celeb_wiki: selectedCeleb.wikipediaUrl, visibility: selectedVis, status: 'pending',
  });

  if (error) {
    alert(error.code === '23505' ? `${selectedCeleb.name} est déjà dans vos prévisions.` : error.message);
    return;
  }

  document.getElementById('modal-celeb-name').textContent = selectedCeleb.name;
  document.getElementById('modal-confirm').classList.remove('hidden');
}

async function closeModal() {
  document.getElementById('modal-confirm').classList.add('hidden');
  clearSelection();
  showScreen('screen-main');
  await renderMyPredictions();
}

/* ═══════════════════════════════════════════════════════════════
   ÉQUIPES
   ═══════════════════════════════════════════════════════════════ */

async function createTeam() {
  const name  = document.getElementById('new-team-name').value.trim();
  const errEl = document.getElementById('create-team-error');
  errEl.classList.add('hidden');
  if (!name || name.length < 2) { errEl.textContent = 'Nom trop court.'; errEl.classList.remove('hidden'); return; }
  if (currentTeam) { errEl.textContent = 'Vous appartenez déjà à une équipe.'; errEl.classList.remove('hidden'); return; }

  const { data: team, error } = await sb.from('teams').insert({ name, admin_id: currentUser.id }).select().single();
  if (error) { errEl.textContent = error.message; errEl.classList.remove('hidden'); return; }

  // Rattacher le profil à l'équipe en base
  await sb.from('profiles').update({ team_id: team.id }).eq('id', currentUser.id);

  // Recharger le profil complet depuis Supabase
  await reloadProfile();

  document.getElementById('new-team-name').value = '';
  switchMainTab('mon-equipe');
}

async function joinTeam() {
  const raw   = document.getElementById('join-code').value.trim().toUpperCase();
  const errEl = document.getElementById('join-team-error');
  errEl.classList.add('hidden');
  if (currentTeam) { errEl.textContent = 'Vous appartenez déjà à une équipe.'; errEl.classList.remove('hidden'); return; }

  const m    = raw.match(/([A-Z0-9]{6})/);
  const code = m ? m[1] : raw;

  const { data: team } = await sb.from('teams').select('*').eq('invite_code', code).maybeSingle();
  if (!team) { errEl.textContent = 'Code invalide.'; errEl.classList.remove('hidden'); return; }

  await sb.from('profiles').update({ team_id: team.id }).eq('id', currentUser.id);

  // Recharger le profil complet depuis Supabase
  await reloadProfile();

  document.getElementById('join-code').value = '';
  switchMainTab('mon-equipe');
}

// Recharge le profil + équipe depuis Supabase et met à jour l'affichage
async function reloadProfile() {
  const { data: profile } = await sb
    .from('profiles')
    .select('*, teams(*)')
    .eq('id', currentUser.id)
    .maybeSingle();

  currentProfile = profile;
  currentTeam    = profile?.teams ?? null;

  document.getElementById('user-avatar-main').textContent = (profile?.pseudo ?? '?')[0].toUpperCase();
  document.getElementById('user-pseudo-display').textContent = profile?.pseudo ?? currentUser.email;
  document.getElementById('user-mode-display').textContent   = currentTeam
    ? `Équipe : ${currentTeam.name}` : 'Prédicteur solo';
}

async function renderTeamTab() {
  if (currentProfile?.team_id) {
    const { data } = await sb.from('teams').select('*').eq('id', currentProfile.team_id).single();
    currentTeam = data;
  }

  const noTeamEl  = document.getElementById('equipe-no-team');
  const contentEl = document.getElementById('equipe-content');
  if (!currentTeam) { noTeamEl.classList.remove('hidden'); contentEl.classList.add('hidden'); return; }
  noTeamEl.classList.add('hidden'); contentEl.classList.remove('hidden');

  const { data: members } = await sb.from('profiles').select('id, pseudo').eq('team_id', currentTeam.id);
  const isAdmin = currentTeam.admin_id === currentUser.id;

  document.getElementById('equipe-name-display').textContent = currentTeam.name;
  document.getElementById('equipe-meta-display').textContent =
    `${(members ?? []).length} membre${(members ?? []).length > 1 ? 's' : ''} · Code : ${currentTeam.invite_code}`;
  document.getElementById('equipe-admin-badge').classList.toggle('hidden', !isAdmin);
  document.getElementById('equipe-admin-panel').classList.toggle('hidden', !isAdmin);

  if (isAdmin) {
    document.getElementById('toggle-lock').checked = currentTeam.locked;
    document.getElementById('limit-val-display').textContent = currentTeam.pred_limit;
    const inviteUrl = `${window.location.origin}${window.location.pathname}?invite=${currentTeam.invite_code}`;
    document.getElementById('invite-link-display').textContent = inviteUrl;
    document.getElementById('invite-qr').innerHTML =
      `<img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(inviteUrl)}" width="100" height="100" alt="QR" />`;
    renderMembersList(members ?? [], isAdmin);
  }

  await renderTeamPredictions();
  await renderTeamRanking(members ?? []);
}

function renderMembersList(members, isAdmin) {
  const listEl = document.getElementById('equipe-members-list');
  listEl.innerHTML = '';
  members.forEach(m => {
    const isMe = m.id === currentUser.id;
    const isAdm = m.id === currentTeam.admin_id;
    const row = document.createElement('div');
    row.className = 'member-row';
    row.innerHTML = `
      <div class="member-avatar">${m.pseudo[0].toUpperCase()}</div>
      <div class="member-name">${esc(m.pseudo)}
        ${isMe ? '<em style="color:var(--gold-dim2);font-size:0.72rem">(vous)</em>' : ''}
        ${isAdm ? '<em style="color:var(--gold-dim2);font-size:0.72rem">Admin</em>' : ''}
      </div>
      ${isAdmin && !isMe ? `<button class="pred-delete" onclick="removeMember('${m.id}','${esc(m.pseudo)}')">✕</button>` : ''}
    `;
    listEl.appendChild(row);
  });
}

async function removeMember(userId, pseudo) {
  if (!confirm(`Retirer ${pseudo} ?`)) return;
  await sb.from('profiles').update({ team_id: null }).eq('id', userId);
  await renderTeamTab();
}

async function toggleTeamLock(locked) {
  await sb.from('teams').update({ locked }).eq('id', currentTeam.id);
  currentTeam.locked = locked;
}

async function changeTeamLimit(delta) {
  const newLimit = Math.max(1, Math.min(50, (currentTeam.pred_limit ?? 20) + delta));
  await sb.from('teams').update({ pred_limit: newLimit }).eq('id', currentTeam.id);
  currentTeam.pred_limit = newLimit;
  document.getElementById('limit-val-display').textContent = newLimit;
}

async function copyInviteLink() {
  await navigator.clipboard.writeText(document.getElementById('invite-link-display').textContent);
  const btn = event.target; const orig = btn.textContent;
  btn.textContent = 'Copié ✓'; setTimeout(() => { btn.textContent = orig; }, 2000);
}

async function renderTeamPredictions() {
  const { data: preds } = await sb.from('predictions')
    .select('*, profiles(pseudo)').eq('team_id', currentTeam.id)
    .in('visibility', ['public', 'group']).eq('year', 2026)
    .order('created_at', { ascending: false });

  const listEl = document.getElementById('equipe-predictions-list');
  listEl.innerHTML = '';
  const list = preds ?? [];
  if (list.length === 0) {
    listEl.innerHTML = '<div class="prev-empty" style="padding:1.5rem"><p>Aucune prévision partagée.</p></div>'; return;
  }

  const counts = {};
  list.forEach(p => { counts[p.wikidata_id] = (counts[p.wikidata_id] || 0) + 1; });
  const seen = new Set();

  list.forEach((p, i) => {
    if (seen.has(p.wikidata_id)) return;
    seen.add(p.wikidata_id);
    const item = document.createElement('div');
    item.className = 'prediction-item';
    item.style.animationDelay = `${i * 0.04}s`;
    const imgHtml = p.celeb_image
      ? `<img class="pred-thumb" src="${esc(p.celeb_image)}" alt="${esc(p.celeb_name)}" onerror="this.outerHTML='<div class=\\'pred-thumb-placeholder\\'>✝</div>'">`
      : `<div class="pred-thumb-placeholder">✝</div>`;
    const statusClass = p.status === 'correct' ? 'pred-status-correct' : p.status === 'wrong' ? 'pred-status-wrong' : 'pred-status-pending';
    item.innerHTML = `
      ${imgHtml}
      <div class="pred-info">
        <div class="pred-name">${esc(p.celeb_name)}</div>
        <div class="pred-meta">${esc(p.celeb_domain || '')} · par ${esc(p.profiles?.pseudo ?? '—')}${counts[p.wikidata_id] > 1 ? ` · ${counts[p.wikidata_id]} membres` : ''}</div>
      </div>
      <div class="pred-status ${statusClass}">${p.status === 'correct' ? '✓' : p.status === 'wrong' ? '✗' : '—'}</div>
    `;
    listEl.appendChild(item);
  });
}

async function renderTeamRanking(members) {
  const { data: preds } = await sb.from('predictions')
    .select('user_id, status').eq('team_id', currentTeam.id).eq('year', 2026);

  const rankEl = document.getElementById('equipe-ranking');
  rankEl.innerHTML = '';
  const scores = {};
  members.forEach(m => { scores[m.id] = { pseudo: m.pseudo, correct: 0, total: 0 }; });
  (preds ?? []).forEach(p => {
    if (!scores[p.user_id]) return;
    scores[p.user_id].total++;
    if (p.status === 'correct') scores[p.user_id].correct++;
  });

  const sorted   = Object.values(scores).sort((a, b) => b.correct - a.correct || b.total - a.total);
  const maxScore = sorted[0]?.correct || 1;
  const medals   = ['🥇', '🥈', '🥉'];

  sorted.forEach((s, i) => {
    const row = document.createElement('div');
    row.className = 'ranking-row';
    const pct = Math.round((s.correct / maxScore) * 100);
    row.innerHTML = `
      <div class="ranking-rank">${medals[i] ?? (i + 1)}</div>
      <div class="member-avatar" style="width:28px;height:28px;font-size:0.75rem">${s.pseudo[0].toUpperCase()}</div>
      <div class="ranking-name">${esc(s.pseudo)}</div>
      <div class="ranking-bar-wrap"><div class="ranking-bar-fill" style="width:${pct}%"></div></div>
      <div class="ranking-score">${s.correct} / ${s.total}</div>
    `;
    rankEl.appendChild(row);
  });
}

/* ═══════════════════════════════════════════════════════════════
   WIKIDATA
   ═══════════════════════════════════════════════════════════════ */

function onSearchInput(value) {
  clearTimeout(searchTimer);
  const q = value.trim();
  document.getElementById('search-results').innerHTML = '';
  document.getElementById('search-empty').classList.add('hidden');
  if (q.length < 2) { document.getElementById('search-suggestions').style.display = ''; return; }
  document.getElementById('search-suggestions').style.display = 'none';
  document.getElementById('search-spinner').classList.remove('hidden');
  searchTimer = setTimeout(() => performSearch(q), 500);
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
    const qids = (data.search || []).map(r => r.id);
    if (qids.length === 0) { showSearchEmpty(); return; }

    // Vérifier le cache Supabase en premier
    const { data: cached } = await sb.from('celebrities').select('*').in('wikidata_id', qids).eq('is_alive', true);
    const cachedIds = new Set((cached ?? []).map(c => c.wikidata_id));
    const uncached  = qids.filter(q => !cachedIds.has(q));

    let fresh = [];
    if (uncached.length > 0) fresh = await fetchLivingFromWikidata(uncached);

    const cacheFormatted = (cached ?? []).map(c => ({
      wikidataId: c.wikidata_id, name: c.name, domain: c.domain,
      nationality: c.nationality, birthDate: c.birth_date, age: c.age,
      imageUrl: c.image_url, wikipediaUrl: c.wiki_url,
    }));

    const all     = [...cacheFormatted, ...fresh];
    const ordered = qids.map(id => all.find(r => r.wikidataId === id)).filter(Boolean);

    if (ordered.length === 0) showSearchEmpty();
    else renderSearchResults(ordered);

  } catch (err) {
    console.error(err); showSearchEmpty();
  } finally {
    document.getElementById('search-spinner').classList.add('hidden');
  }
}

async function fetchLivingFromWikidata(qids) {
  const values = qids.map(q => `wd:${q}`).join(' ');
  const sparql = `
    SELECT DISTINCT ?person ?personLabel ?birthDate ?age ?nationalityLabel ?occupationLabel ?image WHERE {
      VALUES ?person { ${values} }
      ?person wdt:P31 wd:Q5 .
      FILTER NOT EXISTS { ?person wdt:P570 [] }
      ?person wdt:P569 ?birthDate .
      BIND(YEAR(NOW()) - YEAR(?birthDate) AS ?age)
      OPTIONAL { ?person wdt:P27 ?nationality . }
      OPTIONAL { ?person wdt:P106 ?occupation . }
      OPTIONAL { ?person wdt:P18 ?image . }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en" . }
    } LIMIT 10`;
  return runSparql(sparql);
}

async function loadSuggestions(domain) {
  const listEl = document.getElementById('suggestions-list');
  listEl.innerHTML = '<div class="prev-hint-text">Chargement…</div>';
  try {
    const domainFilter = domain && DOMAIN_QIDS[domain]
      ? `VALUES ?occ { ${DOMAIN_QIDS[domain].map(q => `wd:${q}`).join(' ')} } ?person wdt:P106 ?occ .` : '';
    const sparql = `
      SELECT DISTINCT ?person ?personLabel ?birthDate ?age ?image ?nationalityLabel ?occupationLabel (COUNT(?sl) AS ?pop)
      WHERE {
        ?person wdt:P31 wd:Q5 . ${domainFilter}
        FILTER NOT EXISTS { ?person wdt:P570 [] }
        ?person wdt:P569 ?birthDate .
        BIND(YEAR(NOW()) - YEAR(?birthDate) AS ?age)
        FILTER(?age >= 70)
        OPTIONAL { ?person wdt:P27 ?nationality . }
        OPTIONAL { ?person wdt:P106 ?occupation . }
        OPTIONAL { ?person wdt:P18 ?image . }
        ?sl schema:about ?person .
        SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en" . }
      }
      GROUP BY ?person ?personLabel ?birthDate ?age ?image ?nationalityLabel ?occupationLabel
      ORDER BY DESC(?pop) LIMIT 24`;
    renderSuggestions(await runSparql(sparql));
  } catch { listEl.innerHTML = '<div class="prev-hint-text">Suggestions non disponibles.</div>'; }
}

async function runSparql(sparql) {
  const url = new URL(WIKIDATA_SPARQL);
  url.searchParams.set('query', sparql); url.searchParams.set('format', 'json');
  const res = await fetch(url, { headers: { 'Accept': 'application/sparql-results+json' } });
  if (!res.ok) throw new Error(`SPARQL ${res.status}`);
  const json = await res.json();
  const seen = new Set();
  return (json.results?.bindings || []).filter(r => {
    const id = r.person?.value?.split('/').pop();
    if (!id || seen.has(id)) return false;
    seen.add(id); return true;
  }).map(r => ({
    wikidataId  : r.person?.value?.split('/').pop(),
    name        : r.personLabel?.value ?? '—',
    birthDate   : r.birthDate?.value?.slice(0, 10),
    age         : r.age?.value ? parseInt(r.age.value) : null,
    nationality : r.nationalityLabel?.value ?? null,
    domain      : r.occupationLabel?.value ?? null,
    imageUrl    : r.image?.value ?? null,
    wikipediaUrl: `https://fr.wikipedia.org/wiki/${encodeURIComponent(r.personLabel?.value ?? '')}`,
  }));
}

/* ── RENDER ──────────────────────────────────────────────────── */
function renderSearchResults(results) {
  const listEl = document.getElementById('search-results');
  listEl.innerHTML = '';
  results.forEach((p, i) => {
    const item = document.createElement('div');
    item.className = 'search-result-item';
    item.style.animationDelay = `${i * 0.04}s`;
    const imgHtml = p.imageUrl
      ? `<img class="result-img" src="${esc(p.imageUrl)}" alt="${esc(p.name)}" onerror="this.outerHTML='<div class=\\'result-img-placeholder\\'>✝</div>'">`
      : `<div class="result-img-placeholder">✝</div>`;
    item.innerHTML = `${imgHtml}<div class="result-info"><div class="result-name">${esc(p.name)}</div><div class="result-meta">${[p.domain, p.nationality, p.age ? p.age + ' ans' : null].filter(Boolean).join(' · ')}</div></div><button class="result-add-btn">Choisir</button>`;
    item.addEventListener('click', () => selectCelebrity(p));
    listEl.appendChild(item);
  });
}

function renderSuggestions(results) {
  const listEl = document.getElementById('suggestions-list');
  listEl.innerHTML = '';
  if (!results.length) { listEl.innerHTML = '<div class="prev-hint-text">Aucune suggestion.</div>'; return; }
  results.forEach(p => {
    const item = document.createElement('div');
    item.className = 'suggestion-item';
    const imgHtml = p.imageUrl ? `<img class="suggestion-img" src="${esc(p.imageUrl)}" alt="${esc(p.name)}" onerror="this.style.display='none'">` : '';
    item.innerHTML = `${imgHtml}<div class="suggestion-name">${esc(p.name)}</div>${p.age ? `<div class="suggestion-age">${p.age} ans</div>` : ''}`;
    item.addEventListener('click', () => selectCelebrity(p));
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
  imgEl.src = celeb.imageUrl ?? ''; imgEl.style.display = celeb.imageUrl ? '' : 'none';
  document.getElementById('selected-name').textContent = celeb.name;
  document.getElementById('selected-meta').textContent = [celeb.domain, celeb.nationality, celeb.age ? celeb.age + ' ans' : null].filter(Boolean).join(' · ');
  document.getElementById('selected-wiki').href = celeb.wikipediaUrl ?? '#';
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
  document.querySelectorAll('.vis-opt').forEach(b => b.classList.toggle('active', b.dataset.vis === vis));
}

function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
