"""Tests for server.py. They run offline: instead of the real RecipeDB / FlavorDB server we use tests/mock_upstream.py.
Run:  python tests/test_backend.py"""
import asyncio, os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__))); sys.path.insert(0, os.path.dirname(__file__))
os.environ.update(API_BASE="http://mock", API_KEY="test-key", COCKTAIL_MODE="thecocktaildb", THECOCKTAILDB_BASE="http://mock/api/json/v1")
import httpx, mock_upstream, server

_Orig = httpx.AsyncClient
class Patched(_Orig):
    def __init__(self, *a, **k): super().__init__(*a, transport=httpx.ASGITransport(app=mock_upstream.app), **k)
server.httpx.AsyncClient = Patched

async def call(item):
    async with _Orig(transport=httpx.ASGITransport(app=server.app), base_url="http://app") as c:
        return (await c.get("/api/food/ideas", params={"item": item})).json()

async def main():
    r = await call("Wheat bran")
    assert r["recipes"]["source"] == r["flavor"]["source"] == r["drinks"]["source"] == "live"
    assert r["recipes"]["items"][0]["indian"] is True                      # Indian cuisine listed first
    assert all("Rum" not in d["name"] for d in r["drinks"]["items"])       # alcoholic drinks are filtered out
    assert (await call("Wheat bran"))["cached"] is True                    # credit-saving cache
    server._cache.clear(); server.API_KEY = "wrong"
    assert "401" in (await call("Rice bran"))["recipes"]["error"]          # bad key is reported, not crashed
    # ---- shared world: Farmer app and Buyer app
    import tempfile, pathlib
    server.WORLD_FILE = pathlib.Path(tempfile.mkdtemp()) / "world.json"
    server.WORLD.clear(); server.WORLD.update(server._empty_world())
    async def sync(since, **ch):
        async with _Orig(transport=httpx.ASGITransport(app=server.app), base_url="http://app") as c:
            return (await c.post("/api/world/sync", json={"since": since, "changes": ch.get("changes", {}), "notifs": ch.get("notifs", [])})).json()
    a = await sync(0, changes={"listings": [{"id": "L1F", "crop": "Rice Straw", "qty": 4, "v": 1}]}, notifs=[{"nid": "n1", "aud": "buyer", "text": "new batch"}])
    b = await sync(0)                                                       # buyer app opens later and receives it
    assert [i["id"] for i in b["listings"]] == ["L1F"] and b["notifs"][0]["nid"] == "n1"
    r1 = b["rev"]
    await sync(r1, changes={"listings": [{"id": "L1F", "crop": "Rice Straw", "qty": 4, "status": "Booked", "v": 2}]})
    assert (await sync(a["rev"]))["listings"][0]["status"] == "Booked"       # farmer app sees the buyer's change
    await sync(r1, changes={"listings": [{"id": "L1F", "crop": "Rice Straw", "qty": 9, "v": 1}]})   # stale write is rejected
    assert server.WORLD["items"]["listings"]["L1F"]["status"] == "Booked"
    await sync(0, notifs=[{"nid": "n1", "aud": "buyer", "text": "new batch"}])                       # duplicate notification ignored
    assert len(server.WORLD["notifs"]) == 1
    print("all backend tests passed")
asyncio.run(main())
