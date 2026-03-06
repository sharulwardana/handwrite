# Routes package
from routes.generate import generate_bp
from routes.folio import folio_bp
from routes.download import download_bp
from routes.ai import ai_bp
from routes.system import system_bp

__all__ = ["generate_bp", "folio_bp", "download_bp", "ai_bp", "system_bp"]
