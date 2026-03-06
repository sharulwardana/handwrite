import os
import time
import threading

from flask import Flask
from flask_cors import CORS
from PIL import Image
from dotenv import load_dotenv
import cloudinary

# ── SETUP & KONFIGURASI AWAL ─────────────────────────────────────────────────
Image.MAX_IMAGE_PIXELS = 100000000
load_dotenv()

cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
    secure=True,
)

# Import shared config (initializes folders, templates, fonts)
from config import (
    UPLOAD_FOLDER, FOLIO_TEMPLATES, allowed_origins,
    save_folio_cache, _active_lock, _active_folios, _folio_lock,
)

# Import route blueprints
from routes import generate_bp, folio_bp, download_bp, ai_bp, system_bp


def create_app():
    app = Flask(__name__)
    app.config["MAX_CONTENT_LENGTH"] = 50 * 1024 * 1024

    # ── Rate limiting ────────────────────────────────────────────────────
    try:
        from flask_limiter import Limiter
        from flask_limiter.util import get_remote_address
        from flask import request

        def get_limit_key():
            return request.headers.get("X-User-Email") or get_remote_address()

        limiter = Limiter(
            get_limit_key, app=app, default_limits=[], storage_uri="memory://"
        )
        # Apply rate limits to specific blueprints/endpoints
        limiter.limit("30 per minute")(generate_bp)  # preview
        limiter.limit("10 per minute")(folio_bp)  # upload limit

    except ImportError:
        print("⚠️  flask-limiter not installed. Rate limiting disabled.")

    # ── CORS ─────────────────────────────────────────────────────────────
    CORS(app, resources={r"/api/*": {"origins": allowed_origins}})

    # ── Register Blueprints ──────────────────────────────────────────────
    app.register_blueprint(generate_bp)
    app.register_blueprint(folio_bp)
    app.register_blueprint(download_bp)
    app.register_blueprint(ai_bp)
    app.register_blueprint(system_bp)

    return app


app = create_app()


# ── FITUR: BACKGROUND CLEANUP ───────────────────────────────────────────
def cleanup_old_folios(folder_path, max_age_hours=24):
    """Hapus file gambar yang usianya lebih dari max_age_hours. Berjalan di background."""
    while True:
        try:
            now = time.time()
            if os.path.exists(folder_path):
                for filename in os.listdir(folder_path):
                    if not filename.lower().endswith((".png", ".jpg", ".jpeg")):
                        continue
                    filepath = os.path.join(folder_path, filename)
                    with _active_lock:
                        if filepath in _active_folios:
                            continue
                    file_modified_time = os.path.getmtime(filepath)
                    age_in_hours = (now - file_modified_time) / 3600
                    if age_in_hours > max_age_hours:
                        os.remove(filepath)
                        print(f"🧹 [Cleanup] File folio lama dihapus: {filename}")
                        with _folio_lock:
                            keys_to_delete = [
                                k for k, v in FOLIO_TEMPLATES.items() if v == filepath
                            ]
                            for k in keys_to_delete:
                                del FOLIO_TEMPLATES[k]
                save_folio_cache()
        except Exception as e:
            print(f"⚠️ [Cleanup Error]: {e}")
        finally:
            time.sleep(3600)


cleanup_thread = threading.Thread(
    target=cleanup_old_folios,
    args=(UPLOAD_FOLDER, 24),
    daemon=True,
)
cleanup_thread.start()

if __name__ == "__main__":
    app.run(
        debug=os.getenv("FLASK_DEBUG", "False").lower() == "true",
        host="0.0.0.0",
        port=int(os.getenv("PORT", 5000)),
    )
