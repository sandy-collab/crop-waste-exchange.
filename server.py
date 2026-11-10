"""
server.py  -  backend of AI Crop-Waste Exchange (FastAPI)

What it does:
 1. Food & drink ideas: gets data from RecipeDB, FlavorDB and CocktailDB for food-grade by-products.
 2. Shared world: the Farmer app and the Buyer app send their changes here, so both can see the same
    listings, requirements, orders and notifications.
 3. Serves the website (/) and the two apps (/farmer/ and /buyer/).

The API key is kept here on the server, so it never goes to the browser.
Run:  uvicorn server:app --reload
"""
import asyncio, json, os, re, time
from collections import Counter
from pathlib import Path
from urllib.parse import quote

import httpx
from fastapi import Body, FastAPI, Query
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

API_BASE = os.getenv("API_BASE", "http://cosylab.iiitd.edu.in:6969").rstrip("/")
API_KEY = os.getenv("API_KEY", "")
CUISINE_REGION = os.getenv("CUISINE_REGION", "Indian Subcontinent")
COCKTAIL_MODE = os.getenv("COCKTAIL_MODE", "off").lower()        # foodoscope | thecocktaildb | off
COCKTAIL_PATH = os.getenv("COCKTAIL_PATH", "")                   # foodoscope mode: path from the hackathon docs
COCKTAIL_PARAM = os.getenv("COCKTAIL_PARAM", "ingredient")       # foodoscope mode: query-param name
THECOCKTAILDB_BASE = os.getenv("THECOCKTAILDB_BASE", "https://www.thecocktaildb.com/api/json/v1")
THECOCKTAILDB_KEY = os.getenv("THECOCKTAILDB_KEY", "1")          # "1" is the public test key
CACHE_TTL = int(os.getenv("CACHE_TTL_SECONDS", "86400"))
TIMEOUT = float(os.getenv("UPSTREAM_TIMEOUT", "10"))

# only food-grade by-products here. Straw and husk are not edible so they are left out on purpose.
ITEMS = {
    "Wheat bran":  {"recipe": ["wheat bran", "bran"],               "flavor": ["wheat"],  "category": "Cereal", "drinks": ["Honey", "Cinnamon", "Milk"]},
    "Rice bran":   {"recipe": ["rice bran", "bran"],                "flavor": ["rice"],   "category": "Cereal", "drinks": ["Coconut", "Milk", "Honey"]},
    "Corn husk":   {"recipe": ["corn husk", "tamale"],              "flavor": ["corn"],   "category": "Cereal", "drinks": ["Lime", "Mint", "Honey"]},
    "Citrus peel": {"recipe": ["orange peel", "lemon peel"],        "flavor": ["orange"], "category": "Fruit",  "drinks": ["Lemon", "Orange", "Ginger"]},
}

ALCOHOL_WORDS = re.compile(
    r"\b(vodka|rum|whisk(?:e)?y|gin|tequila|brandy|cognac|wine|beer|liqueur|bourbon|scotch|vermouth|champagne|prosecco|sake|absinthe|schnapps)\b", re.I)

app = FastAPI(title="Crop-Waste Exchange - Food & Drink Upcycling")
_cache: dict = {}


# ---------------------------------------------------------------- helpers
def cache_get(key):
    hit = _cache.get(key)
    return hit[1] if hit and time.time() - hit[0] < CACHE_TTL else None


def unwrap(data):
    """The API sometimes gives a plain list and sometimes {"payload": ...} or {"content": ...}.
    This function always gives back a list so the rest of the code is simple."""
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for k in ("content", "payload", "data", "recipes", "results"):
            v = data.get(k)
            if isinstance(v, list):
                return v
            if isinstance(v, dict):
                inner = unwrap(v)
                if inner:
                    return inner
        return [data] if data else []
    return []


def pick(d, *keys, default=""):
    for k in keys:
        if isinstance(d, dict) and d.get(k) not in (None, ""):
            return d[k]
    return default


async def up_get(client, path, params=None):
    headers = {"Authorization": f"Bearer {API_KEY}"} if API_KEY else {}
    r = await client.get(API_BASE + path, params=params, headers=headers, timeout=TIMEOUT)
    r.raise_for_status()
    return r.json()


class NotConfigured(Exception):
    pass


# ---------------------------------------------------------------- RecipeDB
async def get_recipes(client, cfg):
    if not API_KEY:
        raise NotConfigured("API_KEY missing")
    found, seen = [], set()
    for term in cfg["recipe"]:
        for r in unwrap(await up_get(client, "/recipe2-api/recipe-bytitle/recipeByTitle", {"title": term})):
            rid = pick(r, "recipe_id", "Recipe_id")
            if rid in seen or not rid:
                continue
            seen.add(rid)
            where = " ".join(str(pick(r, k)) for k in ("region", "sub_region", "continent")).lower()
            found.append({"id": rid, "title": pick(r, "recipe_title", "Recipe_title"),
                          "region": pick(r, "region", "Region"), "time": pick(r, "total_time"),
                          "indian": CUISINE_REGION.lower() in where or "india" in where})
    indian = [r for r in found if r["indian"]]
    if len(indian) < 3:   # less than 3 Indian recipes -> also read the Indian cuisine list and filter by our words
        try:
            data = await up_get(client, f"/recipe2-api/recipes_cuisine/cuisine/{quote(CUISINE_REGION)}",
                                {"page": 1, "page_size": 100})
            words = {w for t in cfg["recipe"] for w in t.lower().split()}
            for r in unwrap(data):
                title = str(pick(r, "recipe_title", "Recipe_title"))
                rid = pick(r, "recipe_id", "Recipe_id")
                if rid and rid not in seen and any(w in title.lower() for w in words):
                    seen.add(rid)
                    found.append({"id": rid, "title": title, "region": pick(r, "region", "Region") or CUISINE_REGION,
                                  "time": pick(r, "total_time"), "indian": True})
        except httpx.HTTPError:
            pass
    found.sort(key=lambda r: not r["indian"])
    if not found:
        raise LookupError("no recipes found")
    return {"items": found[:5]}


# ---------------------------------------------------------------- FlavorDB
async def get_flavor(client, cfg):
    if not API_KEY:
        raise NotConfigured("API_KEY missing")
    entity, term_used = None, None
    for term in cfg["flavor"]:
        ents = unwrap(await up_get(client, "/flavordb/entities/by-entity-alias-readable",
                                   {"entity_alias_readable": term, "page": 0, "size": 5}))
        if not ents:
            continue
        entity = next((e for e in ents if cfg["category"].lower() in str(pick(e, "category")).lower()), None)
        if not entity:   # not found in our category -> try the second endpoint (name + category)
            try:
                narrowed = unwrap(await up_get(client, "/flavordb/entities/by-name-and-category",
                                               {"name": term, "category": cfg["category"], "page": 0, "size": 5}))
            except httpx.HTTPError:
                narrowed = []
            entity = (narrowed or ents)[0]
        term_used = term
        break
    if not entity:
        raise LookupError("no FlavorDB entity found")
    molecules = entity.get("molecules") or []
    words = Counter()
    for m in molecules:
        for w in re.split(r"[,@;/]+", str(pick(m, "flavor_profile"))):
            w = w.strip().lower()
            if w:
                words[w] += 1
    pairings = []
    try:   # ingredients that go well with it (extra endpoint, if it fails we just skip)
        for p in unwrap(await up_get(client, "/flavordb/food/by-alias", {"food_pair": term_used})):
            name = str(pick(p, "entity_alias_readable", "entity_alias")).strip()
            if name and name.lower() != term_used and name not in pairings:
                pairings.append(name)
    except httpx.HTTPError:
        pass
    return {"entity": pick(entity, "entity_alias_readable", "entity_alias", default=term_used),
            "molecule_count": len(molecules), "profiles": [w for w, _ in words.most_common(6)],
            "pairings": pairings[:6]}


# ---------------------------------------------------------------- CocktailDB (non-alcoholic only)
async def get_drinks(client, cfg):
    if COCKTAIL_MODE == "thecocktaildb":
        base = f"{THECOCKTAILDB_BASE}/{THECOCKTAILDB_KEY}"
        na = (await client.get(f"{base}/filter.php", params={"a": "Non_Alcoholic"}, timeout=TIMEOUT)).json().get("drinks")
        na_ids = {d["idDrink"] for d in na if isinstance(d, dict)} if isinstance(na, list) else set()
        out, seen = [], set()
        for ing in cfg["drinks"]:
            drinks = (await client.get(f"{base}/filter.php", params={"i": ing}, timeout=TIMEOUT)).json().get("drinks")
            for d in drinks if isinstance(drinks, list) else []:
                if d.get("idDrink") in na_ids and d["idDrink"] not in seen:
                    seen.add(d["idDrink"]); out.append({"name": d["strDrink"], "thumb": d.get("strDrinkThumb"), "via": ing})
        if not out:
            raise LookupError("no non-alcoholic drinks found")
        return {"items": out[:5]}
    if COCKTAIL_MODE == "foodoscope":
        if not (API_KEY and COCKTAIL_PATH):
            raise NotConfigured("set COCKTAIL_PATH (from the hackathon docs) and API_KEY")
        out, seen = [], set()
        for ing in cfg["drinks"]:
            for rec in unwrap(await up_get(client, COCKTAIL_PATH, {COCKTAIL_PARAM: ing})):
                name = str(pick(rec, "name", "drink_name", "cocktail_name", "strDrink", "title", "recipe_title"))
                flag = str(pick(rec, "alcoholic", "strAlcoholic")).lower()
                # keep a drink only if it says non-alcoholic, or if no alcohol word is found in it
                ok = flag.startswith("non") or (not flag.startswith("alcohol") and not ALCOHOL_WORDS.search(json.dumps(rec)))
                if name and ok and name not in seen:
                    seen.add(name); out.append({"name": name, "via": ing})
        if not out:
            raise LookupError("no non-alcoholic drinks found")
        return {"items": out[:5]}
    raise NotConfigured("CocktailDB not configured (COCKTAIL_MODE=off)")


async def section(fn, client, cfg):
    try:
        return {"source": "live", **(await fn(client, cfg))}
    except NotConfigured as e:
        return {"source": "not_configured", "error": str(e)}
    except httpx.HTTPStatusError as e:
        return {"source": "error", "error": f"upstream HTTP {e.response.status_code}"}
    except (httpx.ConnectError, httpx.TimeoutException):
        return {"source": "error", "error": "upstream unreachable (check API_BASE / VPN / campus network)"}
    except LookupError as e:
        return {"source": "empty", "error": str(e)}
    except Exception as e:  # if one database fails the other two should still work
        return {"source": "error", "error": f"{type(e).__name__}: {e}"}


# ---------------------------------------------------------------- routes
@app.get("/api/food/health")
async def health():
    return {"ok": True, "has_key": bool(API_KEY), "api_base": API_BASE, "cocktail_mode": COCKTAIL_MODE, "items": list(ITEMS)}


@app.get("/api/food/ideas")
async def ideas(item: str = Query(..., description="e.g. Wheat bran")):
    cfg = ITEMS.get(item)
    if not cfg:
        return JSONResponse({"error": "unknown item", "items": list(ITEMS)}, status_code=404)
    hit = cache_get(item)
    if hit:
        return {**hit, "cached": True}   # same answer as before, saves our API credits
    async with httpx.AsyncClient() as client:
        rec, fla, dri = await asyncio.gather(section(get_recipes, client, cfg), section(get_flavor, client, cfg),
                                             section(get_drinks, client, cfg))
    result = {"item": item, "recipes": rec, "flavor": fla, "drinks": dri, "cached": False}
    if any(s["source"] == "live" for s in (rec, fla, dri)):
        _cache[item] = (time.time(), result)
    return result


# ---------------------------------------------------------------- shared world (Farmer app <-> Buyer app)
WORLD_FILE = Path(os.getenv("WORLD_FILE", Path(__file__).parent / "world.json"))
COLLECTIONS = ("listings", "demand", "orders")


def _empty_world():
    return {"rev": 0, "items": {c: {} for c in COLLECTIONS}, "notifs": []}


def _load_world():
    try:
        w = json.loads(WORLD_FILE.read_text(encoding="utf-8"))
        if all(c in w.get("items", {}) for c in COLLECTIONS):
            return w
    except (OSError, ValueError):
        pass
    return _empty_world()


WORLD = _load_world()


def _sig(o):
    return json.dumps({k: v for k, v in o.items() if k not in ("v", "_rev")}, sort_keys=True)


def _save_world():
    try:
        WORLD_FILE.write_text(json.dumps(WORLD), encoding="utf-8")
    except OSError:
        pass


@app.get("/api/world/health")
async def world_health():
    return {"ok": True, "rev": WORLD["rev"]}


@app.post("/api/world/sync")
async def world_sync(body: dict = Body(...)):
    """Called by the apps every few seconds.
    The app sends only the things it changed, the server saves them and sends back everything newer than `since`.
    Every item has a version number `v`. Higher version wins (if same, the last one wins)."""
    since = int(body.get("since", 0)); changes = body.get("changes", {}); changed = False
    for col in COLLECTIONS:
        store = WORLD["items"][col]
        for it in changes.get(col, []):
            iid = it.get("id")
            if not iid:
                continue
            cur = store.get(iid)
            if cur is None or int(it.get("v", 0)) >= int(cur.get("v", 0)):
                if cur is not None and _sig(cur) == _sig(it):
                    cur["v"] = max(int(cur.get("v", 0)), int(it.get("v", 0)))
                    continue
                WORLD["rev"] += 1
                store[iid] = {**it, "_rev": WORLD["rev"]}
                changed = True
    known = {n["nid"] for n in WORLD["notifs"]}
    for n in body.get("notifs", []):
        if n.get("nid") and n["nid"] not in known:
            WORLD["rev"] += 1
            WORLD["notifs"].append({**n, "_rev": WORLD["rev"]})
            known.add(n["nid"]); changed = True
    WORLD["notifs"] = WORLD["notifs"][-300:]
    if changed:
        _save_world()
    out = {"rev": WORLD["rev"], "notifs": [n for n in WORLD["notifs"] if n["_rev"] > since]}
    for col in COLLECTIONS:
        out[col] = [i for i in WORLD["items"][col].values() if i["_rev"] > since]
    return out


@app.post("/api/world/reset")
async def world_reset():
    """clears all shared data (use it before the demo so everything starts fresh)"""
    WORLD.clear(); WORLD.update(_empty_world()); _save_world()
    return {"ok": True}


# ---------------------------------------------------------------- website and apps
STATIC = Path(__file__).parent / "static"


@app.get("/")                      # website: farmer and buyer in one site
async def index():
    return FileResponse(STATIC / "index.html")


for _name in ("farmer", "buyer"):  # the two apps (PWA, can be installed on a phone)
    def _manifest(n=_name):
        async def handler():
            return FileResponse(STATIC / n / "manifest.webmanifest", media_type="application/manifest+json")
        return handler
    app.add_api_route(f"/{_name}/manifest.webmanifest", _manifest(), methods=["GET"], include_in_schema=False)
    app.mount(f"/{_name}", StaticFiles(directory=STATIC / _name, html=True), name=_name)

app.mount("/static", StaticFiles(directory=STATIC), name="static")
