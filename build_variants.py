"""build_variants.py
Makes the 3 front-ends from the files in src/ :
    static/index.html   -> website (farmer + buyer in one site)
    static/farmer/      -> Farmer app (PWA, fixed role, green)
    static/buyer/       -> Buyer app  (PWA, fixed role, blue)
    docs/               -> copy of static/ that GitHub Pages can show

    python build_variants.py                  -> build everything
    python build_variants.py --artifacts DIR  -> also save the single file apps in DIR (for the online preview)
"""
import json, re, shutil, sys
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).parent
SRC = ROOT / "src"
JS_ORDER = ["data", "demand", "app", "food", "sync", "main"]   # order matters, main.js must be last


def bundle():
    """Joins src/index.html + style.css + all the js files into ONE html file.
    (the apps and the online preview need a single file, so we build it here)"""
    html = (SRC / "index.html").read_text(encoding="utf-8")
    css = (SRC / "css" / "style.css").read_text(encoding="utf-8")
    js = "\n".join((SRC / "js" / f"{n}.js").read_text(encoding="utf-8") for n in JS_ORDER)
    html = re.sub(r'<link rel="stylesheet" href="css/style.css"\s*/?>', lambda m: "<style>\n" + css + "</style>", html)
    html = re.sub(r'(\s*<script src="js/[a-z]+\.js"></script>)+', lambda m: "\n<script>\n" + js + "</script>", html)
    assert html.count("<script>") == 1 and "<style>" in html
    return html


site = bundle()
(ROOT / "static").mkdir(exist_ok=True)
(ROOT / "static" / "index.html").write_text(site, encoding="utf-8")   # the website

APPS = {
  'farmer': dict(name='Crop-Waste Farmer', short='CW Farmer', theme='#1FA547', bg='#1FA547',
                 desc='Sell your crop residue: AI price, nearby buyers, offers and live order tracking.', css=''),
  'buyer':  dict(name='Crop-Waste Buyer', short='CW Buyer', theme='#1769C2', bg='#1769C2',
                 desc='Find crop residue near you, post what you need and track every delivery.',
                 css=(':root{--g:#1769C2;--gd:#0F4C9A;--gs:#E5EFFA;}\n'
                      '.banner{background:linear-gradient(120deg,#0f4c9a,#1d7fd6 60%,#5bb4f0);}\n'
                      'nav .fab{box-shadow:0 6px 14px rgba(23,105,194,.45);}\n')),
}

def remove_media(s, px):
    """deletes the  @media (min-width: Npx) { ... }  block from the css (the apps always use the phone layout)"""
    m = re.search(r"@media\s*\(min-width:\s*%dpx\)\s*\{" % px, s)
    depth = 0
    for j in range(m.end() - 1, len(s)):
        if s[j] == "{":
            depth += 1
        elif s[j] == "}":
            depth -= 1
            if depth == 0:
                return s[: m.start()] + s[j + 1 :]
    raise ValueError("block not closed")


def phone_app(s, role, a):
    for px in (640, 960):
        s = remove_media(s, px)
    assert not re.search(r"min-width:\s*(640|960)px", s)
    extra = ('#roleSeg{display:none!important}\n' + a['css'] +
             '@media (min-width:640px){body{background:#EEF2EE;} .app{box-shadow:0 10px 40px rgba(0,0,0,.16);}}\n')
    s = s.replace('</style>', extra + '</style>', 1)
    s = s.replace('<title>AI Crop-Waste Exchange</title>', f"<title>{a['name']}</title>", 1)
    assert s.count('<script>') == 1
    return s.replace('<script>', f"<script>window.APP_ROLE='{role}';</script>\n<script>", 1)

def add_pwa(s, role, a):
    vp = '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'
    head = (f'<link rel="manifest" href="manifest.webmanifest">\n<meta name="theme-color" content="{a["theme"]}">\n'
            f'<meta name="mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-capable" content="yes">\n'
            f'<meta name="apple-mobile-web-app-title" content="{a["short"]}">\n<link rel="apple-touch-icon" href="icon-192.png">')
    assert vp in s; s = s.replace(vp, vp + '\n' + head, 1)
    s = s.replace('<button class="round" data-act="bell">', '<button class="obtn" id="installBtn" style="display:none">Install</button><button class="round" data-act="bell">', 1)
    js = ("let deferredInstall=null;\n"
          "window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;$('#installBtn').style.display='inline-block';});\n"
          "$('#installBtn').addEventListener('click',async()=>{if(!deferredInstall)return;deferredInstall.prompt();await deferredInstall.userChoice;deferredInstall=null;$('#installBtn').style.display='none';});\n"
          "if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});\n\n// ---------- Boot ----------")
    assert s.count('// ---------- Boot ----------') == 1
    return s.replace('// ---------- Boot ----------', js, 1)

def icon(role, size, path, bg):
    im = Image.new('RGB', (size, size), bg); d = ImageDraw.Draw(im); s = size / 512
    d.ellipse([56*s, 56*s, 456*s, 456*s], fill='#FFFFFF')
    if role == 'farmer':       # wheat ear
        d.ellipse([244*s, 150*s, 268*s, 380*s], fill=bg); d.ellipse([240*s, 118*s, 272*s, 176*s], fill=bg)
        for y in (170, 220, 270):
            d.ellipse([178*s, (y-18)*s, 248*s, (y+22)*s], fill=bg); d.ellipse([264*s, (y-18)*s, 334*s, (y+22)*s], fill=bg)
    else:                      # shopping basket
        d.polygon([(150*s, 235*s), (362*s, 235*s), (335*s, 345*s), (177*s, 345*s)], fill=bg)
        d.rectangle([135*s, 215*s, 377*s, 240*s], fill=bg)
        d.arc([196*s, 140*s, 316*s, 280*s], 180, 360, fill=bg, width=int(18*s))
        for x in (205, 256, 307): d.rectangle([(x-5)*s, 255*s, (x+5)*s, 330*s], fill='#FFFFFF')
    im.save(path)

SW = '''const CACHE = 'cwx-%s-v1';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.pathname.startsWith('/api/')) return;      // live data / sync always go to the network
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(r => {
    if (u.origin === location.origin) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return r;
  }).catch(() => caches.match('index.html'))));
});
'''

for role, a in APPS.items():
    d = ROOT / 'static' / role; d.mkdir(exist_ok=True)
    (d / 'index.html').write_text(add_pwa(phone_app(site, role, a), role, a), encoding='utf-8')
    (d / 'manifest.webmanifest').write_text(json.dumps({
        "name": a['name'], "short_name": a['short'], "description": a['desc'], "start_url": "./", "scope": "./",   # relative, so it works on GitHub Pages too (username.github.io/repo/farmer/)
        "display": "standalone", "orientation": "portrait", "background_color": "#FFFFFF", "theme_color": a['theme'],
        "icons": [{"src": "icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable"},
                  {"src": "icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable"}]}, indent=2), encoding='utf-8')
    (d / 'sw.js').write_text(SW % role, encoding='utf-8')
    icon(role, 192, d / 'icon-192.png', a['bg']); icon(role, 512, d / 'icon-512.png', a['bg'])

if '--artifacts' in sys.argv:
    out = Path(sys.argv[sys.argv.index('--artifacts') + 1]); out.mkdir(parents=True, exist_ok=True)
    for role, a in APPS.items():
        (out / f'ai_crop_waste_exchange_{role}_app.html').write_text(phone_app(site, role, a), encoding='utf-8')
# copy everything to docs/ -> GitHub Pages can serve this folder (demo mode: no backend, sample data)
docs = ROOT / "docs"
shutil.rmtree(docs, ignore_errors=True)
shutil.copytree(ROOT / "static", docs)
(docs / ".nojekyll").write_text("", encoding="utf-8")
print("built: website + farmer app + buyer app  (copy for GitHub Pages in docs/)")
