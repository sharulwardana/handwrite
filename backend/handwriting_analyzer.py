import cv2
import numpy as np


def analyze_handwriting(image_bytes: bytes) -> dict:
    """
    Analisis foto tulisan tangan SUPER CEPAT.
    """
    arr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Gambar tidak bisa dibaca")

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape

    # 🔥 OPTIMISASI UTAMA: Lakukan komputasi berat SATU KALI SAJA untuk semua fungsi
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    n, _, stats, _ = cv2.connectedComponentsWithStats(binary)

    result = {}

    # 1 & 5. Estimasi Ukuran Huruf & Kecepatan (Digabung agar komputasi loop cuma 1x)
    font_size, write_speed = _estimate_font_and_speed(stats, n, h, w)
    result["fontSize"] = font_size
    result["writeSpeed"] = write_speed

    # 2. Estimasi Line Height
    result["lineHeight"] = _estimate_line_height(binary, h, w)

    # 3. Estimasi Kemiringan (Membutuhkan raw grayscale untuk Canny edge)
    result["slantAngle"] = _estimate_slant(gray)

    # 4. Estimasi Spasi Kata
    result["wordSpacing"] = _estimate_word_spacing(binary, w)

    # 6. Estimasi Margin Jitter
    result["marginJitter"] = _estimate_margin_jitter(binary, w)

    # 7. Estimasi Warna Tinta
    result["color"] = _estimate_ink_color(img, gray)

    return result


def _estimate_font_and_speed(stats, n, h, w):
    heights = []
    fill_ratios = []
    for i in range(1, n):
        comp_h = stats[i, cv2.CC_STAT_HEIGHT]
        comp_w = stats[i, cv2.CC_STAT_WIDTH]
        area = stats[i, cv2.CC_STAT_AREA]
        bbox_area = comp_h * comp_w

        # Filter komponen proporsional huruf
        if (
            bbox_area > 0
            and 5 < comp_h < h * 0.15
            and 3 < comp_w < w * 0.1
            and area > 20
        ):
            heights.append(comp_h)
            fill_ratios.append(area / bbox_area)

    # Kalkulasi Font Size
    if not heights:
        font_size = 60
    else:
        median_h = float(np.median(heights))
        scale = 3508 / h
        font_size = max(40, min(90, int(median_h * scale * 0.85)))

    # Kalkulasi Kecepatan Tulis
    if not fill_ratios:
        write_speed = 0.5
    else:
        avg_fill = float(np.mean(fill_ratios))
        write_speed = round(float(np.clip(1.0 - avg_fill, 0.1, 0.9)), 2)

    return font_size, write_speed


def _estimate_line_height(binary, h, w):
    proj = np.sum(binary, axis=1)
    threshold = proj.max() * 0.15
    in_line = proj > threshold

    transitions = np.diff(in_line.astype(int))
    starts = np.where(transitions == 1)[0]
    ends = np.where(transitions == -1)[0]

    if len(starts) < 2 or len(ends) < 2:
        return 83

    centers = [(starts[i] + ends[i]) / 2 for i in range(min(len(starts), len(ends)))]
    gaps = [centers[i + 1] - centers[i] for i in range(len(centers) - 1)]

    if not gaps:
        return 83

    median_gap = float(np.median(gaps))
    scale = 3508 / h
    return max(60, min(120, int(median_gap * scale * 0.9)))


def _estimate_slant(gray):
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
        if abs(abs(angle) - 90) < 25:
            angles.append(angle)

    if not angles:
        return 0
    median_angle = float(np.median(angles))
    return int(np.clip(-median_angle * 0.3, -15, 15))


def _estimate_word_spacing(binary, w):
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (15, 3))
    dilated = cv2.dilate(binary, kernel)
    n, _, stats, _ = cv2.connectedComponentsWithStats(dilated)

    widths = [
        stats[i, cv2.CC_STAT_WIDTH]
        for i in range(1, n)
        if stats[i, cv2.CC_STAT_WIDTH] > 20
    ]

    if len(widths) < 2:
        return 8
    avg_w = float(np.mean(widths))
    ratio = avg_w / w

    if ratio < 0.05:
        return -5
    elif ratio < 0.12:
        return 8
    else:
        return 20


def _estimate_margin_jitter(binary, w):
    proj = np.sum(binary, axis=1)
    threshold = proj.max() * 0.15
    in_line = proj > threshold

    transitions = np.diff(in_line.astype(int))
    starts = np.where(transitions == 1)[0]
    ends = np.where(transitions == -1)[0]

    if len(starts) < 2:
        return 6

    left_positions = []
    for i in range(min(len(starts), len(ends))):
        row_slice = binary[int(starts[i]) : int(ends[i]), :]
        col_sums = row_slice.sum(axis=0)
        nonzero = np.nonzero(col_sums)[0]
        if len(nonzero) > 0:
            left_positions.append(nonzero[0])

    if len(left_positions) < 2:
        return 6

    std_dev = float(np.std(left_positions))
    scale_factor = 14.0 / (w * 0.05)
    return int(np.clip(std_dev * scale_factor, 2, 14))


def _estimate_ink_color(img, gray):
    thresh = cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 21, 10
    )
    y_coords, x_coords = np.where(thresh > 0)
    if len(y_coords) == 0:
        return "#1a1a1a"

    colors = img[y_coords, x_coords]
    luminance = 0.114 * colors[:, 0] + 0.587 * colors[:, 1] + 0.299 * colors[:, 2]
    dark_pixels = colors[luminance < 110]

    if len(dark_pixels) == 0:
        dark_pixels = colors

    median_b = int(np.median(dark_pixels[:, 0]))
    median_g = int(np.median(dark_pixels[:, 1]))
    median_r = int(np.median(dark_pixels[:, 2]))

    return f"#{median_r:02x}{median_g:02x}{median_b:02x}"
