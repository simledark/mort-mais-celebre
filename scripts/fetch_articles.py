#!/usr/bin/env python3
"""
MORT & CÉLÈBRE — Générateur d'articles
Récupère les flux RSS et génère un fichier articles.json statique
Lancé automatiquement par GitHub Actions toutes les 6h
"""

import json
import re
import sys
from datetime import datetime, timezone
from urllib.request import urlopen, Request
from urllib.error import URLError
from html.parser import HTMLParser
import xml.etree.ElementTree as ET

# ── SOURCES RSS ─────────────────────────────────────────────
SOURCES = [
    # Science
    {"name": "Inserm",             "type": "science", "url": "https://presse.inserm.fr/feed/"},
    {"name": "Sciences & Avenir",  "type": "science", "url": "https://www.sciencesetavenir.fr/sante/rss.xml"},
    {"name": "Futura Santé",       "type": "science", "url": "https://www.futura-sciences.com/rss/sante/actualites.xml"},
    {"name": "Le Monde Science",   "type": "science", "url": "https://www.lemonde.fr/sciences/rss_full.xml"},
    {"name": "Pour la Science",    "type": "science", "url": "https://www.pourlascience.fr/flux-rss/"},
    # Presse
    {"name": "Le Monde Santé",     "type": "presse",  "url": "https://www.lemonde.fr/sante/rss_full.xml"},
    {"name": "France Info Santé",  "type": "presse",  "url": "https://www.francetvinfo.fr/sante.rss"},
    {"name": "Le Figaro Santé",    "type": "presse",  "url": "https://sante.lefigaro.fr/rss/rss.xml"},
    {"name": "20 Minutes Santé",   "type": "presse",  "url": "https://www.20minutes.fr/feeds/rss-sante.xml"},
    {"name": "Libération",         "type": "presse",  "url": "https://www.liberation.fr/arc/outboundfeeds/rss-all/?outputType=xml"},
]

# Mots-clés de pertinence
KEYWORDS = [
    "mort", "décès", "mourir", "mortalité", "longévité", "vieillissement",
    "espérance de vie", "euthanasie", "suicide", "cancer", "tumeur",
    "maladie", "immortalité", "centenaire", "sénescence", "alzheimer",
    "démence", "palliatif", "nécrologie", "deuil", "autopsie", "épidémie",
    "pandémie", "virus", "pathologie", "gériatrie", "gérontologie",
    "biologie", "génétique", "cellule", "adn", "gène", "âge",
]

# ── PARSER HTML SIMPLE ───────────────────────────────────────
class HTMLStripper(HTMLParser):
    def __init__(self):
        super().__init__()
        self.reset()
        self.fed = []
        self._img = None

    def handle_starttag(self, tag, attrs):
        if tag == 'img':
            for attr, val in attrs:
                if attr == 'src' and val.startswith('http'):
                    self._img = val
                    break

    def handle_data(self, d):
        self.fed.append(d)

    def get_data(self):
        return ' '.join(self.fed).strip()

    def get_img(self):
        return self._img


def strip_html(html):
    """Supprime les balises HTML et retourne texte + première image"""
    if not html:
        return '', None
    s = HTMLStripper()
    try:
        s.feed(html)
        return re.sub(r'\s+', ' ', s.get_data()).strip(), s.get_img()
    except Exception:
        return re.sub(r'<[^>]+>', ' ', html).strip(), None


def is_relevant(text):
    """Vérifie si l'article est pertinent par rapport aux mots-clés"""
    lower = (text or '').lower()
    return any(kw in lower for kw in KEYWORDS)


def parse_date(date_str):
    """Parse une date RSS en datetime"""
    if not date_str:
        return datetime.now(timezone.utc)
    formats = [
        "%a, %d %b %Y %H:%M:%S %z",
        "%a, %d %b %Y %H:%M:%S GMT",
        "%Y-%m-%dT%H:%M:%S%z",
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%d",
    ]
    for fmt in formats:
        try:
            return datetime.strptime(date_str.strip(), fmt)
        except ValueError:
            continue
    return datetime.now(timezone.utc)


def fetch_rss(source):
    """Récupère et parse un flux RSS"""
    articles = []
    try:
        req = Request(
            source["url"],
            headers={
                "User-Agent": "Mozilla/5.0 (compatible; MortCelebre/1.0)",
                "Accept": "application/rss+xml, application/xml, text/xml",
            }
        )
        with urlopen(req, timeout=15) as resp:
            xml_data = resp.read()

        # Parser le XML
        root = ET.fromstring(xml_data)

        # Gérer les namespaces
        ns = {
            'media'  : 'http://search.yahoo.com/mrss/',
            'content': 'http://purl.org/rss/1.0/modules/content/',
            'dc'     : 'http://purl.org/dc/elements/1.1/',
            'atom'   : 'http://www.w3.org/2005/Atom',
        }

        # Trouver les items (RSS 2.0 ou Atom)
        items = root.findall('.//item') or root.findall('.//{http://www.w3.org/2005/Atom}entry')

        for item in items[:20]:
            def get(tag, default=''):
                el = item.find(tag)
                return el.text.strip() if el is not None and el.text else default

            title    = get('title') or get('{http://www.w3.org/2005/Atom}title')
            link     = get('link')  or get('{http://www.w3.org/2005/Atom}id')
            pub_date = get('pubDate') or get('dc:date', ns.get('dc')) or get('{http://www.w3.org/2005/Atom}published')
            desc_raw = get('description') or get('{http://www.w3.org/2005/Atom}summary')
            content_raw = ''

            # Contenu enrichi
            content_el = item.find('{http://purl.org/rss/1.0/modules/content/}encoded')
            if content_el is not None and content_el.text:
                content_raw = content_el.text

            # Image
            image = None
            media_el = item.find('{http://search.yahoo.com/mrss/}thumbnail')
            if media_el is not None:
                image = media_el.get('url')
            if not image:
                media_el = item.find('{http://search.yahoo.com/mrss/}content')
                if media_el is not None:
                    image = media_el.get('url')
            if not image:
                enclosure = item.find('enclosure')
                if enclosure is not None and 'image' in (enclosure.get('type') or ''):
                    image = enclosure.get('url')

            # Extraire texte et image depuis description/content
            desc_text, desc_img = strip_html(desc_raw or content_raw)
            if not image:
                image = desc_img

            # Vérifier la pertinence
            if not is_relevant(title + ' ' + desc_text):
                continue

            # Nettoyer le lien (atom:link peut être un élément vide avec href)
            if not link:
                link_el = item.find('{http://www.w3.org/2005/Atom}link')
                if link_el is not None:
                    link = link_el.get('href', '')

            if not title or not link:
                continue

            parsed_date = parse_date(pub_date)
            articles.append({
                "title"         : title[:200],
                "desc"          : desc_text[:300],
                "url"           : link,
                "image"         : image,
                "date"          : parsed_date.strftime("%Y-%m-%dT%H:%M:%S+00:00"),
                "date_formatted": parsed_date.strftime("%-d %B %Y") if sys.platform != 'win32' else parsed_date.strftime("%d %B %Y"),
                "source"        : source["name"],
                "type"          : source["type"],
            })

        print(f"  ✓ {source['name']}: {len(articles)} articles pertinents")
        return articles

    except URLError as e:
        print(f"  ✗ {source['name']}: URL error — {e.reason}")
        return []
    except ET.ParseError as e:
        print(f"  ✗ {source['name']}: XML parse error — {e}")
        return []
    except Exception as e:
        print(f"  ✗ {source['name']}: {type(e).__name__} — {e}")
        return []


def main():
    print(f"\n🔍 Récupération des flux RSS — {datetime.now().strftime('%d/%m/%Y %H:%M')}")
    print("=" * 60)

    all_articles = []
    seen_urls    = set()

    for source in SOURCES:
        print(f"→ {source['name']}…")
        articles = fetch_rss(source)
        for art in articles:
            if art["url"] not in seen_urls:
                seen_urls.add(art["url"])
                all_articles.append(art)

    # Trier par date décroissante
    all_articles.sort(key=lambda a: a["date"], reverse=True)

    # Limiter à 100 articles
    all_articles = all_articles[:100]

    print(f"\n✅ Total : {len(all_articles)} articles uniques pertinents")

    # Générer le JSON
    output = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "count"        : len(all_articles),
        "articles"     : all_articles,
    }

    with open("articles.json", "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"📄 articles.json généré ({len(all_articles)} articles)")


if __name__ == "__main__":
    main()
