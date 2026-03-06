# Generate & Preview route blueprint

import os
import io
import base64
import random

from flask import Blueprint, request, jsonify
from PIL import Image, ImageDraw

from config import (
    FOLIO_TEMPLATES, AVAILABLE_FONTS, FONT_FOLDER,
    generation_semaphore, _active_folios, _active_lock, allowed_origins,
)
from handwriting_generator import HandwritingGenerator

generate_bp = Blueprint("generate", __name__)


@generate_bp.route("/api/preview", methods=["POST"])
def generate_preview():
    """Generate 1 baris tulisan tangan untuk preview sidebar."""
    try:
        data = request.json
        font_id = data.get("fontId", "indie_flower")
        folio_id = data.get("folioId", "")
        preview_text = data.get("text", "Halo Dunia, ini contoh tulisan.")[:60]

        config = {
            "startX": 80, "startY": 140, "lineHeight": 80,
            "maxWidth": 900, "pageBottom": 400,
            "fontSize": int(data.get("fontSize", 60)),
            "color": data.get("color", "#1a1a1a"),
            "wordSpacing": int(data.get("wordSpacing", 8)),
            "leftHanded": data.get("leftHanded", False),
            "writeSpeed": float(data.get("writeSpeed", 0.5)),
            "enableTypo": False,
            "slantAngle": float(data.get("slantAngle", 0)),
            "tiredMode": False,
            "showPageNumber": False,
            "pageNumberFormat": "- {n} -",
            "marginJitter": 0,
            "folioEvenPath": None,
            "enableDropCap": False,
            "watermarkText": "",
        }

        folio_path = FOLIO_TEMPLATES.get(folio_id)
        if not folio_path:
            folio_path = next(iter(FOLIO_TEMPLATES.values()), None)
        if not folio_path:
            return jsonify({"error": "No folio available"}), 200

        font_info = AVAILABLE_FONTS.get(font_id)
        if not font_info:
            return jsonify({"error": "Invalid font"}), 200
        font_path = os.path.join(FONT_FOLDER, font_info["file"])
        if not os.path.exists(font_path):
            return jsonify({"error": "Font file not found"}), 200

        generator = HandwritingGenerator(config, folio_path, font_path)

        full_img = generator.folio_odd.copy()
        crop_h = int(config["startY"] + config["fontSize"] * 2.5)
        cropped = full_img.crop((0, 0, full_img.width, crop_h))

        text_layer = Image.new("RGBA", full_img.size, (0, 0, 0, 0))
        draw = ImageDraw.Draw(text_layer, "RGBA")
        generator.add_humanizer_effect(
            text_layer, draw, preview_text, config["startX"], config["startY"]
        )

        base = cropped.convert("RGBA")
        text_crop = text_layer.crop((0, 0, full_img.width, crop_h))
        result = Image.alpha_composite(base, text_crop).convert("RGB")

        buf = io.BytesIO()
        result.save(buf, format="JPEG", quality=85, optimize=True)
        buf.seek(0)
        b64 = base64.b64encode(buf.getvalue()).decode()

        return jsonify({"success": True, "image": f"data:image/jpeg;base64,{b64}"})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@generate_bp.route("/api/generate/stream", methods=["POST"])
def generate_handwriting_stream():
    """Streaming endpoint — kirim halaman satu per satu (Server-Sent Events)."""
    from flask import current_app

    try:
        data = request.json
        text = data.get("text", "")
        if not text.strip():
            return jsonify({"error": "No text provided"}), 400
        if len(text) > 50000:
            return jsonify({"error": "Teks terlalu panjang. Maksimal 50.000 karakter."}), 400

        folio_id = data.get("folioId", "")
        font_id = data.get("fontId", "indie_flower")
        seed = data.get("seed")
        if seed is not None:
            random.seed(seed)

        config = {
            "startX": 100, "startY": 125, "lineHeight": 83,
            "maxWidth": 2205, "pageBottom": 3320,
            "fontSize": 60, "color": "#2b2b2b", "wordSpacing": 8,
            "leftHanded": False, "writeSpeed": 0.5,
            "enableTypo": True, "slantAngle": 0,
            "tiredMode": False, "showPageNumber": False,
            "pageNumberFormat": "- {n} -", "marginJitter": 6,
            "folioEvenPath": None, "watermarkText": "",
            **data.get("config", {}),
        }

        folio_path = FOLIO_TEMPLATES.get(folio_id)
        if not folio_path and str(folio_id).startswith("http"):
            folio_path = folio_id
        if not folio_path:
            return jsonify({"error": "Invalid folio selected"}), 400
        if not folio_path.startswith("http") and not os.path.exists(folio_path):
            return jsonify({"error": "Folio file not found"}), 400

        folio_even_id = data.get("folioEvenId", "")
        folio_even_path = FOLIO_TEMPLATES.get(folio_even_id)
        if not folio_even_path and str(folio_even_id).startswith("http"):
            folio_even_path = folio_even_id
        if folio_even_path:
            config["folioEvenPath"] = folio_even_path

        font_info = AVAILABLE_FONTS.get(font_id)
        if not font_info:
            return jsonify({"error": "Invalid font selected"}), 400
        font_path = os.path.join(FONT_FOLDER, font_info["file"])
        if not os.path.exists(font_path):
            return jsonify({"error": f"Font file not found: {font_info['file']}"}), 400

        generator = HandwritingGenerator(config, folio_path, font_path)
        all_page_lines = generator.split_into_pages(text)
        generator.total_pages = len(all_page_lines)
        total = len(all_page_lines)

        def stream():
            import json as _json
            import gc

            if not generation_semaphore.acquire(blocking=False):
                yield f"data: {_json.dumps({'type': 'error', 'message': 'Server sibuk, antrean penuh. Coba lagi dalam beberapa detik.'})}\n\n"
                return
            try:
                with _active_lock:
                    _active_folios.add(folio_path)
                    if folio_even_path:
                        _active_folios.add(folio_even_path)
                try:
                    yield f"data: {_json.dumps({'type': 'total', 'totalPages': total})}\n\n"

                    for idx, lines in enumerate(all_page_lines):
                        page_img = generator.generate_page(lines, idx + 1)
                        buf = io.BytesIO()
                        jpeg_quality = max(78, 92 - (total * 2)) if total > 5 else 92
                        page_img.save(buf, format="JPEG", quality=jpeg_quality, optimize=True)
                        buf.seek(0)
                        b64 = base64.b64encode(buf.getvalue()).decode()
                        payload = _json.dumps({
                            "type": "page", "page": idx + 1,
                            "image": f"data:image/jpeg;base64,{b64}",
                        })
                        yield f"data: {payload}\n\n"

                        del page_img, buf, b64, payload
                        with HandwritingGenerator._cache_lock:
                            if len(HandwritingGenerator._image_cache) > 2:
                                HandwritingGenerator._image_cache.clear()
                        if (idx + 1) % 2 == 0:
                            gc.collect()

                    gc.collect()
                    yield f"data: {_json.dumps({'type': 'done'})}\n\n"
                finally:
                    with _active_lock:
                        _active_folios.discard(folio_path)
                        if folio_even_path:
                            _active_folios.discard(folio_even_path)
            finally:
                generation_semaphore.release()
                import ctypes
                try:
                    ctypes.CDLL("libc.so.6").malloc_trim(0)
                except Exception:
                    pass

        origin = request.headers.get("Origin", "")
        cors_origin = (
            origin if origin in allowed_origins
            else (allowed_origins[-1] if allowed_origins else "*")
        )

        return current_app.response_class(
            stream(),
            mimetype="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",
                "Access-Control-Allow-Origin": cors_origin,
                "Access-Control-Allow-Credentials": "true",
                "Access-Control-Expose-Headers": "Content-Type",
            },
        )

    except Exception as e:
        return jsonify({"error": str(e)}), 500
