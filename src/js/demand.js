// demand.js
// Buyer requests ("demand board"). Farmer sees these and can offer his batch.

// ---------- Buyer demand board (what buyers want) ----------
const KINDS = {
  feed: { e: "🐄", bg: "#FDEBCB", t: "Animal-feed unit" },
  fuel: { e: "🔥", bg: "#DDEBF8", t: "Biomass plant" },
  compost: { e: "🌱", bg: "#F9DDE6", t: "Compost producer" },
  mush: { e: "🍄", bg: "#FCE9D2", t: "Mushroom farm" },
  build: { e: "🏠", bg: "#E7DDF5", t: "Eco-build panels" },
};
let demand = [],
  did = 3000;
S.bname = "Ramesh Traders";
[
  ["Konark Cattle Feeds", "feed", "Rice Straw", 8, 3300, "Odisha", "Cuttack"],
  ["Eastern Bio-Power", "fuel", "Rice Straw", 20, 2700, "Odisha", "Jharsuguda"],
  ["GreenLeaf Compost Co.", "compost", "Wheat Straw", 6, 2100, "Bihar", "Patna"],
  ["Sahyadri Mushroom Farm", "mush", "Wheat Straw", 3, 2900, "Maharashtra", "Nashik"],
  ["Karnal Pellet Works", "fuel", "Corn Stalks", 12, 2600, "Haryana", "Karnal"],
  ["AgroBoard Panels", "build", "Rice Straw", 10, 2500, "Gujarat", "Ahmedabad"],
  ["Cauvery Compost Works", "compost", "Husk", 5, 1700, "Karnataka", "Mysuru"],
].forEach(([buyer, kind, crop, qty, price, state, city]) =>
  demand.push({
    id: "D" + ++did,
    buyer,
    kind,
    crop,
    qty,
    price,
    state,
    city,
    status: "Open",
    mine: false,
    filled: 0,
  }),
);
const openDemand = () => demand.filter((d) => d.status === "Open");
const dDist = (d) => distKm(S.state, S.city, d.state, d.city);
// finds a batch of the farmer which matches what the buyer wants (same crop, still available)
function myBatchFor(d) {
  const c = listings.filter((l) => l.mine && l.status === "Available" && l.crop === d.crop);
  return c.find((l) => l.qty <= d.qty) || c[0] || null;
}
// how much the farmer will earn = price x tonnes - transport - 250 handling
// transport = distance x 45 (rupees per km, rough rate)
function offerCalc(d, l) {
  const q = Math.min(l.qty, d.qty),
    dist = dDist(d),
    tr = Math.round(dist * 45 * (0.9 + q * 0.05));
  return { q, dist, tr, net: Math.round(d.price * q) - tr - 250 };
}
// html card of ONE buyer request (this is shown in the farmer app)
function demandCard(d) {
  const k = KINDS[d.kind],
    l = myBatchFor(d),
    c = l ? offerCalc(d, l) : null;
  return `<div class="item" data-act="ddetail" data-id="${d.id}">
    <div class="thumb" style="background:${k.bg}">${k.e}</div>
    <div class="imid"><b>${esc(d.buyer)}</b><small>${k.t} · ${esc(d.city)}, ${d.state}</small>
      <div class="meta">Needs <em>${d.qty} t ${d.crop}</em> · ${inr(d.price)}/t · ${dDist(d)} km</div>
      <div class="meta" style="color:var(--mu)">${c ? `Your ${c.q} t would net <em>${inr(c.net)}</em>` : `List a ${d.crop.toLowerCase()} batch to sell here`}</div></div>
    <div class="acts"><button class="cbtn" data-act="dcall" data-id="${d.id}" aria-label="Call buyer">📞</button><button class="obtn" data-act="offer" data-id="${d.id}">Offer</button></div></div>`;
}
// html card of the buyer's OWN requirement (shown in the buyer app)
function reqCard(d) {
  const k = KINDS[d.kind];
  return `<div class="item"><div class="thumb" style="background:${k.bg}">${k.e}</div>
    <div class="imid"><b>${d.crop} · ${d.qty} t open</b><small>${k.t} · ${esc(d.city)}, ${d.state}</small>
      <div class="meta"><em>${inr(d.price)}/t</em> · ${d.filled ? d.filled + " t already offered" : "waiting for farmers"}</div></div>
    <div class="acts"><span class="pill ${d.status === "Open" ? "" : "gry"}">${d.status}</span></div></div>`;
}
// farmer offers his batch to a buyer -> creates an order.
// If the batch is bigger than the need, only the needed tonnes are sold and the rest stays listed.
function offer(id) {
  const d = demand.find((x) => x.id === id);
  if (!d || d.status !== "Open") return;
  closeSheet();
  const l = myBatchFor(d);
  if (!l) {
    S.pre = d.crop;
    go("sell");
    toast(`List your ${d.crop.toLowerCase()} first — ${d.buyer} needs ${d.qty} t`);
    return;
  }
  const c = offerCalc(d, l),
    partial = l.qty > d.qty;
  d.qty = +(d.qty - c.q).toFixed(2);
  d.filled = (d.filled || 0) + c.q;
  if (d.qty <= 0) d.status = "Filled";
  if (partial) l.qty = +(l.qty - c.q).toFixed(2);
  createOrder({
    listingId: l.id,
    partial,
    crop: l.crop,
    qty: c.q,
    farmer: l.farmer,
    city: l.city + ", " + l.state,
    price: d.price,
    net: c.net,
    dist: c.dist,
    by: "farmer",
    buyer: d.buyer,
    destCity: d.city,
    destState: d.state,
  });
}
// popup form where the buyer writes what he needs
function postReqSheet() {
  sheet(`<h4>📝 Post a requirement</h4><p class="hi">Farmers near you will be notified and can offer their batch.</p>
    <label>Business name</label><input id="rName" value="${esc(S.bname)}">
    <div class="g2"><div><label>Crop residue needed</label><select id="rCrop">${Object.keys(CROPS)
      .map((c) => `<option>${c}</option>`)
      .join("")}</select></div>
    <div><label>Quantity (tonnes)</label><input type="number" id="rQty" value="5" min="0.5" step="0.5"></div>
    <div><label>Offer price (₹ / tonne)</label><input type="number" id="rPrice" value="${CROPS["Rice Straw"].p}" step="50"></div>
    <div><label>You will use it for</label><select id="rKind">${Object.entries(KINDS)
      .map(([k, v]) => `<option value="${k}">${v.t}</option>`)
      .join("")}</select></div></div>
    <div class="note">Delivery location: ${esc(S.city)}, ${S.state} (change it from the location pill)</div>
    <button class="btn" data-act="savereq">Post requirement</button>`);
}
document.addEventListener("change", (e) => {
  if (e.target.id === "rCrop") $("#rPrice").value = CROPS[e.target.value].p;
});
// saves the popup form as a new requirement and tells the farmers about it
function saveReq() {
  const crop = $("#rCrop").value,
    qty = parseFloat($("#rQty").value) || 1,
    price = parseInt($("#rPrice").value) || CROPS[crop].p,
    kind = $("#rKind").value,
    buyer = ($("#rName").value || "").trim() || S.bname;
  S.bname = buyer;
  demand.unshift({
    id: "D" + ++did + SUF,
    buyer,
    kind,
    crop,
    qty,
    price,
    state: S.state,
    city: S.city,
    status: "Open",
    mine: true,
    filled: 0,
  });
  closeSheet();
  notify("buyer", `Requirement posted: ${qty} t ${crop} at ${inr(price)}/t.`);
  notify("farmer", `New buyer near ${S.city}: ${buyer} needs ${qty} t ${crop} at ${inr(price)}/t.`);
  go("home");
}
