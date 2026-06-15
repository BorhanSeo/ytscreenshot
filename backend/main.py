import os
import shutil
import uuid
import time
import zipfile
import subprocess
import re
from fastapi import FastAPI, BackgroundTasks, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from PIL import Image, ImageDraw, ImageFont

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ScreenshotRequest(BaseModel):
    videoUrl: str
    intervalSeconds: int = 5
    cropType: str = "none" # "none", "no_bottom", "central_4_3"

def cleanup(folder_path: str, zip_path: str):
    time.sleep(60)
    if os.path.exists(folder_path):
        shutil.rmtree(folder_path)
    if os.path.exists(zip_path):
        os.remove(zip_path)

def extract_frames(video_url: str, output_folder: str, interval: int = 5, crop_type: str = "none"):
    os.makedirs(output_folder, exist_ok=True)
    
    try:
        # Get the direct video stream URL using pytubefix
        print(f"Fetching stream URL for {video_url}...")
        from pytubefix import YouTube
        yt = YouTube(video_url)
        stream = yt.streams.filter(file_extension='mp4').first()
        
        if not stream or not stream.url:
            raise Exception("pytubefix could not find a suitable mp4 stream")
            
        stream_url = stream.url
            
        print(f"Extracting frames with ffmpeg (crop mode: {crop_type})...")
        output_pattern = os.path.join(output_folder, "screenshot_%04d.jpg")
        
        # Build ffmpeg video filter string
        filters = []
        if crop_type == "no_bottom":
            filters.append("crop=iw:ih*0.85:0:0")
        elif crop_type == "central_4_3":
            # Crop 48% width, 85% height, centered horizontally (offset 26% width)
            filters.append("crop=iw*0.48:ih*0.85:iw*0.26:0")
        filters.append(f"fps=1/{interval}")
        filter_str = ",".join(filters)
        
        # Check if local ffmpeg.exe exists in root or parent folder
        ffmpeg_path = "ffmpeg"
        if os.path.exists("ffmpeg.exe"):
            ffmpeg_path = os.path.abspath("ffmpeg.exe")
        elif os.path.exists(os.path.join(os.path.dirname(__file__), "..", "ffmpeg.exe")):
            ffmpeg_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "ffmpeg.exe"))
            
        ffmpeg_cmd = [
            ffmpeg_path,
            "-y", 
            "-i", stream_url,
            "-vf", filter_str,
            "-q:v", "2",
            output_pattern
        ]
        
        subprocess.run(ffmpeg_cmd, capture_output=True, text=True, check=True)
        print("Extraction complete.")
        
    except subprocess.CalledProcessError as e:
        print(f"Subprocess failed: {e.stderr}")
        raise Exception(f"Failed to process video: {e.stderr}")
    except Exception as e:
        print(f"Error extracting frames: {str(e)}")
        raise e

@app.post("/api/screenshots")
async def generate_screenshots(req: ScreenshotRequest, background_tasks: BackgroundTasks):
    run_id = str(uuid.uuid4())
    output_folder = f"temp_screenshots_{run_id}"
    zip_path = f"screenshots_{run_id}.zip"

    try:
        extract_frames(req.videoUrl, output_folder, req.intervalSeconds, req.cropType)

        # Check if files were created
        if not os.path.exists(output_folder) or len(os.listdir(output_folder)) == 0:
            cleanup(output_folder, zip_path)
            raise HTTPException(status_code=400, detail="Failed to capture any screenshots.")

        # Zip the files
        with zipfile.ZipFile(zip_path, 'w') as zipf:
            for root, _, files in os.walk(output_folder):
                for file in files:
                    file_path = os.path.join(root, file)
                    zipf.write(file_path, os.path.relpath(file_path, output_folder))

        background_tasks.add_task(cleanup, output_folder, zip_path)

        return FileResponse(
            path=zip_path,
            filename=f"youtube_screenshots.zip",
            media_type="application/zip"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        cleanup(output_folder, zip_path)
        raise HTTPException(status_code=500, detail=str(e))


def natural_sort_key(text):
    return [int(c) if c.isdigit() else c.lower() for c in re.split(r'(\d+)', text)]

def get_default_font():
    win_font_dir = os.path.join(os.environ.get("WINDIR", "C:\\Windows"), "Fonts")
    candidates = [
        os.path.join(win_font_dir, "Nirmala.ttf"),
        os.path.join(win_font_dir, "Nirmalab.ttf"),
        os.path.join(win_font_dir, "vrinda.ttf"),
        os.path.join(win_font_dir, "SiyamRupali.ttf"),
        os.path.join(win_font_dir, "SolaimanLipi.ttf"),
        os.path.join(win_font_dir, "arial.ttf"),
        os.path.join(win_font_dir, "calibri.ttf"),
    ]
    for font_path in candidates:
        if os.path.exists(font_path):
            return font_path
    return None

def wrap_text(text, font, max_width, draw):
    words = text.split()
    if not words:
        return []
    lines = []
    current_line = []
    for word in words:
        test_line = " ".join(current_line + [word])
        try:
            bbox = draw.textbbox((0, 0), test_line, font=font)
            line_width = bbox[2] - bbox[0]
        except AttributeError:
            line_width, _ = draw.textsize(test_line, font=font) if hasattr(draw, "textsize") else (0, 0)
            
        if line_width <= max_width:
            current_line.append(word)
        else:
            if current_line:
                lines.append(" ".join(current_line))
                current_line = [word]
            else:
                lines.append(word)
                current_line = []
    if current_line:
        lines.append(" ".join(current_line))
    return lines

@app.post("/api/subtitles")
async def add_subtitles_endpoint(
    background_tasks: BackgroundTasks,
    images_zip: UploadFile = File(...),
    subtitles_txt: UploadFile = File(...),
    style: str = Form("outline"),
    font_size: str = Form(""),
    font_scale: float = Form(0.045),
    margin: float = Form(0.08),
    outline_width: int = Form(3),
    bg_opacity: float = Form(0.55),
):
    run_id = str(uuid.uuid4())
    temp_dir = f"temp_subtitles_{run_id}"
    input_zip_path = f"input_{run_id}.zip"
    output_zip_path = f"subtitled_{run_id}.zip"
    
    os.makedirs(temp_dir, exist_ok=True)
    
    try:
        # Save uploaded ZIP file
        with open(input_zip_path, "wb") as buffer:
            shutil.copyfileobj(images_zip.file, buffer)
            
        # Extract images from ZIP
        with zipfile.ZipFile(input_zip_path, 'r') as zip_ref:
            zip_ref.extractall(temp_dir)
            
        # Clean up input ZIP immediately
        if os.path.exists(input_zip_path):
            os.remove(input_zip_path)
        
        # Read subtitle lines
        subtitle_content = await subtitles_txt.read()
        subtitle_lines = [line.strip() for line in subtitle_content.decode("utf-8", errors="ignore").splitlines()]
        
        # Gather and naturally sort images in temp_dir
        valid_exts = (".png", ".jpg", ".jpeg", ".bmp", ".webp")
        image_paths = []
        for root, _, files in os.walk(temp_dir):
            for file in files:
                if file.lower().endswith(valid_exts):
                    image_paths.append(os.path.join(root, file))
                    
        image_paths.sort(key=lambda p: natural_sort_key(os.path.basename(p)))
        
        if not image_paths:
            raise HTTPException(status_code=400, detail="No valid images found in the uploaded ZIP file.")
            
        process_count = min(len(image_paths), len(subtitle_lines))
        if process_count == 0:
            raise HTTPException(status_code=400, detail="Either images list or subtitle lines are empty.")
            
        font_path = get_default_font()
        
        # Parse font_size if provided
        parsed_font_size = None
        if font_size and font_size.strip().isdigit():
            parsed_font_size = int(font_size.strip())
            
        # Add subtitles to each image
        for i in range(process_count):
            img_path = image_paths[i]
            subtitle_text = subtitle_lines[i]
            
            if not subtitle_text:
                continue # Skip empty lines, keep image clean
                
            with Image.open(img_path) as img:
                if img.mode != "RGB":
                    img = img.convert("RGB")
                else:
                    img = img.copy()
                    
                width, height = img.size
                draw = ImageDraw.Draw(img)
                
                # Font size logic
                f_size = parsed_font_size
                if not f_size:
                    f_size = max(12, int(height * font_scale))
                    
                # Load font
                if font_path:
                    font = ImageFont.truetype(font_path, f_size)
                else:
                    font = ImageFont.load_default()
                    
                max_text_width = int(width * 0.9)
                b_margin = int(height * margin)
                
                # Wrap text
                wrapped_lines = wrap_text(subtitle_text, font, max_text_width, draw)
                if not wrapped_lines:
                    continue
                    
                # Calculate heights
                line_heights = []
                line_spacing = int(f_size * 0.2)
                
                for line in wrapped_lines:
                    try:
                        bbox = draw.textbbox((0, 0), line, font=font)
                        h = bbox[3] - bbox[1]
                    except AttributeError:
                        _, h = draw.textsize(line, font=font) if hasattr(draw, "textsize") else (0, f_size)
                    line_heights.append(h)
                    
                total_text_height = sum(line_heights) + line_spacing * (len(wrapped_lines) - 1)
                start_y = height - b_margin - total_text_height
                
                # Background Box Style
                if style == "bg_box":
                    box_padding_x = int(f_size * 0.5)
                    box_padding_y = int(f_size * 0.3)
                    
                    max_w = 0
                    for line in wrapped_lines:
                        try:
                            bbox = draw.textbbox((0, 0), line, font=font)
                            w = bbox[2] - bbox[0]
                        except AttributeError:
                            w, _ = draw.textsize(line, font=font) if hasattr(draw, "textsize") else (0, 0)
                        if w > max_w:
                            max_w = w
                            
                    box_left = (width - max_w) // 2 - box_padding_x
                    box_right = (width + max_w) // 2 + box_padding_x
                    box_top = start_y - box_padding_y
                    box_bottom = start_y + total_text_height + box_padding_y
                    
                    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
                    overlay_draw = ImageDraw.Draw(overlay)
                    bg_color = (0, 0, 0, int(255 * bg_opacity))
                    overlay_draw.rectangle([box_left, box_top, box_right, box_bottom], fill=bg_color)
                    
                    img = Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")
                    draw = ImageDraw.Draw(img)
                    
                # Draw text
                current_y = start_y
                for idx, line in enumerate(wrapped_lines):
                    try:
                        bbox = draw.textbbox((0, 0), line, font=font)
                        w = bbox[2] - bbox[0]
                    except AttributeError:
                        w, _ = draw.textsize(line, font=font) if hasattr(draw, "textsize") else (0, 0)
                        
                    x = (width - w) // 2
                    
                    if style == "outline":
                        draw.text(
                            (x, current_y), 
                            line, 
                            font=font, 
                            fill="white", 
                            stroke_width=outline_width,
                            stroke_fill="black"
                        )
                    else:
                        draw.text((x, current_y), line, font=font, fill="white")
                        
                    current_y += line_heights[idx] + line_spacing
                    
                # Save modified image back
                img.save(img_path)
                
        # Zip the processed folder
        with zipfile.ZipFile(output_zip_path, 'w') as zipf:
            for root, _, files in os.walk(temp_dir):
                for file in files:
                    file_path = os.path.join(root, file)
                    zipf.write(file_path, os.path.relpath(file_path, temp_dir))
                    
        background_tasks.add_task(cleanup, temp_dir, output_zip_path)
        
        return FileResponse(
            path=output_zip_path,
            filename="subtitled_images.zip",
            media_type="application/zip"
        )
        
    except HTTPException:
        cleanup(temp_dir, output_zip_path)
        raise
    except Exception as e:
        cleanup(temp_dir, output_zip_path)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/")
def read_root():
    return {"status": "Backend is running with yt-dlp and ffmpeg!"}
