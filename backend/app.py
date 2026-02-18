from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from PIL import Image, ImageDraw, ImageFont
import io
import base64
import os
import zipfile
import mimetypes
import random
import math
import cloudinary
import cloudinary.uploader
import cloudinary.api
import requests
from dotenv import load_dotenv
from werkzeug.utils import secure_filename

load_dotenv()

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "https://nama-domain-vercel-anda.vercel.app"}})

UPLOAD_FOLDER = 'uploads/folios'
FONT_FOLDER = 'fonts'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(FONT_FOLDER, exist_ok=True)

app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024

FOLIO_TEMPLATES = {}

def load_folio_templates():
    FOLIO_TEMPLATES.clear()
    for filename in os.listdir(UPLOAD_FOLDER):
        if filename.lower().endswith(('.png', '.jpg', '.jpeg')):
            FOLIO_TEMPLATES[filename] = os.path.join(UPLOAD_FOLDER, filename)

load_folio_templates()

AVAILABLE_FONTS = {
    'indie_flower':   {'name': 'Indie Flower',      'file': 'IndieFlower-Regular.ttf',    'style': 'casual'},
    'dancing_script': {'name': 'Dancing Script',    'file': 'DancingScript-Regular.ttf',  'style': 'elegant'},
    'caveat':         {'name': 'Caveat',             'file': 'Caveat-Regular.ttf',         'style': 'playful'},
    'patrick_hand':   {'name': 'Patrick Hand',      'file': 'PatrickHand-Regular.ttf',    'style': 'neat'},
    'kalam':          {'name': 'Kalam',              'file': 'Kalam-Regular.ttf',          'style': 'natural'},
    'reenie_beanie':  {'name': 'Reenie Beanie',     'file': 'ReenieBeanie-Regular.ttf',   'style': 'messy'},
    'dekko':          {'name': 'Dekko',              'file': 'Dekko-Regular.ttf',          'style': 'ballpoint'},
    'nanum_pen':      {'name': 'Nanum Pen Script',  'file': 'NanumPenScript-Regular.ttf', 'style': 'natural'},
    'sriracha':       {'name': 'Sriracha',           'file': 'Sriracha-Regular.ttf',       'style': 'quick'},
}


def hex_to_rgb(hex_color):
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))


def vary_color(base_rgb, variation=12):
    r, g, b = base_rgb
    factor = random.gauss(0, variation * 0.5)
    return (
        max(0, min(255, int(r + factor))),
        max(0, min(255, int(g + factor))),
        max(0, min(255, int(b + factor))),
    )


class HandwritingGenerator:
    def __init__(self, config, folio_path_or_url, font_path):
        self.config = config
        
        # Cek apakah ini URL Cloudinary dari internet atau file lokal
        if folio_path_or_url.startswith('http'):
            response = requests.get(folio_path_or_url, stream=True)
            self.folio_template = Image.open(response.raw).convert('RGB')
        else:
            self.folio_template = Image.open(folio_path_or_url).convert('RGB')
            
        self.font_path = font_path
        self.font = ImageFont.truetype(font_path, config['fontSize'])
        self.base_color_rgb = hex_to_rgb(config.get('color', '#2b2b2b'))
        self.word_spacing = int(config.get('wordSpacing', 8))
        self.session_seed = random.random()

    def get_baseline_wobble(self, line_index):
        """Kemiringan baseline per baris — terasa organik pakai sin + noise"""
        wave = math.sin(line_index * 1.1 + self.session_seed * 20) * 1.5
        return wave + random.uniform(-1.0, 1.0)

    def add_humanizer_effect(self, draw, text, x, y, line_index=0):
        # --- FITUR BARU: Efek Coretan (Typo) ---
        # 5% kemungkinan program "salah tulis" pada kata yang panjangnya lebih dari 4 huruf
        if len(text) > 4 and random.random() < 0.05:
            # Potong kata secara acak seolah-olah baru ditulis setengah
            typo_text = text[:random.randint(2, len(text)-1)]
            bbox = draw.textbbox((0, 0), typo_text, font=self.font)
            typo_width = bbox[2] - bbox[0]
            
            # Gambar kata yang salah
            draw.text((x, y), typo_text, fill=self.base_color_rgb, font=self.font)
            
            # Buat garis coretan di tengah tulisan
            strike_y = y + (self.config['fontSize'] // 2)
            draw.line([(x - 5, strike_y + random.randint(-2, 2)), 
                       (x + typo_width + 5, strike_y + random.randint(-2, 2))], 
                      fill=self.base_color_rgb, width=3)
            
            # Geser spasi agar kata yang BENAR ditulis setelah coretan
            x += typo_width + 20 
        # ---------------------------------------

        cursor_x = x
        available_width = self.config['maxWidth'] - x
        baseline_wobble = self.get_baseline_wobble(line_index)
        ink_level = random.uniform(0.65, 1.0)
        """
        Render satu baris dengan efek tulisan tangan:
        1. Tekanan pena  — variasi warna (tekan kuat=gelap, ringan=terang)
        2. Tinta habis   — karakter pudar sesekali, lalu pulih
        3. Variasi size  — ukuran font berfluktuasi kecil per karakter
        4. Baseline wobble — baris tidak lurus sempurna (naik-turun halus)
        5. Variasi spasi kata — word_spacing + sedikit random
        6. Variasi spasi huruf — char spacing kecil
        """
        cursor_x = x
        available_width = self.config['maxWidth'] - x
        baseline_wobble = self.get_baseline_wobble(line_index)
        ink_level = random.uniform(0.65, 1.0)

        for char in text:
            # 1. Jitter posisi
            jitter_x = random.uniform(-1.2, 1.2)
            progress = max(0.0, (cursor_x - x) / max(1, available_width))
            jitter_y = random.uniform(-1.5, 1.5) + baseline_wobble * progress * 4

            # 2. Variasi ukuran font
            size_delta = random.choices(
                [-3, -2, -1,  0,  0,  0,  0,  1,  2,  3],
                weights=[1,   2,  4,  8,  8,  8,  8,  4,  2,  1]
            )[0]
            font_size = max(10, self.config['fontSize'] + size_delta)
            char_font = ImageFont.truetype(self.font_path, font_size)

            # 3. Variasi warna (tekanan + tinta habis)
            if char.strip():
                pressure = random.gauss(0, 10)
                if ink_level < 0.25 and random.random() > 0.45:
                    fade = random.uniform(40, 75)
                    char_color = tuple(min(255, c + int(fade)) for c in self.base_color_rgb)
                elif ink_level < 0.5 and random.random() > 0.55:
                    fade = random.uniform(12, 32)
                    char_color = tuple(min(255, c + int(fade + pressure)) for c in self.base_color_rgb)
                else:
                    char_color = vary_color(self.base_color_rgb, int(abs(pressure) + 5))
            else:
                char_color = self.base_color_rgb

            # 4. Render
            draw.text(
                (cursor_x + jitter_x, y + jitter_y),
                char,
                fill=char_color,
                font=char_font
            )

            # 5. Update cursor
            bbox = draw.textbbox((0, 0), char, font=char_font)
            char_width = bbox[2] - bbox[0]

            if char == ' ':
                # Spasi kata: lebar asli + wordSpacing config + sedikit variasi
                extra = self.word_spacing + random.uniform(-1.5, 3.0)
                cursor_x += char_width + extra
            else:
                cursor_x += char_width + random.uniform(-0.5, 0.8)

            # 6. Drain & refill ink
            ink_level -= random.uniform(0, 0.005)
            if random.random() > 0.97:
                ink_level = min(1.0, ink_level + random.uniform(0.3, 0.6))
            ink_level = max(0.08, ink_level)

        return cursor_x

    def calculate_text_width(self, text):
        """Estimasi lebar teks termasuk wordSpacing"""
        draw = ImageDraw.Draw(Image.new('RGB', (1, 1)))
        bbox = draw.textbbox((0, 0), text, font=self.font)
        base_width = bbox[2] - bbox[0]
        extra = text.count(' ') * self.word_spacing
        return base_width + extra

    def split_into_pages(self, text):
        pages, current_lines = [], []
        y = self.config['startY']
        line_index = 0

        for paragraph in text.split('\n'):
            if not paragraph.strip():
                current_lines.append({'text': '', 'y': y, 'line_index': line_index})
                y += self.config['lineHeight']
                line_index += 1
                if y > self.config['pageBottom']:
                    pages.append(current_lines); current_lines = []
                    y = self.config['startY']; line_index = 0
                continue

            current_line = ""
            for word in paragraph.split(' '):
                test = current_line + word + " "
                if self.calculate_text_width(test) > (self.config['maxWidth'] - self.config['startX']) and current_line:
                    current_lines.append({'text': current_line.strip(), 'y': y, 'line_index': line_index})
                    current_line = word + " "
                    y += self.config['lineHeight']; line_index += 1
                    if y > self.config['pageBottom']:
                        pages.append(current_lines); current_lines = []
                        y = self.config['startY']; line_index = 0
                else:
                    current_line = test

            if current_line.strip():
                current_lines.append({'text': current_line.strip(), 'y': y, 'line_index': line_index})
                y += self.config['lineHeight']; line_index += 1
                if y > self.config['pageBottom']:
                    pages.append(current_lines); current_lines = []
                    y = self.config['startY']; line_index = 0

        if current_lines:
            pages.append(current_lines)
        return pages

    def apply_paper_texture(self, image):
        """Noise halus agar terasa seperti kertas di-scan"""
        data = list(image.getdata())
        result = []
        for px in data:
            if isinstance(px, tuple) and len(px) >= 3:
                n = random.randint(-4, 4)
                result.append((max(0,min(255,px[0]+n)), max(0,min(255,px[1]+n)), max(0,min(255,px[2]+n))))
            else:
                result.append(px)
        out = Image.new('RGB', image.size)
        out.putdata(result)
        return out

    def generate_page(self, lines):
        page = self.folio_template.copy()
        draw = ImageDraw.Draw(page)
        for line in lines:
            if line['text']:
                self.add_humanizer_effect(draw, line['text'], self.config['startX'], line['y'], line.get('line_index', 0))
        return self.apply_paper_texture(page)

    def generate_all_pages(self, text):
        return [self.generate_page(lines) for lines in self.split_into_pages(text)]


# ── ROUTES ──────────────────────────────────────────────

@app.route('/api/fonts', methods=['GET'])
def get_fonts():
    available = {k: v for k, v in AVAILABLE_FONTS.items()
                 if os.path.exists(os.path.join(FONT_FOLDER, v['file']))}
    return jsonify({'fonts': available})

@app.route('/api/folios', methods=['GET'])
def get_folios():
    load_folio_templates()
    folios = []
    
    # 1. Load template lokal (jika ada)
    for filename in FOLIO_TEMPLATES:
        if not filename.startswith('http'):
            name = filename
            for ext in ['.jpg','.jpeg','.png','.JPG','.JPEG','.PNG']:
                name = name.replace(ext, '')
            folios.append({
                'id': filename, 
                'name': name.replace('_',' ').replace('-',' ').title(),
                'preview': f'/api/folio/preview/{filename}'
            })
            
    # 2. Load template dari Cloudinary
    try:
        resources = cloudinary.api.resources(
            type="upload", 
            prefix="handwrite_folios/", 
            max_results=30
        )
        for res in resources.get('resources', []):
            name = res['public_id'].split('/')[-1].replace('_', ' ').replace('-', ' ').title()
            url = res['secure_url']
            folios.append({
                'id': url, 
                'name': name, 
                'preview': url
            })
            FOLIO_TEMPLATES[url] = url # Daftarkan ke dictionary
    except Exception as e:
        print("Cloudinary info:", e)
        
    return jsonify({'folios': folios})

@app.route('/api/folio/preview/<filename>', methods=['GET'])
def get_folio_preview(filename):
    filepath = os.path.join(UPLOAD_FOLDER, secure_filename(filename))
    if os.path.exists(filepath):
        mt, _ = mimetypes.guess_type(filepath)
        return send_file(filepath, mimetype=mt or 'image/jpeg')
    return jsonify({'error': 'Folio not found'}), 404

@app.route('/api/folio/upload', methods=['POST'])
def upload_folio():
    if 'folio' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    file = request.files['folio']
    if not file.filename:
        return jsonify({'error': 'No file selected'}), 400
        
    try:
        # Lempar file langsung ke Cloudinary
        upload_result = cloudinary.uploader.upload(file, folder="handwrite_folios")
        secure_url = upload_result['secure_url']
        
        # Simpan URL ke memori agar bisa dipakai
        FOLIO_TEMPLATES[secure_url] = secure_url
        return jsonify({'success': True, 'filename': secure_url})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/generate', methods=['POST'])
def generate_handwriting():
    try:
        data = request.json
        text = data.get('text', '')
        if not text.strip():
            return jsonify({'error': 'No text provided'}), 400
        if len(text) > 50000:
            return jsonify({'error': 'Text too long. Max 50,000 characters.'}), 400

        folio_id  = data.get('folioId', '')
        font_id   = data.get('fontId', 'indie_flower')
        
        # --- TAMBAHKAN 3 BARIS INI ---
        seed = data.get('seed')
        if seed:
            random.seed(seed)
        config    = {
            'startX': 100, 'startY': 130, 'lineHeight': 84,
            'maxWidth': 2400, 'pageBottom': 4500,
            'fontSize': 60, 'color': '#2b2b2b', 'wordSpacing': 8,
            **data.get('config', {})
        }

        folio_path = FOLIO_TEMPLATES.get(folio_id)
        if not folio_path or not os.path.exists(folio_path):
            return jsonify({'error': 'Invalid folio selected'}), 400

        font_info = AVAILABLE_FONTS.get(font_id)
        if not font_info:
            return jsonify({'error': 'Invalid font selected'}), 400

        font_path = os.path.join(FONT_FOLDER, font_info['file'])
        if not os.path.exists(font_path):
            return jsonify({'error': f'Font file not found: {font_info["file"]}'}), 400

        generator = HandwritingGenerator(config, folio_path, font_path)
        pages     = generator.generate_all_pages(text)

        result_pages = []
        for idx, page in enumerate(pages):
            buf = io.BytesIO()
            page.save(buf, format='JPEG', quality=92, optimize=True)
            buf.seek(0)
            result_pages.append({
                'page': idx + 1,
                'image': f'data:image/jpeg;base64,{base64.b64encode(buf.getvalue()).decode()}'
            })

        return jsonify({'success': True, 'totalPages': len(result_pages), 'pages': result_pages})

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/download/<int:page_num>', methods=['POST'])
def download_page(page_num):
    try:
        data = request.json
        raw  = data.get('imageData', '').split(',')[-1]
        return send_file(io.BytesIO(base64.b64decode(raw)),
                         mimetype='image/jpeg', as_attachment=True,
                         download_name=f'tugas_halaman_{page_num}.jpg')
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'healthy',
        'available_fonts': len([k for k,v in AVAILABLE_FONTS.items()
                                  if os.path.exists(os.path.join(FONT_FOLDER, v['file']))]),
        'available_folios': len(FOLIO_TEMPLATES)
    })

if __name__ == '__main__':
    app.run(
        debug=os.getenv('FLASK_DEBUG','False').lower() == 'true',
        host='0.0.0.0',
        port=int(os.getenv('PORT', 5000))
    )

@app.route('/api/download/pdf', methods=['POST'])
def download_pdf():
    try:
        pages = request.json.get('pages', [])
        if not pages:
            return jsonify({'error': 'No pages'}), 400

        images = []
        for p in pages:
            # Decode base64 menjadi Image Pillow
            img_data = base64.b64decode(p['image'].split(',')[1])
            img = Image.open(io.BytesIO(img_data)).convert('RGB')
            images.append(img)

        # Simpan gambar pertama, dan 'append' gambar sisanya sebagai PDF multi-halaman
        buf = io.BytesIO()
        images[0].save(buf, format='PDF', save_all=True, append_images=images[1:], resolution=100.0)
        buf.seek(0)

        return send_file(buf, mimetype='application/pdf', as_attachment=True, download_name='tugas_handwriting.pdf')
    except Exception as e:
        return jsonify({'error': str(e)}), 500