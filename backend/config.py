# Backend shared state and configuration
# This module contains shared variables, locks, and config used across route modules.

import os
import json
import threading
from dotenv import load_dotenv

load_dotenv()

# ── Folders ───────────────────────────────────────────────────────────────
UPLOAD_FOLDER = "uploads/folios"
CACHE_FOLDER = "uploads/cache"
FONT_FOLDER = "fonts"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(CACHE_FOLDER, exist_ok=True)
os.makedirs(FONT_FOLDER, exist_ok=True)

# ── Locks ─────────────────────────────────────────────────────────────────
_active_folios = set()
_active_lock = threading.Lock()
_folio_lock = threading.Lock()
_json_lock = threading.Lock()
generation_semaphore = threading.Semaphore(3)

# ── Folio Templates ──────────────────────────────────────────────────────
FOLIO_TEMPLATES = {}
CACHE_FILE = "uploads/cache/folio_cache.json"


def save_folio_cache():
    try:
        with _json_lock:
            with open(CACHE_FILE, "w") as f:
                json.dump(FOLIO_TEMPLATES, f)
    except Exception as e:
        print("Cache save error:", e)


def load_folio_cache():
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, "r") as f:
                cached = json.load(f)
            valid = {
                k: v
                for k, v in cached.items()
                if v.startswith("http") or os.path.exists(v)
            }
            FOLIO_TEMPLATES.update(valid)
        except Exception as e:
            print("Failed to load cache:", e)


def load_folio_templates():
    FOLIO_TEMPLATES.clear()
    for filename in os.listdir(UPLOAD_FOLDER):
        if filename.lower().endswith((".png", ".jpg", ".jpeg")):
            FOLIO_TEMPLATES[filename] = os.path.join(UPLOAD_FOLDER, filename)


# ── Available Fonts ──────────────────────────────────────────────────────
AVAILABLE_FONTS = {
    "architects_daughter": {
        "name": "Architects Daughter",
        "file": "ArchitectsDaughter-Regular.ttf",
        "style": "casual",
    },
    "caveat": {"name": "Caveat", "file": "Caveat-Regular.ttf", "style": "playful"},
    "dekko": {"name": "Dekko", "file": "Dekko-Regular.ttf", "style": "ballpoint"},
    "gochi_hand": {
        "name": "Gochi Hand",
        "file": "GochiHand-Regular.ttf",
        "style": "bold",
    },
    "indie_flower": {
        "name": "Indie Flower",
        "file": "IndieFlower-Regular.ttf",
        "style": "casual",
    },
    "kalam": {"name": "Kalam", "file": "Kalam-Regular.ttf", "style": "natural"},
    "nanum_pen": {
        "name": "Nanum Pen Script",
        "file": "NanumPenScript-Regular.ttf",
        "style": "natural",
    },
    "patrick_hand": {
        "name": "Patrick Hand",
        "file": "PatrickHand-Regular.ttf",
        "style": "neat",
    },
    "virgil": {"name": "Virgil", "file": "Virgil.ttf", "style": "sketch"},
}

# ── File validation ──────────────────────────────────────────────────────
ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg"}

# ── Allowed CORS origins ────────────────────────────────────────────────
allowed_origins = [
    "http://localhost:3000",
    os.getenv("FRONTEND_URL", "https://handwrite-ai.vercel.app"),
]

# Initialize on import
load_folio_templates()
load_folio_cache()
