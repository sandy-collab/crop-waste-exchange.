// app.js
// Main part of the app: popups, navigation, home, market, sell, orders, dashboard, AI chat and the click handler.

// ---------- UI primitives ----------
// small message that comes on top of the screen for 3 seconds
function toast(t) {
  const el = document.createElement("div");
  el.className = "toast";
  el.innerHTML = t;
  $("#toasts").appendChild(el);
  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transition = "opacity .3s";
    setTimeout(() => el.remove(), 300);
  }, 3200);
}
// opens the bottom popup (called "sheet") with the given html
function sheet(html) {
  $("#sheet").innerHTML = '<div class="grab"></div>' + html;
  $("#sbg").classList.add("on");
}
// closes the popup
function closeSheet() {
  $("#sbg").classList.remove("on");
}
$("#sbg").addEventListener("click", (e) => {
  if (e.target.id === "sbg") closeSheet();
});

// adds a notification. aud = who should get it: 'farmer', 'buyer' or 'both'.
// Toast is shown only if it is for the user who is using the app right now.
function notify(aud, text) {
  const n = {
    nid: (SUF || "W") + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    aud,
    text,
    time: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
  };
  notifs.unshift(n);
  knownN.add(n.nid);
  if (aud === "both" || aud === S.role)
    toast(`<b>${aud === "both" ? "Update" : aud === "farmer" ? "Farmer" : "Buyer"}:</b> ${text}`);
  updateBell();
  syncSoon();
}
const relevant = () => notifs.filter((n) => n.aud === "both" || n.aud === S.role);
// red number on the bell icon = notifications not seen yet
function updateBell() {
  const n = relevant().length - seen[S.role];
  const el = $("#bellCount");
  el.style.display = n > 0 ? "flex" : "none";
  el.textContent = n;
}

// ---------- Navigation ----------
// makes the bottom menu. Farmer gets a Sell button, buyer gets a Post button.
// The items marked 1 are only for the desktop sidebar.
function buildNav() {
  const f = S.role === "farmer";
  const items = [
    ["home", "🏠", "Home"],
    ["market", f ? "🤝" : "🛒", f ? "Buyers" : "Market"],
    [f ? "sell" : "post", "＋", f ? "Sell" : "Post"],
    ["orders", "📦", "Orders"],
    ["ai", "🤖", "Assistant"],
    ["dash", "📊", "Dashboard", 1],
    ["uses", "📚", "Uses & Info", 1],
    ["food", "🍽️", "Food & Drink", 1],
  ];
  $("#nav").innerHTML = items
    .map(([id, ic, lb, dk]) =>
      id === "sell" || id === "post"
        ? `<button class="fab" data-act="${f ? "go" : "postreq"}" ${f ? 'data-s="sell"' : ""}><span class="ic">${ic}</span><span class="lb">${f ? "Sell crop waste" : "Post requirement"}</span></button>`
        : `<button class="${dk ? "dsk" : ""}" data-act="go" data-s="${id}" data-nav="${id}"><span class="ic">${ic}</span>${lb}</button>`,
    )
    .join("");
}
// opens a screen (home, market, orders ...) and draws it
function go(s) {
  S.screen = s;
  document.querySelectorAll(".screen").forEach((x) => x.classList.toggle("on", x.id === s));
  document.querySelectorAll("#nav [data-nav]").forEach((b) => b.classList.toggle("on", b.dataset.nav === s));
  const sub = s === "dash" || s === "uses" || s === "food";
  $("#backBtn").style.display = sub ? "block" : "none";
  $("#catWrap").style.display = s === "market" ? "block" : "none";
  if (s === "home") renderHome();
  if (s === "market") renderMarket();
  if (s === "orders") renderOrders();
  if (s === "dash") renderDash();
  if (s === "sell") initSell();
  if (s === "food") renderFood();
  window.scrollTo(0, 0);
}
// switch between farmer and buyer (only works in the website, the apps have a fixed role)
function setRole(r) {
  if (window.APP_ROLE && r !== window.APP_ROLE) return;
  S.role = r;
  document.querySelectorAll("#roleSeg button").forEach((b) => b.classList.toggle("on", b.dataset.r === r));
  S.mine = false;
  buildNav();
  updateBell();
  go("home");
}
// shows the current city and state in the top left
function locText() {
  $("#locText").textContent = S.city + ", " + S.state;
}

// ---------- Home ----------
// html card of ONE batch listed by a farmer
function listingCard(l) {
  const c = CROPS[l.crop],
    d = distKm(S.state, S.city, l.state, l.city),
    own = l.mine && S.role === "farmer";
  const thumb = l.photo ? `<img src="${l.photo}" alt="">` : c.e;
  let acts;
  if (own) acts = `<span class="pill ${l.status === "Available" ? "" : "gry"}">${l.status}</span>`;
  else
    acts =
      `<button class="cbtn" data-act="call" data-id="${l.id}" aria-label="Call">📞</button>` +
      (S.role === "buyer" && l.status === "Available"
        ? `<button class="pbtn" data-act="req" data-id="${l.id}" aria-label="Request order">+</button>`
        : "");
  return `<div class="item" data-act="detail" data-id="${l.id}">
    <div class="thumb" style="background:${c.bg}">${thumb}</div>
    <div class="imid"><b>${l.crop}</b><small>${own ? "You" : l.farmer} · ${l.city}, ${l.state}</small>
      <div class="meta"><em>${inr(l.price)}/t</em> · ${l.qty} t · ${d} km · Q${l.quality}</div></div>
    <div class="acts">${acts}</div></div>`;
}
// the part of the home screen that is different for farmer and buyer:
// farmer -> buyers near him + his batches, buyer -> his requirements + new listings
function roleSections(f) {
  if (f) {
    const dem = openDemand()
        .sort((a, b) => dDist(a) - dDist(b))
        .slice(0, 3),
      mine = listings.filter((l) => l.mine);
    return `<div class="row"><h3>Buyers near you</h3><button class="link" data-act="go" data-s="market">See all</button></div>
      <p class="hi" style="margin-top:-.4rem">Who needs residue right now, and what they will pay</p>
      <div class="flist">${dem.map(demandCard).join("") || '<div class="empty">No open buyer requests yet</div>'}</div>
      <div class="row"><h3>Your batches</h3>${mine.length > 3 ? '<button class="link" data-act="mybatches">See all</button>' : ""}</div>
      <div class="flist">${mine.slice(0, 3).map(listingCard).join("") || '<div class="card empty">You have not listed anything yet.<br><button class="btn" data-act="go" data-s="sell">List your first batch</button></div>'}</div>`;
  }
  const mineD = demand.filter((d) => d.mine),
    near = listings
      .filter((l) => l.status === "Available")
      .sort((a, b) => distKm(S.state, S.city, a.state, a.city) - distKm(S.state, S.city, b.state, b.city))
      .slice(0, 3);
  return `<div class="row"><h3>Your requirements</h3><button class="link" data-act="postreq">+ Post new</button></div>
    <div class="flist">${mineD.map(reqCard).join("") || '<div class="card empty">Tell farmers what you need and they will come to you.<br><button class="btn" data-act="postreq">Post a requirement</button></div>'}</div>
    <div class="row"><h3>Fresh listings near you</h3><button class="link" data-act="go" data-s="market">See all</button></div>
    <div class="flist">${near.map(listingCard).join("") || '<div class="empty">No listings yet</div>'}</div>`;
}
// draws the home screen
function renderHome() {
  const f = S.role === "farmer",
    comp = orders.filter((o) => o.stage === 4);
  const wallet = comp.reduce((s, o) => s + o.net, 0);
  const tiles =
    Object.entries(CROPS)
      .map(
        ([n, c]) =>
          `<button class="tile" style="background:${c.bg}" data-act="crop" data-c="${n}"><span class="em">${c.e}</span><span>${n}</span></button>`,
      )
      .join("") +
    USES.filter((u) => u.id !== "mush")
      .map(
        (u) =>
          `<button class="tile" style="background:${u.bg}" data-act="use" data-u="${u.id}"><span class="em">${u.e}</span><span>${u.s}</span></button>`,
      )
      .join("");
  $("#home").innerHTML = `
    <p class="hi">${f ? "Namaste, " + S.name + " 👋" : "Hello, Buyer 👋"}</p>
    <div class="banner"><span class="tag">UP TO ₹3,200 / TONNE</span>
      <h2>${f ? "Crop waste = Cash" : "Fresh residue near you"}</h2>
      <p>${f ? "AI finds the best buyer for your straw & husk" : "Verified listings with live distance & tracking"}</p>
      <button class="cta" data-act="go" data-s="${f ? "sell" : "market"}">${f ? "Sell now" : "Browse now"}</button><span class="art">👩‍🌾</span></div>
    <h3 style="margin-top:1.2rem">${f ? "What are you selling?" : "What are you looking for?"}</h3>
    <div class="grid3">${tiles}</div>
    <div class="quick">
      <button class="qcard" data-act="go" data-s="dash"><b>${f ? inr(wallet) : orders.length}</b><small>${f ? "Wallet · see dashboard ›" : "Orders · see dashboard ›"}</small></button>
      <button class="qcard" data-act="go" data-s="uses"><b>6 uses</b><small>Animal feed, houses & more ›</small></button>
      <button class="qcard" data-act="go" data-s="food"><b>🍽️ Food & drink</b><small>Recipes, flavours & drinks from food-grade by-products ›</small></button>
    </div>
    ${roleSections(f)}
    <div class="foot">${SYNC.ok ? "🔄 Live-synced with the " + (S.role === "farmer" ? "Buyer" : "Farmer") + " app · " : ""}🔒 Safe &amp; verified demo · all data simulated, no real payments</div>`;
}

// ---------- Market ----------
// draws the market screen. Farmer sees the buyer demand board, buyer sees the farmer listings.
function renderMarket() {
  const f = S.role === "farmer";
  $("#mtitle").textContent = f ? "Buyer demand board" : "Browse listings";
  $("#msub").textContent = f
    ? "Buyers who need crop residue right now — nearest first"
    : "Fresh batches from farmers across India";
  $("#mq").placeholder = f ? "Search buyer, crop, city…" : "Search straw, husk, city, farmer…";
  $("#mpost").innerHTML = f ? "" : '<button class="btn sm" data-act="postreq">+ Post requirement</button>';
  const sopts = f
    ? [
        ["distance", "Nearest first"],
        ["price", "Best price"],
        ["qty", "Biggest need"],
      ]
    : [
        ["distance", "Nearest first"],
        ["price", "Lowest price"],
        ["qty", "Most quantity"],
        ["quality", "Best quality"],
      ];
  if (!sopts.some((o) => o[0] === S.sort)) S.sort = "distance";
  $("#msort").innerHTML = sopts
    .map(([v, l]) => `<option value="${v}" ${S.sort === v ? "selected" : ""}>${l}</option>`)
    .join("");
  $("#mchips").innerHTML = ["All", ...Object.keys(CROPS)]
    .map(
      (c) =>
        `<button class="chip ${(c === "All" ? !S.filter : S.filter === c) ? "on" : ""}" data-act="chip" data-c="${c}">${c}</button>`,
    )
    .join("");
  const q = S.q.toLowerCase();
  if (f) {
    const list = openDemand().filter(
      (d) =>
        (!S.filter || d.crop === S.filter) &&
        (!q || (d.buyer + d.crop + d.city + d.state).toLowerCase().includes(q)),
    );
    const sorts = {
      distance: (a, b) => dDist(a) - dDist(b),
      price: (a, b) => b.price - a.price,
      qty: (a, b) => b.qty - a.qty,
    };
    list.sort(sorts[S.sort]);
    $("#mcount").textContent = list.length + " open requests";
    $("#mlist").innerHTML =
      list.map(demandCard).join("") || '<div class="empty">No buyer requests match.</div>';
  } else {
    const list = listings.filter(
      (l) =>
        l.status === "Available" &&
        (!S.filter || l.crop === S.filter) &&
        (!q || (l.crop + l.city + l.state + l.farmer).toLowerCase().includes(q)),
    );
    const d = (l) => distKm(S.state, S.city, l.state, l.city);
    const sorts = {
      distance: (a, b) => d(a) - d(b),
      price: (a, b) => a.price - b.price,
      qty: (a, b) => b.qty - a.qty,
      quality: (a, b) => b.quality - a.quality,
    };
    list.sort(sorts[S.sort]);
    $("#mcount").textContent = list.length + " listings";
    $("#mlist").innerHTML = list.map(listingCard).join("") || '<div class="empty">No listings match.</div>';
  }
}
$("#mq").addEventListener("input", (e) => {
  S.q = e.target.value;
  renderMarket();
});
$("#msort").addEventListener("change", (e) => {
  S.sort = e.target.value;
  renderMarket();
});

// ---------- Sell + AI analysis ----------
// fills the sell form (only first time) and sets city/state from the location
function initSell() {
  if (!$("#fCrop").options.length) {
    $("#fCrop").innerHTML = Object.keys(CROPS)
      .map((c) => `<option>${c}</option>`)
      .join("");
    $("#fState").innerHTML = stateOpts();
    $("#fState").addEventListener("change", stateNote);
    $("#fPhoto").addEventListener("change", (e) => {
      const f = e.target.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = (ev) => {
        S.photo = ev.target.result;
        $("#fPrev").src = S.photo;
        $("#fPrev").style.display = "block";
      };
      r.readAsDataURL(f);
    });
  }
  $("#fState").value = S.state;
  $("#fCity").value = S.city;
  stateNote();
  if (S.pre) {
    $("#fCrop").value = S.pre;
    S.pre = null;
  }
}
// shows what the selected state normally uses crop waste for
function stateNote() {
  $("#fNote").textContent = "In " + $("#fState").value + ": " + STATES[$("#fState").value].use;
}
// NOTE: this is NOT a real AI model. It only picks a quality score and a price near the base price using random numbers.
// In the real version a CNN (transfer learning) will find the crop type from the photo and a model will predict the price.
// Net return of each buyer = revenue - transport - handling.
function analyze() {
  const crop = $("#fCrop").value,
    qty = parseFloat($("#fQty").value) || 1,
    state = $("#fState").value,
    city = $("#fCity").value || "Village",
    farmer = $("#fName").value || "Farmer";
  S.name = farmer;
  S.state = state;
  S.city = city;
  locText();
  const conf = (88 + Math.random() * 9).toFixed(1),
    quality = Math.round(72 + Math.random() * 20),
    price = Math.round(CROPS[crop].p * (0.92 + Math.random() * 0.12));
  const l = {
    id: "L" + ++lid + SUF,
    crop,
    qty,
    state,
    city,
    farmer,
    price,
    quality,
    status: "Available",
    mine: true,
    photo: S.photo,
  };
  listings.unshift(l);
  notify("buyer", `New listing near ${city}: ${qty} t ${crop} from ${farmer} at ${inr(price)}/t.`);
  S.batch = { ...l, conf, listingId: l.id };
  S.matches = BUYERS.map((b) => {
    const bp = Math.round(price * b.f),
      rev = Math.round(bp * qty),
      dist = Math.round(4 + Math.random() * 24),
      tr = Math.round(dist * 45 * (0.9 + qty * 0.05));
    return { ...b, bp, rev, dist, tr, net: rev - tr - b.h };
  });
  renderSellOut();
}
// shows the analyze result and the buyers ranked as per the goal chosen (profit, distance, ...)
function renderSellOut() {
  const b = S.batch;
  if (!b) return;
  const m = [...S.matches],
    g = S.goal;
  const sorts = {
    profit: (x, y) => y.net - x.net,
    distance: (x, y) => x.dist - y.dist,
    local: (x, y) => x.dist - y.dist,
    pickup: (x, y) => x.pr - y.pr || y.net - x.net,
    price: (x, y) => y.bp - x.bp,
  };
  m.sort(sorts[g]);
  $("#sellOut").innerHTML = `
   <div class="card"><div class="row"><b>${CROPS[b.crop].e} ${b.crop}</b><span class="pill">${b.conf}% confidence</span></div>
     <div class="stats" style="margin-top:.7rem"><div class="stat"><b>${b.quality}/100</b><small>Quality (AI est.)</small></div><div class="stat"><b>${inr(b.price)}</b><small>Price / tonne</small></div><div class="stat"><b>${inr(b.price * b.qty)}</b><small>Batch value</small></div></div>
     <p class="hi" style="margin:.6rem 0 0;font-size:.66rem">Quality &amp; price are AI estimates; final check happens at pickup. Your batch is now live in Market.</p></div>
   <h3>AI-ranked buyers</h3>
   <div class="chips">${Object.entries(GOALS)
     .map(
       ([k, v]) => `<button class="chip ${g === k ? "on" : ""}" data-act="goal" data-g="${k}">${v}</button>`,
     )
     .join("")}</div>
   ${m
     .map(
       (
         x,
         i,
       ) => `<div class="card"><div class="mrow"><div class="thumb" style="background:${CROPS[b.crop].bg};width:46px;height:46px;font-size:1.5rem">${x.e}</div>
      <div><b style="font-size:.86rem">${x.type}</b>${i === 0 ? ' <span class="pill">Recommended</span>' : ""}<small style="display:block;font-size:.66rem;color:var(--mu)">${x.dist} km · pickup ${x.pick}</small></div>
      <div class="net"><b>${inr(x.net)}</b><small>net return</small></div></div>
      <div class="mdet">${inr(x.bp)}/t → ${inr(x.rev)} revenue − ${inr(x.tr)} transport − ${inr(x.h)} handling</div>
      <button class="btn sm" data-act="book" data-t="${x.type}">Book this buyer</button></div>`,
     )
     .join("")}`;
}

// ---------- Orders ----------
// makes a new order and sends notifications to both farmer and buyer
function createOrder(o) {
  o.id = "ORD-" + ++oid + SUF;
  o.t = Date.now();
  o.batchId = "B-" + Math.floor(100000 + Math.random() * 900000);
  o.stage = 0;
  o.rating = 0;
  orders.unshift(o);
  const l = listings.find((x) => x.id === o.listingId);
  if (l && !o.partial) l.status = "Booked";
  if (o.by === "farmer") {
    notify("farmer", `Order ${o.id} placed for ${o.qty}t ${o.crop} with ${o.buyer}.`);
    notify("buyer", `New order ${o.id}: ${o.qty}t ${o.crop} from ${o.farmer}.`);
  } else {
    notify("buyer", `Order ${o.id} requested: ${o.qty}t ${o.crop} from ${o.farmer}.`);
    notify("farmer", `${o.buyer} requested order ${o.id} for your ${o.qty}t ${o.crop}.`);
  }
  go("orders");
}
// draws the orders with the 5 step tracker, the route bar and the passport after payment
function renderOrders() {
  $("#orders").innerHTML =
    '<h3>My orders &amp; live tracking</h3><div class="flist">' +
    (orders.length
      ? [...orders]
          .sort((a, b) => (b.t || 0) - (a.t || 0))
          .map((o) => {
            const pct = Math.round((o.stage / 4) * 100),
              done = o.stage === 4,
              c = CROPS[o.crop];
            const stp = STAGES.map(
              (s, i) =>
                `<div class="s ${i < o.stage ? "d" : i === o.stage ? "c" : ""}"><i>${i < o.stage ? "✓" : i + 1}</i>${s}</div>`,
            ).join("");
            const dest = o.destCity ? `${o.destCity}, ${o.destState}` : o.buyer;
            const pp = done
              ? `<div class="pp"><div><span>Batch ID</span><span>${o.batchId}</span></div><div><span>Farmer</span><span>${o.farmer}</span></div><div><span>Waste type</span><span>${o.crop}</span></div><div><span>Quantity</span><span>${o.qty} t</span></div><div><span>Buyer</span><span>${o.buyer}</span></div><div><span>Farmer net return</span><span>${inr(o.net)}</span></div><div><span>Status</span><span class="pill">Completed</span></div></div>` +
                (S.role === "buyer"
                  ? `<div class="stars" data-oid="${o.id}">${[1, 2, 3, 4, 5].map((n) => `<span data-act="rate" data-n="${n}" class="${o.rating >= n ? "on" : ""}">★</span>`).join("")}</div>`
                  : `<p class="hi" style="margin-top:.5rem">${o.rating ? "Buyer rating: <b>" + o.rating + "/5</b> ★" : "Awaiting buyer rating"}</p>`)
              : "";
            return `<div class="card"><div class="otop"><b>${c.e} ${o.id}</b><span class="pill ${done ? "" : "amb"}">${done ? "Completed" : STAGES[o.stage]}</span></div>
      <small style="color:var(--mu);font-size:.7rem">${o.qty} t ${o.crop} · ${o.buyer}</small>
      <div class="stp">${stp}</div>
      <div class="route"><span class="pt">${o.city}</span><div class="bar"><i style="width:${pct}%"></i><em style="left:${pct}%">🚚</em></div><span class="pt">${dest}</span></div>
      <small style="color:var(--mu);font-size:.66rem">${o.dist} km · ${pct}% of the journey</small>${pp}
      ${done ? "" : `<button class="btn sm" style="margin-top:.7rem" data-act="adv" data-id="${o.id}">Advance to next stage →</button>`}</div>`;
          })
          .join("")
      : '<div class="empty">No orders yet.<br>Book a buyer or request a listing to start tracking.</div>') +
    "</div>";
}
// moves an order to the next stage (Placed -> Confirmed -> Pickup -> Picked up -> Paid)
function advance(id) {
  const o = orders.find((x) => x.id === id);
  if (!o || o.stage >= 4) return;
  o.stage++;
  notify(
    "both",
    [
      "",
      `Order ${o.id} confirmed by buyer.`,
      `Pickup scheduled for ${o.id}.`,
      `${o.id} picked up — in transit.`,
      `Payment completed for ${o.id}. Waste-to-Value Passport issued.`,
    ][o.stage],
  );
  if (o.stage === 4 && !o.partial) {
    const l = listings.find((x) => x.id === o.listingId);
    if (l) l.status = "Sold";
  }
  renderOrders();
}

// ---------- Dashboard / Uses ----------
// draws the dashboard numbers and bars
function renderDash() {
  const f = S.role === "farmer",
    comp = orders.filter((o) => o.stage === 4),
    rated = comp.filter((o) => o.rating);
  const wallet = comp.reduce((s, o) => s + o.net, 0),
    spent = comp.filter((o) => o.by === "buyer").reduce((s, o) => s + o.price * o.qty, 0);
  const avg = rated.length ? (rated.reduce((s, o) => s + o.rating, 0) / rated.length).toFixed(1) : "–";
  const st = f
    ? [
        [inr(wallet), "Wallet"],
        [listings.filter((l) => l.mine).length, "My listings"],
        [avg, "Avg rating"],
      ]
    : [
        [orders.length, "Orders"],
        [inr(spent), "Spent"],
        [listings.filter((l) => l.status === "Available").length, "Available"],
      ];
  const by = Object.keys(CROPS).map((c) => [
    c,
    listings.filter((l) => l.crop === c && l.status === "Available").reduce((s, l) => s + l.qty, 0),
  ]);
  const mx = Math.max(1, ...by.map((x) => x[1])),
    wk = [6, 9, 8, 14, 17, 21];
  $("#dash").innerHTML =
    `<h3>Dashboard</h3><div class="stats">${st.map(([n, l]) => `<div class="stat"><b>${n}</b><small>${l}</small></div>`).join("")}</div>
   <div class="row2" style="margin-top:.8rem"><div class="card"><b style="font-size:.85rem">Waste available by type</b>${by.map(([c, q]) => `<div class="hb"><span>${c}</span><div><i style="width:${(q / mx) * 100}%"></i></div><b>${q} t</b></div>`).join("")}</div>
   <div class="card"><b style="font-size:.85rem">Transactions · last 6 weeks (demo)</b><div class="vb">${wk.map((v, i) => `<div><i style="height:${v * 4}px"></i>W${i + 1}</div>`).join("")}</div></div></div>`;
}
$("#useGrid").innerHTML = USES.map(
  (u) =>
    `<div class="ucard" style="background:${u.bg}"><div class="em">${u.e}</div><b>${u.t}</b><p>${u.x}</p></div>`,
).join("");
$("#uState").innerHTML = stateOpts();
$("#uState").addEventListener("change", uNote);
function uNote() {
  $("#uNote").textContent = "In " + $("#uState").value + ": " + STATES[$("#uState").value].use;
}
uNote();

// ---------- AI assistant ----------
// adds one message in the chat window
function addMsg(r, h) {
  const d = document.createElement("div");
  d.className = "msg " + r;
  d.innerHTML = h;
  $("#chat").appendChild(d);
  $("#chat").scrollTop = 1e6;
}
// NOTE: simple keyword matching, not a real AI. It checks the words of the question (animal, house, fuel ...)
// and gives the matching answer from the USES list. A real LLM can be connected later.
function answer(q) {
  q = q.toLowerCase();
  for (const s in STATES) if (q.includes(s.toLowerCase())) return `📍 <b>${s}:</b> ${STATES[s].use}`;
  const m = USES.filter((u) => u.k.some((k) => q.includes(k)));
  if (m.length) return m.map((u) => `${u.e} <b>${u.t}:</b> ${u.x}`).join("<br><br>");
  if (/use|product|waste|straw|husk|stalk/.test(q))
    return (
      "This crop residue can be used for:<br><br>" +
      USES.map((u) => `${u.e} <b>${u.t}</b> — ${u.x}`).join("<br><br>")
    );
  return "I'm a simple demo assistant — ask about animal feed, house building, biomass fuel, compost, mushrooms, biogas, or a state's typical use.";
}
// user asks a question in the chat
function ask(t) {
  t = (t || "").trim();
  if (!t) return;
  addMsg("u", t);
  $("#aq").value = "";
  setTimeout(() => addMsg("a", answer(t)), 350);
}
$("#aiChips").innerHTML = [
  "What is the use of this product?",
  "Can animals eat rice straw?",
  "Can it be used to build a house?",
  "What is it used for in Punjab?",
]
  .map((t) => `<button class="chip" data-act="chip-ai">${t}</button>`)
  .join("");
$("#aq").addEventListener("keydown", (e) => {
  if (e.key === "Enter") ask($("#aq").value);
});
addMsg(
  "a",
  "Hi! 👋 I'm your AI assistant. Ask me <b>what is the use of this product</b> — animal feed, building houses, fuel and more.",
);

// ---------- Actions (event delegation) ----------
document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-act]");
  if (!t) return;
  const a = t.dataset.act,
    id = t.dataset.id;
  if (a === "detail" && e.target.closest(".acts")) return;
  if (a === "go") go(t.dataset.s);
  else if (a === "role") setRole(t.dataset.r);
  else if (a === "bell") {
    seen[S.role] = relevant().length;
    updateBell();
    sheet(
      "<h4>🔔 Notifications</h4>" +
        (relevant()
          .map(
            (n) =>
              `<div class="ni">${n.text}<small>${n.aud === "both" ? "update" : n.aud} · ${n.time}</small></div>`,
          )
          .join("") || '<div class="empty">Nothing yet</div>'),
    );
  } else if (a === "loc")
    (sheet(
      `<h4>📍 Set your location</h4><label>State</label><select id="lState">${stateOpts()}</select><label>City / village</label><input id="lCity" value="${S.city}"><button class="btn" data-act="saveloc">Save location</button>`,
    ),
      ($("#lState").value = S.state));
  else if (a === "saveloc") {
    S.state = $("#lState").value;
    S.city = $("#lCity").value || S.city;
    locText();
    closeSheet();
    go(S.screen);
    toast("Location updated — distances recalculated");
  } else if (a === "crop") {
    S.filter = t.dataset.c;
    S.mine = false;
    go("market");
  } else if (a === "use") {
    const u = USES.find((x) => x.id === t.dataset.u);
    sheet(
      `<h4>${u.e} ${u.t}</h4><p style="font-size:.84rem;line-height:1.5">${u.x}</p><div class="note">In ${S.state}: ${STATES[S.state].use}</div><button class="btn" data-act="askuse" data-q="What is the use of ${u.t.toLowerCase()}?">Ask AI more</button>`,
    );
  } else if (a === "askuse") {
    closeSheet();
    go("ai");
    ask(t.dataset.q);
  } else if (a === "cats")
    sheet(
      '<h4>Category</h4><div class="chips" style="flex-wrap:wrap">' +
        ["All", ...Object.keys(CROPS)]
          .map(
            (c) =>
              `<button class="chip ${(c === "All" ? !S.filter : S.filter === c) ? "on" : ""}" data-act="catpick" data-c="${c}">${c}</button>`,
          )
          .join("") +
        "</div>",
    );
  else if (a === "catpick") {
    S.filter = t.dataset.c === "All" ? "" : t.dataset.c;
    S.mine = false;
    closeSheet();
    renderMarket();
  } else if (a === "chip") {
    S.mine = false;
    S.filter = t.dataset.c === "All" ? "" : t.dataset.c;
    renderMarket();
  } else if (a === "call") {
    const l = listings.find((x) => x.id === id);
    toast(`📞 Calling ${l.farmer}… (demo)`);
  } else if (a === "req") {
    const l = listings.find((x) => x.id === id),
      d = distKm(S.state, S.city, l.state, l.city),
      tr = d * 45;
    createOrder({
      listingId: l.id,
      crop: l.crop,
      qty: l.qty,
      farmer: l.farmer,
      city: l.city + ", " + l.state,
      price: l.price,
      net: l.price * l.qty - tr - 200,
      dist: d,
      by: "buyer",
      buyer: "Ramesh Traders",
      destCity: S.city,
      destState: S.state,
    });
  } else if (a === "detail") {
    const l = listings.find((x) => x.id === id),
      d = distKm(S.state, S.city, l.state, l.city),
      c = CROPS[l.crop],
      own = l.mine && S.role === "farmer";
    sheet(`<div class="row"><h4>${c.e} ${l.crop}</h4><span class="pill">${l.status}</span></div>
      <div class="stats"><div class="stat"><b>${inr(l.price)}</b><small>per tonne</small></div><div class="stat"><b>${l.qty} t</b><small>quantity</small></div><div class="stat"><b>${d} km</b><small>from you</small></div></div>
      <p style="font-size:.8rem;margin:.8rem 0 .2rem"><b>${own ? "You" : l.farmer}</b> · ${l.city}, ${l.state} · Quality ${l.quality}/100</p>
      <div class="note">Typical use in ${l.state}: ${STATES[l.state].use}</div>
      <button class="btn ghost" data-act="askuse" data-q="What is the use of ${l.crop.toLowerCase()}?">🤖 What is this used for?</button>
      ${!own ? `<button class="btn" data-act="callreq" data-id="${l.id}">${S.role === "buyer" && l.status === "Available" ? "Request order" : "Call farmer"}</button>` : ""}`);
  } else if (a === "callreq") {
    closeSheet();
    const l = listings.find((x) => x.id === id);
    if (S.role === "buyer" && l.status === "Available") {
      document.querySelector(`[data-act="req"][data-id="${id}"]`)?.click() ||
        toast("Open Market to request this");
    } else toast(`📞 Calling ${l.farmer}… (demo)`);
  } else if (a === "food") {
    S.food = t.dataset.f;
    renderFood();
  } else if (a === "offer") offer(id);
  else if (a === "dcall") {
    const d = demand.find((x) => x.id === id);
    toast(`📞 Calling ${d.buyer}… (demo)`);
  } else if (a === "postreq") postReqSheet();
  else if (a === "savereq") saveReq();
  else if (a === "mybatches")
    sheet(
      "<h4>Your batches</h4>" +
        (listings
          .filter((l) => l.mine)
          .map(listingCard)
          .join("") || '<div class="empty">Nothing listed yet</div>'),
    );
  else if (a === "ddetail") {
    const d = demand.find((x) => x.id === id),
      k = KINDS[d.kind],
      l = myBatchFor(d),
      c = l ? offerCalc(d, l) : null;
    sheet(`<div class="row"><h4>${k.e} ${esc(d.buyer)}</h4><span class="pill">${d.status}</span></div>
      <p class="hi" style="margin:-.3rem 0 .6rem">${k.t} · ${esc(d.city)}, ${d.state}</p>
      <div class="stats"><div class="stat"><b>${d.qty} t</b><small>needed</small></div><div class="stat"><b>${inr(d.price)}</b><small>per tonne</small></div><div class="stat"><b>${dDist(d)} km</b><small>from you</small></div></div>
      ${c ? `<div class="note"><b>AI estimate for your ${l.qty} t batch:</b> ${inr(d.price * c.q)} revenue − ${inr(c.tr)} transport − ₹250 handling = <b>${inr(c.net)}</b> net${l.qty > d.qty ? ` (partial order: they need only ${d.qty} t)` : ""}</div>` : `<div class="note">You have no available ${d.crop.toLowerCase()} batch yet. List one to sell to this buyer.</div>`}
      <div class="note">Typical use in ${d.state}: ${STATES[d.state].use}</div>
      <button class="btn" data-act="offer" data-id="${d.id}">${l ? "Offer my batch" : "List a " + d.crop.toLowerCase() + " batch"}</button>`);
  } else if (a === "analyze") analyze();
  else if (a === "goal") {
    S.goal = t.dataset.g;
    renderSellOut();
  } else if (a === "book") {
    const x = S.matches.find((m) => m.type === t.dataset.t),
      b = S.batch;
    createOrder({
      listingId: b.listingId,
      crop: b.crop,
      qty: b.qty,
      farmer: b.farmer,
      city: b.city + ", " + b.state,
      price: x.bp,
      net: x.net,
      dist: x.dist,
      by: "farmer",
      buyer: x.type,
    });
  } else if (a === "adv") advance(id);
  else if (a === "rate") {
    const o = orders.find((x) => x.id === t.parentElement.dataset.oid);
    o.rating = +t.dataset.n;
    notify("farmer", `Order ${o.id} rated ${o.rating}/5 by ${o.buyer}.`);
    renderOrders();
  } else if (a === "send") ask($("#aq").value);
  else if (a === "chip-ai") ask(t.textContent);
});
