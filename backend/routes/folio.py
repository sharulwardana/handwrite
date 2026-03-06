# Folio management route blueprint

import os
import mimetypes

from flask import Blueprint, request, jsonify, send_file
from PIL import Image
from werkzeug.utils import secure_filename
import cloudinary
import cloudinary.uploader
import cloudinary.api
import numpy as np
import requests as http_requests

from config import (
    FOLIO_TEMPLATES, UPLOAD_FOLDER, ALLOWED_EXTENSIONS,
    load_folio_templates, save_folio_cache,
)

folio_bp = Blueprint("folio", __name__)


def analyze_folio(image_path_or_url):
    """Auto-detect garis folio dan return config yang optimal + confidence score."""
    try:
        if image_path_or_url.startswith("http"):
            response = http_requests.get(image_path_or_url, stream=True, timeout=10)
            try:
                img_color = Image.open(response.raw).convert("RGB")
            finally:
                response.raw.close()
        else:
            img_color = Image.open(image_path_or_url).convert("RGB")

        img = img_color.convert("L")
        width, height = img.size
        arr = np.array(img)
        arr_color = np.array(img_color)

        confidence_points = 0
        confidence_max = 0

        # 1. Deteksi garis horizontal
        confidence_max += 50
        row_means = arr.mean(axis=1)
        threshold = row_means.mean() - 8
        line_rows = np.where(row_means < threshold)[0]

        lines = []
        if len(line_rows) > 0:
            group = [line_rows[0]]
            for r in line_rows[1:]:
                if r - group[-1] <= 3:
                    group.append(r)
                else:
                    lines.append(int(np.mean(group)))
                    group = [r]
            lines.append(int(np.mean(group)))

        if len(lines) < 2:
            return None

        line_gaps = [lines[i + 1] - lines[i] for i in range(len(lines) - 1)]
        median_gap = np.median(line_gaps)
        normal_gaps = [g for g in line_gaps if abs(g - median_gap) <= 5]
        avg_gap = float(np.mean(normal_gaps)) if normal_gaps else float(median_gap)
        line_confidence = min(50, int((len(lines) / 20) * 50))
        confidence_points += line_confidence

        # 2. Deteksi garis vertikal (margin kiri)
        confidence_max += 20
        col_means = arr.mean(axis=0)
        col_threshold = col_means.mean() - 10
        left_area = col_means[: int(width * 0.25)]
        dark_cols = np.where(left_area < col_threshold)[0]

        start_x = 60
        if len(dark_cols) > 0:
            margin_col = int(dark_cols[-1])
            start_x = margin_col + int(width * 0.015)
            confidence_points += 20

        # 3. Deteksi warna garis
        confidence_max += 20
        line_color = "gray"
        if len(lines) > 0:
            sample_row = lines[0]
            row_start = max(0, sample_row - 2)
            row_end = min(height, sample_row + 2)
            sample_pixels = arr_color[row_start:row_end, :, :]
            avg_r = float(np.mean(sample_pixels[:, :, 0]))
            avg_g = float(np.mean(sample_pixels[:, :, 1]))
            avg_b = float(np.mean(sample_pixels[:, :, 2]))

            if avg_r > avg_b + 30 and avg_r > avg_g + 20:
                line_color = "red"
            elif avg_b > avg_r + 30 and avg_b > avg_g + 10:
                line_color = "blue"
            elif avg_r > 180 and avg_g > 180 and avg_b > 180:
                line_color = "light"
            else:
                line_color = "gray"
            confidence_points += 20

        # 4. Deteksi tipe kertas
        confidence_max += 10
        paper_type = "lined"
        right_dark = np.where(col_means[int(width * 0.25):] < col_threshold)[0]
        if len(right_dark) > 8:
            paper_type = "grid"
        confidence_points += 10

        # 5. Confidence score
        confidence = int((confidence_points / confidence_max) * 100)
        confidence = max(10, min(100, confidence))

        return {
            "startX": start_x,
            "startY": lines[0] + int(avg_gap * 0.5),
            "lineHeight": avg_gap,
            "maxWidth": int(width * 0.93),
            "pageBottom": lines[-1] + int(avg_gap * 0.3),
            "fontSize": int(avg_gap * 0.6),
            "confidence": confidence,
            "lineColor": line_color,
            "paperType": paper_type,
            "detectedLines": len(lines),
        }

    except Exception as e:
        print("Analyze folio error:", e)
        return None


@folio_bp.route("/api/folios", methods=["GET"])
def get_folios():
    load_folio_templates()
    folios = []

    for filename in FOLIO_TEMPLATES:
        if not filename.startswith("http"):
            name = filename
            for ext in [".jpg", ".jpeg", ".png", ".JPG", ".JPEG", ".PNG"]:
                name = name.replace(ext, "")
            folios.append({
                "id": filename,
                "name": name.replace("_", " ").replace("-", " ").title(),
                "preview": f"/api/folio/preview/{filename}",
            })

    try:
        resources = cloudinary.api.resources(
            type="upload", prefix="handwrite_folios/", max_results=30
        )
        for res in resources.get("resources", []):
            name = (res["public_id"].split("/")[-1]
                    .replace("_", " ").replace("-", " ").title())
            url = res["secure_url"]
            folios.append({"id": url, "name": name, "preview": url})
            FOLIO_TEMPLATES[url] = url
    except Exception as e:
        print("Cloudinary info:", e)

    return jsonify({"folios": folios})


@folio_bp.route("/api/folio/preview/<filename>", methods=["GET"])
def get_folio_preview(filename):
    filepath = os.path.join(UPLOAD_FOLDER, secure_filename(filename))
    if os.path.exists(filepath):
        mt, _ = mimetypes.guess_type(filepath)
        return send_file(filepath, mimetype=mt or "image/jpeg")
    return jsonify({"error": "Folio not found"}), 404


@folio_bp.route("/api/folio/analyze/<path:folio_id>", methods=["GET"])
def analyze_folio_route(folio_id):
    from urllib.parse import unquote

    folio_id = unquote(folio_id)
    folio_path = FOLIO_TEMPLATES.get(folio_id)
    if not folio_path and str(folio_id).startswith("http"):
        folio_path = folio_id
    if not folio_path:
        return jsonify({"error": "Folio not found"}), 404

    result = analyze_folio(folio_path)
    if result:
        config_keys = ["startX", "startY", "lineHeight", "maxWidth", "pageBottom", "fontSize"]
        config = {k: result[k] for k in config_keys if k in result}
        meta = {k: result[k] for k in result if k not in config_keys}
        return jsonify({"success": True, "config": config, "meta": meta})
    else:
        return jsonify({"success": False, "message": "Garis tidak terdeteksi"}), 200


@folio_bp.route("/api/folio/upload", methods=["POST"])
def upload_folio():
    if "folio" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["folio"]
    if not file.filename:
        return jsonify({"error": "No file selected"}), 400

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        return jsonify({"error": "Format file tidak didukung. Harap upload gambar JPG atau PNG."}), 400

    file.seek(0)
    header = file.read(8)
    file.seek(0)
    MAGIC_BYTES = {b"\x89PNG": ".png", b"\xff\xd8\xff": ".jpg"}
    is_valid = any(header.startswith(magic) for magic in MAGIC_BYTES)
    if not is_valid:
        return jsonify({"error": "File korup atau bukan gambar yang valid"}), 400

    try:
        img_check = Image.open(file)
        width, height = img_check.size
        if width > 3500 or height > 4500:
            return jsonify({"error": f"Resolusi gambar terlalu raksasa ({width}x{height}). Maksimal 3500x4500 piksel."}), 400
        file.seek(0)
    except Exception:
        return jsonify({"error": "File tidak bisa dibaca sebagai gambar yang valid."}), 400

    try:
        upload_result = cloudinary.uploader.upload(file, folder="handwrite_folios")
        secure_url = upload_result["secure_url"]
        FOLIO_TEMPLATES[secure_url] = secure_url
        save_folio_cache()
        return jsonify({"success": True, "filename": secure_url})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
