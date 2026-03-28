/* ============================================================
   MORT & CÉLÈBRE — Application JavaScript
   Sources: Wikipedia REST API + Wikidata SPARQL
   ============================================================ */

'use strict';

/* ── CONFIG ─────────────────────────────────────────────── */
const WIKI_REST = 'https://fr.wikipedia.org/api/rest_v1';
const WIKI_EN   = 'https://en.wikipedia.org/api/rest_v1';
const WIKIDATA  = 'https://www.wikidata.org/w/api.php';
const WIKI_FR_API = 'https://fr.wikipedia.org/w/api.php';
const WIKI_EN_API = 'https://en.wikipedia.org/w/api.php';
const START_2026  = new Date('2026-01-01');
const QUOTES = [
  { text: "La mort est le seul démocrate parfait. Elle traite chacun avec une égalité absolue.", author: "George Bernard Shaw" },
  { text: "Mourir est peu de chose. Il faut voir disparaître avec soi tout un monde.", author: "Victor Hugo" },
  { text: "On ne meurt qu'une fois, et c'est pour si longtemps.", author: "Molière" },
  { text: "La mort n'est rien, mais vivre vaincu et sans gloire, c'est mourir tous les jours.", author: "Napoléon Bonaparte" },
  { text: "La célébrité est le châtiment du mérite et la punition du talent.", author: "Simone de Beauvoir" },
];

/* ── STATE ──────────────────────────────────────────────── */
let currentDate  = new Date();
let allTodayDeaths  = [];
let allHistoryDeaths = [];
let currentCentury  = 'all';
let ranking2026     = [];

/* ── DOM REFS ───────────────────────────────────────────── */
const $datePicker   = document.getElementById('date-picker');
const $dateText     = document.getElementById('date-text');
const $todayTitle   = document.getElementById('today-title');
const $loadingToday = document.getElementById('loading-today');
const $cardsToday   = document.getElementById('cards-today');
const $emptyToday   = document.getElementById('empty-today');
const $loadingHist  = document.getElementById('loading-history');
const $timelineHist = document.getElementById('timeline-history');
const $emptyHist    = document.getElementById('empty-history');
const $counter      = document.getElementById('counter-2026');
const $counterBar   = document.getElementById('counter-bar');
const $counterNote  = document.getElementById('counter-note');
const $rankingList  = document.getElementById('ranking-list');
const $footerYear   = document.getElementById('footer-year');

/* ── INIT ───────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  $footerYear.textContent = new Date().getFullYear();
  randomizeQuote();
  setDateTo(new Date());
  setupListeners();
  load2026Ranking();
});

function randomizeQuote() {
  const q = QUOTES[Math.floor(Math.random() * QUOTES.length)];
  const el = document.querySelector('.memento-quote p');
  const cite = document.querySelector('.memento-quote cite');
  if (el) el.textContent = `"${q.text}"`;
  if (cite) cite.textContent = `— ${q.author}`;
}

/* ── DATE UTILITIES ─────────────────────────────────────── */
function pad(n) { return String(n).padStart(2, '0'); }

function formatDateISO(d) {
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

function formatDateFR(d) {
  const days = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
  const months = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  const isToday = formatDateISO(d) === formatDateISO(new Date());
  const prefix = isToday ? 'Aujourd\'hui — ' : '';
  return `${prefix}${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function setDateTo(d) {
  currentDate = d;
  const iso = formatDateISO(d);
  $datePicker.value = iso;
  $dateText.textContent = formatDateFR(d);
  const isToday = iso === formatDateISO(new Date());
  $todayTitle.textContent = isToday ? 'Décès aujourd\'hui' : `Décès le ${d.getDate()} ${['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'][d.getMonth()]}`;
  loadDeaths(d);
}

/* ── EVENT LISTENERS ────────────────────────────────────── */
function setupListeners() {
  $datePicker.addEventListener('change', (e) => {
    const [y, m, day] = e.target.value.split('-').map(Number);
    setDateTo(new Date(y, m-1, day));
  });

  document.getElementById('btn-prev').addEventListener('click', () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - 1);
    setDateTo(d);
  });

  document.getElementById('btn-next').addEventListener('click', () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + 1);
    setDateTo(d);
  });

  document.getElementById('btn-today').addEventListener('click', () => {
    setDateTo(new Date());
  });

  document.getElementById('year-filter').addEventListener('click', (e) => {
    const btn = e.target.closest('.year-btn');
    if (!btn) return;
    document.querySelectorAll('.year-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentCentury = btn.dataset.century;
    renderHistory(allHistoryDeaths, currentCentury);
  });
}

/* ── MAIN LOAD ──────────────────────────────────────────── */
async function loadDeaths(date) {
  // Reset UI
  $cardsToday.innerHTML = '';
  $timelineHist.innerHTML = '';
  $emptyToday.classList.add('hidden');
  $emptyHist.classList.add('hidden');
  $loadingToday.classList.remove('hidden');
  $loadingHist.classList.add('hidden');
  allTodayDeaths = [];
  allHistoryDeaths = [];

  const month = date.getMonth() + 1;
  const day   = date.getDate();
  const year  = date.getFullYear();

  try {
    const data = await fetchWikiDeaths(month, day);
    // Separate today vs history
    const todayYear = year;
    allTodayDeaths   = data.filter(p => p.year === todayYear);
    allHistoryDeaths = data.filter(p => p.year !== todayYear);

    $loadingToday.classList.add('hidden');

    if (allTodayDeaths.length === 0) {
      $emptyToday.classList.remove('hidden');
    } else {
      renderCards(allTodayDeaths);
    }

    $loadingHist.classList.remove('hidden');
    setTimeout(() => {
      $loadingHist.classList.add('hidden');
      if (allHistoryDeaths.length === 0) {
        $emptyHist.classList.remove('hidden');
      } else {
        renderHistory(allHistoryDeaths, currentCentury);
      }
    }, 300);

  } catch (err) {
    console.error('Erreur chargement:', err);
    $loadingToday.classList.add('hidden');
    $emptyToday.textContent = 'Erreur de chargement. Veuillez réessayer.';
    $emptyToday.classList.remove('hidden');
  }
}

/* ── WIKIPEDIA API ──────────────────────────────────────── */
async function fetchWikiDeaths(month, day) {
  // Wikipedia "On This Day" deaths endpoint
  const url = `https://en.wikipedia.org/api/rest_v1/feed/onthisday/deaths/${pad(month)}/${pad(day)}`;
  
  try {
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const deaths = json.deaths || [];
    
    return deaths.map(entry => {
      const page = entry.pages?.[0] || {};
      const thumb = page.thumbnail?.source || null;
      const desc  = page.description || page.extract || '';
      const name  = page.titles?.normalized || page.title || '?';
      const wikiUrl = page.content_urls?.desktop?.page?.replace('en.wikipedia.org', 'fr.wikipedia.org') || `https://fr.wikipedia.org/wiki/${encodeURIComponent(page.title || name)}`;
      
      return {
        year:    entry.year,
        name,
        desc:    desc || 'Personnalité notable',
        thumb,
        wikiUrl,
        age:     computeAge(entry),
        born:    entry.year - (page.birth_year || 0) > 0 ? null : null,
        category: guessCategory(desc),
        pageId:  page.pageid,
      };
    }).filter(p => p.name && p.name !== '?');
    
  } catch (err) {
    console.warn('Wikipedia EN API failed, trying FR...', err);
    return fetchWikiDeathsFR(month, day);
  }
}

async function fetchWikiDeathsFR(month, day) {
  // Fallback: French Wikipedia API
  const url = `https://fr.wikipedia.org/api/rest_v1/feed/onthisday/deaths/${pad(month)}/${pad(day)}`;
  try {
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) throw new Error('FR API failed');
    const json = await res.json();
    const deaths = json.deaths || [];
    return deaths.map(entry => {
      const page = entry.pages?.[0] || {};
      return {
        year:     entry.year,
        name:     page.titles?.normalized || page.title || '?',
        desc:     page.description || page.extract || 'Personnalité notable',
        thumb:    page.thumbnail?.source || null,
        wikiUrl: page.content_urls?.desktop?.page?.replace('en.wikipedia.org', 'fr.wikipedia.org') || `https://fr.wikipedia.org/wiki/${encodeURIComponent(page.title || '')}`,
        age:      null,
        category: guessCategory(page.description || ''),
        pageId:   page.pageid,
      };
    }).filter(p => p.name && p.name !== '?');
  } catch (e) {
    return [];
  }
}

function computeAge(entry) {
  if (!entry.year) return null;
  const pages = entry.pages || [];
  for (const p of pages) {
    if (p.birth_year) return entry.year - p.birth_year;
  }
  return null;
}

function guessCategory(desc) {
  const d = (desc || '').toLowerCase();
  if (/acteur|actrice|actor|actress|film|cinema|réalisateur/i.test(d)) return 'Cinéma';
  if (/chanteur|chanteuse|musicien|musician|singer|compositeur/i.test(d)) return 'Musique';
  if (/politi|président|ministre|senator|mayor/i.test(d)) return 'Politique';
  if (/écrivain|écrivaine|auteur|auteure|novelist|writer|poet|poète/i.test(d)) return 'Littérature';
  if (/sportif|sportive|footballer|tennis|athlète|athlete|boxer/i.test(d)) return 'Sport';
  if (/peintre|painter|sculptor|sculpteur|artist|artiste/i.test(d)) return 'Art';
  if (/scientifique|scientist|physicist|biologiste|médecin|doctor/i.test(d)) return 'Science';
  if (/philosophe|philosopher/i.test(d)) return 'Philosophie';
  return 'Personnalité';
}

/* ── RENDER CARDS (today) ───────────────────────────────── */
function renderCards(people) {
  $cardsToday.innerHTML = '';
  people.forEach((p, i) => {
    const card = document.createElement('div');
    card.className = 'death-card';
    card.style.animationDelay = `${i * 0.06}s`;

    const imgHtml = p.thumb
      ? `<img class="card-img" src="${escHtml(p.thumb)}" alt="${escHtml(p.name)}" loading="lazy" onerror="this.parentNode.innerHTML='<div class=\\'card-img-placeholder\\'>✝</div>'">`
      : `<div class="card-img-placeholder">✝</div>`;

    card.innerHTML = `
      <div class="card-img-wrap">${imgHtml}</div>
      <div class="card-body">
        <div class="card-name">${escHtml(p.name)}</div>
        <div class="card-dates">✝ ${p.year}${p.age ? ` · ${p.age} ans` : ''}</div>
        <div class="card-desc">${escHtml(p.desc)}</div>
        <span class="card-tag">${escHtml(p.category)}</span>
      </div>`;

    card.addEventListener('click', () => openModal(p));
    $cardsToday.appendChild(card);
  });
}

/* ── RENDER TIMELINE (history) ──────────────────────────── */
function renderHistory(people, century) {
  $timelineHist.innerHTML = '';
  const filtered = people.filter(p => {
    if (century === 'all') return true;
    if (century === '21')  return p.year >= 2000;
    if (century === '20')  return p.year >= 1900 && p.year < 2000;
    if (century === '19')  return p.year >= 1800 && p.year < 1900;
    if (century === 'old') return p.year < 1800;
    return true;
  });

  if (filtered.length === 0) {
    $emptyHist.classList.remove('hidden');
    return;
  }
  $emptyHist.classList.add('hidden');

  // Sort descending
  const sorted = [...filtered].sort((a, b) => b.year - a.year);
  sorted.forEach((p, i) => {
    const el = document.createElement('div');
    el.className = 'timeline-entry';
    el.style.animationDelay = `${i * 0.04}s`;
    el.innerHTML = `
      <div class="timeline-year">${p.year}</div>
      <div class="timeline-name">${escHtml(p.name)}</div>
      <div class="timeline-info">${escHtml(p.desc)}</div>
      ${p.age ? `<div class="timeline-age">† ${p.age} ans</div>` : ''}`;
    el.addEventListener('click', () => openModal(p));
    $timelineHist.appendChild(el);
  });
}

/* ── MODAL ──────────────────────────────────────────────── */
function openModal(p) {
  const existing = document.querySelector('.modal-backdrop');
  if (existing) existing.remove();

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';

  const imgHtml = p.thumb
    ? `<div class="modal-img-wrap"><img class="modal-img" src="${escHtml(p.thumb)}" alt="${escHtml(p.name)}" onerror="this.parentNode.style.display='none'"></div>`
    : '';

  backdrop.innerHTML = `
    <div class="modal">
      <button class="modal-close" title="Fermer">✕</button>
      ${imgHtml}
      <div class="modal-body">
        <div class="modal-name">${escHtml(p.name)}</div>
        <div class="modal-dates">${p.year ? `✝ ${p.year}` : ''}${p.age ? ` · ${p.age} ans` : ''} · ${escHtml(p.category)}</div>
        <div class="modal-desc">${escHtml(p.desc)}</div>
        ${p.wikiUrl && p.wikiUrl !== '#' ? `<a class="modal-link" href="${escHtml(p.wikiUrl)}" target="_blank" rel="noopener">Lire sur Wikipedia →</a>` : ''}
      </div>
    </div>`;

  backdrop.querySelector('.modal-close').addEventListener('click', () => backdrop.remove());
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) backdrop.remove(); });
  document.body.appendChild(backdrop);
  document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') { backdrop.remove(); document.removeEventListener('keydown', esc); }
  });
}

/* ── 2026 RANKING ───────────────────────────────────────── */
async function load2026Ranking() {
  // Hard-coded list of notable 2026 deaths (real or anticipated structure)
  // We'll fetch from Wikipedia's API for recent deaths in 2026
  try {
    const deaths2026 = await fetch2026Deaths();
    updateCounter(deaths2026.length);
    renderRanking(deaths2026.slice(0, 12));
    ranking2026 = deaths2026;
  } catch (e) {
    console.warn('2026 ranking load failed:', e);
    $counter.textContent = '–';
    $rankingList.innerHTML = '<li class="ranking-loading">Données non disponibles</li>';
  }
}

async function fetch2026Deaths() {
  // Query Wikipedia category for 2026 deaths
  const url = `https://en.wikipedia.org/w/api.php?action=query&list=categorymembers&cmtitle=Category:2026_deaths&cmlimit=100&cmtype=page&format=json&origin=*`;
  try {
    const res = await fetch(url);
    const json = await res.json();
    const members = json.query?.categorymembers || [];
    
    if (members.length === 0) return [];
    
    // Get page details for first 30 (to get descriptions and thumbnails)
    const pageIds = members.slice(0, 30).map(m => m.pageid).join('|');
    const detailUrl = `https://en.wikipedia.org/w/api.php?action=query&pageids=${pageIds}&prop=pageimages|description|pageprops&pithumbsize=80&format=json&origin=*`;
    const detailRes = await fetch(detailUrl);
    const detailJson = await detailRes.json();
    const pages = detailJson.query?.pages || {};

    return Object.values(pages).map(p => ({
      name:    p.title || '?',
      desc:    p.description || guessCategory(p.description || ''),
      thumb:   p.thumbnail?.source || null,
      wikiUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(p.title || '')}`,
      category: guessCategory(p.description || ''),
      year:    2026,
      pageid:  p.pageid,
    })).filter(p => p.name !== '?');
  } catch (err) {
    console.warn('Category fetch failed:', err);
    return [];
  }
}

function updateCounter(count) {
  const days = Math.floor((new Date() - START_2026) / 86400000);
  $counter.textContent = count || '–';
  $counterNote.textContent = count > 0
    ? `Soit ~${(count / Math.max(days, 1)).toFixed(1)} décès de personnalité par jour`
    : 'Données en cours de chargement';
  
  // Animate bar (100% = 500 deaths as reference)
  const pct = Math.min((count / 500) * 100, 100);
  setTimeout(() => { $counterBar.style.width = `${pct}%`; }, 300);
}

function renderRanking(people) {
  if (people.length === 0) {
    $rankingList.innerHTML = '<li class="ranking-loading">Aucune donnée disponible</li>';
    return;
  }
  $rankingList.innerHTML = '';
  people.forEach((p, i) => {
    const li = document.createElement('li');
    li.className = 'ranking-item';
    li.style.animationDelay = `${i * 0.05}s`;

    const avatarHtml = p.thumb
      ? `<img src="${escHtml(p.thumb)}" alt="${escHtml(p.name)}" loading="lazy" onerror="this.outerHTML='<div class=\\'rank-avatar-placeholder\\'>✝</div>'">`
      : `<div class="rank-avatar-placeholder">✝</div>`;

    li.innerHTML = `
      <div class="rank-avatar">${avatarHtml}</div>
      <div class="rank-info">
        <div class="rank-name">${escHtml(p.name)}</div>
        <div class="rank-detail">${escHtml(p.desc || p.category)}</div>
      </div>`;
    li.addEventListener('click', () => openModal(p));
    $rankingList.appendChild(li);
  });
}

/* ── UTILS ──────────────────────────────────────────────── */
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
