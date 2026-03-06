# System routes blueprint (health, cache, fonts, analyze-handwriting)

import os
import json
import re

from flask import Blueprint, request, jsonify
from werkzeug.utils import secure_filename

from config import (
    AVAILABLE_FONTS, FONT_FOLDER, CACHE_FOLDER,
    FOLIO_TEMPLATES,
)
from handwriting_generator import HandwritingGenerator
from handwriting_analyzer import analyze_handwriting

system_bp = Blueprint("system", __name__)


@system_bp.route("/api/fonts", methods=["GET"])
def get_fonts():
    available = {
        k: v for k, v in AVAILABLE_FONTS.items()
        if os.path.exists(os.path.join(FONT_FOLDER, v["file"]))
    }
    return jsonify({"fonts": available})


@system_bp.route("/api/analyze-handwriting", methods=["POST"])
def analyze_handwriting_endpoint():
    """Analisis foto tulisan tangan user, return config yang disarankan."""
    try:
        if "image" not in request.files:
            return jsonify({"error": "No image uploaded"}), 400

        file = request.files["image"]
        image_bytes = file.read()

        if len(image_bytes) > 10 * 1024 * 1024:
            return jsonify({"error": "File terlalu besar, max 10MB"}), 400

        result = analyze_handwriting(image_bytes)
        return jsonify({"success": True, "config": result})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@system_bp.route("/api/cache/save", methods=["POST"])
def cache_save():
    """Simpan session_id + pages ke file JSON di disk."""
    try:
        data = request.json
        sid = data.get("sessionId", "")
        pages = data.get("pages", [])
        if not sid or not pages:
            return jsonify({"error": "Missing sessionId or pages"}), 400
        if not re.match(r"^[a-zA-Z0-9_-]{8,64}$", sid):
            return jsonify({"error": "Invalid session ID format"}), 400

        cache_path = os.path.join(CACHE_FOLDER, f"cache_{sid}.json")
        with open(cache_path, "w") as f:
            json.dump(pages, f)

        cache_files = sorted(
            [f for f in os.listdir(CACHE_FOLDER) if f.startswith("cache_") and f.endswith(".json")],
            key=lambda f: os.path.getmtime(os.path.join(CACHE_FOLDER, f)),
        )
        while len(cache_files) > 50:
            os.remove(os.path.join(CACHE_FOLDER, cache_files.pop(0)))

        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@system_bp.route("/api/cache/load/<session_id>", methods=["GET"])
def cache_load(session_id):
    """Load hasil generate dari file JSON di disk."""
    cache_path = os.path.join(CACHE_FOLDER, f"cache_{secure_filename(session_id)}.json")
    if not os.path.exists(cache_path):
        return jsonify({"found": False}), 200

    try:
        with open(cache_path, "r") as f:
            pages = json.load(f)
        return jsonify({"found": True, "pages": pages})
    except Exception:
        return jsonify({"found": False}), 200


@system_bp.route("/health", methods=["GET"])
@system_bp.route("/api/health", methods=["GET"])
def health_check():
    import gc

    mem_info = {}
    try:
        import psutil
        process = psutil.Process(os.getpid())
        mem = process.memory_info()
        mem_info = {
            "rss_mb": round(mem.rss / 1024 / 1024, 1),
            "vms_mb": round(mem.vms / 1024 / 1024, 1),
        }
    except ImportError:
        mem_info = {"note": "psutil not installed"}

    with HandwritingGenerator._cache_lock:
        cache_items = len(HandwritingGenerator._image_cache)

    cache_disk_mb = 0
    try:
        for f in os.listdir(CACHE_FOLDER):
            fp = os.path.join(CACHE_FOLDER, f)
            if os.path.isfile(fp):
                cache_disk_mb += os.path.getsize(fp)
        cache_disk_mb = round(cache_disk_mb / 1024 / 1024, 1)
    except Exception:
        pass

    return jsonify({
        "status": "healthy",
        "version": "2.0.0",
        "available_fonts": len([
            k for k, v in AVAILABLE_FONTS.items()
            if os.path.exists(os.path.join(FONT_FOLDER, v["file"]))
        ]),
        "available_folios": len(FOLIO_TEMPLATES),
        "memory": mem_info,
        "image_cache_items": cache_items,
        "disk_cache_mb": cache_disk_mb,
    })
