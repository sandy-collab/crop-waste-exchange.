// data.js
// All the fixed data of the app (states, crops, uses, buyer types) + small helper functions.
// Everything here is demo data. The numbers (prices etc.) are only for demonstration.

// short name for document.querySelector
const $ = (s) => document.querySelector(s);
// shows a number as rupees, e.g. 3200 -> ₹3,200
const inr = (n) => "₹" + Math.round(n).toLocaleString("en-IN");

// ---------- Reference data ----------
// state name -> lat/lng of the capital (for distance) + what the crop waste is mostly used for there
const STATES = {
  Odisha: {
    lat: 20.27,
    lng: 85.84,
    use: "Widely used as cattle fodder and as a growing substrate for mushroom cultivation.",
  },
  Punjab: {
    lat: 31.63,
    lng: 74.87,
    use: "Large paddy-wheat surplus makes it a major feedstock hub for biomass power plants.",
  },
  Haryana: {
    lat: 29.06,
    lng: 76.09,
    use: "Commonly supplied to biomass co-firing power plants and paper mills.",
  },
  Bihar: {
    lat: 25.61,
    lng: 85.14,
    use: "Traditionally used as cattle fodder and for thatching rural rooftops.",
  },
  "Uttar Pradesh": {
    lat: 26.85,
    lng: 80.95,
    use: "Sugar-mill belt; residue supports bagasse-based cogeneration.",
  },
  Maharashtra: {
    lat: 19.08,
    lng: 72.88,
    use: "Used in sugar-mill biomass cogeneration and vermi-compost units.",
  },
  "Madhya Pradesh": {
    lat: 23.26,
    lng: 77.41,
    use: "Often processed into compressed biomass fuel pellets and briquettes.",
  },
  Karnataka: {
    lat: 12.97,
    lng: 77.59,
    use: "Popular as mushroom-farming substrate and for organic compost.",
  },
  "Tamil Nadu": {
    lat: 13.08,
    lng: 80.27,
    use: "Used in paper-pulp mills and biogas plants near dairy clusters.",
  },
  "West Bengal": {
    lat: 22.57,
    lng: 88.36,
    use: "Common in jute-paper mills and household biogas digesters.",
  },
  Gujarat: {
    lat: 23.03,
    lng: 72.58,
    use: "Increasingly used in eco-friendly straw-board construction panels.",
  },
  Rajasthan: {
    lat: 26.91,
    lng: 75.79,
    use: "Used as cattle fodder and for low-cost mud-straw house insulation.",
  },
  Assam: { lat: 26.14, lng: 91.73, use: "Traditionally used for thatched roofing and handicraft material." },
  Kerala: { lat: 8.52, lng: 76.94, use: "Used in coir-composite boards and organic-farming compost." },
  Telangana: {
    lat: 17.38,
    lng: 78.49,
    use: "Growing use in biomass gasification units and fuel briquetting.",
  },
};
// crop residue types: emoji, base price in rupees per tonne, tile colour
const CROPS = {
  "Rice Straw": { e: "🌾", p: 3200, bg: "#DDF0DA" },
  "Wheat Straw": { e: "🌿", p: 2800, bg: "#FDE9E0" },
  "Corn Stalks": { e: "🌽", p: 2400, bg: "#FBEFCB" },
  Husk: { e: "🌰", p: 1800, bg: "#D9F0EA" },
};
// the 6 uses of crop waste. 'k' = keywords which the AI chat looks for in the question
const USES = [
  {
    id: "feed",
    e: "🐄",
    t: "Animal Feed",
    s: "Animal Feed",
    bg: "#FDEBCB",
    k: ["animal", "cattle", "feed", "eat", "fodder", "cow", "buffalo", "goat"],
    x: "Rice and wheat straw are a low-cost roughage feed for cattle, buffalo and goats after basic treatment.",
  },
  {
    id: "build",
    e: "🏠",
    t: "Eco-Friendly Construction",
    s: "Eco-Build",
    bg: "#E7DDF5",
    k: ["house", "home", "construction", "build", "wall", "roof", "brick"],
    x: "Compressed straw bales and straw-board panels are used as insulation and wall material in low-cost eco-friendly housing.",
  },
  {
    id: "fuel",
    e: "🔥",
    t: "Biomass Fuel",
    s: "Biomass Fuel",
    bg: "#DDEBF8",
    k: ["fuel", "biomass", "energy", "power", "burn", "pellet"],
    x: "Dried residue is compressed into pellets or briquettes and used in power plants as a coal alternative.",
  },
  {
    id: "compost",
    e: "🌱",
    t: "Compost & Fertiliser",
    s: "Compost",
    bg: "#F9DDE6",
    k: ["compost", "fertiliser", "fertilizer", "soil", "manure"],
    x: "Decomposed residue enriches soil as organic compost and reduces dependence on chemical fertiliser.",
  },
  {
    id: "mush",
    e: "🍄",
    t: "Mushroom Cultivation",
    s: "Mushroom",
    bg: "#FCE9D2",
    k: ["mushroom", "fungus"],
    x: "Straw is a popular growing substrate for oyster and button mushroom farming.",
  },
  {
    id: "gas",
    e: "💨",
    t: "Biogas Feedstock",
    s: "Biogas",
    bg: "#E0F1EC",
    k: ["biogas", "gas", "cooking"],
    x: "Residue can be fed into biogas digesters along with cattle dung to make clean cooking gas.",
  },
];
// types of buyers used for the ranking. f = fraction of the base price they pay, h = handling cost
const BUYERS = [
  { type: "Animal Feed Buyer", e: "🐄", f: 1.0, h: 300, pick: "Today", pr: 0 },
  { type: "Biomass Fuel Buyer", e: "🔥", f: 0.82, h: 250, pick: "In 2 days", pr: 1 },
  { type: "Compost Producer", e: "🌱", f: 0.56, h: 200, pick: "Today", pr: 0 },
];
const GOALS = {
  profit: "Max Profit",
  distance: "Min Distance",
  pickup: "Fastest Pickup",
  price: "Best Price",
  local: "Sustainable / Local",
};
const STAGES = ["Placed", "Confirmed", "Pickup", "Picked up", "Paid"];

// ---------- Helpers ----------
// turns a text into a number. We use it so the distance between the same two cities
// is always the same (otherwise it changes on every refresh)
function hash(s) {
  let h = 7;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}
// distance in km between two places.
// Different states -> haversine formula using lat/lng of the state capital.
// Same state -> small number made from the city names (we dont have city coordinates)
function distKm(s1, c1, s2, c2) {
  c1 = (c1 || "").toLowerCase();
  c2 = (c2 || "").toLowerCase();
  if (s1 === s2) return c1 === c2 ? 6 : 12 + (hash(c1 + "|" + c2) % 34);
  const a = STATES[s1],
    b = STATES[s2],
    R = 6371,
    r = (d) => (d * Math.PI) / 180;
  const x =
    Math.sin(r(b.lat - a.lat) / 2) ** 2 +
    Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(x)));
}
// makes the <option> list of all states for the dropdowns
const stateOpts = () =>
  Object.keys(STATES)
    .map((s) => `<option>${s}</option>`)
    .join("");

// ---------- App state ----------
const S = {
  role: window.APP_ROLE || "farmer",
  screen: "home",
  state: "Odisha",
  city: "Bhubaneswar",
  name: "Demo Farmer",
  filter: "",
  mine: false,
  q: "",
  sort: "distance",
  goal: "profit",
  photo: null,
  batch: null,
  matches: [],
};
let listings = [],
  orders = [],
  notifs = [],
  seen = { farmer: 0, buyer: 0 },
  lid = 2000,
  oid = 1000;
const SUF = window.APP_ROLE ? window.APP_ROLE[0].toUpperCase() : ""; // keeps ids unique across the two apps
const knownN = new Set();
if (window.APP_ROLE === "buyer") {
  S.city = "Cuttack";
}
[
  ["Rice Straw", 5, "Odisha", "Cuttack", "Ramesh Sahu", 3100, 82],
  ["Wheat Straw", 3, "Bihar", "Patna", "Suresh Yadav", 2700, 78],
  ["Corn Stalks", 6, "Maharashtra", "Nashik", "Ganesh Patil", 2300, 85],
  ["Husk", 2, "Haryana", "Karnal", "Baljeet Singh", 1750, 74],
  ["Rice Straw", 4, "Odisha", "Bhubaneswar", "Sunita Behera", 3050, 88],
].forEach(([crop, qty, state, city, farmer, price, quality]) =>
  listings.push({
    id: "L" + ++lid,
    crop,
    qty,
    state,
    city,
    farmer,
    price,
    quality,
    status: "Available",
    mine: false,
  }),
);
