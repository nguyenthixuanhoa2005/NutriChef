from flask import Flask, request, jsonify
import speech_recognition as sr
import os
import re
import unicodedata
from ultralytics import YOLO
from pydub import AudioSegment 
import requests
import time
import shutil

app = Flask(__name__)

# --- CẤU HÌNH ---
UPLOAD_FOLDER = './temp_uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# --- CẤU HÌNH DANH SÁCH NGUYÊN LIỆU ---
VALID_INGREDIENTS_MAP = {
    "banana": "Chuối", "apple": "Táo", "orange": "Cam", "broccoli": "Súp lơ",
    "carrot": "Cà rốt", "potted plant": "Rau xanh", "sandwich": "Bánh mì",
    "cake": "Bánh ngọt", "hot dog": "Xúc xích", "pizza": "Pizza",
    "donut": "Bánh ngọt", "bird": "Thịt gà", "cow": "Thịt bò", "fish": "Cá",
}

VOICE_INGREDIENT_ALIASES = {
    "Thịt gà": ["thịt gà", "ức gà", "gà", "gà ta"],
    "Thịt bò": ["thịt bò", "bò nạc", "bò", "thăn bò"],
    "Thịt lợn": ["thịt heo", "thịt lợn", "ba chỉ", "nạc vai"],
    "Súp lơ": ["súp lơ", "bông cải", "bông cải xanh", "bắp cải"],
    "Rau xanh": ["rau muống", "rau cải", "bắp cải", "xà lách", "cải kale", "cải thìa", "cần tây"],
    "Đậu phụ": ["đậu hũ", "tàu hũ"],
    "Hành lá": ["hành hoa", "hành"],
    "Bánh mì": ["bánh mỳ", "sandwich"],
    "Bánh ngọt": ["bánh kem", "bánh quy", "donut", "cake"],
    "Ớt": ["ớt tươi", "ớt đỏ", "ớt xanh"],
    "Khoai tây": ["khoai tây", "khoai tây bi"],
    "Khoai lang": ["khoai lang", "khoai lang tím"],
    "Tôm": ["tôm sú", "tôm"],
    "Cá": ["cá basa", "cá hồi", "cá trê"],
}

INGREDIENT_WHITELIST = set()
VOICE_ALIAS_TO_CANONICAL = {}
VOICE_MATCHERS = []

def normalize_text(text):
    if not text: return ""
    lowered = str(text).strip().lower()
    no_accent = unicodedata.normalize("NFD", lowered)
    no_accent = "".join(ch for ch in no_accent if unicodedata.category(ch) != "Mn")
    only_text = re.sub(r"[^a-z0-9\s]", " ", no_accent)
    return re.sub(r"\s+", " ", only_text).strip()

def rebuild_voice_matchers():
    global VOICE_ALIAS_TO_CANONICAL, VOICE_MATCHERS
    alias_map = {}
    for ingredient in INGREDIENT_WHITELIST:
        norm_name = normalize_text(ingredient)
        if norm_name: alias_map[norm_name] = ingredient
    for canonical_name, aliases in VOICE_INGREDIENT_ALIASES.items():
        if canonical_name not in INGREDIENT_WHITELIST: continue
        for alias in aliases:
            norm_alias = normalize_text(alias)
            if norm_alias: alias_map[norm_alias] = canonical_name
    VOICE_ALIAS_TO_CANONICAL = alias_map
    sorted_aliases = sorted(alias_map.items(), key=lambda item: len(item[0]), reverse=True)
    VOICE_MATCHERS = [(re.compile(rf"(?:^|\s){re.escape(alias)}(?:\s|$)", re.IGNORECASE), canonical)
                      for alias, canonical in sorted_aliases]

def load_ingredients_from_backend():
    global INGREDIENT_WHITELIST
    try:
        response = requests.get('http://localhost:3000/api/internal/all-ingredients', timeout=5)
        if response.status_code == 200:
            db_ingredients = response.json()
            INGREDIENT_WHITELIST = {str(item.get("name") if isinstance(item, dict) else item).strip() for item in db_ingredients if item}
            print(f"✅ Đã tải {len(INGREDIENT_WHITELIST)} nguyên liệu từ DB.")
    except:
        print("⚠️ Dùng whitelist cục bộ.")
        INGREDIENT_WHITELIST = set(VALID_INGREDIENTS_MAP.values()) | set(VOICE_INGREDIENT_ALIASES.keys())
    rebuild_voice_matchers()

# Load Model
print("Đang tải model YOLOv8...")
model = YOLO('yolov8n.pt') 
load_ingredients_from_backend()

def convert_to_wav(input_path, output_path):
    try:
        # 1. Thử kiểm tra xem file có phải là WAV thật không
        with open(input_path, 'rb') as f:
            header = f.read(4)
            if header == b'RIFF':
                shutil.copyfile(input_path, output_path)
                return True, "Already WAV"

        # 2. Nếu không phải WAV, bắt buộc dùng Pydub (cần FFmpeg)
        sound = AudioSegment.from_file(input_path)
        sound.set_channels(1).export(output_path, format="wav")
        return True, "Success"
    except Exception as e:
        err_str = str(e)
        if "ffprobe" in err_str or "ffmpeg" in err_str:
            return False, "SERVER_MISSING_FFMPEG"
        return False, err_str

@app.route('/detect/voice', methods=['POST'])
def detect_voice():
    if 'file' not in request.files: return jsonify({"error": "No file"}), 400
    file = request.files['file']
    filename = file.filename or "audio.m4a"
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    file.save(filepath)
    
    wav_path = os.path.join(UPLOAD_FOLDER, f"temp_{int(time.time())}.wav")
    recognizer = sr.Recognizer()
    try:
        success, err_code = convert_to_wav(filepath, wav_path)
        if not success:
            if err_code == "SERVER_MISSING_FFMPEG":
                return jsonify({
                    "error": "Lỗi Server: Thiếu FFmpeg để đọc âm thanh Android.",
                    "solution": "Hãy chạy lệnh 'winget install ffmpeg' trên máy tính và khởi động lại Server.",
                    "status": "error"
                }), 500
            return jsonify({"error": f"Lỗi chuyển đổi: {err_code}", "status": "error"}), 400

        with sr.AudioFile(wav_path) as source:
            recognizer.adjust_for_ambient_noise(source, duration=0.5)
            audio = recognizer.record(source)
            text = recognizer.recognize_google(audio, language="vi-VN")
            
            found = set()
            temp_text = f" {normalize_text(text)} "
            for pattern, canonical in VOICE_MATCHERS:
                if pattern.search(temp_text):
                    found.add(canonical)
            
            detected = sorted(list(found))
            print(f"🎙️ Nghe thấy: \"{text}\" -> Trích xuất: {detected}")
            return jsonify({"raw_text": text, "detected_ingredients": detected, "status": "success"})
    except sr.UnknownValueError:
        return jsonify({"error": "AI không nghe rõ bạn nói gì", "status": "fail"}), 422
    except Exception as e:
        print(f"❌ Lỗi: {str(e)}")
        return jsonify({"error": str(e), "status": "error"}), 500
    finally:
        for p in [filepath, wav_path]:
            if os.path.exists(p):
                try: os.remove(p)
                except: pass

@app.route('/detect/image', methods=['POST'])
def detect_image():
    if 'file' not in request.files: return jsonify({"error": "No file"}), 400
    file = request.files['file']
    filepath = os.path.join(UPLOAD_FOLDER, file.filename or "img.jpg")
    file.save(filepath)
    try:
        results = model.predict(source=filepath, conf=0.2, iou=0.45, save=False)
        detected_ingredients = set()
        for result in results:
            for box in result.boxes:
                name_en = model.names[int(box.cls[0])]
                if name_en in VALID_INGREDIENTS_MAP:
                    name_vi = VALID_INGREDIENTS_MAP[name_en]
                    canonical = VOICE_ALIAS_TO_CANONICAL.get(normalize_text(name_vi), name_vi)
                    detected_ingredients.add(canonical)
        return jsonify({"status": "success", "detected_ingredients": sorted(list(detected_ingredients))})
    except Exception as e:
        return jsonify({"error": str(e), "status": "error"}), 500
    finally:
        if os.path.exists(filepath): os.remove(filepath)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)
