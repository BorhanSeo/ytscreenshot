import os
import shutil
import uuid
import time
import zipfile
import subprocess
from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

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

def cleanup(folder_path: str, zip_path: str):
    time.sleep(60)
    if os.path.exists(folder_path):
        shutil.rmtree(folder_path)
    if os.path.exists(zip_path):
        os.remove(zip_path)

def extract_frames(video_url: str, output_folder: str, interval: int = 5):
    os.makedirs(output_folder, exist_ok=True)
    
    try:
        # Get the direct video stream URL using pytubefix
        print(f"Fetching stream URL for {video_url}...")
        from pytubefix import YouTube
        yt = YouTube(video_url, client='WEB', use_po_token=True)
        stream = yt.streams.filter(file_extension='mp4').first()
        
        if not stream or not stream.url:
            raise Exception("pytubefix could not find a suitable mp4 stream")
            
        stream_url = stream.url
            
        print("Extracting frames with ffmpeg...")
        output_pattern = os.path.join(output_folder, "screenshot_%04d.jpg")
        fps_filter = f"fps=1/{interval}"
        
        ffmpeg_cmd = [
            "ffmpeg",
            "-y", 
            "-i", stream_url,
            "-vf", fps_filter,
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
        extract_frames(req.videoUrl, output_folder, req.intervalSeconds)

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

@app.get("/")
def read_root():
    return {"status": "Backend is running with yt-dlp and ffmpeg!"}
