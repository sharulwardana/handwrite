import google.generativeai as genai
import os
from dotenv import load_dotenv

# Load API Key dari file .env
load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    print("❌ API Key tidak ditemukan! Pastikan file .env sudah benar.")
else:
    print("⏳ Menghubungi server Google...")
    genai.configure(api_key=api_key)

    print("\n✅ Ini daftar model yang BISA kamu gunakan:")
    try:
        for m in genai.list_models():
            if "generateContent" in m.supported_generation_methods:
                print(f"👉 {m.name}")
    except Exception as e:
        print(f"❌ Terjadi error saat mengecek: {e}")
