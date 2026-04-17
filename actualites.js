/* ============================================================
   MORT & CÉLÈBRE — Actualités scientifiques & presse
   Sources RSS françaises via proxy rss2json.com (CORS-free)
   ============================================================ */

'use strict';

/* ── SOURCES RSS ─────────────────────────────────────────── */
const SOURCES = [
  // ── SCIENCE ──────────────────────────────────────────────
  {
    name  : 'Inserm',
    type  : 'science',
    icon  : '🔬',
    url   : 'https://presse.inserm.fr/feed/',
    color : 'badge-science',
  },
  {
    name  : 'Sciences & Avenir',
    type  : 'science',
    icon  : '🔬',
    url   : 'https://www.sciencesetavenir.fr/sante/rss.xml',
    color : 'badge-science',
  },
  {
    name  : 'Futura Santé',
    type  : 'science',
    icon  : '🔬',
    url   : 'https://www.futura-sciences.com/rss/sante/actualites.xml',
    color : 'badge-science',
  },
  {
    name  : 'Le Monde Science',
    type  : 'science',
    icon  : '🔬',
    url   : 'https://www.lemonde.fr/sciences/rss_full.xml',
    color : 'badge-science',
  },
  // ── PRESSE ───────────────────────────────────────────────
  {
    name  : 'Le Monde Santé',
    type  : 'presse',
    icon  : '📰',
    url   : 'https://www.lemonde.fr/sante/rss_full.xml',
    color : 'badge-presse',
  },
  {
    name  : 'Le Figaro Santé',
    type  : 'presse',
    icon  : '📰',
    url   : 'https://sante.lefigaro.fr/rss/rss.xml',
    color : 'badge-presse',
  },
  {
    name  : 'Libération',
    type  : 'presse',
    icon  : '📰',
    url   : 'https://www.liberation.fr/arc/outboundfeeds/rss-all/?outputType=xml',
    color : 'badge-presse',
  },
  {
    name  : 'France Info Santé',
    type  : 'presse',
    icon  : '📰',
    url   : 'https://www.francetvinfo.fr/sante.rss',
    color : 'badge-presse',
  },
];

// Mots-clés pour filtrer les articles liés à la mort / longévité
const KEYWORDS = [
  'mort', 'décès', 'mourir', 'mortalité', 'longévité', 'vieillissement',
  'espérance de vie', 'euthanasie', 'suicide', 'cancer', 'tumeur',
  'maladie', 'immortalité', 'âge', 'centenaire', 'sénescence',
  'alzheimer', 'démence', 'hospice', 'palliatif', 'nécrologie',
  'deuil', 'funèbre', 'obsèques', 'cimetière', 'autopsie',
  'génétique', 'cellule', 'ADN', 'gène', 'biologie',
  'épidémie', 'pandémie', 'virus', 'bactérie', 'pathologie',
];

const RSS2JSON = 'https://api.rss2json.com/v1/api.json?rss_url=';
const PER_PAGE = 9;

/* ── ÉTAT ────────────────────────────────────────────────── */
let allArticles     = [];
let filteredArticles = [];
let currentTab      = 'all';
let visibleCount    = PER_PAGE;

/* ── INIT ────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('footer-year').textContent = new Date().getFullYear();
  await loadAllFeeds();
});

/* ── CHARGEMENT DES FLUX ─────────────────────────────────── */
async function loadAllFeeds() {
  const results = await Promise.allSettled(
    SOURCES.map(source => fetchFeed(source))
  );

  // Fusionner tous les articles
  results.forEach(result => {
    if (result.status === 'fulfilled' && result.value) {
      allArticles = allArticles.concat(result.value);
    }
  });

  // Trier par date (plus récent en premier)
  allArticles.sort((a, b) => new Date(b.date) - new Date(a.date));

  // Si aucun article avec filtre par mots-clés, afficher tout
  if (allArticles.length === 0) {
    showError();
    return;
  }

  applyTab(currentTab);
}

async function fetchFeed(source) {
  try {
    const url     = RSS2JSON + encodeURIComponent(source.url) + '&count=20';
    const res     = await fetch(url);
    const data    = await res.json();

    if (data.status !== 'ok' || !data.items) return [];

    return data.items
      .filter(item => isRelevant(item.title + ' ' + (item.description || '')))
      .map(item => ({
        title      : cleanText(item.title),
        desc       : cleanText(stripHtml(item.description || item.content || '')).slice(0, 200),
        url        : item.link,
        image      : item.thumbnail || extractImage(item.description || item.content || ''),
        date       : item.pubDate,
        dateFormatted : formatDate(item.pubDate),
        source     : source.name,
        type       : source.type,
        icon       : source.icon,
        badgeClass : source.color,
      }));
  } catch (e) {
    console.warn('Erreur flux ' + source.name + ':', e.message);
    return [];
  }
}

/* ── FILTRAGE PAR PERTINENCE ─────────────────────────────── */
function isRelevant(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return KEYWORDS.some(kw => lower.includes(kw));
}

/* ── ONGLETS ─────────────────────────────────────────────── */
function setTab(tab) {
  currentTab   = tab;
  visibleCount = PER_PAGE;

  document.querySelectorAll('.actu-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });

  applyTab(tab);
}

function applyTab(tab) {
  filteredArticles = tab === 'all'
    ? allArticles
    : allArticles.filter(a => a.type === tab);

  renderGrid();
  renderUne();
}

/* ── RENDU À LA UNE ──────────────────────────────────────── */
function renderUne() {
  const uneEl = document.getElementById('actu-une');
  const art   = filteredArticles[0];

  if (!art) {
    uneEl.innerHTML = '<div class="actu-loading"><p>Aucun article disponible.</p></div>';
    return;
  }

  const imgHtml = art.image
    ? `<img class="actu-une-img" src="${esc(art.image)}" alt="${esc(art.title)}" onerror="this.parentNode.innerHTML='<div class=\\'actu-une-img-placeholder\\'>✦</div>'">`
    : `<div class="actu-une-img-placeholder">✦</div>`;

  uneEl.innerHTML = `
    <a class="actu-une-card" href="${esc(art.url)}" target="_blank" rel="noopener">
      <div class="actu-une-body">
        <div>
          <div class="actu-une-badge ${art.badgeClass}">${art.icon} ${esc(art.source)}</div>
          <div class="actu-une-title">${esc(art.title)}</div>
          <div class="actu-une-desc">${esc(art.desc)}</div>
        </div>
        <div class="actu-une-meta">
          <span class="actu-une-source">${esc(art.source)}</span>
          <span class="actu-une-date">${art.dateFormatted}</span>
          <span class="actu-une-lire">Lire l'article →</span>
        </div>
      </div>
      <div class="actu-une-img-wrap">${imgHtml}</div>
    </a>`;
}

/* ── RENDU GRILLE ────────────────────────────────────────── */
function renderGrid() {
  const gridEl   = document.getElementById('actu-grid');
  const emptyEl  = document.getElementById('actu-empty');
  const moreBtn  = document.getElementById('actu-voir-plus');
  const countEl  = document.getElementById('actu-count');

  // Exclure l'article à la une de la grille
  const gridArticles = filteredArticles.slice(1);
  const total        = gridArticles.length;

  countEl.textContent = total > 0 ? total + ' article' + (total > 1 ? 's' : '') : '';

  if (total === 0) {
    gridEl.innerHTML = '';
    emptyEl.classList.remove('hidden');
    moreBtn.classList.add('hidden');
    return;
  }
  emptyEl.classList.add('hidden');

  const toShow = gridArticles.slice(0, visibleCount);
  gridEl.innerHTML = '';

  toShow.forEach((art, i) => {
    const card = document.createElement('a');
    card.className = 'actu-card';
    card.href      = art.url;
    card.target    = '_blank';
    card.rel       = 'noopener';
    card.style.animationDelay = (i * 0.05) + 's';

    const imgHtml = art.image
      ? `<img class="actu-card-img" src="${esc(art.image)}" alt="${esc(art.title)}" onerror="this.parentNode.innerHTML='<div class=\\'actu-card-img-placeholder\\'>✦</div>'">`
      : `<div class="actu-card-img-placeholder">✦</div>`;

    card.innerHTML = `
      <div class="actu-card-img-wrap">${imgHtml}</div>
      <div class="actu-card-body">
        <div class="actu-card-badge ${art.badgeClass}">${art.icon} ${esc(art.source)}</div>
        <div class="actu-card-title">${esc(art.title)}</div>
        <div class="actu-card-desc">${esc(art.desc)}</div>
        <div class="actu-card-footer">
          <span class="actu-card-source">${esc(art.source)}</span>
          <span class="actu-card-date">${art.dateFormatted}</span>
        </div>
      </div>`;

    gridEl.appendChild(card);
  });

  // Bouton Voir plus
  if (visibleCount < total) {
    moreBtn.classList.remove('hidden');
    moreBtn.textContent = 'Voir ' + Math.min(PER_PAGE, total - visibleCount) + ' articles de plus';
  } else {
    moreBtn.classList.add('hidden');
  }
}

function loadMore() {
  visibleCount += PER_PAGE;
  renderGrid();
}

/* ── UTILITAIRES ─────────────────────────────────────────── */
function stripHtml(html) {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function cleanText(text) {
  if (!text) return '';
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function extractImage(html) {
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? m[1] : null;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch (e) { return ''; }
}

function showError() {
  document.getElementById('actu-une').innerHTML =
    '<div class="actu-loading"><p>Impossible de charger les actualités. Réessayez plus tard.</p></div>';
}

function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
