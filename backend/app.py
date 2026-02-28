import os
import io
import base64
import json
import mimetypes
import random
import time
import threading

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from PIL import Image, ImageDraw  # <-- ImageDraw kita kembalikan ke sini
import cloudinary
import cloudinary.uploader
import cloudinary.api
import requests
import numpy as np
from google import genai
from dotenv import load_dotenv
from werkzeug.utils import secure_filename

# Import buatan sendiri
from handwriting_analyzer import analyze_handwriting
from handwriting_generator import HandwritingGenerator

# ── SETUP & KONFIGURASI AWAL ─────────────────────────────────────────────────

# Posisikan kode eksekusi di bawah SETELAH semua import selesai
Image.MAX_IMAGE_PIXELS = 100000000

load_dotenv()

cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
    secure=True,
)

# Konfigurasi Gemini API (SDK Baru)
ai_client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

app = Flask(__name__)

# ── Rate limiting ────────────────────────────────────────────────────────────
try:
    from flask_limiter import Limiter
    from flask_limiter.util import get_remote_address

    # Fitur Baru: Cek limit berdasarkan email user, jika tidak login baru pakai IP
    def get_limit_key():
        return request.headers.get("X-User-Email") or get_remote_address()

    limiter = Limiter(
        get_limit_key, app=app, default_limits=[], storage_uri="memory://"
    )
    RATE_LIMIT_ENABLED = True
except ImportError:
    # flask-limiter belum diinstall — jalankan: pip install flask-limiter
    limiter = None
    RATE_LIMIT_ENABLED = False
    print("⚠️  flask-limiter not installed. Rate limiting disabled.")

# Ubah baris ini di app.py
allowed_origins = [
    "http://localhost:3000",
    os.getenv("FRONTEND_URL", "https://handwrite-ai.vercel.app"),
]
CORS(app, resources={r"/api/*": {"origins": allowed_origins}})


def apply_rate_limit(f, limit="15 per minute"):
    """Decorator aman: terapkan rate limit hanya jika flask-limiter tersedia."""
    if RATE_LIMIT_ENABLED and limiter:
        return limiter.limit(limit)(f)
    return f


def rate_limit_strict(f):
    """Rate limit ketat untuk endpoint berat (generate stream)."""
    return apply_rate_limit(f, "10 per minute")


def rate_limit_loose(f):
    """Rate limit longgar untuk endpoint ringan (preview)."""
    return apply_rate_limit(f, "30 per minute")


UPLOAD_FOLDER = "uploads/folios"
CACHE_FOLDER = "uploads/cache"
FONT_FOLDER = "fonts"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(CACHE_FOLDER, exist_ok=True)
os.makedirs(FONT_FOLDER, exist_ok=True)
app.config["MAX_CONTENT_LENGTH"] = 50 * 1024 * 1024

FOLIO_TEMPLATES = {}
CACHE_FILE = "uploads/cache/folio_cache.json"

_active_folios = set()
_active_lock = threading.Lock()
_folio_lock = threading.Lock()
generation_semaphore = threading.Semaphore(3)  # Max 3 generate sekaligus


def save_folio_cache():
    try:
        with open(CACHE_FILE, "w") as f:
            json.dump(FOLIO_TEMPLATES, f)
    except Exception as e:
        print("Cache save error:", e)


def load_folio_cache():
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, "r") as f:
                cached = json.load(f)
            # Hanya load cache yang file-nya masih ada
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


load_folio_templates()
load_folio_cache()

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


def analyze_folio(image_path_or_url):
    """Auto-detect garis folio dan return config yang optimal + confidence score"""
    try:
        if image_path_or_url.startswith("http"):
            response = requests.get(image_path_or_url, stream=True, timeout=10)
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

        confidence_points = 0  # Akumulasi poin untuk confidence score
        confidence_max = 0

        # ── 1. DETEKSI GARIS HORIZONTAL ─────────────────────────────────────
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
        # Gunakan desimal (float) agar jarak baris 100% presisi sampai halaman paling bawah
        avg_gap = float(np.mean(line_gaps))

        # Makin banyak garis terdeteksi, makin tinggi confidence
        line_confidence = min(50, int((len(lines) / 20) * 50))
        confidence_points += line_confidence

        # ── 2. DETEKSI GARIS VERTIKAL (MARGIN KIRI) ─────────────────────────
        confidence_max += 20
        col_means = arr.mean(axis=0)
        col_threshold = col_means.mean() - 10

        # Cari kolom gelap di area kiri (0-25% lebar gambar)
        left_area = col_means[: int(width * 0.25)]
        dark_cols = np.where(left_area < col_threshold)[0]

        start_x = 60  # Default jika tidak ditemukan margin
        if len(dark_cols) > 0:
            # Ambil kolom paling kanan dari cluster garis vertikal di kiri
            margin_col = int(dark_cols[-1])
            # Tambah padding setelah garis margin
            start_x = margin_col + int(width * 0.015)
            confidence_points += 20

        # ── 3. DETEKSI WARNA GARIS ──────────────────────────────────────────
        confidence_max += 20
        line_color = "gray"  # Default

        if len(lines) > 0:
            # Ambil sample pixel di sekitar garis pertama
            sample_row = lines[0]
            row_start = max(0, sample_row - 2)
            row_end = min(height, sample_row + 2)
            sample_pixels = arr_color[row_start:row_end, :, :]

            avg_r = float(np.mean(sample_pixels[:, :, 0]))
            avg_g = float(np.mean(sample_pixels[:, :, 1]))
            avg_b = float(np.mean(sample_pixels[:, :, 2]))

            # Klasifikasi warna garis
            if avg_r > avg_b + 30 and avg_r > avg_g + 20:
                line_color = "red"  # Buku tulis bergaris merah
            elif avg_b > avg_r + 30 and avg_b > avg_g + 10:
                line_color = "blue"  # Buku tulis bergaris biru
            elif avg_r > 180 and avg_g > 180 and avg_b > 180:
                line_color = "light"  # Garis sangat tipis / hampir putih
            else:
                line_color = "gray"  # Folio standar bergaris abu

            confidence_points += 20

        # ── 4. DETEKSI TIPE KERTAS (LINED vs GRID) ──────────────────────────
        confidence_max += 10
        paper_type = "lined"  # Default

        # Grid hanya jika ada >8 kolom gelap yang TERSEBAR merata di seluruh lebar gambar
        # bukan hanya di area kiri (yang berarti margin)
        right_dark = np.where(col_means[int(width * 0.25) :] < col_threshold)[0]
        if len(right_dark) > 8:
            paper_type = "grid"
        confidence_points += 10

        # ── 5. HITUNG CONFIDENCE SCORE ──────────────────────────────────────
        confidence = int((confidence_points / confidence_max) * 100)
        confidence = max(10, min(100, confidence))

        return {
            "startX": start_x,
            "startY": lines[0] + int(avg_gap * 0.5),
            "lineHeight": avg_gap,
            "maxWidth": int(width * 0.93),
            "pageBottom": lines[-1] + int(avg_gap * 0.3),
            "fontSize": int(avg_gap * 0.6),
            # Info tambahan untuk frontend
            "confidence": confidence,
            "lineColor": line_color,
            "paperType": paper_type,
            "detectedLines": len(lines),
        }

    except Exception as e:
        print("Analyze folio error:", e)
        return None


# ── ROUTES ──────────────────────────────────────────────────────────────────


@app.route("/api/analyze-handwriting", methods=["POST"])
def analyze_handwriting_endpoint():
    """Analisis foto tulisan tangan user, return config yang disarankan."""
    try:
        if "image" not in request.files:
            return jsonify({"error": "No image uploaded"}), 400

        file = request.files["image"]
        image_bytes = file.read()

        if len(image_bytes) > 10 * 1024 * 1024:  # max 10MB
            return jsonify({"error": "File terlalu besar, max 10MB"}), 400

        result = analyze_handwriting(image_bytes)
        return jsonify({"success": True, "config": result})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/preview", methods=["POST"])
@rate_limit_loose
def generate_preview():
    """Generate 1 baris tulisan tangan untuk preview sidebar."""
    try:
        data = request.json
        font_id = data.get("fontId", "indie_flower")
        folio_id = data.get("folioId", "")
        preview_text = data.get("text", "Halo Dunia, ini contoh tulisan.")[:60]

        config = {
            "startX": 80,
            "startY": 140,
            "lineHeight": 80,
            "maxWidth": 900,
            "pageBottom": 400,
            "fontSize": int(data.get("fontSize", 60)),
            "color": data.get("color", "#1a1a1a"),
            "wordSpacing": int(data.get("wordSpacing", 8)),
            "leftHanded": data.get("leftHanded", False),
            "writeSpeed": float(data.get("writeSpeed", 0.5)),
            "enableTypo": False,  # preview jangan ada typo
            "slantAngle": float(data.get("slantAngle", 0)),
            "tiredMode": False,
            "showPageNumber": False,
            "pageNumberFormat": "- {n} -",
            "marginJitter": 0,
            "folioEvenPath": None,
            "enableDropCap": False,  # <--- TAMBAHAN UNTUK MENCEGAH ERROR 500
            "watermarkText": "",  # <--- TAMBAHAN UNTUK MENCEGAH ERROR 500
        }

        folio_path = FOLIO_TEMPLATES.get(folio_id)
        if not folio_path:
            # Fallback: pakai folio pertama yang ada
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

        # Crop hanya area baris pertama — jauh lebih cepat dari full halaman
        full_img = generator.folio_odd.copy()
        crop_h = int(config["startY"] + config["fontSize"] * 2.5)
        cropped = full_img.crop((0, 0, full_img.width, crop_h))

        # Gambar 1 baris saja
        text_layer = Image.new("RGBA", full_img.size, (0, 0, 0, 0))
        draw = ImageDraw.Draw(text_layer, "RGBA")
        generator.add_humanizer_effect(
            text_layer, draw, preview_text, config["startX"], config["startY"]
        )

        # Composite & crop
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


@app.route("/api/fonts", methods=["GET"])
def get_fonts():
    available = {
        k: v
        for k, v in AVAILABLE_FONTS.items()
        if os.path.exists(os.path.join(FONT_FOLDER, v["file"]))
    }
    return jsonify({"fonts": available})


@app.route("/api/folios", methods=["GET"])
def get_folios():
    load_folio_templates()
    folios = []

    # 1. Load template lokal
    for filename in FOLIO_TEMPLATES:
        if not filename.startswith("http"):
            name = filename
            for ext in [".jpg", ".jpeg", ".png", ".JPG", ".JPEG", ".PNG"]:
                name = name.replace(ext, "")
            folios.append(
                {
                    "id": filename,
                    "name": name.replace("_", " ").replace("-", " ").title(),
                    "preview": f"/api/folio/preview/{filename}",
                }
            )

    # 2. Load template dari Cloudinary
    try:
        resources = cloudinary.api.resources(
            type="upload", prefix="handwrite_folios/", max_results=30
        )
        for res in resources.get("resources", []):
            name = (
                res["public_id"]
                .split("/")[-1]
                .replace("_", " ")
                .replace("-", " ")
                .title()
            )
            url = res["secure_url"]
            folios.append({"id": url, "name": name, "preview": url})
            FOLIO_TEMPLATES[url] = url
    except Exception as e:
        print("Cloudinary info:", e)

    return jsonify({"folios": folios})


@app.route("/api/folio/preview/<filename>", methods=["GET"])
def get_folio_preview(filename):
    filepath = os.path.join(UPLOAD_FOLDER, secure_filename(filename))
    if os.path.exists(filepath):
        mt, _ = mimetypes.guess_type(filepath)
        return send_file(filepath, mimetype=mt or "image/jpeg")
    return jsonify({"error": "Folio not found"}), 404


@app.route("/api/folio/analyze/<path:folio_id>", methods=["GET"])
def analyze_folio_route(folio_id):
    from urllib.parse import unquote

    folio_id = unquote(folio_id)
    folio_path = FOLIO_TEMPLATES.get(folio_id)

    # KODE BARU: Bypass multi-worker Railway
    if not folio_path and str(folio_id).startswith("http"):
        folio_path = folio_id

    if not folio_path:
        return jsonify({"error": "Folio not found"}), 404

    result = analyze_folio(folio_path)
    if result:
        # Pisahkan config dari metadata
        config_keys = [
            "startX",
            "startY",
            "lineHeight",
            "maxWidth",
            "pageBottom",
            "fontSize",
        ]
        config = {k: result[k] for k in config_keys if k in result}
        meta = {k: result[k] for k in result if k not in config_keys}
        return jsonify({"success": True, "config": config, "meta": meta})
    else:
        return jsonify({"success": False, "message": "Garis tidak terdeteksi"}), 200


ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg"}


@app.route("/api/folio/upload", methods=["POST"])
def upload_folio():
    if "folio" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["folio"]
    if not file.filename:
        return jsonify({"error": "No file selected"}), 400

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        return (
            jsonify(
                {
                    "error": "Format file tidak didukung. Harap upload gambar JPG atau PNG."
                }
            ),
            400,
        )

    # Cek magic bytes untuk memastikan file benar-benar gambar
    file.seek(0)
    header = file.read(8)
    file.seek(0)
    MAGIC_BYTES = {
        b"\x89PNG": ".png",
        b"\xff\xd8\xff": ".jpg",
    }
    is_valid = any(header.startswith(magic) for magic in MAGIC_BYTES)
    if not is_valid:
        return jsonify({"error": "File korup atau bukan gambar yang valid"}), 400

    # --- FITUR BARU: Validasi Resolusi Gambar Maksimal ---
    try:
        img_check = Image.open(file)
        width, height = img_check.size
        if width > 3500 or height > 4500:
            return (
                jsonify(
                    {
                        "error": f"Resolusi gambar terlalu raksasa ({width}x{height}). Maksimal 3500x4500 piksel agar server tidak nge-lag."
                    }
                ),
                400,
            )
        file.seek(0)  # Kembalikan kursor file ke awal setelah dibaca PIL
    except Exception:
        return (
            jsonify({"error": "File tidak bisa dibaca sebagai gambar yang valid."}),
            400,
        )
    # -----------------------------------------------------

    try:
        upload_result = cloudinary.uploader.upload(file, folder="handwrite_folios")
        secure_url = upload_result["secure_url"]
        FOLIO_TEMPLATES[secure_url] = secure_url
        save_folio_cache()
        return jsonify({"success": True, "filename": secure_url})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/ai-writer", methods=["POST"])
def ai_writer():
    try:
        data = request.json
        prompt = data.get("prompt", "")
        if not prompt.strip():
            return jsonify({"error": "Prompt tidak boleh kosong"}), 400

        # System prompt: Paksa AI merespons tanpa Markdown (bintang/pagar) karena akan ditulis tangan
        full_prompt = (
            "Kamu adalah asisten pelajar. Tuliskan teks untuk tugas sekolah/kuliah berdasarkan instruksi berikut. "
            "PENTING: Jangan gunakan formatting Markdown seperti **tebal**, *miring*, atau # heading, karena teks ini "
            "akan dikonversi menjadi tulisan tangan biasa. Tulis dengan paragraf biasa.\n\n"
            f"Instruksi: {prompt}"
        )

        # Memanggil Gemini menggunakan SDK versi terbaru dan model Gemini 2.5 Flash
        response = ai_client.models.generate_content(
            model="gemini-2.5-flash", contents=full_prompt
        )

        return jsonify({"success": True, "text": response.text})

    except Exception as e:
        print("Gemini API Error:", e)
        return jsonify({"error": str(e)}), 500


@app.route("/api/ai-expand", methods=["POST"])
def ai_expand():
    """Parafrase & panjangkan teks agar lolos plagiasi dan pas 1 halaman folio."""
    try:
        data = request.json
        text = data.get("text", "")
        if not text.strip():
            return jsonify({"error": "Teks tidak boleh kosong"}), 400

        # Prompt khusus AI Anti-Deteksi
        full_prompt = (
            "Kamu adalah seorang pelajar/mahasiswa. Tugasmu adalah memparafrase dan memperluas materi dari teks berikut "
            "agar terlihat lebih natural, elaboratif, tidak terdeteksi sebagai hasil copas dari Wikipedia/AI, "
            "dan cukup panjang/detail untuk memenuhi setidaknya 1 hingga 2 halaman folio penuh.\n\n"
            "Aturan ketat:\n"
            "1. JANGAN gunakan formatting Markdown seperti **tebal**, *miring*, atau # heading.\n"
            "2. Gunakan bahasa Indonesia yang baik, mengalir, dan seperti esai pemikiran manusia.\n"
            "3. BERIKAN HANYA TEKS HASILNYA SAJA, tanpa kalimat pembuka/penutup seperti 'Tentu, ini hasilnya'.\n\n"
            f"Teks asli:\n{text}"
        )

        response = ai_client.models.generate_content(
            model="gemini-2.5-flash", contents=full_prompt
        )

        return jsonify({"success": True, "text": response.text})

    except Exception as e:
        print("Gemini API Error:", e)
        return jsonify({"error": str(e)}), 500


@app.route("/api/download/<int:page_num>", methods=["POST"])
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


@app.route("/api/download/zip", methods=["POST"])
def download_zip():
    """Buat ZIP dari semua halaman di server, kirim sebagai stream."""
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

        return send_file(
            buf,
            mimetype="application/zip",
            as_attachment=True,
            download_name="Tugas_Handwriting.zip",
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/download/transparent", methods=["POST"])
def download_transparent():
    """Export tulisan tangan saja tanpa background folio (PNG transparan)."""
    try:
        data = request.json
        raw = data.get("imageData", "").split(",")[-1]
        img = Image.open(io.BytesIO(base64.b64decode(raw))).convert("RGBA")

        # Hapus background putih/kertas — jadikan transparan
        arr = np.array(img)
        # Pixel yang sangat terang (kertas) → transparan
        r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
        luminance = 0.299 * r + 0.587 * g + 0.114 * b
        mask = luminance > 220  # Threshold kertas
        arr[mask, 3] = 0  # Jadikan transparan

        result = Image.fromarray(arr)
        buf = io.BytesIO()
        result.save(buf, format="PNG")
        buf.seek(0)
        return send_file(
            buf,
            mimetype="image/png",
            as_attachment=True,
            download_name="tulisan_transparan.png",
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/generate/stream", methods=["POST"])
@rate_limit_strict
def generate_handwriting_stream():
    """Streaming endpoint — kirim halaman satu per satu (Server-Sent Events)."""
    try:
        data = request.json
        text = data.get("text", "")
        if not text.strip():
            return jsonify({"error": "No text provided"}), 400
        if len(text) > 50000:
            return (
                jsonify({"error": "Teks terlalu panjang. Maksimal 50.000 karakter."}),
                400,
            )

        folio_id = data.get("folioId", "")
        font_id = data.get("fontId", "indie_flower")
        seed = data.get("seed")
        if seed is not None:
            random.seed(seed)

        config = {
            "startX": 100,
            "startY": 125,
            "lineHeight": 83,
            "maxWidth": 2205,
            "pageBottom": 3320,
            "fontSize": 60,
            "color": "#2b2b2b",
            "wordSpacing": 8,
            "leftHanded": False,
            "writeSpeed": 0.5,
            "enableTypo": True,
            "slantAngle": 0,
            "tiredMode": False,
            "showPageNumber": False,
            "pageNumberFormat": "- {n} -",
            "marginJitter": 6,
            "folioEvenPath": None,
            "watermarkText": "",  # [BARU] teks watermark diagonal tipis
            **data.get("config", {}),
        }

        folio_path = FOLIO_TEMPLATES.get(folio_id)

        # KODE BARU: Bypass memory worker, izinkan jika folio adalah URL valid
        if not folio_path and str(folio_id).startswith("http"):
            folio_path = folio_id

        if not folio_path:
            return jsonify({"error": "Invalid folio selected"}), 400
        if not folio_path.startswith("http") and not os.path.exists(folio_path):
            return jsonify({"error": "Folio file not found"}), 400

        folio_even_id = data.get("folioEvenId", "")
        folio_even_path = FOLIO_TEMPLATES.get(folio_even_id)

        # KODE BARU: Bypass memory untuk folio genap
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
            # Import ditaruh di luar loop agar tidak dipanggil berulang kali
            import json as _json
            import gc

            if not generation_semaphore.acquire(blocking=False):
                yield f"data: {_json.dumps({'type': 'error', 'message': 'Server sibuk, antrean penuh. Coba lagi dalam beberapa detik.'})}\n\n"
                return
            try:
                # Tandai folio sedang dipakai
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
                        page_img.save(
                            buf, format="JPEG", quality=jpeg_quality, optimize=True
                        )
                        buf.seek(0)

                        b64 = base64.b64encode(buf.getvalue()).decode()
                        payload = _json.dumps(
                            {
                                "type": "page",
                                "page": idx + 1,
                                "image": f"data:image/jpeg;base64,{b64}",
                            }
                        )
                        yield f"data: {payload}\n\n"

                        # Hapus variabel besar
                        del page_img
                        del buf
                        del b64
                        del payload

                        # Hapus cache gambar grafis untuk mencegah RAM jebol (OOM)
                        with HandwritingGenerator._cache_lock:
                            if len(HandwritingGenerator._image_cache) > 2:
                                HandwritingGenerator._image_cache.clear()

                        import ctypes

                        try:
                            # Paksa Linux/Server membebaskan RAM secara instan
                            ctypes.CDLL("libc.so.6").malloc_trim(0)
                        except Exception:
                            pass

                        # Jalankan Garbage Collection setiap 2 halaman
                        if (idx + 1) % 2 == 0:
                            gc.collect()

                    # Pembersihan final
                    gc.collect()
                    yield f"data: {_json.dumps({'type': 'done'})}\n\n"
                finally:
                    with _active_lock:
                        _active_folios.discard(folio_path)
                        if folio_even_path:
                            _active_folios.discard(folio_even_path)
            finally:
                generation_semaphore.release()

        # CORS header harus ditambahkan MANUAL di streaming response
        # karena Flask-CORS tidak otomatis inject ke app.response_class()
        origin = request.headers.get("Origin", "")
        cors_origin = (
            origin
            if origin in allowed_origins
            else (allowed_origins[-1] if allowed_origins else "*")
        )

        return app.response_class(
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


@app.route("/api/cache/save", methods=["POST"])
def cache_save():
    """Simpan session_id + pages ke file JSON di disk agar RAM server tidak jebol."""
    import re

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

        # Hapus cache lama jika sudah lebih dari 50 file
        cache_files = sorted(
            [
                f
                for f in os.listdir(CACHE_FOLDER)
                if f.startswith("cache_") and f.endswith(".json")
            ],
            key=lambda f: os.path.getmtime(os.path.join(CACHE_FOLDER, f)),
        )
        while len(cache_files) > 50:
            os.remove(os.path.join(CACHE_FOLDER, cache_files.pop(0)))

        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/cache/load/<session_id>", methods=["GET"])
def cache_load(session_id):
    """Load hasil generate dari file JSON di disk."""
    cache_path = os.path.join(CACHE_FOLDER, f"cache_{secure_filename(session_id)}.json")
    if not os.path.exists(cache_path):
        return jsonify({"found": False}), 200  # <--- Ubah 404 menjadi 200

    try:
        with open(cache_path, "r") as f:
            pages = json.load(f)
        return jsonify({"found": True, "pages": pages})
    except Exception:
        return jsonify({"found": False}), 200  # <--- Ubah 500 menjadi 200


@app.route("/health", methods=["GET"])
@app.route("/api/health", methods=["GET"])
def health_check():
    import gc

    # Memory monitoring
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

    # Image cache stats
    with HandwritingGenerator._cache_lock:
        cache_items = len(HandwritingGenerator._image_cache)

    # Disk cache size
    cache_disk_mb = 0
    try:
        for f in os.listdir(CACHE_FOLDER):
            fp = os.path.join(CACHE_FOLDER, f)
            if os.path.isfile(fp):
                cache_disk_mb += os.path.getsize(fp)
        cache_disk_mb = round(cache_disk_mb / 1024 / 1024, 1)
    except Exception:
        pass

    return jsonify(
        {
            "status": "healthy",
            "version": "1.3.0",
            "rate_limiting": RATE_LIMIT_ENABLED,
            "available_fonts": len(
                [
                    k
                    for k, v in AVAILABLE_FONTS.items()
                    if os.path.exists(os.path.join(FONT_FOLDER, v["file"]))
                ]
            ),
            "available_folios": len(FOLIO_TEMPLATES),
            "memory": mem_info,
            "image_cache_items": cache_items,
            "disk_cache_mb": cache_disk_mb,
        }
    )


# ── FITUR BARU: BACKGROUND CLEANUP ───────────────────────────────────────────
def cleanup_old_folios(folder_path, max_age_hours=24):
    """
    Mengecek dan menghapus file gambar di folder yang usianya lebih dari max_age_hours.
    Fungsi ini berjalan terus-menerus di background (daemon thread) setiap 1 jam.
    """
    while True:
        try:
            now = time.time()
            if os.path.exists(folder_path):
                for filename in os.listdir(folder_path):
                    # Hanya proses file gambar
                    if not filename.lower().endswith((".png", ".jpg", ".jpeg")):
                        continue

                    filepath = os.path.join(folder_path, filename)

                    # Cek apakah file ini sedang dipakai untuk generate
                    with _active_lock:
                        if filepath in _active_folios:
                            continue  # Skip, jangan dihapus dulu

                    # Cek umur file berdasarkan waktu terakhir dimodifikasi (modified time)
                    file_modified_time = os.path.getmtime(filepath)
                    age_in_hours = (now - file_modified_time) / 3600

                    # Jika lebih dari 24 jam, hapus file tersebut
                    if age_in_hours > max_age_hours:
                        os.remove(filepath)
                        print(f"🧹 [Cleanup] File folio lama dihapus: {filename}")

                        # Hapus juga dari dictionary FOLIO_TEMPLATES jika ada
                        with _folio_lock:
                            keys_to_delete = [
                                k for k, v in FOLIO_TEMPLATES.items() if v == filepath
                            ]
                            for k in keys_to_delete:
                                del FOLIO_TEMPLATES[k]

                # Update file cache JSON setelah penghapusan
                save_folio_cache()

        except Exception as e:
            print(f"⚠️ [Cleanup Error]: {e}")

        finally:
            # Jeda selama 1 jam (3600 detik) selalu dieksekusi walau ada error
            time.sleep(3600)


# Jalankan thread cleanup sebagai daemon (otomatis mati jika server Flask mati)
cleanup_thread = threading.Thread(
    target=cleanup_old_folios,
    args=(UPLOAD_FOLDER, 24),  # 24 adalah batas usianya (dalam jam)
    daemon=True,
)
cleanup_thread.start()
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    app.run(
        debug=os.getenv("FLASK_DEBUG", "False").lower() == "true",
        host="0.0.0.0",
        port=int(os.getenv("PORT", 5000)),
    )
