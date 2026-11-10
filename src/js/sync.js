// sync.js
// Keeps the Farmer app and the Buyer app in sync using our backend (/api/world/sync).
// If there is no backend nothing happens and each app works alone with its own sample data.

// ---------- Live sync between the Farmer app and the Buyer app (active only when the backend is running) ----------
const SYNC = { ok: false, since: 0, snap: {}, sent: new Set(), busy: false, timer: null, fail: 0 };
const sig = (o) => JSON.stringify(o, (k, v) => (k === "v" || k === "_rev" ? undefined : v));
const COLS = () => ({ listings, demand, orders });
// sync again after a short wait (called after something changes)
function syncSoon() {
  if (SYNC.ok) {
    clearTimeout(SYNC.timer);
    SYNC.timer = setTimeout(syncNow, 150);
  }
}
// draws the current screen again after new data came from the server
function rerender() {
  const s = S.screen;
  if (s === "home") renderHome();
  else if (s === "market") renderMarket();
  else if (s === "orders") renderOrders();
  else if (s === "dash") renderDash();
}
// after a restart, move the id counters ahead of the ids already on the server so new ids dont repeat
function rebase() {
  const mx = (arr, re) =>
    arr.reduce((m, x) => {
      const k = re.exec(x.id);
      return k ? Math.max(m, +k[1]) : m;
    }, 0);
  lid = Math.max(lid, mx(listings, /^L(\d+)/));
  did = Math.max(did, mx(demand, /^D(\d+)/));
  oid = Math.max(oid, mx(orders, /^ORD-(\d+)/));
}
// 1) find items that changed on this phone  2) send them  3) take the newer items that came back
async function syncNow() {
  if (SYNC.busy || !SYNC.ok) return;
  SYNC.busy = true;
  try {
    const changes = {};
    for (const [name, arr] of Object.entries(COLS())) {
      changes[name] = [];
      for (const it of arr) {
        if (SYNC.snap[name + it.id] !== sig(it)) {
          it.v = (it.v || 0) + 1;
          changes[name].push(it);
        }
      }
    }
    const fresh = notifs.filter((n) => !SYNC.sent.has(n.nid));
    const r = await fetch("/api/world/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ since: SYNC.since, changes, notifs: fresh }),
    });
    if (!r.ok) throw new Error("sync " + r.status);
    const w = await r.json();
    for (const [name, arr] of Object.entries(changes))
      for (const it of arr) SYNC.snap[name + it.id] = sig(it);
    fresh.forEach((n) => SYNC.sent.add(n.nid));
    let changed = false;
    for (const [name, arr] of Object.entries(COLS())) {
      for (const rit of w[name] || []) {
        const i = arr.findIndex((x) => x.id === rit.id),
          local = arr[i];
        if (local && (local.v || 0) > (rit.v || 0)) continue; // newer local edit not sent yet
        if (local && sig(local) === sig(rit)) {
          local.v = rit.v;
          SYNC.snap[name + rit.id] = sig(rit);
          continue;
        }
        if (i >= 0) arr[i] = rit;
        else arr.push(rit);
        SYNC.snap[name + rit.id] = sig(rit);
        changed = true;
      }
    }
    for (const n of w.notifs || []) {
      SYNC.sent.add(n.nid);
      if (knownN.has(n.nid)) continue;
      knownN.add(n.nid);
      notifs.unshift(n);
      changed = true;
      if (n.aud === "both" || n.aud === S.role)
        toast(`<b>${n.aud === "both" ? "Update" : n.aud === "farmer" ? "Farmer" : "Buyer"}:</b> ${n.text}`);
    }
    SYNC.since = w.rev;
    SYNC.fail = 0;
    rebase();
    if (changed) {
      updateBell();
      rerender();
    }
  } catch (e) {
    if (++SYNC.fail > 3) SYNC.ok = false;
  } finally {
    SYNC.busy = false;
  }
}
// checks if the backend is there, if yes starts syncing every 2.5 seconds
async function initSync() {
  try {
    const r = await fetch("/api/world/health");
    if (!r.ok) return;
    const j = await r.json();
    if (!j.ok) return;
    SYNC.ok = true;
  } catch (e) {
    return;
  }
  await syncNow();
  rerender();
  setInterval(() => {
    if (SYNC.ok) syncNow();
  }, 2500);
}
