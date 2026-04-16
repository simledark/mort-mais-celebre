'use strict';
/* ══════════════════════════════════════════════════════
   PALMARÈS DE LA MORT — palmares.js
   ══════════════════════════════════════════════════════

   COMMENT AJOUTER UN COMPTEUR :
   ─────────────────────────────
   Dans le tableau COMPTEURS ci-dessous, ajoutez un objet :
   {
     id:        'identifiant_unique',        // jamais d'espace
     label:     'Nom affiché',
     icon:      '🔴',                        // emoji
     categorie: 'maladies',                  // doit exister dans CATEGORIES
     perYear:   1_234_567,                   // décès/an dans le monde (OMS)
     source:    'OMS 2023',
     couleur:   '#e53935'                    // couleur de la barre (optionnel)
   }

   COMMENT AJOUTER UNE CATÉGORIE :
   ────────────────────────────────
   Dans le tableau CATEGORIES ci-dessous, ajoutez :
   { id: 'ma_categorie', label: 'Mon Label', icon: '🏷️' }
   Puis assignez cette categorie à vos compteurs.

   ══════════════════════════════════════════════════════ */

/* ── CATÉGORIES ─────────────────────────────────────── */
const CATEGORIES = [
  { id: 'all',           label: 'Toutes',          icon: '🌍' },
  { id: 'maladies',      label: 'Maladies',         icon: '🫁' },
  { id: 'cardio',        label: 'Cardiovasculaire', icon: '❤️' },
  { id: 'cancer',        label: 'Cancers',          icon: '🎗️' },
  { id: 'infectieux',    label: 'Infectieux',       icon: '🦠' },
  { id: 'accidents',     label: 'Accidents',        icon: '⚠️' },
  { id: 'mental',        label: 'Santé mentale',    icon: '🧠' },
  { id: 'environnement', label: 'Environnement',    icon: '🌱' },
];

/* ── COMPTEURS ──────────────────────────────────────── */
/* perYear = décès mondiaux annuels selon OMS / Lancet  */
const COMPTEURS = [

  /* ── CARDIOVASCULAIRE ── */
  { id: 'cardio_total',    label: 'Maladies cardiovasculaires',    icon: '❤️',  categorie: 'cardio',   perYear: 17_900_000, source: 'OMS 2023',          couleur: '#e53935' },
  { id: 'infarctus',       label: 'Infarctus du myocarde',         icon: '💔',  categorie: 'cardio',   perYear: 9_000_000,  source: 'OMS 2023',          couleur: '#c62828' },
  { id: 'avc',             label: 'AVC (Accidents vasculaires)',    icon: '🧠',  categorie: 'cardio',   perYear: 6_700_000,  source: 'OMS 2023',          couleur: '#b71c1c' },
  { id: 'hypertension',    label: 'Hypertension (complications)',   icon: '🩺',  categorie: 'cardio',   perYear: 10_400_000, source: 'The Lancet 2023',   couleur: '#d32f2f' },

  /* ── CANCERS ── */
  { id: 'cancer_total',    label: 'Cancers (tous types)',           icon: '🎗️',  categorie: 'cancer',   perYear: 9_958_000,  source: 'CIRC / OMS 2022',   couleur: '#6a1b9a' },
  { id: 'cancer_poumon',   label: 'Cancer du poumon',               icon: '🫁',  categorie: 'cancer',   perYear: 1_800_000,  source: 'CIRC 2022',         couleur: '#7b1fa2' },
  { id: 'cancer_foie',     label: 'Cancer du foie',                 icon: '🫀',  categorie: 'cancer',   perYear: 830_000,    source: 'CIRC 2022',         couleur: '#8e24aa' },
  { id: 'cancer_colon',    label: 'Cancer colorectal',              icon: '🔬',  categorie: 'cancer',   perYear: 916_000,    source: 'CIRC 2022',         couleur: '#9c27b0' },
  { id: 'cancer_sein',     label: 'Cancer du sein',                 icon: '🩷',  categorie: 'cancer',   perYear: 685_000,    source: 'CIRC 2022',         couleur: '#ab47bc' },
  { id: 'cancer_cerveau',  label: 'Cancer du cerveau',              icon: '🧠',  categorie: 'cancer',   perYear: 251_000,    source: 'CIRC 2022',         couleur: '#ba68c8' },
  { id: 'cancer_prostate', label: 'Cancer de la prostate',          icon: '🔵',  categorie: 'cancer',   perYear: 375_000,    source: 'CIRC 2022',         couleur: '#4a148c' },
  { id: 'leucemie',        label: 'Leucémies',                      icon: '🩸',  categorie: 'cancer',   perYear: 312_000,    source: 'CIRC 2022',         couleur: '#6a0080' },

  /* ── MALADIES ── */
  { id: 'diabete',         label: 'Diabète',                        icon: '💉',  categorie: 'maladies', perYear: 6_700_000,  source: 'FID 2023',          couleur: '#f57f17' },
  { id: 'alzheimer',       label: 'Alzheimer & démences',           icon: '🧩',  categorie: 'maladies', perYear: 2_100_000,  source: 'OMS 2023',          couleur: '#ff8f00' },
  { id: 'pneumonie',       label: 'Pneumonie',                      icon: '🌬️',  categorie: 'maladies', perYear: 2_500_000,  source: 'OMS 2023',          couleur: '#e65100' },
  { id: 'rein',            label: 'Maladies rénales chroniques',    icon: '🫘',  categorie: 'maladies', perYear: 1_300_000,  source: 'OMS 2023',          couleur: '#bf360c' },
  { id: 'foie_maladie',    label: 'Cirrhose / Maladies du foie',    icon: '🫀',  categorie: 'maladies', perYear: 2_000_000,  source: 'OMS 2023',          couleur: '#dd2c00' },
  { id: 'bpco',            label: 'BPCO (bronchite chronique)',      icon: '🫁',  categorie: 'maladies', perYear: 3_230_000,  source: 'OMS 2023',          couleur: '#ff6d00' },

  /* ── INFECTIEUX ── */
  { id: 'tuberculose',     label: 'Tuberculose',                    icon: '🦠',  categorie: 'infectieux', perYear: 1_600_000, source: 'OMS 2023',         couleur: '#1b5e20' },
  { id: 'vih',             label: 'VIH / SIDA',                     icon: '🔴',  categorie: 'infectieux', perYear: 650_000,   source: 'ONUSIDA 2023',     couleur: '#2e7d32' },
  { id: 'paludisme',       label: 'Paludisme',                      icon: '🦟',  categorie: 'infectieux', perYear: 619_000,   source: 'OMS 2023',         couleur: '#388e3c' },
  { id: 'hepatite',        label: 'Hépatites virales (B+C)',         icon: '🧫',  categorie: 'infectieux', perYear: 1_100_000, source: 'OMS 2023',         couleur: '#43a047' },
  { id: 'diarrhee',        label: 'Maladies diarrhéiques',          icon: '💧',  categorie: 'infectieux', perYear: 1_600_000, source: 'OMS 2023',         couleur: '#4caf50' },
  { id: 'covid',           label: 'COVID-19',                       icon: '😷',  categorie: 'infectieux', perYear: 700_000,   source: 'OMS 2024',         couleur: '#66bb6a' },

  /* ── ACCIDENTS ── */
  { id: 'route',           label: 'Accidents de la route',          icon: '🚗',  categorie: 'accidents', perYear: 1_350_000, source: 'OMS 2023',          couleur: '#e65100' },
  { id: 'noyade',          label: 'Noyades',                        icon: '🌊',  categorie: 'accidents', perYear: 236_000,   source: 'OMS 2023',          couleur: '#0277bd' },
  { id: 'chute',           label: 'Chutes accidentelles',           icon: '⬇️',  categorie: 'accidents', perYear: 684_000,   source: 'OMS 2023',          couleur: '#ff8f00' },
  { id: 'empoisonnement',  label: 'Empoisonnements accidentels',    icon: '☠️',  categorie: 'accidents', perYear: 106_000,   source: 'OMS 2023',          couleur: '#558b2f' },
  { id: 'guerre',          label: 'Conflits armés',                 icon: '💣',  categorie: 'accidents', perYear: 250_000,   source: 'IHME 2023',         couleur: '#37474f' },
  { id: 'homicide',        label: 'Homicides',                      icon: '🔪',  categorie: 'accidents', perYear: 475_000,   source: 'ONUDC 2023',        couleur: '#455a64' },

  /* ── SANTÉ MENTALE ── */
  { id: 'suicide',         label: 'Suicides',                       icon: '🖤',  categorie: 'mental',    perYear: 703_000,   source: 'OMS 2023',          couleur: '#37474f' },
  { id: 'drogue',          label: 'Troubles liés aux drogues',      icon: '💊',  categorie: 'mental',    perYear: 500_000,   source: 'ONUDC 2023',        couleur: '#546e7a' },
  { id: 'alcool_maladie',  label: 'Maladies liées à l\'alcool',     icon: '🍷',  categorie: 'mental',    perYear: 3_000_000, source: 'OMS 2023',          couleur: '#78909c' },

  /* ── ENVIRONNEMENT ── */
  { id: 'pollution_air',   label: 'Pollution de l\'air',            icon: '🌫️',  categorie: 'environnement', perYear: 7_000_000, source: 'OMS 2023',     couleur: '#795548' },
  { id: 'chaleur',         label: 'Chaleur extrême',                icon: '🌡️',  categorie: 'environnement', perYear: 489_000,   source: 'Lancet 2023',  couleur: '#ff7043' },
  { id: 'eau_sale',        label: 'Eau insalubre / assainissement', icon: '💧',  categorie: 'environnement', perYear: 1_400_000, source: 'OMS 2023',     couleur: '#0288d1' },
  { id: 'malnutrition',    label: 'Malnutrition / Faim',            icon: '🌾',  categorie: 'environnement', perYear: 2_200_000, source: 'FAO 2023',     couleur: '#afb42b' },

  /* ══ AJOUTEZ VOS PROPRES COMPTEURS ICI ══
     Exemple :
     { id: 'sepsis', label: 'Sepsis (septicémie)', icon: '🩸', categorie: 'infectieux', perYear: 11_000_000, source: 'Lancet 2020', couleur: '#c62828' },
  */
];

/* ── DONNÉES ESPÉRANCE DE VIE DE BASE (OMS) ─────────── */
const ESPERANCE_BASE = {
  /* espérance à la naissance, H / F */
  france:    { H: 79.5, F: 85.4 },
  belgique:  { H: 79.2, F: 84.0 },
  suisse:    { H: 81.9, F: 85.6 },
  canada:    { H: 80.4, F: 84.4 },
  usa:       { H: 75.1, F: 80.5 },
  japon:     { H: 81.1, F: 87.1 },
  allemagne: { H: 79.0, F: 83.6 },
  uk:        { H: 79.4, F: 83.1 },
  italie:    { H: 80.9, F: 85.2 },
  espagne:   { H: 80.7, F: 86.2 },
  maroc:     { H: 74.3, F: 77.1 },
  algerie:   { H: 74.5, F: 77.2 },
  russie:    { H: 67.5, F: 77.8 },
  bresil:    { H: 72.5, F: 79.4 },
  inde:      { H: 68.4, F: 71.1 },
  autre:     { H: 70.0, F: 74.5 },
};

/* ── MODIFICATEURS (en années) ──────────────────────── */
const MODIF = {
  education: { primaire: -2.5, brevet: -1.5, bac: 0, bac2: +0.8, bac3: +1.5, bac5: +2.2, doctorat: +3.0 },
  tabac:     { jamais: 0, ancien: -2.0, leger: -3.5, moyen: -6.0, fort: -10.0 },
  alcool:    { jamais: +0.5, occasionnel: 0, modere: -1.5, excessif: -5.0 },
  activite:  { sedentaire: -3.5, leger: -1.0, modere: +2.0, intense: +3.5 },
  imc:       { maigreur: -2.0, normal: 0, surpoids: -1.5, obese1: -3.0, obese2: -6.0 },
  stress:    { faible: +1.0, moyen: 0, eleve: -2.0, tres_eleve: -4.0 },
  alimentation: { mauvaise: -3.0, moyenne: 0, bonne: +1.5, excellente: +3.0 },
  sommeil:   { insuffisant: -2.5, correct: 0, optimal: +1.0, excessif: -1.0 },
  lien_social: { isole: -3.0, modere: 0, fort: +2.5 },
  antecedents: { aucun: 0, cardio: -3.0, cancer: -2.5, diabete: -2.0, multiple: -5.0 },
};

/* ══════════════════════════════════════════════════════
   MOTEUR
   ══════════════════════════════════════════════════════ */
const JAN1   = new Date(new Date().getFullYear(), 0, 1);
let currentCat = 'all';

function secsSinceJan1() { return (Date.now() - JAN1) / 1000; }
function fmt(n) { return Math.floor(n).toLocaleString('fr-FR'); }

/* ── BUILD UI ────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('footer-year').textContent = new Date().getFullYear();
  buildFilters();
  buildCounters();
  tick();
});

function buildFilters() {
  const wrap = document.getElementById('cat-filters');
  CATEGORIES.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'year-btn' + (cat.id === 'all' ? ' active' : '');
    btn.textContent = `${cat.icon} ${cat.label}`;
    btn.dataset.cat = cat.id;
    btn.addEventListener('click', () => {
      document.querySelectorAll('#cat-filters .year-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentCat = cat.id;
      filterCounters();
    });
    wrap.appendChild(btn);
  });
}

function buildCounters() {
  const list = document.getElementById('counters-list');
  list.innerHTML = '';
  const secs = secsSinceJan1();
  const sorted = [...COMPTEURS].sort((a, b) => b.perYear - a.perYear);
  sorted.forEach((c, i) => {
    const div = document.createElement('div');
    div.className = 'palmares-row';
    div.id = 'pr-' + c.id;
    div.dataset.cat = c.categorie;
    div.style.animationDelay = `${i * 0.03}s`;
    const pct  = Math.min((c.perYear / 17_900_000) * 100, 100);
    const rate = c.perYear / 31_536_000;
    div.innerHTML = `
      <div class="pal-row-left">
        <span class="pal-icon">${c.icon}</span>
        <div>
          <div class="pal-label">${escHtml(c.label)}</div>
          <div class="pal-source">${escHtml(c.source)}</div>
        </div>
      </div>
      <div class="pal-row-right">
        <div class="pal-val" id="pv-${c.id}">0</div>
        <div class="pal-bar-wrap">
          <div class="pal-bar" id="pb-${c.id}" style="background:${c.couleur || 'var(--green)'}; width:0%"></div>
        </div>
        <div class="pal-rate">${formatRate(rate)}</div>
      </div>`;
    list.appendChild(div);
    setTimeout(() => {
      const bar = document.getElementById('pb-' + c.id);
      if (bar) bar.style.width = pct + '%';
    }, 500 + i * 20);
  });
}

function filterCounters() {
  const list = document.getElementById('counters-list');
  const sorted = [...COMPTEURS].sort((a, b) => b.perYear - a.perYear);
  // Masquer/afficher
  document.querySelectorAll('.palmares-row').forEach(row => {
    const show = currentCat === 'all' || row.dataset.cat === currentCat;
    row.style.display = show ? '' : 'none';
  });
  // Réordonner dans le DOM par perYear décroissant
  sorted
    .filter(c => currentCat === 'all' || c.categorie === currentCat)
    .forEach(c => {
      const row = document.getElementById('pr-' + c.id);
      if (row) list.appendChild(row);
    });
}

function tick() {
  const secs = secsSinceJan1();
  COMPTEURS.forEach(c => {
    const el = document.getElementById('pv-' + c.id);
    if (el) el.textContent = fmt(secs * (c.perYear / 31_536_000));
  });
  setTimeout(tick, 1000);
}

function formatRate(perSec) {
  if (perSec >= 1)        return `≈ ${perSec.toFixed(1)} / seconde`;
  if (perSec * 60 >= 1)   return `≈ ${(perSec * 60).toFixed(1)} / minute`;
  if (perSec * 3600 >= 1) return `≈ ${(perSec * 3600).toFixed(1)} / heure`;
  return `≈ ${(perSec * 86400).toFixed(1)} / jour`;
}
