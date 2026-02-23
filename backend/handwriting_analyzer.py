import cv2
import numpy as np
from PIL import Image
import io
import base64


def analyze_handwriting(image_bytes: bytes) -> dict:
    """
    Analisis foto tulisan tangan, return parameter config yang bisa
    langsung dipakai HandwritingGenerator.
    """
    # Decode image
    arr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Gambar tidak bisa dibaca")

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape

    result = {}

    # ── 1. Estimasi ukuran huruf ─────────────────────────────────────────────
    result["fontSize"] = _estimate_font_size(gray, h, w)

    # ── 2. Estimasi line height ──────────────────────────────────────────────
    result["lineHeight"] = _estimate_line_height(gray, h, w)

    # ── 3. Estimasi kemiringan (slant) ───────────────────────────────────────
    result["slantAngle"] = _estimate_slant(gray)

    # ── 4. Estimasi spasi kata ───────────────────────────────────────────────
    result["wordSpacing"] = _estimate_word_spacing(gray)

    # ── 5. [BARU] Estimasi kecepatan tulis dari ketebalan stroke ────────────
    result["writeSpeed"] = _estimate_write_speed(gray, h, w)

    # ── 6. [BARU] Estimasi konsistensi margin kiri ──────────────────────────
    result["marginJitter"] = _estimate_margin_jitter(gray, h, w)

    # ── 7. [BARU] Estimasi warna tinta asli ─────────────────────────────────
    result["color"] = _estimate_ink_color(img, gray)

    return result


def _estimate_font_size(gray, h, w):
    """Estimasi tinggi huruf dari connected components."""
    try:
        _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        n, _, stats, _ = cv2.connectedComponentsWithStats(binary)

        heights = []
        for i in range(1, n):
            comp_h = stats[i, cv2.CC_STAT_HEIGHT]
            comp_w = stats[i, cv2.CC_STAT_WIDTH]
            area = stats[i, cv2.CC_STAT_AREA]
            # Filter: hanya komponen yang proporsional seperti huruf
            if 5 < comp_h < h * 0.15 and 3 < comp_w < w * 0.1 and area > 20:
                heights.append(comp_h)

        if not heights:
            return 60  # default

        median_h = float(np.median(heights))
        scale = 3508 / h
        font_size = int(median_h * scale * 0.85)
        return max(40, min(90, font_size))

    except Exception:
        return 60


def _estimate_line_height(gray, h, w):
    """Estimasi jarak antar baris dari horizontal projection."""
    try:
        _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        proj = np.sum(binary, axis=1)

        threshold = proj.max() * 0.15
        in_line = proj > threshold

        transitions = np.diff(in_line.astype(int))
        starts = np.where(transitions == 1)[0]
        ends = np.where(transitions == -1)[0]

        if len(starts) < 2 or len(ends) < 2:
            return 83  # default

        centers = [
            (starts[i] + ends[i]) / 2 for i in range(min(len(starts), len(ends)))
        ]
        gaps = [centers[i + 1] - centers[i] for i in range(len(centers) - 1)]

        if not gaps:
            return 83

        median_gap = float(np.median(gaps))
        scale = 3508 / h
        line_height = int(median_gap * scale * 0.9)
        return max(60, min(120, line_height))

    except Exception:
        return 83


def _estimate_slant(gray):
    """Estimasi kemiringan tulisan dari sudut stroke vertikal."""
    try:
        edges = cv2.Canny(gray, 50, 150)
        lines = cv2.HoughLinesP(
            edges, 1, np.pi / 180, threshold=30, minLineLength=20, maxLineGap=5
        )
        if lines is None:
            return 0

        angles = []
        for line in lines:
            x1, y1, x2, y2 = line[0]
            if x2 == x1:
                continue
            angle = np.degrees(np.arctan2(y2 - y1, x2 - x1))
            # ✅ PERBAIKAN BUG: hanya filter abs(angle) > 60 — stroke mendekati vertikal
            if abs(angle) > 60:
                angles.append(angle)

        if not angles:
            return 0

        median_angle = float(np.median(angles))
        slant = int(np.clip(-median_angle * 0.3, -15, 15))
        return slant

    except Exception:
        return 0


def _estimate_word_spacing(gray):
    """Estimasi spasi kata dari gap horizontal antar cluster huruf."""
    try:
        _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (15, 3))
        dilated = cv2.dilate(binary, kernel)

        n, _, stats, _ = cv2.connectedComponentsWithStats(dilated)
        widths = []
        for i in range(1, n):
            comp_w = stats[i, cv2.CC_STAT_WIDTH]
            if comp_w > 20:
                widths.append(comp_w)

        if len(widths) < 2:
            return 8  # default

        avg_w = float(np.mean(widths))
        img_w = gray.shape[1]
        ratio = avg_w / img_w

        if ratio < 0.05:
            return -5  # rapat
        elif ratio < 0.12:
            return 8  # normal
        else:
            return 20  # lebar

    except Exception:
        return 8


# ── FUNGSI BARU #5 ─────────────────────────────────────────────────────────────


def _estimate_write_speed(gray, h, w):
    """
    [BARU] Estimasi kecepatan tulis dari ketebalan stroke huruf.

    Cara kerja:
    - Setiap huruf punya rasio: area pixel terisi vs luas bounding box-nya.
    - Rasio tinggi  → stroke tebal → tulisan lambat & rapi (writeSpeed rendah).
    - Rasio rendah  → stroke tipis → tulisan cepat & kasar (writeSpeed tinggi).

    Return: float antara 0.1 (sangat lambat/rapi) sampai 0.9 (sangat cepat).
    """
    try:
        _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        n, _, stats, _ = cv2.connectedComponentsWithStats(binary)

        fill_ratios = []
        for i in range(1, n):
            area = stats[i, cv2.CC_STAT_AREA]
            comp_h = stats[i, cv2.CC_STAT_HEIGHT]
            comp_w = stats[i, cv2.CC_STAT_WIDTH]
            bbox_area = comp_h * comp_w

            # Filter hanya komponen ukuran huruf, bukan noise atau titik kecil
            if bbox_area > 0 and 8 < comp_h < h * 0.15 and 5 < comp_w < w * 0.1:
                fill_ratios.append(area / bbox_area)

        if not fill_ratios:
            return 0.5  # default: kecepatan normal

        avg_fill = float(np.mean(fill_ratios))

        # avg_fill ~0.3 = stroke tipis (cepat), ~0.7 = stroke tebal (lambat)
        # Map ke writeSpeed: stroke tebal → speed rendah, stroke tipis → speed tinggi
        # Clamp ke rentang 0.1 – 0.9 agar tidak ekstrem
        write_speed = float(np.clip(1.0 - avg_fill, 0.1, 0.9))
        # Bulatkan ke 2 desimal agar lebih bersih di UI
        return round(write_speed, 2)

    except Exception:
        return 0.5


# ── FUNGSI BARU #6 ─────────────────────────────────────────────────────────────


def _estimate_margin_jitter(gray, h, w):
    """
    [BARU] Estimasi seberapa konsisten margin kiri tulisan tangan.

    Cara kerja:
    - Untuk setiap baris teks, cari posisi pixel pertama (paling kiri) yang hitam.
    - Hitung standar deviasi posisi-posisi tersebut.
    - Deviasi kecil = margin konsisten = marginJitter kecil.
    - Deviasi besar = margin tidak rata = marginJitter besar.

    Return: int antara 2 (sangat konsisten) sampai 14 (sangat tidak rata).
    """
    try:
        _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

        # Horizontal projection untuk temukan baris teks
        proj = np.sum(binary, axis=1)
        threshold = proj.max() * 0.15
        in_line = proj > threshold

        transitions = np.diff(in_line.astype(int))
        starts = np.where(transitions == 1)[0]
        ends = np.where(transitions == -1)[0]

        if len(starts) < 2:
            return 6  # default

        # Untuk setiap baris, cari kolom paling kiri yang ada pixel-nya
        left_positions = []
        for i in range(min(len(starts), len(ends))):
            row_start = int(starts[i])
            row_end = int(ends[i])
            # Ambil area baris ini dari binary image
            row_slice = binary[row_start:row_end, :]
            # Cari kolom pertama yang ada pixel putih (teks)
            col_sums = row_slice.sum(axis=0)
            nonzero = np.nonzero(col_sums)[0]
            if len(nonzero) > 0:
                left_positions.append(nonzero[0])

        if len(left_positions) < 2:
            return 6

        # Standar deviasi posisi kiri = ukuran ketidakrataan margin
        std_dev = float(np.std(left_positions))

        # Scale std_dev (dalam pixel foto) ke nilai marginJitter (2–14)
        # Foto biasanya 1000-3000px lebar, margin jitter di folio ~2-14px
        scale_factor = 14.0 / (w * 0.05)  # 5% lebar foto = jitter max
        jitter = int(np.clip(std_dev * scale_factor, 2, 14))
        return jitter

    except Exception:
        return 6


# ── FUNGSI BARU #7 ─────────────────────────────────────────────────────────────


def _estimate_ink_color(img, gray):
    """
    [BARU] Ekstraksi warna tinta asli dari foto.
    Mencari pixel yang merupakan teks, lalu mengambil median warnanya.
    """
    try:
        # Gunakan adaptive threshold untuk memisahkan teks dari kertas
        thresh = cv2.adaptiveThreshold(
            gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 21, 10
        )

        # Ambil koordinat pixel yang merupakan teks
        y_coords, x_coords = np.where(thresh > 0)
        if len(y_coords) == 0:
            return "#1a1a1a"  # Default hitam/dark gray

        # Ambil warna asli dari gambar BGR (OpenCV pakai BGR, bukan RGB)
        colors = img[y_coords, x_coords]

        # Filter pixel yang terlalu terang (mungkin bayangan kertas yang ikut terdeteksi)
        # Luminance formula untuk mencari pixel yang cukup gelap (tinta)
        # OpenCV menyimpan warna dalam urutan BGR, bukan RGB:
        #   colors[:, 0] = Blue
        #   colors[:, 1] = Green
        #   colors[:, 2] = Red
        #
        # Rumus luminance ITU-R BT.601 yang benar: 0.299*R + 0.587*G + 0.114*B
        # Karena urutan array adalah BGR, penulisannya jadi terbalik:
        luminance = 0.114 * colors[:, 0] + 0.587 * colors[:, 1] + 0.299 * colors[:, 2]
        dark_pixels = colors[luminance < 140]

        if len(dark_pixels) == 0:
            dark_pixels = colors  # Fallback kalau ternyata tintanya warna terang

        # Gunakan median agar kebal terhadap noise / warna kertas yang bocor
        median_b = int(np.median(dark_pixels[:, 0]))
        median_g = int(np.median(dark_pixels[:, 1]))
        median_r = int(np.median(dark_pixels[:, 2]))

        # Format ke HEX warna
        return f"#{median_r:02x}{median_g:02x}{median_b:02x}"

    except Exception as e:
        print("Color extraction error:", e)
        return "#1a1a1a"
