# AI routes blueprint (AI Writer, AI Expand)

import os
from flask import Blueprint, request, jsonify
from google import genai
from dotenv import load_dotenv
from pydantic import ValidationError

load_dotenv()

ai_bp = Blueprint("ai", __name__)

# Konfigurasi Gemini API
ai_client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))


@ai_bp.route("/api/ai-writer", methods=["POST"])
def ai_writer():
    try:
        from models.validators import AIWriterRequest
        try:
            data = AIWriterRequest(**request.json)
        except ValidationError as e:
            return jsonify({"error": e.errors()[0]["msg"]}), 400

        full_prompt = (
            "Kamu adalah asisten pelajar. Tuliskan teks untuk tugas sekolah/kuliah berdasarkan instruksi berikut. "
            "PENTING: Jangan gunakan formatting Markdown seperti **tebal**, *miring*, atau # heading, karena teks ini "
            "akan dikonversi menjadi tulisan tangan biasa. Tulis dengan paragraf biasa.\n\n"
            f"Instruksi: {data.prompt}"
        )

        response = ai_client.models.generate_content(
            model="gemini-2.5-flash", contents=full_prompt
        )
        return jsonify({"success": True, "text": response.text})

    except Exception as e:
        print("Gemini API Error:", e)
        return jsonify({"error": str(e)}), 500


@ai_bp.route("/api/ai-expand", methods=["POST"])
def ai_expand():
    """Parafrase & panjangkan teks agar lolos plagiasi dan pas 1 halaman folio."""
    try:
        from models.validators import AIExpandRequest
        try:
            data = AIExpandRequest(**request.json)
        except ValidationError as e:
            return jsonify({"error": e.errors()[0]["msg"]}), 400

        full_prompt = (
            "Kamu adalah seorang pelajar/mahasiswa. Tugasmu adalah memparafrase dan memperluas materi dari teks berikut "
            "agar terlihat lebih natural, elaboratif, tidak terdeteksi sebagai hasil copas dari Wikipedia/AI, "
            "dan cukup panjang/detail untuk memenuhi setidaknya 1 hingga 2 halaman folio penuh.\n\n"
            "Aturan ketat:\n"
            "1. JANGAN gunakan formatting Markdown seperti **tebal**, *miring*, atau # heading.\n"
            "2. Gunakan bahasa Indonesia yang baik, mengalir, dan seperti esai pemikiran manusia.\n"
            "3. BERIKAN HANYA TEKS HASILNYA SAJA, tanpa kalimat pembuka/penutup seperti 'Tentu, ini hasilnya'.\n\n"
            f"Teks asli:\n{data.text}"
        )

        response = ai_client.models.generate_content(
            model="gemini-2.5-flash", contents=full_prompt
        )
        return jsonify({"success": True, "text": response.text})

    except Exception as e:
        print("Gemini API Error:", e)
        return jsonify({"error": str(e)}), 500
