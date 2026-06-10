import os
import shutil
import uuid
import time
import zipfile
from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from playwright.sync_api import sync_playwright
import cv2
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# Allow CORS for the frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For production, restrict this to your Vercel domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class VideoRequest(BaseModel):
    video_url: str

def clean_crop(image_path, output_path):
    img = cv2.imread(image_path)
    height, width = img.shape[:2]

    # Crop out side borders and logos
    left   = int(width * 0.26)
    right  = int(width * 0.90)
    top    = int(height * 0.05)
    bottom = int(height * 0.92)

    cropped = img[top:bottom, left:right]
    cv2.imwrite(output_path, cropped)

def capture_screenshots(video_url: str, output_folder: str, interval: int = 5):
    os.makedirs(output_folder, exist_ok=True)
    
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True, # Needs to be True for server environments!
            args=['--disable-blink-features=AutomationControlled', '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        )

        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            viewport={"width": 1920, "height": 1080},
            locale="en-US",
        )

        page = context.new_page()
        page.on("dialog", lambda dialog: dialog.dismiss())

        try:
            page.goto(video_url, wait_until="domcontentloaded", timeout=60000)
            time.sleep(4)

            # Close Popups
            for selector in [
                'button[aria-label="Accept all"]',
                'button:has-text("Accept all")',
                'button:has-text("Reject all")',
            ]:
                try:
                    if page.is_visible(selector, timeout=2000):
                        page.click(selector)
                        time.sleep(1)
                        break
                except:
                    pass

            page.wait_for_selector('video', timeout=20000)

            # Play + mute
            page.evaluate("""
                const video = document.querySelector('video');
                video.play();
                video.muted = true;
            """)
            time.sleep(2)

            # Fullscreen
            try:
                fullscreen_btn = page.query_selector('.ytp-fullscreen-button')
                if fullscreen_btn:
                    fullscreen_btn.click()
                    time.sleep(2)
            except:
                pass

            # Subtitles off
            try:
                cc_button = page.query_selector('.ytp-subtitles-button[aria-pressed="true"]')
                if cc_button:
                    cc_button.click()
            except:
                pass

            time.sleep(2)
            video_duration = page.evaluate("document.querySelector('video').duration")
            if not video_duration or video_duration > 600:
                # To avoid taking down the server, let's limit max video duration to 10 minutes (600s)
                # You can remove this limit if you want.
                video_duration = min(video_duration if video_duration else 600, 600)

            screenshot_count = 0

            while True:
                current_time = page.evaluate("document.querySelector('video').currentTime")
                is_ended = page.evaluate("document.querySelector('video').ended")
                is_paused = page.evaluate("document.querySelector('video').paused")

                if is_ended or current_time >= video_duration:
                    break

                if is_paused:
                    page.evaluate("document.querySelector('video').play()")

                raw_path = f"{output_folder}/raw_temp.png"
                final_path = f"{output_folder}/screenshot_{screenshot_count + 1}.png"

                try:
                    video_element = page.query_selector('video')
                    if video_element:
                        video_element.screenshot(path=raw_path)
                        clean_crop(raw_path, final_path)
                        if os.path.exists(raw_path):
                            os.remove(raw_path)
                        screenshot_count += 1
                except Exception as e:
                    print(f"Error capturing: {e}")

                time.sleep(interval)
        except Exception as e:
            print(f"Error navigating: {e}")
        finally:
            context.close()
            browser.close()

def create_zip(folder_path, zip_path):
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, _, files in os.walk(folder_path):
            for file in files:
                file_path = os.path.join(root, file)
                # Ensure the zip structure doesn't include absolute paths
                zipf.write(file_path, arcname=file)

def cleanup(folder_path, zip_path):
    if os.path.exists(folder_path):
        shutil.rmtree(folder_path)
    if os.path.exists(zip_path):
        os.remove(zip_path)

@app.post("/api/screenshots")
def get_screenshots(req: VideoRequest, background_tasks: BackgroundTasks):
    job_id = str(uuid.uuid4())
    output_folder = f"temp_{job_id}"
    zip_path = f"screenshots_{job_id}.zip"

    try:
        # 1. Capture screenshots
        capture_screenshots(req.video_url, output_folder, interval=5)
        
        # 2. Check if any screenshots were captured
        if not os.path.exists(output_folder) or len(os.listdir(output_folder)) == 0:
            cleanup(output_folder, zip_path)
            raise HTTPException(status_code=400, detail="Failed to capture any screenshots.")

        # 3. Create zip file
        create_zip(output_folder, zip_path)

        # 4. Schedule cleanup after response is sent
        background_tasks.add_task(cleanup, output_folder, zip_path)

        # 5. Return zip file
        return FileResponse(path=zip_path, filename="youtube_screenshots.zip", media_type="application/zip")

    except Exception as e:
        cleanup(output_folder, zip_path)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
def read_root():
    return {"status": "Backend is running"}
