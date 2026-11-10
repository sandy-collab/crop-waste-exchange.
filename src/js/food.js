// food.js
// Food & drink ideas for food-grade by-products (bran, corn husk, citrus peel).
// If the backend is running it shows live data from RecipeDB / FlavorDB / CocktailDB, otherwise sample data.

// ---------- Food & drink upcycling (RecipeDB + FlavorDB + CocktailDB) ----------
const FOOD_SAMPLE = {
  "Wheat bran": {
    e: "🌾",
    r: ["Multigrain bran roti", "Bran & jaggery muffins", "Savoury bran upma"],
    p: ["Jaggery", "Cinnamon", "Roasted cumin"],
    d: ["Roasted-bran & jaggery chai (no alcohol)", "Spiced bran buttermilk"],
  },
  "Rice bran": {
    e: "🍚",
    r: ["Rice-bran energy bars", "Bran-enriched khichdi", "Nuka-style bran pickle"],
    p: ["Sesame", "Roasted peanut", "Coconut"],
    d: ["Rice-bran & coconut cooler", "Toasted bran lassi"],
  },
  "Corn husk": {
    e: "🌽",
    r: ["Steamed corn parcels (tamale-style)", "Husk-wrapped steamed paneer", "Husk-steamed fish"],
    p: ["Lime", "Green chilli", "Coriander"],
    d: ["Lime & mint corn cooler"],
  },
  "Citrus peel": {
    e: "🍊",
    r: ["Candied peel", "Peel marmalade", "Peel pickle"],
    p: ["Ginger", "Mint", "Black salt"],
    d: ["Peel & ginger shrub spritzer", "Citrus-peel iced tea"],
  },
};
const esc = (s) =>
  String(s == null ? "" : s).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
// Is the backend (server.py) available? On a plain static host this stays false and sample data is used.
const foodReady = fetch("/api/food/health")
  .then((r) => (r.ok ? r.json() : null))
  .then((j) => !!(j && j.ok))
  .catch(() => false);
let foodTok = 0;
// asks our backend for live data. Returns null if the backend is not there (then we show sample data)
async function loadFoodLive(name) {
  if (!(await foodReady)) return null;
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 20000);
    const r = await fetch("/api/food/ideas?item=" + encodeURIComponent(name), { signal: c.signal });
    clearTimeout(t);
    return r.ok ? await r.json() : null;
  } catch (e) {
    return null;
  }
}
// draws the 3 cards (recipes, flavours, drinks). Every card has a badge: Live or Sample
async function renderFood() {
  const names = Object.keys(FOOD_SAMPLE);
  if (!S.food) S.food = names[0];
  $("#fChips").innerHTML = names
    .map(
      (n) =>
        `<button class="chip ${S.food === n ? "on" : ""}" data-act="food" data-f="${n}">${FOOD_SAMPLE[n].e} ${n}</button>`,
    )
    .join("");
  const tok = ++foodTok;
  $("#fOut").innerHTML = '<div class="empty">Loading ideas…</div>';
  const live = await loadFoodLive(S.food);
  if (tok !== foodTok) return;
  const f = FOOD_SAMPLE[S.food],
    ok = (k) => !!(live && live[k] && live[k].source === "live");
  const badge = (b) => `<span class="pill ${b ? "" : "gry"}">${b ? "Live" : "Sample"}</span>`;
  const li = (a) => `<ul class="fl">${a.map((x) => `<li>${x}</li>`).join("")}</ul>`;
  const why = (k) =>
    live && live[k] && live[k].error && !ok(k)
      ? `<div class="api">${esc(live[k].error)} — showing sample</div>`
      : "";
  const recOk = ok("recipes") && live.recipes.items.length,
    flaOk = ok("flavor"),
    driOk = ok("drinks") && live.drinks.items.length;
  const recipes = recOk
    ? li(
        live.recipes.items.map(
          (r) =>
            esc(r.title) +
            (r.region
              ? ` <small style="color:var(--mu)">· ${esc(r.region)}${r.indian ? " · Indian" : ""}</small>`
              : ""),
        ),
      )
    : li(f.r);
  const flavor = flaOk
    ? `<p class="hi" style="margin:.35rem 0 0">${esc(live.flavor.entity)} · ${live.flavor.molecule_count} flavour molecules</p>` +
      (live.flavor.profiles.length
        ? `<div class="tags">${live.flavor.profiles.map((p) => `<span>${esc(p)}</span>`).join("")}</div>`
        : "") +
      (live.flavor.pairings.length
        ? `<p class="hi" style="margin:.3rem 0 0">Pairs well with:</p>${li(live.flavor.pairings.map(esc))}`
        : "")
    : li(f.p);
  const drinks = driOk
    ? li(
        live.drinks.items.map(
          (d) => esc(d.name) + (d.via ? ` <small style="color:var(--mu)">· with ${esc(d.via)}</small>` : ""),
        ),
      )
    : li(f.d);
  const anyLive = recOk || flaOk || driOk;
  $("#fOut").innerHTML = `<div class="flist">
    <div class="card"><b>🍳 Recipe ideas</b> ${badge(recOk)}${recipes}<div class="api">RecipeDB · GET /recipe2-api/recipe-bytitle/recipeByTitle, then /recipe2-api/recipes_cuisine/cuisine/{region}</div>${why("recipes")}</div>
    <div class="card"><b>🧪 Flavour pairings</b> ${badge(flaOk)}${flavor}<div class="api">FlavorDB · GET /flavordb/entities/by-entity-alias-readable, then /flavordb/entities/by-name-and-category</div>${why("flavor")}</div>
    <div class="card"><b>🍹 Drink ideas (no alcohol)</b> ${badge(driOk)}${drinks}<div class="api">CocktailDB · non-alcoholic drinks that share a pairing ingredient</div>${why("drinks")}</div></div>
    <div class="note">${anyLive ? "Live results come from the databases through the backend, so the API key never reaches the browser." : "Sample ideas shown. Run the backend (see README) to fetch live RecipeDB, FlavorDB and CocktailDB results."} Only clean, fresh, food-grade by-products qualify — never straw, husk, burnt, mouldy or pesticide-contaminated material.</div>`;
}
