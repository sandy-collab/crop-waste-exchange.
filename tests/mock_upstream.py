"""A fake RecipeDB / FlavorDB / CocktailDB server, only for testing (so we dont need the real API key)."""
from fastapi import FastAPI, Request, HTTPException
app = FastAPI()
KEY = "test-key"
def auth(req):
    if req.headers.get("authorization") != f"Bearer {KEY}": raise HTTPException(401, "bad key")

@app.get("/recipe2-api/recipe-bytitle/recipeByTitle")
def by_title(request: Request, title: str):
    auth(request)
    return {"payload": {"data": [
        {"recipe_id": 11, "recipe_title": "Wheat Bran Roti", "region": "Indian Subcontinent", "total_time": "30"},
        {"recipe_id": 12, "recipe_title": "Bran Muffins", "region": "US", "total_time": "40"}]}}

@app.get("/recipe2-api/recipes_cuisine/cuisine/{region}")
def cuisine(request: Request, region: str, page: int = 1, page_size: int = 10):
    auth(request); assert region == "Indian Subcontinent", region
    return {"payload": {"data": [{"recipe_id": 21, "recipe_title": "Masala Bran Paratha", "region": "Indian Subcontinent"},
                                  {"recipe_id": 22, "recipe_title": "Dal Tadka", "region": "Indian Subcontinent"}]}}

@app.get("/flavordb/entities/by-entity-alias-readable")
def ent(request: Request, entity_alias_readable: str, page: int = 0, size: int = 5):
    auth(request)
    return {"content": [{"entity_alias_readable": "wheat", "category": "Cereal",
                         "molecules": [{"common_name": "hexanal", "flavor_profile": "green, fatty"},
                                       {"common_name": "furfural", "flavor_profile": "nutty, sweet"},
                                       {"common_name": "maltol", "flavor_profile": "sweet, caramel"}]}]}

@app.get("/flavordb/entities/by-name-and-category")
def ent_cat(request: Request, name: str, category: str, page: int = 0, size: int = 5):
    auth(request); return {"content": []}

@app.get("/flavordb/food/by-alias")
def pair(request: Request, food_pair: str):
    auth(request); return [{"entity_alias_readable": "barley"}, {"entity_alias_readable": "honey"}, {"entity_alias_readable": "wheat"}]

@app.get("/api/json/v1/1/filter.php")
def tcdb(a: str = None, i: str = None):
    if a == "Non_Alcoholic": return {"drinks": [{"idDrink": "1", "strDrink": "Honey Milk Cooler"}, {"idDrink": "2", "strDrink": "Virgin Mojito"}]}
    if i == "Honey": return {"drinks": [{"idDrink": "1", "strDrink": "Honey Milk Cooler", "strDrinkThumb": "x"}, {"idDrink": "9", "strDrink": "Rum Punch"}]}
    return {"drinks": "None Found"}
