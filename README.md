# AI Crop-Waste Exchange 🌾

> Crop waste is not waste. It is a resource that nobody has found a buyer for yet.

A platform that helps farmers sell crop residue (rice straw, wheat straw, corn stalks, husk) to nearby buyers
instead of burning it. The farmer lists the batch, the app shows what every buyer will really pay after
transport, and both sides can track the order till the payment.

This repo has **three versions** of the same project:

| Version | Folder | For whom |
|---|---|---|
| 🧑‍🌾 **Farmer app** | `static/farmer/` | Farmers. Green app, can be installed on the phone (PWA) |
| 🛒 **Buyer app** | `static/buyer/` | Feed makers, biomass plants, compost units. Blue app, installable |
| 🌐 **Website** | `static/index.html` | Both roles in one responsive site (switch Farmer / Buyer on top) |

The Farmer app and the Buyer app are **separate apps** but they talk to each other through the backend
(`server.py`). When a farmer lists a batch the buyer sees it, when a buyer posts a requirement the farmer sees it.

---

## Problem
After harvest farmers have a lot of straw and husk but no easy way to know who will buy it and at what price.
Transport cost also eats the profit. So most of it is burned in the field, which pollutes the air and
damages the soil.

## Our solution
1. Farmer lists the crop waste (photo, quantity, place).
2. App gives a quality score and a price estimate.
3. Buyers are ranked by **net return = revenue - transport cost - handling cost**.
4. Farmer offers the batch (or a buyer requests it), both get notifications.
5. Order is tracked in 5 stages and ends with a **Waste-to-Value Passport** and a rating.

## Features
**Farmer app**
- Sell screen with AI price + quality estimate
- "Buyers near you" demand board with distance and how much *my* batch would earn
- Offer a batch to a buyer (partial quantity also works)
- Order tracking, notifications, wallet, ratings

**Buyer app**
- Browse listings (filter by crop, sort by distance / price / quality)
- Post a requirement ("I need 6 tonnes of rice straw at Rs 3500")
- Request an order, track it, rate the farmer

**Both**
- Distance between states / cities (haversine formula)
- 5 stage order tracker with a moving truck 🚚
- AI assistant: "what is the use of this product?" (animal feed, house building, biomass fuel, compost ...)
- What each state normally uses crop waste for
- Food & Drink ideas for food-grade by-products (RecipeDB, FlavorDB, CocktailDB)
- Works on phone and on laptop (flexbox layouts)

## Tech used
| Part | Technology |
|---|---|
| Frontend | HTML, CSS (flexbox), JavaScript (no framework) |
| Apps | PWA (manifest + service worker) |
| Backend | Python, FastAPI, httpx |
| Data APIs | RecipeDB, FlavorDB, CocktailDB (food by-products module) |
| Testing | pytest-style scripts, jsdom, Playwright |

## Folder structure
```
crop-waste-exchange/
├── src/                  <- the code we write
│   ├── index.html
│   ├── css/style.css
│   └── js/               data.js, demand.js, app.js, food.js, sync.js, main.js
├── static/               <- built files (website + farmer app + buyer app)
├── docs/                 <- copy of static/ for GitHub Pages
├── server.py             <- backend (FastAPI)
├── build_variants.py     <- joins src/ into website, farmer app, buyer app
├── tests/
├── requirements.txt      <- to run the project
├── requirements-dev.txt  <- to rebuild and test
├── Procfile              <- for hosting (Render / Railway)
└── .env.example
```

## How to run on your computer
```bash
pip install -r requirements.txt
cp .env.example .env          # on Windows: copy .env.example .env
uvicorn server:app --reload
```
Open
- http://localhost:8000/         -> website
- http://localhost:8000/farmer/  -> Farmer app
- http://localhost:8000/buyer/   -> Buyer app

Open the Farmer app in one tab and the Buyer app in another tab (or on two phones) to see the live sync.
To clear the shared data before a demo: send `POST /api/world/reset`.

### Changing the code
Edit the files inside `src/`, then run
```bash
pip install -r requirements-dev.txt   # only first time (Pillow is used to make the app icons)
python build_variants.py
```
This rebuilds `static/` and `docs/`.

## Putting it online
**Option 1: GitHub Pages (easy, demo mode).**
Repo -> Settings -> Pages -> Source: `main` branch, folder `/docs`. The apps will be at
`https://<your-username>.github.io/<repo-name>/farmer/` and `.../buyer/`.
There is no backend on GitHub Pages, so each app works alone with its own sample data.

**Option 2: Render / Railway (full version with live sync).**
Create a new web service from this repo. Build command: `pip install -r requirements.txt`.
Start command is in the `Procfile`. Add your keys in the *Environment* settings (never commit them).
Open `https://<your-app>/farmer/` on a phone and use *Add to Home screen* to install the app (needs https).

## Food & Drink module (RecipeDB / FlavorDB / CocktailDB)
Works only for **food-grade** by-products (wheat bran, rice bran, corn husk, citrus peel). Straw and husk are not edible.
Put your own API key in `.env` (`API_KEY=...`). Without a key the app shows sample data and says so (badge *Sample*).

| API | Endpoint |
|---|---|
| RecipeDB | `/recipe2-api/recipe-bytitle/recipeByTitle`, `/recipe2-api/recipes_cuisine/cuisine/{region}` |
| FlavorDB | `/flavordb/entities/by-entity-alias-readable`, `/flavordb/entities/by-name-and-category` |
| CocktailDB | set `COCKTAIL_MODE` and `COCKTAIL_PATH` in `.env` (see `.env.example`) |

## Tests
```bash
python tests/test_backend.py                  # backend + sync logic (offline, mock server)
npm install jsdom && node tests/ui_roles_test.js        # farmer vs buyer screens
pip install playwright && playwright install chromium
python tests/e2e_apps_test.py                 # both apps together in a real browser
```

## What is real and what is simulated
Being honest about the prototype:
- **Real:** the apps, the roles, orders, notifications, sync between the two apps, distance calculation,
  net return calculation, tracking, the backend and its tests.
- **Simulated:** the "AI" for crop type, quality and price uses simple formulas with random numbers around a
  base price. The AI assistant is keyword matching. Buyer names and prices in the demo are made up.
- **Not built yet:** login (JWT), real database (PostgreSQL), real payments.

## Future work
- Train a CNN (transfer learning) on residue photos to find the crop type and quality
- Price prediction model using mandi data
- Login with JWT and PostgreSQL
- Moisture sensors (IoT), satellite surplus map, carbon credit estimation

## Author
Made by **<your name>**, <your college>, <year>.  Guide: <guide name>.
