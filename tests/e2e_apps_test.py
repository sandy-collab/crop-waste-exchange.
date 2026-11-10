"""Full test: opens the Farmer app and the Buyer app in a browser and checks that they share data through the backend.
Needs:  pip install playwright   and   playwright install chromium
Run:    python tests/e2e_apps_test.py"""
import os, sys, tempfile, pathlib
os.environ["WORLD_FILE"] = os.path.join(tempfile.mkdtemp(), "world.json")
ROOT = pathlib.Path(__file__).resolve().parent.parent; sys.path.insert(0, str(ROOT))
from starlette.testclient import TestClient
from playwright.sync_api import sync_playwright
import server

client = TestClient(server.app)
def bridge(route, request):                      # serve http://app.test/* from the real FastAPI app, in-process
    path = request.url.split("app.test", 1)[1]
    if path.startswith("/api/food"):
        return route.abort()                         # food APIs need a key; the apps fall back to sample data
    r = client.request(request.method, path, content=request.post_data_buffer, headers={"content-type": "application/json"}, follow_redirects=False)
    route.fulfill(status=r.status_code, body=r.content, headers={"content-type": r.headers.get("content-type", "text/plain"), **({"location": r.headers["location"]} if "location" in r.headers else {})})

fails = 0
def ok(cond, msg):
    global fails; print(("PASS " if cond else "FAIL ") + msg); fails += (not cond)

with sync_playwright() as p:
    b = p.chromium.launch()
    def open_app(role):
        pg = b.new_page(viewport={"width": 390, "height": 800})
        pg.route("**/*fonts.g*", lambda r: r.abort()); pg.route("http://app.test/**", bridge)
        pg.goto(f"http://app.test/{role}/"); pg.wait_for_timeout(500); return pg
    F, B = open_app("farmer"), open_app("buyer")
    nav = lambda pg: [t.strip() for t in pg.locator("#nav button").all_inner_texts()]
    ok(not F.locator("#roleSeg").is_visible() and not B.locator("#roleSeg").is_visible(), "no Farmer/Buyer switch inside either app")
    ok(nav(F)[:2] == ["🏠\nHome", "🤝\nBuyers"] and F.locator("#nav .fab .lb").inner_text() == "Sell crop waste", f"farmer nav = Home, Buyers, Sell…  {nav(F)}")
    ok(nav(B)[:2] == ["🏠\nHome", "🛒\nMarket"] and B.locator("#nav .fab .lb").inner_text() == "Post requirement", f"buyer nav = Home, Market, Post…  {nav(B)}")
    ok("Buyers near you" in F.locator("#home").inner_text() and "Fresh listings near you" in B.locator("#home").inner_text(), "different home screens")
    F.wait_for_function("document.querySelector('.foot') && document.querySelector('.foot').innerText.includes('Live-synced')", timeout=8000)
    ok(True, "both apps connected to the shared backend (footer says Live-synced)")

    # 1) farmer lists a batch -> buyer sees it
    F.click("#nav .fab"); F.fill("#fName", "Sunita Devi"); F.select_option("#fCrop", "Rice Straw"); F.fill("#fQty", "4"); F.click('[data-act="analyze"]')
    B.click('#nav [data-nav="market"]')
    B.wait_for_function("document.querySelector('#mlist').innerText.includes('Sunita Devi')", timeout=9000)
    ok(True, "farmer's new batch appears in the buyer app")
    ok(int(B.locator("#bellCount").inner_text() or 0) >= 1, "buyer got a notification about the new listing")

    # 2) buyer requests it -> farmer sees the order
    B.locator('#mlist .item', has_text="Sunita Devi").locator('[data-act="req"]').click()
    F.click('#nav [data-nav="orders"]')
    F.wait_for_function("document.querySelector('#orders').innerText.includes('ORD-')", timeout=9000)
    ok(True, "buyer's order shows up in the farmer app")

    # 3) farmer advances it -> buyer sees the new stage
    F.locator('#orders [data-act="adv"]').first.click(); F.locator('#orders [data-act="adv"]').first.click()
    B.click('#nav [data-nav="orders"]')
    B.wait_for_function("document.querySelector('#orders').innerText.includes('Pickup')", timeout=9000)
    ok(True, "stage changes made in the farmer app reach the buyer app")

    # 4) buyer posts a requirement -> farmer sees it and can offer
    B.click("#nav .fab"); B.fill("#rName", "Mahanadi Feeds"); B.select_option("#rCrop", "Rice Straw"); B.fill("#rQty", "6"); B.fill("#rPrice", "3600"); B.click('[data-act="savereq"]')
    F.click('#nav [data-nav="market"]')
    F.wait_for_function("document.querySelector('#mlist').innerText.includes('Mahanadi Feeds')", timeout=9000)
    ok(True, "buyer's requirement appears on the farmer's demand board")
    F.click("#nav .fab"); F.select_option("#fCrop", "Rice Straw"); F.fill("#fQty", "3"); F.click('[data-act="analyze"]')
    F.click('#nav [data-nav="market"]')
    F.locator('#mlist .item', has_text="Mahanadi Feeds").locator('[data-act="offer"]').click()
    B.click('#nav [data-nav="home"]')
    B.wait_for_function("document.querySelector('#home').innerText.includes('already offered')", timeout=9000)
    ok(True, "farmer's offer is reflected on the buyer's requirement")

    # 5) shared state survives an app restart
    n_before = F.locator("#orders .card").count() if F.locator('#orders').count() else 0
    F.reload(); F.wait_for_timeout(1500); F.click('#nav [data-nav="orders"]'); F.wait_for_timeout(300)
    ok(F.locator("#orders .card").count() >= 2, "reopening the farmer app restores its orders from the server")
    b.close()
print("\nALL E2E TESTS PASSED" if not fails else f"\n{fails} FAILED"); sys.exit(1 if fails else 0)
