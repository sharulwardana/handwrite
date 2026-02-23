import math
import os
import random
import threading

import cv2
import numpy as np
import requests
from PIL import Image, ImageDraw, ImageFont


def hex_to_rgb(hex_color):
    hex_color = hex_color.lstrip("#")
    return tuple(int(hex_color[i : i + 2], 16) for i in (0, 2, 4))


class HandwritingGenerator:
    _image_cache: dict = {}  # Cache gambar folio antar request
    _MAX_CACHE = 10  # Maksimal 10 folio di memory
    _cache_lock = threading.Lock()

    def __init__(self, config, folio_path_or_url, font_path):
        self.config = config

        # Cek apakah ini URL Cloudinary dari internet atau file lokal
        def load_image(path_or_url):
            mtime = (
                os.path.getmtime(path_or_url)
                if not path_or_url.startswith("http")
                else 0
            )
            cache_key = (path_or_url, mtime)

            with HandwritingGenerator._cache_lock:
                if cache_key in HandwritingGenerator._image_cache:
                    return HandwritingGenerator._image_cache[cache_key].copy()

            if path_or_url.startswith("http"):
                response = requests.get(path_or_url, stream=True, timeout=15)
                img = Image.open(response.raw).convert("RGB")
                response.raw.close()
            else:
                img = Image.open(path_or_url).convert("RGB")

            with HandwritingGenerator._cache_lock:
                if (
                    len(HandwritingGenerator._image_cache)
                    >= HandwritingGenerator._MAX_CACHE
                ):
                    oldest_key = next(iter(HandwritingGenerator._image_cache))
                    del HandwritingGenerator._image_cache[oldest_key]
                HandwritingGenerator._image_cache[cache_key] = img

            return img.copy()

        self.folio_odd = load_image(folio_path_or_url)
        # Folio genap: pakai folio kedua jika ada, fallback ke folio pertama
        folio_even_path = config.get("folioEvenPath")
        self.folio_even = (
            load_image(folio_even_path) if folio_even_path else self.folio_odd
        )
        self.folio_template = self.folio_odd  # default untuk kompatibilitas

        self.font_path = font_path
        self.font = ImageFont.truetype(font_path, config["fontSize"])
        self.base_color_rgb = hex_to_rgb(config.get("color", "#2b2b2b"))
        self.word_spacing = int(config.get("wordSpacing", 8))
        self.left_handed = config.get("leftHanded", False)
        self.write_speed = float(config.get("writeSpeed", 0.5))
        self.slant_angle = float(config.get("slantAngle", 0))  # -15 s/d +15 derajat
        self._word_slant_offset = 0.0  # variasi kemiringan per kata
        self.enable_drop_cap = bool(config.get("enableDropCap", False))
        self.tired_mode = bool(config.get("tiredMode", False))  # degradasi per halaman
        self.show_page_number = bool(config.get("showPageNumber", False))
        self.page_number_format = config.get("pageNumberFormat", "- {n} -")
        self.session_seed = random.random()
        self.total_pages = 1  # diupdate saat generate_all_pages
        self._prev_text_layer = None
        self.font_cache = {}  # Tambahan: Inisialisasi penyimpanan cache font

    def get_baseline_wobble(self, line_index):
        # Gelombang lambat antar baris
        wave = math.sin(line_index * 0.9 + self.session_seed * 20) * 0.35
        # Random kecil per baris
        wobble = wave + random.uniform(-0.3, 0.3)
        # Fatigue: setiap 3-4 baris, baseline sedikit turun (gravitasi tangan)
        fatigue_drift = (line_index % random.randint(3, 5)) * random.uniform(0.1, 0.4)
        return (wobble + fatigue_drift) * (-1.4 if self.left_handed else 1.0)

    def make_typo_version(self, word):
        """
        Buat versi cacat dari sebuah kata — simulasi salah ketik tangan:
        - Tukar 2 huruf berdekatan (transposisi)
        - Tambah huruf acak di tengah
        - Ganti 1 huruf dengan huruf terdekat di alfabet
        Minimal 3 karakter agar bisa diacak.
        """
        if len(word) < 3:
            return word + word[-1]  # double huruf terakhir

        method = random.choice(["transpose", "insert", "replace"])

        if method == "transpose":
            # Tukar 2 huruf berdekatan di posisi acak
            idx = random.randint(0, len(word) - 2)
            return word[:idx] + word[idx + 1] + word[idx] + word[idx + 2 :]

        elif method == "insert":
            # Sisipkan huruf duplikat di posisi acak
            idx = random.randint(1, len(word) - 1)
            return word[:idx] + word[idx] + word[idx:]

        else:  # replace
            # Ganti 1 huruf dengan huruf "bertetangga" di alfabet
            idx = random.randint(0, len(word) - 1)
            c = word[idx]
            neighbors = chr(ord(c) - 1) if ord(c) > ord("a") else chr(ord(c) + 1)
            return word[:idx] + neighbors + word[idx + 1 :]

    def ink_vary(self, pressure_delta=0):
        """
        Kembalikan warna tinta dengan variasi tekanan pena.
        pressure_delta: negatif = tekan lebih kuat (lebih gelap),
                        positif = tekan lebih ringan (lebih terang).
        Warna hue TIDAK berubah — hanya brightness-nya saja.
        """
        r, g, b = self.base_color_rgb
        # Jitter kecil alami per goresan (±5), ditambah pressure offset
        jitter = random.gauss(0, 5) + pressure_delta
        return (
            max(0, min(255, int(r + jitter))),
            max(0, min(255, int(g + jitter))),
            max(0, min(255, int(b + jitter))),
        )

    def draw_heavy_strikethrough(self, draw, x_start, x_end, y, font_size):
        """
        Coretan tebal berlapis yang MENUTUPI kata typo.
        Warna = SAMA PERSIS dengan tinta tulisan (hanya variasi tekanan).
        Tiga lapisan: isi rapat → goresan tebal → diagonal cepat.
        """
        # Area tutup: dari atas sampai bawah huruf
        top_y = y + int(font_size * 0.05)
        bottom_y = y + int(font_size * 0.95)
        x_l = x_start - random.randint(2, 5)
        x_r = x_end + random.randint(2, 5)

        # ── Lapisan 1: garis horizontal rapat mengisi seluruh area ──────────
        step = random.randint(2, 3)
        fill_y = top_y
        while fill_y <= bottom_y:
            wl = random.randint(-2, 2)
            wr = random.randint(-2, 2)
            w = random.randint(2, 4)
            draw.line(
                [(x_l + wl, fill_y), (x_r + wr, fill_y + random.randint(-1, 1))],
                fill=self.ink_vary(pressure_delta=random.uniform(-8, -2)),
                width=w,
            )
            fill_y += step

        # ── Lapisan 2: 4-6 goresan tebal menyapu (gerak tangan aktif) ───────
        num_heavy = random.randint(4, 6)
        for i in range(num_heavy):
            progress = i / max(1, num_heavy - 1)
            base_y = int(top_y + (bottom_y - top_y) * progress)
            y_l = base_y + random.randint(-2, 2)
            y_r = base_y + random.randint(-2, 2)
            xl_ext = x_l - random.randint(0, 6)
            xr_ext = x_r + random.randint(0, 6)
            thick = random.randint(3, 7)
            draw.line(
                [(xl_ext, y_l), (xr_ext, y_r)],
                fill=self.ink_vary(pressure_delta=random.uniform(-12, -3)),
                width=thick,
            )

        # ── Lapisan 3: 2-3 goresan diagonal (coret cepat, tekanan ringan) ───
        num_diag = random.randint(2, 3)
        for _ in range(num_diag):
            dy = random.randint(int(font_size * 0.15), int(font_size * 0.55))
            draw.line(
                [
                    (
                        x_l + random.randint(-3, 3),
                        top_y + random.randint(0, int(font_size * 0.2)),
                    ),
                    (x_r + random.randint(-3, 3), top_y + dy),
                ],
                fill=self.ink_vary(pressure_delta=random.uniform(-6, 2)),
                width=random.randint(2, 4),
            )

    def add_humanizer_effect(self, text_layer, draw, text, x, y, line_index=0):
        """
        Render satu baris dengan efek tulisan tangan:
        1. Tekanan pena    — variasi warna
        2. Tinta habis     — karakter pudar sesekali
        3. Variasi size    — ukuran font berfluktuasi
        4. Baseline wobble — baris tidak lurus sempurna
        5. Variasi spasi   — word_spacing + sedikit random
        6. Efek Coretan    — tulis versi CACAT kata, tutup dengan coretan
        """
        available_total = self.config["maxWidth"] - x
        words = text.split(" ")

        enable_typo = self.config.get("enableTypo", True)
        if enable_typo and len(words) >= 2 and random.random() < 0.05:
            typo_word_idx = random.randint(0, max(0, len(words) // 2))
            correct_word = words[typo_word_idx]
            cacat_word = self.make_typo_version(correct_word)

            cacat_bbox = draw.textbbox((0, 0), cacat_word, font=self.font)
            cacat_width = cacat_bbox[2] - cacat_bbox[0]

            full_bbox = draw.textbbox((0, 0), text, font=self.font)
            full_width = full_bbox[2] - full_bbox[0]
            gap_after = int(self.config["fontSize"] * 0.35)

            if cacat_width + gap_after + full_width <= available_total:
                draw.text(
                    (x, y),
                    cacat_word,
                    fill=self.ink_vary(pressure_delta=random.uniform(5, 15)),
                    font=self.font,
                )
                self.draw_heavy_strikethrough(
                    draw, x, x + cacat_width, y, self.config["fontSize"]
                )
                x += cacat_width + gap_after

        cursor_x = x
        available_width = self.config["maxWidth"] - x
        baseline_wobble = self.get_baseline_wobble(line_index)

        is_paragraph_start = line_index == 0
        ink_level = 1.0 if is_paragraph_start else random.uniform(0.65, 1.0)
        # Drop Cap: huruf pertama paragraf dibuat jauh lebih besar
        _drop_cap_done = False

        tokens = []
        for word in text.split(" "):
            for ch in word:
                tokens.append(("char", ch))
            tokens.append(("space", " "))
        if tokens and tokens[-1][1] == " ":
            tokens.pop()

        word_char_idx = 0
        current_word_len = len(text.split(" ")[0]) if text.split(" ") else 1
        word_count_seen = 0
        line_drift_y = 0.0
        # Variasi kemiringan dan ukuran per kata
        self._word_slant_offset = random.gauss(0, 1.2)
        self._word_size_jitter = random.uniform(0.97, 1.03)

        for tok_type, char in tokens:
            if tok_type == "space":
                word_char_idx = 0
                word_count_seen += 1
                if word_count_seen < len(words):
                    current_word_len = max(1, len(words[word_count_seen]))
                # Kemiringan & Ukuran bergeser sedikit tiap kata
                self._word_slant_offset = float(
                    np.clip(self._word_slant_offset + random.gauss(0, 0.8), -2.5, 2.5)
                )
                self._word_size_jitter = random.uniform(0.97, 1.03)
            else:
                word_char_idx += 1

            speed = self.write_speed
            jitter_x = random.uniform(-1.2 * (1 + speed), 1.2 * (1 + speed))
            progress = max(0.0, (cursor_x - x) / max(1, available_width))
            pen_pressure = 0  # default; dioverride di dalam if char.strip()

            # FITUR BARU: Drift Kumulatif (Cenderung naik/turun searah per kalimat)
            line_drift_y += random.uniform(-0.15, 0.2)
            jitter_y = (
                random.uniform(-1.0 * (1 + speed), 1.0 * (1 + speed))
                + (baseline_wobble * progress * 4)
                + line_drift_y
            )

            is_upper = char.isupper() and char.isalpha()
            cap_bonus = int(self.config["fontSize"] * 0.12) if is_upper else 0
            max_delta = int(2 + self.write_speed * 4)
            size_delta = random.choices(
                [-max_delta, -2, -1, 0, 0, 0, 0, 1, 2, max_delta],
                weights=[1, 2, 4, 8, 8, 8, 8, 4, 2, 1],
            )[0]

            # ── UKURAN LEBIH BESAR DI AWAL PARAGRAF ─────────────────────────
            # Semangat baru saat mulai paragraf → huruf sedikit lebih besar,
            # lalu menyusut perlahan ke ukuran normal dalam 8 kata pertama
            paragraph_bonus = 0
            if is_paragraph_start and word_count_seen < 8:
                fade = 1.0 - (word_count_seen / 8.0)  # 1.0 → 0.0 dalam 8 kata
                paragraph_bonus = int(random.uniform(1.5, 3.5) * fade)
            # ────────────────────────────────────────────────────────────────

            # Terapkan jitter per kata pada perhitungan ukuran font
            base_calculated_size = (
                self.config["fontSize"] + size_delta + cap_bonus + paragraph_bonus
            )
            font_size = max(
                10, int(base_calculated_size * getattr(self, "_word_size_jitter", 1.0))
            )

            # ── DROP CAP ─────────────────────────────────────────────────────
            # Huruf pertama paragraf dibuat 1.5x lebih besar
            is_drop_cap_char = (
                self.enable_drop_cap
                and is_paragraph_start
                and word_count_seen == 0
                and word_char_idx == 1
                and not _drop_cap_done
                and char.strip()
            )
            if is_drop_cap_char:
                font_size = int(self.config["fontSize"] * 1.5)
                _drop_cap_done = True
            # ────────────────────────────────────────────────────────────────

            # Tambahan: Gunakan font dari cache jika sudah pernah di-load
            if font_size not in self.font_cache:
                self.font_cache[font_size] = ImageFont.truetype(
                    self.font_path, font_size
                )
            char_font = self.font_cache[font_size]

            DOWNSTROKE_HEAVY = set("mnhbpqgjy")
            if char.lower() in DOWNSTROKE_HEAVY:
                draw_twice = True
                bold_pressure = random.uniform(-15, -5)
            else:
                draw_twice = False
                bold_pressure = 0

            alpha = 255
            if char.strip():
                word_progress = min(1.0, word_char_idx / max(1, current_word_len))

                # FITUR BARU (Claude Poin 1): Pen Pressure Kurva Sinus
                # Tinta ditekan kuat (gelap) di tengah kata, dan diangkat ringan di awal/akhir
                pressure_curve = math.sin(word_progress * math.pi)
                pen_pressure = -20 * pressure_curve + 10 * (1 - pressure_curve)

                if is_paragraph_start and word_count_seen == 0 and word_char_idx == 1:
                    pen_pressure -= 22  # Huruf pertama paragraf: sangat ditekan
                elif is_paragraph_start and word_count_seen < 3:
                    pen_pressure -= 10

                if ink_level < 0.25 and random.random() > 0.45:
                    alpha = random.randint(100, 150)
                    char_color = self.ink_vary(pressure_delta=random.uniform(8, 18))
                elif ink_level < 0.5 and random.random() > 0.55:
                    alpha = random.randint(160, 200)
                    char_color = self.ink_vary(pressure_delta=random.uniform(5, 12))
                else:
                    base_jitter = random.gauss(0, 5)
                    shift = int(pen_pressure + base_jitter)
                    r, g, b = self.base_color_rgb
                    char_color = (
                        max(0, min(255, r + shift)),
                        max(0, min(255, g + shift)),
                        max(0, min(255, b + shift)),
                    )
            else:
                char_color = self.base_color_rgb

            fill_color = (*char_color, alpha)

            # Titik tumpu baseline
            y_baseline = y + self.config["fontSize"] * 0.82 + jitter_y

            # --- Variasi Tinta Kering & Tekanan Kertas ---
            # Selalu set default dulu agar spasi (char == " ") tidak error
            r_c, g_c, b_c = (
                fill_color[:3]
                if len(fill_color) > 3
                else (fill_color[0], fill_color[1], fill_color[2])
            )
            dynamic_alpha = random.randint(240, 255)
            dynamic_fill = fill_color  # default fallback

            if char.strip():
                # Variasi Ketebalan & Tinta Macet (Opacity Fluctuation)
                r_c, g_c, b_c = fill_color[:3] if len(fill_color) > 3 else fill_color

                if random.random() < 0.02:
                    # Sesekali pudar sedikit
                    dynamic_alpha = random.randint(180, 215)
                else:
                    # Tinta normal pekat konsisten
                    dynamic_alpha = random.randint(240, 255)

                dynamic_fill = (r_c, g_c, b_c, dynamic_alpha)

                # Efek Tekanan Kertas (Emboss/Indentation)
                if pen_pressure > 3:
                    draw.text(
                        (cursor_x + jitter_x, y_baseline + 1),
                        char,
                        fill=(255, 255, 255, 40),  # Highlight putih
                        font=char_font,
                        anchor="ls",
                    )

            # === 1. KEMIRINGAN ASLI (TRUE SKEWING) ===
            if getattr(self, "slant_angle", 0) != 0 and char.strip():
                # PERBESAR KANVAS jadi 3x lipat agar ekor huruf aman
                char_w = int(font_size * 3)
                char_h = int(font_size * 3)
                temp_img = Image.new("RGBA", (char_w, char_h), (0, 0, 0, 0))
                temp_draw = ImageDraw.Draw(temp_img)

                # Titik tengah kanvas
                temp_y = int(char_h * 0.6)

                # Gambar huruf menggunakan tinta dinamis (dynamic_fill)
                temp_draw.text(
                    (char_w // 2, temp_y),
                    char,
                    fill=dynamic_fill,
                    font=char_font,
                    anchor="ms",
                )

                # Rumus Matrix Affine untuk Skewing X
                effective_slant = self.slant_angle + self._word_slant_offset
                slant_rad = math.radians(-effective_slant)
                m = math.tan(slant_rad)
                x_shift = temp_y * m

                # Transformasi kemiringan!
                skewed_img = temp_img.transform(
                    (char_w, char_h),
                    Image.AFFINE,
                    (1, m, -x_shift, 0, 1, 0),
                    resample=Image.BICUBIC,
                )

                paste_x = int(cursor_x + jitter_x - char_w // 2)
                paste_y = int(y_baseline - temp_y)
                text_layer.paste(skewed_img, (paste_x, paste_y), skewed_img)
            else:
                # Jika angle 0, gambar normal menggunakan tinta dinamis
                draw.text(
                    (cursor_x + jitter_x, y_baseline),
                    char,
                    fill=dynamic_fill,
                    font=char_font,
                    anchor="ls",
                )

            if draw_twice and char.strip():
                draw.text(
                    (cursor_x + jitter_x + 0.6, y_baseline),
                    char,
                    fill=self.ink_vary(pressure_delta=bold_pressure),
                    font=char_font,
                    anchor="ls",
                )

            # --- FITUR BARU: Efek Bolpoin Realistis (Mblobor & Ketebalan Ekstra) ---
            if char.strip():
                # 1. Micro-bolding: Jika tekanan tangan sedang kuat, bolpoin sedikit lebih tebal (ditimpa tipis)
                if pen_pressure > 5 and random.random() < 0.25:
                    bold_offset = random.choice([0.5, 1.0])
                    use_skew = getattr(self, "slant_angle", 0) != 0
                    if use_skew and "skewed_img" in locals():
                        text_layer.paste(
                            skewed_img,
                            (paste_x + int(bold_offset), paste_y),
                            skewed_img,
                        )
                    elif not use_skew:
                        draw.text(
                            (cursor_x + jitter_x + bold_offset, y_baseline),
                            char,
                            fill=fill_color,
                            font=char_font,
                            anchor="ls",
                        )
                    else:
                        draw.text(
                            (cursor_x + jitter_x + bold_offset, y_baseline),
                            char,
                            fill=fill_color,
                            font=char_font,
                            anchor="ls",
                        )

                # 2. Ink Blobs: Gumpalan tinta khas ujung bolpoin saat mulai/berhenti menggores
                if random.random() < 0.12:  # 12% kemungkinan muncul gumpalan kecil
                    # Ukuran gumpalan (sangat mikroskopis, 0.5 - 1.5 pixel)
                    blob_r = random.uniform(0.5, 1.5)

                    # Posisi acak di sekitar huruf (biasanya di pangkal/ujung garis huruf)
                    char_width_est = draw.textlength(char, font=char_font)
                    blob_x = (
                        cursor_x + jitter_x + random.uniform(0, char_width_est * 0.8)
                    )
                    blob_y = y_baseline - random.uniform(
                        font_size * 0.1, font_size * 0.7
                    )

                    # Warna gumpalan selalu pekat & lebih gelap dari tinta utama
                    r_c, g_c, b_c = char_color
                    blob_color = (
                        max(0, r_c - 45),
                        max(0, g_c - 45),
                        max(0, b_c - 45),
                        random.randint(200, 255),
                    )

                    # Gambar gumpalannya
                    draw.ellipse(
                        [
                            blob_x - blob_r,
                            blob_y - blob_r,
                            blob_x + blob_r,
                            blob_y + blob_r,
                        ],
                        fill=blob_color,
                    )

            # FITUR BARU (Claude Poin 2): Titik Tinta (Ink Blob) di Awal/Akhir kata
            if char.strip():
                is_edge_of_word = (
                    word_char_idx == 1 or word_char_idx >= current_word_len - 1
                )
                if (
                    is_edge_of_word and random.random() < 0.03
                ):  # Probabilitas 3% sesuai saran
                    blob_r = random.uniform(0.5, 1.5)
                    blob_x = cursor_x + jitter_x + random.uniform(0, font_size * 0.3)
                    blob_y = y_baseline - random.uniform(
                        font_size * 0.1, font_size * 0.6
                    )
                    # Gambar titik ekstra tebal
                    r_c, g_c, b_c = (
                        char_color[:3] if len(char_color) > 3 else char_color
                    )
                    draw.ellipse(
                        [
                            blob_x - blob_r,
                            blob_y - blob_r,
                            blob_x + blob_r,
                            blob_y + blob_r,
                        ],
                        fill=(r_c, g_c, b_c, 210),
                    )

            # Ink pooling di tanda baca
            # PUNCTUATION = set(".,;:!?")
            # if char in PUNCTUATION and char.strip() and random.random() < 0.5:
            # pool_r = random.uniform(1.0, 2.5)
            # pool_x = cursor_x + jitter_x + random.uniform(-1, 2)
            # pool_y = y_baseline - random.uniform(font_size * 0.05, font_size * 0.2)
            # r_p, g_p, b_p = self.base_color_rgb
            # draw.ellipse(
            # [
            # pool_x - pool_r,
            # pool_y - pool_r,
            # pool_x + pool_r,
            # pool_y + pool_r,
            # ],
            # fill=(
            # max(0, r_p - 30),
            # max(0, g_p - 30),
            # max(0, b_p - 30),
            # random.randint(180, 240),
            # ),
            # )

            # === 2. UPDATE KERNING (Letter Spacing Variation - Claude Poin 3) ===
            char_width = draw.textlength(char, font=char_font)

            if tok_type == "space":
                extra = self.word_spacing + random.uniform(-1.5, 3.0)
                cursor_x += char_width + extra
            else:
                # Variasi jarak antar huruf
                LONG_TAIL_CHARS = set("frvwy")
                CLOSE_NEXT_CHARS = set("oadb")

                # ── RAPAT DI AKHIR BARIS ─────────────────────────────────────
                # Makin mendekati maxWidth, jarak antar huruf mengecil
                # (simulasi memaksakan huruf agar muat di akhir baris)
                line_fill_ratio = (cursor_x - x) / max(1, available_width)
                end_squeeze = 0.0
                if line_fill_ratio > 0.78:
                    # Squeeze makin kuat seiring mendekati ujung baris
                    squeeze_strength = (line_fill_ratio - 0.78) / 0.22  # 0.0 s/d 1.0
                    end_squeeze = -random.uniform(0.5, 2.5) * squeeze_strength
                # ────────────────────────────────────────────────────────────

                if char in LONG_TAIL_CHARS:
                    letter_jitter = random.uniform(-3.5, -1.0) + end_squeeze
                    cursor_x += char_width + letter_jitter
                elif char in CLOSE_NEXT_CHARS:
                    letter_jitter = random.uniform(-2.0, 0.5) + end_squeeze
                    cursor_x += char_width + letter_jitter
                else:
                    letter_jitter = random.uniform(-1.5, 2.5) + end_squeeze
                    cursor_x += char_width + letter_jitter

                # ── CONNECTOR STROKE (sambungan antar huruf) ──────────────────
                # Huruf yang punya ekor sambungan ke kanan di tulisan tangan asli
                CONNECTABLE = set("acdeghimnopqrsuv")
                if char.lower() in CONNECTABLE and random.random() < 0.20:
                    # Titik awal: ujung kanan huruf yang baru digambar
                    conn_start_x = cursor_x - random.uniform(1, 3)
                    conn_start_y = y_baseline - random.uniform(
                        font_size * 0.06, font_size * 0.16
                    )
                    # Titik akhir: awal huruf berikutnya (sedikit ke kanan)
                    conn_end_x = cursor_x + random.uniform(1, 4)
                    conn_end_y = conn_start_y + random.uniform(-2, 2)

                    # Warna connector: sama dengan tinta tapi lebih transparan
                    r_c, g_c, b_c = self.base_color_rgb
                    connector_alpha = random.randint(55, 105)
                    draw.line(
                        [(conn_start_x, conn_start_y), (conn_end_x, conn_end_y)],
                        fill=(r_c, g_c, b_c, connector_alpha),
                        width=1,
                    )
                # ─────────────────────────────────────────────────────────────

            ink_level -= random.uniform(0, 0.005 + self.write_speed * 0.01)
            if random.random() > 0.97:
                ink_level = min(1.0, ink_level + random.uniform(0.3, 0.6))
            ink_level = max(0.08, ink_level)

            # ── EFEK TINTA MENGERING di ujung kata ───────────────────────────
            # Saat huruf terakhir kata, tambahkan titik pudar kecil
            is_last_char_of_word = word_char_idx >= current_word_len - 1
            if (
                tok_type == "char"
                and char.strip()
                and is_last_char_of_word
                and random.random() < 0.15
            ):
                fade_x = cursor_x + random.uniform(-2, 3)
                fade_y = y_baseline - random.uniform(font_size * 0.05, font_size * 0.25)
                fade_r = random.uniform(0.4, 1.2)
                r_f, g_f, b_f = self.base_color_rgb
                fade_alpha = random.randint(25, 65)
                draw.ellipse(
                    [
                        fade_x - fade_r,
                        fade_y - fade_r,
                        fade_x + fade_r,
                        fade_y + fade_r,
                    ],
                    fill=(r_f, g_f, b_f, fade_alpha),
                )
            # ─────────────────────────────────────────────────────────────────

        return cursor_x

    def calculate_text_width(self, text):
        """Estimasi lebar teks termasuk wordSpacing"""
        bbox = self.font.getbbox(text)
        base_width = bbox[2] - bbox[0]
        extra = text.count(" ") * self.word_spacing
        return base_width + extra

    def split_into_pages(self, text):
        pages, current_lines = [], []
        y = self.config["startY"]
        line_index = 0

        for paragraph in text.split("\n"):
            if not paragraph.strip():
                current_lines.append({"text": "", "y": y, "line_index": line_index})
                y += self.config["lineHeight"]
                line_index += 1
                if y > self.config["pageBottom"]:
                    pages.append(current_lines)
                    current_lines = []
                    y = self.config["startY"]
                    line_index = 0
                continue

            margin_jitter = int(random.gauss(0, self.config.get("marginJitter", 6)))
            current_line = ""
            for word in paragraph.split(" "):
                test = current_line + word + " "
                if (
                    self.calculate_text_width(test)
                    > (self.config["maxWidth"] - self.config["startX"])
                    and current_line
                ):
                    vertical_jitter = int(random.gauss(0, 1.8))
                    current_lines.append(
                        {
                            "text": current_line.strip(),
                            "y": y + vertical_jitter,
                            "line_index": line_index,
                            "margin_jitter": margin_jitter,
                        }
                    )
                    margin_jitter = int(
                        random.gauss(0, self.config.get("marginJitter", 6))
                    )
                    current_line = word + " "
                    y += self.config["lineHeight"]
                    line_index += 1
                    if y > self.config["pageBottom"]:
                        pages.append(current_lines)
                        current_lines = []
                        y = self.config["startY"]
                        line_index = 0
                else:
                    current_line = test

            if current_line.strip():
                # Variasi vertikal kecil per baris — simulasi posisi tangan naik/turun
                vertical_jitter = int(random.gauss(0, 1.8))
                current_lines.append(
                    {
                        "text": current_line.strip(),
                        "y": y + vertical_jitter,
                        "line_index": line_index,
                        "margin_jitter": margin_jitter,
                    }
                )
                y += self.config["lineHeight"]
                line_index += 1
                if y > self.config["pageBottom"]:
                    pages.append(current_lines)
                    current_lines = []
                    y = self.config["startY"]
                    line_index = 0

        if current_lines:
            pages.append(current_lines)
        return pages

    def apply_paper_texture(self, image):
        """
        Post-processing realistis: Simulasi kertas difoto menggunakan kamera HP.
        1. Uneven Lighting (Cahaya tidak rata, misal dari lampu meja/jendela)
        2. Soft Camera Vignette (Pinggiran lensa sedikit gelap)
        3. Smartphone Sensor Grain (Noise halus)
        """
        # Ubah ke float32 agar kalkulasi perkalian cahaya lebih presisi
        arr = np.array(image, dtype=np.float32)
        h, w = arr.shape[:2]

        # === 1. CAHAYA TIDAK RATA (UNEVEN LIGHTING) ===
        # Membuat titik cahaya acak (misal lampu dari arah kiri atas atau kanan atas)
        light_x = random.uniform(0.1, 0.9)
        light_y = random.uniform(-0.2, 0.3)

        # Buat grid koordinat
        X, Y = np.meshgrid(np.linspace(0, 1, w), np.linspace(0, 1, h))

        # Hitung jarak tiap pixel ke sumber cahaya
        distance = np.sqrt((X - light_x) ** 2 + (Y - light_y) ** 2)

        # Buat map gradasi cahaya (1.06 = sedikit lebih terang, 0.88 = sedikit gelap)
        # Bagian yang dekat sumber cahaya akan terang, yang jauh perlahan menggelap
        light_map = np.clip(1.06 - (distance * 0.22), 0.88, 1.1)

        # Aplikasikan cahaya ke semua warna (RGB)
        arr[:, :, 0] *= light_map
        arr[:, :, 1] *= light_map
        arr[:, :, 2] *= light_map

        # === 2. VIGNETTE LENSA KAMERA ===
        cx, cy = w / 2, h / 2
        Y_idx, X_idx = np.ogrid[:h, :w]
        dist_from_center = np.sqrt(((X_idx - cx) / cx) ** 2 + ((Y_idx - cy) / cy) ** 2)

        # Pinggiran pojok akan sedikit lebih gelap natural
        vignette_mask = 1.0 - (np.clip(dist_from_center - 0.55, 0, 0.6) * 0.25)
        arr[:, :, 0] *= vignette_mask
        arr[:, :, 1] *= vignette_mask
        arr[:, :, 2] *= vignette_mask

        # === 3. SENSOR NOISE (Grain Kamera HP) ===
        # Kamera HP yang memotret kertas teks biasanya menghasilkan grain tipis (ISO noise)
        noise = np.random.normal(0, 2.5, arr.shape)
        arr = arr + noise

        # Kembalikan matriks float32 ke format gambar standar (uint8)
        result = np.clip(arr, 0, 255).astype(np.uint8)
        return Image.fromarray(result)

    def generate_page(self, lines, page_number=1):
        self._page_margin_offset = int(random.gauss(0, 8))
        # Seed baseline berbeda tiap halaman agar gelombang tidak identik
        self.session_seed = random.uniform(0, 100)
        if self.tired_mode and self.total_pages > 1:
            fatigue = (page_number - 1) / max(1, self.total_pages - 1)
            self._tired_fatigue = fatigue
            self.write_speed = min(
                1.0, self.config.get("writeSpeed", 0.5) + fatigue * 0.45
            )
            self.word_spacing = int(self.config.get("wordSpacing", 8) + fatigue * 6)
        else:
            self._tired_fatigue = 0.0

        folio = (
            self.folio_odd.copy() if page_number % 2 == 1 else self.folio_even.copy()
        )

        # --- [BARU] EFEK TINTA TEMBUS (SHOW-THROUGH) ---
        if (
            page_number % 2 == 0
            and self._prev_text_layer is not None
            and self.config.get("showThrough", True)
        ):
            from PIL import ImageFilter

            # Balik teks halaman sebelumnya dan beri sedikit blur asli PIL
            bleed = self._prev_text_layer.copy().transpose(Image.FLIP_LEFT_RIGHT)
            bleed = bleed.filter(ImageFilter.GaussianBlur(radius=1.5))

            # Kurangi opacity menjadi sangat tipis (~6-8%)
            r, g, b, a = bleed.split()
            a = a.point(lambda x: int(x * 0.08))
            bleed.putalpha(a)

            # Tempel bayangan ke folio genap
            folio.paste(bleed, (0, 0), mask=bleed)
        # -----------------------------------------------

        text_layer = Image.new("RGBA", folio.size, (0, 0, 0, 0))
        draw = ImageDraw.Draw(text_layer, "RGBA")  # <--- INI YANG TADI HILANG!

        for line in lines:
            if line["text"]:
                # Margin kiri sedikit berbeda per halaman (beda posisi menaruh buku)
                page_margin_offset = getattr(self, "_page_margin_offset", 0)
                x_start = (
                    self.config["startX"]
                    + line.get("margin_jitter", 0)
                    + page_margin_offset
                )
                self.add_humanizer_effect(
                    text_layer,
                    draw,
                    line["text"],  # <--- Tambahkan text_layer di sini!
                    x_start,
                    line["y"],
                    line.get("line_index", 0),
                )

        text_np = np.array(text_layer)

        # 1. Efek Bleeding normal (tinta sedikit meresap ke serat kertas)
        blurred_np = cv2.GaussianBlur(text_np, (3, 3), 0.5)
        bleeding_np = cv2.addWeighted(text_np, 0.80, blurred_np, 0.20, 0)

        # 2. FITUR BARU (Claude Poin 5): Efek Smudge (Tangan menggesek teks)
        # Membuat Custom Kernel untuk Motion Blur searah horizontal ke kanan
        kernel_size = 9
        kernel_motion_blur = np.zeros((kernel_size, kernel_size))
        kernel_motion_blur[int((kernel_size - 1) / 2), :] = np.ones(kernel_size)
        kernel_motion_blur = kernel_motion_blur / kernel_size

        smudge_np = cv2.filter2D(bleeding_np, -1, kernel_motion_blur)

        # Jika mode Kidal aktif, gesekan tangan menyapu teks yang baru ditulis lebih tebal!
        smudge_weight = 0.20 if getattr(self, "left_handed", False) else 0.08

        # Gabungkan lapisan debu tinta (smudge) ke teks utama
        final_text_np = cv2.addWeighted(
            bleeding_np, 1.0 - smudge_weight, smudge_np, smudge_weight, 0
        )
        text_layer = Image.fromarray(final_text_np)

        # 3. MULTIPLY BLEND EFEK TINTA MERESAP (NumPy Matrix Math)
        # Ubah kertas dan teks menjadi matriks float32 agar presisi saat dihitung
        page_np = np.array(folio.copy().convert("RGB")).astype(np.float32)
        text_rgba_np = np.array(text_layer).astype(np.float32)

        # Pisahkan channel RGB (Warna Tinta) dan A (Transparansi/Goresan)
        text_rgb = text_rgba_np[:, :, :3]
        text_alpha = text_rgba_np[:, :, 3:4] / 255.0  # Normalisasi alpha ke 0.0 - 1.0

        # Rumus Multiply Blend murni: (Kertas * Tinta) / 255
        # Ini membuat garis folio yang gelap akan tetap gelap meski ditimpa tinta
        multiply_effect = (page_np * text_rgb) / 255.0

        # Aplikasikan Multiply Blend HANYA pada area yang ada tintanya (menggunakan Alpha Mask)
        # Area kosong (alpha=0) = tetap kertas asli. Area tinta (alpha=1) = efek multiply.
        final_blended_np = (page_np * (1.0 - text_alpha)) + (
            multiply_effect * text_alpha
        )

        # Kembalikan matriks ke format gambar standar
        page = Image.fromarray(np.clip(final_blended_np, 0, 255).astype(np.uint8))

        if self.show_page_number:
            self._draw_page_number(page, page_number)

        # Simpan text_layer untuk efek tinta tembus di halaman berikutnya
        self._prev_text_layer = text_layer.copy()

        # ── Watermark kustom opsional ────────────────────────────────────────
        watermark_text = self.config.get("watermarkText", "").strip()
        if watermark_text:
            page = self._draw_watermark(page, watermark_text)

        return self.apply_paper_texture(page)

    def _draw_page_number(self, image, page_number):
        """Tulis nomor halaman di pojok bawah tengah dengan font tulisan tangan."""
        try:
            num_font_size = max(28, int(self.config["fontSize"] * 0.55))
            num_font = ImageFont.truetype(self.font_path, num_font_size)
            label = self.page_number_format.replace("{n}", str(page_number))

            draw = ImageDraw.Draw(image)
            bbox = draw.textbbox((0, 0), label, font=num_font)
            text_w = bbox[2] - bbox[0]

            img_w, img_h = image.size
            x = (img_w - text_w) // 2 + random.randint(-4, 4)
            y = (
                self.config["pageBottom"]
                + int(self.config["lineHeight"] * 0.4)
                + random.randint(-3, 3)
            )
            y = min(y, img_h - num_font_size - 20)

            color = self.ink_vary(pressure_delta=random.uniform(8, 18))
            draw.text((x, y), label, fill=color, font=num_font)
        except Exception as e:
            print("Page number error:", e)

    def _draw_watermark(self, image, text):
        """
        [BARU] Tambahkan watermark teks diagonal sangat tipis di tengah halaman.
        Dirender sebagai layer RGBA terpisah lalu di-composite ke gambar.
        Opacity sangat rendah (0.05) agar tidak mengganggu tulisan tangan.
        """
        try:
            img_w, img_h = image.size
            overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
            draw = ImageDraw.Draw(overlay)

            wm_font_size = max(60, int(self.config["fontSize"] * 1.2))
            try:
                wm_font = ImageFont.truetype(self.font_path, wm_font_size)
            except Exception:
                wm_font = ImageFont.load_default()

            # Ukur lebar teks watermark
            bbox = draw.textbbox((0, 0), text, font=wm_font)
            text_w = bbox[2] - bbox[0]
            text_h = bbox[3] - bbox[1]

            # Buat layer teks watermark lalu rotate diagonal
            text_img = Image.new("RGBA", (text_w + 40, text_h + 40), (0, 0, 0, 0))
            text_drw = ImageDraw.Draw(text_img)
            # Opacity sangat rendah: alpha = ~13 dari 255 (≈5%)
            text_drw.text((20, 20), text, fill=(80, 80, 80, 25), font=wm_font)
            rotated = text_img.rotate(30, expand=True)

            # Tile watermark agar menutupi seluruh halaman
            tile_w, tile_h = rotated.size
            step_x = max(tile_w, img_w // 2)
            step_y = max(tile_h, img_h // 3)
            for ty in range(-tile_h, img_h + tile_h, step_y):
                for tx in range(-tile_w, img_w + tile_w, step_x):
                    overlay.paste(rotated, (tx, ty), rotated)

            # Composite overlay ke image asli
            result = Image.alpha_composite(image.convert("RGBA"), overlay)
            return result.convert("RGB")

        except Exception as e:
            print("Watermark error:", e)
            return image

    def generate_all_pages(self, text):
        pages = self.split_into_pages(text)
        self.total_pages = len(pages)
        return [self.generate_page(lines, idx + 1) for idx, lines in enumerate(pages)]
