# Download routes blueprint (PNG, ZIP, PDF, Transparent)

import os
import io
import base64

from flask import Blueprint, request, jsonify, send_file
from PIL import Image
import numpy as np

download_bp = Blueprint("download", __name__)


@download_bp.route("/api/download/<int:page_num>", methods=["POST"])
def download_page(page_num):
    try:
        data = request.json
        raw = data.get("imageData", "").split(",")[-1]
        return send_file(
            io.BytesIO(base64.b64decode(raw)),
            mimetype="image/jpeg",
            as_attachment=True,
            download_name=f"tugas_halaman_{page_num}.jpg",
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@download_bp.route("/api/download/zip", methods=["POST"])
def download_zip():
    """Buat ZIP dari semua halaman di server."""
    import zipfile

    try:
        data = request.json
        pages = data.get("pages", [])
        if not pages:
            return jsonify({"error": "No pages provided"}), 400
        if len(pages) > 100:
            return jsonify({"error": "Maksimal 100 halaman per ZIP"}), 400

        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
            for p in pages:
                raw = p.get("image", "").split(",")[-1]
                zf.writestr(f"halaman_{p['page']}.jpg", base64.b64decode(raw))
        buf.seek(0)

        return send_file(buf, mimetype="application/zip", as_attachment=True,
                         download_name="Tugas_Handwriting.zip")
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@download_bp.route("/api/download-pdf", methods=["POST"])
def download_pdf():
    """Jahit gambar-gambar menjadi PDF A4 resolusi tinggi."""
    try:
        from fpdf import FPDF
        import tempfile

        data = request.json
        pages = data.get("pages", [])
        if not pages:
            return jsonify({"error": "No pages provided for PDF"}), 400
        if len(pages) > 100:
            return jsonify({"error": "Maksimal 100 halaman per PDF"}), 400

        pdf = FPDF(unit="mm", format="A4")
        pages = sorted(pages, key=lambda p: int(p.get("page", 0)))

        with tempfile.TemporaryDirectory() as temp_dir:
            for p in pages:
                raw = p.get("image", "").split(",")[-1]
                img_data = base64.b64decode(raw)
                temp_path = os.path.join(temp_dir, f"page_{p['page']}.jpg")
                with open(temp_path, "wb") as f:
                    f.write(img_data)
                pdf.add_page()
                pdf.image(temp_path, x=0, y=0, w=210, h=297)

            pdf_bytes = pdf.output(dest='S').encode('latin1')
            buf = io.BytesIO(pdf_bytes)
            buf.seek(0)

        return send_file(buf, mimetype="application/pdf", as_attachment=True,
                         download_name="Tugas_Handwriting.pdf")
    except Exception as e:
        print("PDF Generation Error:", e)
        return jsonify({"error": str(e)}), 500


@download_bp.route("/api/download/transparent", methods=["POST"])
def download_transparent():
    """Export tulisan tangan saja tanpa background folio (PNG transparan)."""
    try:
        data = request.json
        raw = data.get("imageData", "").split(",")[-1]
        img = Image.open(io.BytesIO(base64.b64decode(raw))).convert("RGBA")

        arr = np.array(img)
        r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
        luminance = 0.299 * r + 0.587 * g + 0.114 * b
        mask = luminance > 220
        arr[mask, 3] = 0

        result = Image.fromarray(arr)
        buf = io.BytesIO()
        result.save(buf, format="PNG")
        buf.seek(0)
        return send_file(buf, mimetype="image/png", as_attachment=True,
                         download_name="tulisan_transparan.png")
    except Exception as e:
        return jsonify({"error": str(e)}), 500
