#!/usr/bin/env python3
"""Generate synthetic Singapore food corpus, demo queries, dish images, and manifest."""

from __future__ import annotations

import json
import random
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from faker import Faker

fake = Faker("en_GB")
random.seed(42)
Faker.seed(42)

DATA = ROOT / "data"
ASSETS = ROOT / "assets" / "food"
SOURCES_PATH = DATA / "dish_image_sources.json"
LOCATIONS = json.loads((DATA / "sg_locations.json").read_text())


def real_photo_dish_ids() -> set[str]:
    """Dish IDs with fetched real photos — never overwrite with placeholders."""
    if not SOURCES_PATH.exists():
        return set()
    sources = json.loads(SOURCES_PATH.read_text())
    return set(sources.keys())

HAWKER_NAMES = [
    "Tian Tian", "Ah Tai", "Hill Street", "Outram Park Fried Kway Teow", "Swee Guan",
    "Liao Fan", "Zhen Zhen", "Depot Road Zhen Shan Mei", "Sun Sui Wah", "Ah Chew",
    "Hong Kong Soya Sauce Chicken", "Tiong Bahru Yi Sheng", "No. 18 Zion Road",
    "Beach Road Scissor-Cut", "Alliance Seafood", "Loo's Hainanese Curry Rice",
]

RESTAURANT_NAMES = [
    "Burnt Ends", "Jumbo Seafood", "Din Tai Fung", "Paradise Dynasty", "PS.Cafe",
    "Zam Zam", "Saap Saap Thai", "Collin's Grill", "Stuff'd", "The Coconut Club",
    "MTR 1924", "Putien", "Crystal Jade", "Song Fa Bak Kut Teh", "Makansutra Gluttons Bay",
    "Burnt Ends Bar", "Open Farm Community", "Burnt Ends Bakery", "Labyrinth", "Odette",
]

CAFE_NAMES = [
    "Common Man Coffee Roasters", "Chye Seng Huat Hardware", "Killiney Kopitiam",
    "Ya Kun Kaya Toast", "Five Oars", "Alchemist", "The Populus Coffee",
]

ZI_CHAR_NAMES = [
    "Keng Eng Kee", "Two Chefs Eating Place", "Mellben Seafood", "Sin Huat Eating House",
    "Kok Sen Restaurant", "Dragon Phoenix", "Eng Seng Restaurant",
]

CUISINES = [
    "chinese", "malay", "indian", "peranakan", "western", "thai", "japanese",
    "teochew", "hokkien", "cantonese", "fusion",
]

VIBES = [
    "light", "clean broth", "office lunch", "comfort", "spicy", "economical",
    "heritage", "late night", "family friendly", "tourist favourite",
]

DESCRIPTION_TEMPLATES = {
    "hawker_stall": [
        "Heritage stall serving {dish} with a loyal queue at lunch. Known for balanced flavours and generous portions.",
        "Popular {cuisine} stall; signature {dish} draws office workers from nearby towers.",
        "Long-running hawker favourite — {dish} prepared fresh daily with traditional methods.",
    ],
    "restaurant": [
        "Full-service dining room specialising in {cuisine} cuisine. Reservation recommended on weekends.",
        "Modern interpretation of classic {dish}; polished service and curated wine list.",
        "Award-recognised venue for {dish}; ideal for celebrations and business dinners.",
    ],
    "cafe": [
        "Specialty coffee and brunch spot with {dish} on the all-day menu.",
        "Relaxed cafe atmosphere; {dish} pairs well with single-origin pour-over.",
    ],
    "zi_char": [
        "Hearty zi char joint — wok hei {dish} and seafood done over high flame.",
        "Neighbourhood zi char institution; {dish} is a table favourite for sharing.",
    ],
}


def jitter(lat: float, lon: float, scale: float = 0.0008) -> tuple[float, float]:
    return lat + random.uniform(-scale, scale), lon + random.uniform(-scale, scale)


def make_searchable_content(doc: dict) -> str:
    parts = [
        doc["title"],
        doc["description"],
        doc.get("signature_dish", ""),
        " ".join(doc.get("cuisine", [])),
        " ".join(doc.get("vibes", [])),
        doc.get("hawker_centre", ""),
        doc.get("neighbourhood", ""),
        " ".join(doc.get("dietary_tags", [])),
    ]
    return "\n".join(p for p in parts if p)


def gen_hawker_stalls(n: int = 100) -> list[dict]:
    docs = []
    centres = LOCATIONS["hawker_centres"]
    dishes = LOCATIONS["dishes"]
    for i in range(n):
        centre = centres[i % len(centres)]
        dish = dishes[i % len(dishes)]
        lat, lon = jitter(centre["lat"], centre["lon"])
        name = HAWKER_NAMES[i % len(HAWKER_NAMES)]
        title = f"{name} — {dish['name']}"
        doc_id = f"hawker_{i+1:03d}"
        doc = {
            "doc_id": doc_id,
            "title": title,
            "doc_type": "hawker_stall",
            "venue_tier": "hawker_stall",
            "signature_dish": dish["name"],
            "dish_id": dish["id"],
            "description": random.choice(DESCRIPTION_TEMPLATES["hawker_stall"]).format(
                dish=dish["name"], cuisine=random.choice(CUISINES)
            ),
            "cuisine": [random.choice(CUISINES), "local"],
            "hawker_centre": centre["name"],
            "neighbourhood": centre["planning_area"],
            "planning_area": centre["planning_area"],
            "nearest_mrt": [centre["mrt"]],
            "price_range": random.choice(["$", "$", "$"]),
            "rating": round(random.uniform(3.8, 4.9), 1),
            "review_count": random.randint(120, 4500),
            "estimated_delivery_mins": random.randint(25, 45),
            "dietary_tags": random.sample(
                ["halal", "vegetarian-friendly", "pescatarian-friendly", "no pork"],
                k=random.randint(0, 2),
            ),
            "opening_hours": "Mon-Sun 10:00-21:00",
            "vibes": random.sample(VIBES, k=3),
            "location": {"lat": lat, "lon": lon},
            "hawker_centre_location": {"lat": centre["lat"], "lon": centre["lon"]},
            "media_type": "text",
            "address": f"{centre['name']}, #{random.randint(1,99):02d}-{random.randint(1,99):02d}",
        }
        doc["searchable_content"] = make_searchable_content(doc)
        doc["hero_image_url"] = f"/assets/food/{dish['id']}.jpg"
        docs.append(doc)
    return docs


def apply_graph_demo_clusters(stalls: list[dict]) -> None:
    """Rich same-dish / same-hawker clusters so map graph demos are obvious."""
    centres = {c["name"]: c for c in LOCATIONS["hawker_centres"]}
    dishes = {d["id"]: d for d in LOCATIONS["dishes"]}
    by_id = {s["doc_id"]: s for s in stalls}

    def patch(
        doc_id: str,
        centre_name: str,
        dish_id: str,
        stall_name: str,
        slot: int,
    ) -> None:
        stall = by_id.get(doc_id)
        if not stall:
            return
        centre = centres[centre_name]
        dish = dishes[dish_id]
        lat, lon = jitter(centre["lat"], centre["lon"], 0.00022 + slot * 0.00007)
        stall.update(
            {
                "title": f"{stall_name} — {dish['name']}",
                "signature_dish": dish["name"],
                "dish_id": dish_id,
                "description": random.choice(DESCRIPTION_TEMPLATES["hawker_stall"]).format(
                    dish=dish["name"], cuisine=random.choice(CUISINES)
                ),
                "hawker_centre": centre_name,
                "neighbourhood": centre["planning_area"],
                "planning_area": centre["planning_area"],
                "nearest_mrt": [centre["mrt"]],
                "location": {"lat": lat, "lon": lon},
                "hawker_centre_location": {"lat": centre["lat"], "lon": centre["lon"]},
                "address": f"{centre_name}, #{10 + slot:02d}-{20 + slot:02d}",
                "hero_image_url": f"/assets/food/{dish_id}.jpg",
            }
        )
        stall["searchable_content"] = make_searchable_content(stall)

    # Maxwell — four chicken-rice rivals + other stalls in same centre
    patch("hawker_001", "Maxwell Food Centre", "chicken_rice", "Tian Tian Chicken Rice", 0)
    patch("hawker_021", "Maxwell Food Centre", "chicken_rice", "Ah Tai Chicken Rice", 1)
    patch("hawker_041", "Maxwell Food Centre", "chicken_rice", "Maxwell Chicken Rice #08", 2)
    patch("hawker_061", "Maxwell Food Centre", "chicken_rice", "Liao Fan Chicken Rice", 3)
    patch("hawker_002", "Maxwell Food Centre", "laksa", "Swee Guan Laksa", 4)
    patch("hawker_022", "Maxwell Food Centre", "satay", "Maxwell Satay #12", 5)

    # Lau Pa Sat — laksa cluster
    patch("hawker_003", "Lau Pa Sat", "laksa", "Hill Street Laksa", 0)
    patch("hawker_023", "Lau Pa Sat", "laksa", "Depot Road Laksa", 1)
    patch("hawker_043", "Lau Pa Sat", "laksa", "Lau Pa Sat Laksa #07", 2)
    patch("hawker_063", "Lau Pa Sat", "laksa", "Katong-style Laksa", 3)

    # Chinatown Complex — satay cluster
    patch("hawker_004", "Chinatown Complex", "satay", "Chinatown Satay #5", 0)
    patch("hawker_024", "Chinatown Complex", "satay", "Lau Satay", 1)
    patch("hawker_044", "Chinatown Complex", "satay", "Smith Street Satay", 2)

    # Old Airport Road — char kway teow cluster
    patch("hawker_005", "Old Airport Road Food Centre", "char_kway_teow", "Outram Park Fried Kway Teow", 0)
    patch("hawker_025", "Old Airport Road Food Centre", "char_kway_teow", "OAR Char Kway Teow #01", 1)
    patch("hawker_045", "Old Airport Road Food Centre", "char_kway_teow", "Hill Street Char Kway Teow", 2)

    # Clementi 448 — chicken rice rivals + fish soup + yong tau foo (same-hawker graph demo)
    c448 = "Clementi 448 Market & Food Centre"
    patch("hawker_006", c448, "chicken_rice", "Clementi 448 Chicken Rice", 0)
    patch("hawker_026", c448, "chicken_rice", "Ah Hua Chicken Rice", 1)
    patch("hawker_046", c448, "chicken_rice", "448 Famous Chicken Rice #04", 2)
    patch("hawker_066", c448, "chicken_rice", "West Coast Chicken Rice", 3)
    patch("hawker_007", c448, "fish_soup", "Clementi 448 Fish Soup", 0)
    patch("hawker_027", c448, "fish_soup", "Teochew Fish Soup #06", 1)
    patch("hawker_047", c448, "fish_soup", "Ah Bee Fish Soup", 2)
    patch("hawker_008", c448, "yong_tau_foo", "448 Yong Tau Foo", 0)
    patch("hawker_028", c448, "yong_tau_foo", "Clementi YTF #02", 1)

    # Clementi Central — nasi lemak + roti prata + mee rebus cluster
    ccentral = "Clementi Central Market & Food Centre"
    patch("hawker_009", ccentral, "nasi_lemak", "Clementi Central Nasi Lemak", 0)
    patch("hawker_029", ccentral, "nasi_lemak", "Makcik Nasi Lemak #01", 1)
    patch("hawker_049", ccentral, "nasi_lemak", "Ah Boy Nasi Lemak", 2)
    patch("hawker_069", ccentral, "nasi_lemak", "Central Nasi Lemak #08", 3)
    patch("hawker_010", ccentral, "roti_prata", "Clementi Prata House", 0)
    patch("hawker_030", ccentral, "roti_prata", "Sin Ming Roti Prata", 1)
    patch("hawker_050", ccentral, "roti_prata", "Prata Planet Clementi", 2)
    patch("hawker_011", ccentral, "mee_rebus", "Clementi Mee Rebus", 0)
    patch("hawker_031", ccentral, "mee_rebus", "Central Mee Rebus #03", 1)


def gen_restaurants(n: int = 90) -> list[dict]:
    docs = []
    clusters = LOCATIONS["restaurant_clusters"] + LOCATIONS["hawker_centres"][:5]
    dishes = LOCATIONS["dishes"]
    for i in range(n):
        cluster = clusters[i % len(clusters)]
        dish = dishes[(i + 3) % len(dishes)]
        lat, lon = jitter(cluster["lat"], cluster["lon"], 0.0015)
        name = RESTAURANT_NAMES[i % len(RESTAURANT_NAMES)]
        doc_id = f"restaurant_{i+1:03d}"
        doc = {
            "doc_id": doc_id,
            "title": name,
            "doc_type": "restaurant",
            "venue_tier": "restaurant",
            "signature_dish": dish["name"],
            "dish_id": dish["id"],
            "description": random.choice(DESCRIPTION_TEMPLATES["restaurant"]).format(
                dish=dish["name"], cuisine=random.choice(CUISINES)
            ),
            "cuisine": [random.choice(CUISINES)],
            "neighbourhood": cluster.get("planning_area", cluster.get("name", "Singapore")),
            "planning_area": cluster.get("planning_area", "Central"),
            "nearest_mrt": [random.choice(LOCATIONS["mrt_stations"])["name"]],
            "price_range": random.choice(["$$", "$$$", "$$$"]),
            "rating": round(random.uniform(4.0, 4.9), 1),
            "review_count": random.randint(500, 12000),
            "estimated_delivery_mins": random.randint(30, 55),
            "dietary_tags": random.sample(["halal", "vegetarian-friendly"], k=random.randint(0, 1)),
            "opening_hours": "Tue-Sun 11:30-22:30",
            "vibes": random.sample(VIBES, k=2),
            "location": {"lat": lat, "lon": lon},
            "media_type": "text",
            "address": f"{random.randint(1,120)} {cluster['name']}, Singapore",
            "postal_code": f"{random.randint(100000, 829999)}",
        }
        doc["searchable_content"] = make_searchable_content(doc)
        doc["hero_image_url"] = f"/assets/food/{dish['id']}.jpg"
        docs.append(doc)
    return docs


def gen_cafes(n: int = 30) -> list[dict]:
    docs = []
    for i in range(n):
        cluster = LOCATIONS["restaurant_clusters"][i % len(LOCATIONS["restaurant_clusters"])]
        dish = LOCATIONS["dishes"][(i + 5) % len(LOCATIONS["dishes"])]
        lat, lon = jitter(cluster["lat"], cluster["lon"])
        name = CAFE_NAMES[i % len(CAFE_NAMES)]
        doc_id = f"cafe_{i+1:03d}"
        doc = {
            "doc_id": doc_id,
            "title": name,
            "doc_type": "cafe",
            "venue_tier": "cafe",
            "signature_dish": dish["name"],
            "dish_id": dish["id"],
            "description": random.choice(DESCRIPTION_TEMPLATES["cafe"]).format(
                dish=dish["name"], cuisine="cafe"
            ),
            "cuisine": ["cafe", "western"],
            "neighbourhood": cluster["planning_area"],
            "planning_area": cluster["planning_area"],
            "nearest_mrt": ["Orchard"],
            "price_range": "$$",
            "rating": round(random.uniform(4.0, 4.8), 1),
            "review_count": random.randint(200, 3000),
            "estimated_delivery_mins": 35,
            "dietary_tags": ["vegetarian-friendly"],
            "vibes": ["brunch", "specialty coffee"],
            "location": {"lat": lat, "lon": lon},
            "media_type": "text",
            "address": f"{cluster['name']}, Singapore",
            "opening_hours": "Daily 08:00-18:00",
        }
        doc["searchable_content"] = make_searchable_content(doc)
        doc["hero_image_url"] = f"/assets/food/{dish['id']}.jpg"
        docs.append(doc)
    return docs


def gen_zi_char(n: int = 30) -> list[dict]:
    docs = []
    for i in range(n):
        centre = LOCATIONS["hawker_centres"][(i + 2) % len(LOCATIONS["hawker_centres"])]
        dish = LOCATIONS["dishes"][(i + 7) % len(LOCATIONS["dishes"])]
        lat, lon = jitter(centre["lat"], centre["lon"])
        name = ZI_CHAR_NAMES[i % len(ZI_CHAR_NAMES)]
        doc_id = f"zi_char_{i+1:03d}"
        doc = {
            "doc_id": doc_id,
            "title": name,
            "doc_type": "zi_char",
            "venue_tier": "zi_char",
            "signature_dish": dish["name"],
            "dish_id": dish["id"],
            "description": random.choice(DESCRIPTION_TEMPLATES["zi_char"]).format(dish=dish["name"]),
            "cuisine": ["chinese", "zi char"],
            "neighbourhood": centre["planning_area"],
            "planning_area": centre["planning_area"],
            "nearest_mrt": [centre["mrt"]],
            "price_range": "$$",
            "rating": round(random.uniform(4.0, 4.7), 1),
            "review_count": random.randint(300, 5000),
            "estimated_delivery_mins": 40,
            "dietary_tags": [],
            "vibes": ["wok hei", "sharing plates"],
            "location": {"lat": lat, "lon": lon},
            "media_type": "text",
            "address": f"Near {centre['name']}",
            "opening_hours": "Daily 17:00-00:30",
        }
        doc["searchable_content"] = make_searchable_content(doc)
        doc["hero_image_url"] = f"/assets/food/{dish['id']}.jpg"
        docs.append(doc)
    return docs


def gen_food_guides(n: int = 30) -> list[dict]:
    guides = [
        ("Rainy-day hawker picks in the CBD", "economical fish soup teochew porridge warm broth CBD lunch"),
        ("Halal stalls near Bugis and Victoria Street", "halal budget Victoria Street Arab Street murtabak"),
        ("Vegetarian-friendly hawker centres", "meat-free yong tau foo vegetarian options"),
        ("Late-night suppers in Geylang", "supper prata frog porridge geylang after midnight"),
        ("Best chicken rice across the island", "poached chicken fragrant rice hainanese"),
        ("Spicy noodle hunt — mee rebus and laksa", "pedas gravy coconut curry noodles makcik style"),
        ("Healthy twists on local classics", "brown rice steamed chicken salad lighter options"),
    ]
    docs = []
    for i in range(n):
        title, body = guides[i % len(guides)]
        doc_id = f"guide_{i+1:03d}"
        doc = {
            "doc_id": doc_id,
            "title": title,
            "doc_type": "food_guide",
            "venue_tier": "guide",
            "description": f"Curated guide: {body}",
            "content": body,
            "media_type": "text",
            "map_visible": False,
        }
        doc["searchable_content"] = f"{title}\n{body}"
        docs.append(doc)
    return docs


def build_dish_manifest(venue_docs: list[dict]) -> list[dict]:
    manifest = []
    by_dish: dict[str, list[str]] = {}
    for doc in venue_docs:
        if doc.get("dish_id") and doc["doc_type"] in {"hawker_stall", "restaurant", "cafe", "zi_char"}:
            by_dish.setdefault(doc["dish_id"], []).append(doc["doc_id"])
    for dish in LOCATIONS["dishes"]:
        venue_ids = by_dish.get(dish["id"], [])[:5]
        manifest.append({
            "dish_id": dish["id"],
            "dish_name": dish["name"],
            "image_file": f"{dish['id']}.jpg",
            "venue_doc_ids": venue_ids,
        })
    return manifest


def build_demo_queries() -> list[dict]:
    return [
        {
            "id": "rainy_soup_cbd",
            "label": "Rainy-day soup near Raffles Place",
            "query": "Warm soupy comfort food for a rainy afternoon near Raffles Place",
            "lat": 1.2839,
            "lon": 103.8515,
            "radius_m": 1200,
            "mode": "text",
        },
        {
            "id": "halal_bugis",
            "label": "Halal lunch under $5 near Bugis",
            "query": "Halal lunch under five dollars near Bugis MRT",
            "lat": 1.3006,
            "lon": 103.8559,
            "radius_m": 800,
            "mode": "text",
        },
        {
            "id": "healthy_chicken_rice",
            "label": "Healthy chicken rice alternative",
            "query": "Something like chicken rice but lighter and healthier",
            "mode": "text",
        },
        {
            "id": "maxwell_chicken_rice",
            "label": "Chicken rice at Maxwell",
            "query": "Best chicken rice at Maxwell Food Centre hawker stalls",
            "lat": 1.2804,
            "lon": 103.8446,
            "radius_m": 600,
            "mode": "text",
        },
        {
            "id": "clementi_chicken_rice",
            "label": "Chicken rice at Clementi 448",
            "query": "Chicken rice hawker stalls at Clementi 448 Market Food Centre",
            "lat": 1.3127,
            "lon": 103.7649,
            "radius_m": 800,
            "mode": "text",
        },
        {
            "id": "clementi_halal_nasi_lemak",
            "label": "Halal nasi lemak near Clementi MRT",
            "query": "Halal nasi lemak near Clementi MRT hawker centre",
            "lat": 1.3150,
            "lon": 103.7645,
            "radius_m": 700,
            "mode": "text",
        },
        {
            "id": "pedas_noodles",
            "label": "Pedas hawker noodles (Singlish)",
            "query": "Pedas hawker noodles makcik style",
            "mode": "text",
            "group": "multilingual",
            "lang_label": "Singlish",
        },
        {
            "id": "zh_halal_bugis",
            "label": "Halal lunch near Bugis",
            "query": "靠近武吉士的清真午餐，便宜一点",
            "lat": 1.3006,
            "lon": 103.8559,
            "radius_m": 800,
            "mode": "text",
            "group": "multilingual",
            "lang_label": "中文",
        },
        {
            "id": "mixed_halal_bugis",
            "label": "Halal makan near Bugis",
            "query": "Halal makan near Bugis 便宜",
            "lat": 1.3006,
            "lon": 103.8559,
            "radius_m": 800,
            "mode": "text",
            "group": "multilingual",
            "lang_label": "EN+MS+ZH",
        },
        {
            "id": "ms_pedas",
            "label": "Spicy hawker noodles",
            "query": "Mee pedas gaya makcik dekat hawker",
            "mode": "text",
            "group": "multilingual",
            "lang_label": "Melayu",
        },
        {
            "id": "zh_tw_pedas",
            "label": "Spicy hawker noodles",
            "query": "小販辣椒麵，要阿姨手藝那種",
            "mode": "text",
            "group": "multilingual",
            "lang_label": "繁體",
        },
        {
            "id": "ja_soup_cbd",
            "label": "Warm soup near Raffles Place",
            "query": "レイフルズプレイス近くで温かいスープが食べたい",
            "lat": 1.2839,
            "lon": 103.8515,
            "radius_m": 1200,
            "mode": "text",
            "group": "multilingual",
            "lang_label": "日本語",
        },
        {
            "id": "ko_chicken_rice",
            "label": "Lighter chicken rice",
            "query": "치킨라이스처럼 가볍고 건강한 음식",
            "mode": "text",
            "group": "multilingual",
            "lang_label": "한국어",
        },
        {
            "id": "hi_halal_bugis",
            "label": "Budget halal near Bugis",
            "query": "बगीस एमआरटी के पास सस्ता हलाल लंच",
            "lat": 1.3006,
            "lon": 103.8559,
            "radius_m": 800,
            "mode": "text",
            "group": "multilingual",
            "lang_label": "हिन्दी",
        },
        {
            "id": "ta_halal_bugis",
            "label": "Halal lunch near Bugis",
            "query": "புக்கிஸ் MRT அருகில் சிறிய செலவில் ஹலால் உணவு",
            "lat": 1.3006,
            "lon": 103.8559,
            "radius_m": 800,
            "mode": "text",
            "group": "multilingual",
            "lang_label": "தமிழ்",
        },
        {
            "id": "halal_walk_bugis",
            "label": "Halal snack walk from Bugis Exit B",
            "query": "Halal snack within walking distance of Bugis MRT",
            "lat": 1.3006,
            "lon": 103.8559,
            "radius_m": 600,
            "mode": "text",
        },
        {
            "id": "photo_chicken_rice",
            "label": "Photo: Chicken Rice",
            "dish_id": "chicken_rice",
            "mode": "photo",
        },
        {
            "id": "photo_laksa",
            "label": "Photo: Laksa",
            "dish_id": "laksa",
            "mode": "photo",
        },
        {
            "id": "photo_satay",
            "label": "Photo: Satay",
            "dish_id": "satay",
            "mode": "photo",
        },
    ]


def _hex_to_rgb(hex_color: str) -> tuple[int, int, int]:
    h = hex_color.lstrip("#")
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


def _darken_rgb(rgb: tuple[int, int, int], factor: float = 0.45) -> tuple[int, int, int]:
    return tuple(max(0, int(c * factor)) for c in rgb)


def _load_font(size: int, *, bold: bool = False):
    from PIL import ImageFont

    candidates = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
        if bold
        else "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    ]
    for path in candidates:
        p = Path(path)
        if p.exists():
            try:
                return ImageFont.truetype(str(p), size)
            except OSError:
                continue
    return ImageFont.load_default()


def _load_emoji_font(size: int):
    from PIL import ImageFont

    for path in (
        "/System/Library/Fonts/Apple Color Emoji.ttc",
        "/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf",
    ):
        p = Path(path)
        if p.exists():
            try:
                return ImageFont.truetype(str(p), size)
            except OSError:
                continue
    return None


def _dish_initials(dish: dict) -> str:
    short = dish.get("short") or dish["name"]
    parts = short.split()
    if len(parts) >= 2:
        return (parts[0][0] + parts[1][0]).upper()
    return short[:2].upper()


def generate_food_images(*, force: bool = False, force_placeholders: bool = False) -> None:
    try:
        from PIL import Image, ImageDraw
    except ImportError:
        print("Pillow required for food images: pip install Pillow")
        return

    ASSETS.mkdir(parents=True, exist_ok=True)
    protected = real_photo_dish_ids()
    size = 512
    for dish in LOCATIONS["dishes"]:
        path = ASSETS / f"{dish['id']}.jpg"
        if dish["id"] in protected and not force_placeholders:
            continue
        if path.exists() and not force:
            continue

        base = _hex_to_rgb(dish["color"])
        dark = _darken_rgb(base)
        img = Image.new("RGB", (size, size))
        draw = ImageDraw.Draw(img)
        for y in range(size):
            t = y / (size - 1)
            row = tuple(int(base[i] + (dark[i] - base[i]) * t) for i in range(3))
            draw.line([(0, y), (size, y)], fill=row)

        emoji = dish.get("emoji", "🍽️")
        emoji_font = _load_emoji_font(180)
        if emoji_font:
            draw.text((size // 2, size // 2 - 24), emoji, font=emoji_font, anchor="mm", embedded_color=True)
        else:
            initials = _dish_initials(dish)
            draw.text(
                (size // 2, size // 2 - 24),
                initials,
                font=_load_font(120, bold=True),
                fill="#FFFFFF",
                anchor="mm",
                stroke_width=3,
                stroke_fill="#00000044",
            )

        label = dish.get("short") or dish["name"]
        bar_top = size - 96
        draw.rectangle([0, bar_top, size, size], fill=(24, 24, 28))
        draw.text(
            (size // 2, bar_top + 48),
            label,
            font=_load_font(34, bold=True),
            fill="#FFFFFF",
            anchor="mm",
            stroke_width=1,
            stroke_fill="#000000",
        )

        img.save(path, quality=92)
        print("Created", path.name)


def sync_food_assets_to_web() -> None:
    import shutil

    dest = ROOT / "web" / "public" / "assets" / "food"
    dest.mkdir(parents=True, exist_ok=True)
    for path in ASSETS.glob("*.jpg"):
        shutil.copy2(path, dest / path.name)
    print(f"Synced {len(list(ASSETS.glob('*.jpg')))} images to {dest.relative_to(ROOT)}")


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--regen-images",
        action="store_true",
        help="Regenerate missing dish placeholder JPGs (skips real photos in dish_image_sources.json)",
    )
    parser.add_argument(
        "--force-placeholders",
        action="store_true",
        help="Overwrite all dish JPGs with synthetic placeholders, including real photos",
    )
    args = parser.parse_args()

    DATA.mkdir(parents=True, exist_ok=True)
    generate_food_images(force=args.regen_images, force_placeholders=args.force_placeholders)
    sync_food_assets_to_web()

    venues = (
        gen_hawker_stalls(100)
        + gen_restaurants(90)
        + gen_cafes(30)
        + gen_zi_char(30)
    )
    hawkers = [v for v in venues if v.get("doc_type") == "hawker_stall"]
    apply_graph_demo_clusters(hawkers)
    guides = gen_food_guides(30)
    all_docs = venues + guides

    corpus_path = DATA / "sg_food_corpus.jsonl"
    with corpus_path.open("w") as f:
        for doc in all_docs:
            f.write(json.dumps(doc, ensure_ascii=False) + "\n")

    manifest = build_dish_manifest(venues)
    (DATA / "dish_image_manifest.json").write_text(json.dumps(manifest, indent=2))
    (DATA / "demo_queries.json").write_text(json.dumps(build_demo_queries(), indent=2))

    print(f"Wrote {len(all_docs)} documents to {corpus_path}")
    print(f"  venues: {len(venues)}, guides: {len(guides)}")
    print(f"  dish manifest: {len(manifest)} dishes")
    print(f"  demo queries: {len(build_demo_queries())}")


if __name__ == "__main__":
    main()
