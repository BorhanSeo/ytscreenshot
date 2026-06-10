import subprocess
import threading
import re
import time
import os
import sys

def start_cloudflared():
    print("Starting Cloudflare tunnel...")
    process = subprocess.Popen(
        [".\\cloudflared.exe", "tunnel", "--url", "http://localhost:10000"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    
    url_found = False
    for line in process.stderr:
        match = re.search(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com", line)
        if match and not url_found:
            url = match.group(0)
            print("\n" + "="*60)
            print("YOUR LIVE BACKEND URL IS:")
            print(f"-> {url}")
            print("="*60)
            print("\nCopy this URL and paste it into page.tsx instead of the Render URL!")
            with open("url.txt", "w") as f:
                f.write(url)
            url_found = True

def start_fastapi():
    print("Starting FastAPI backend...")
    env = os.environ.copy()
    # Ensure uvicorn runs the backend
    subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "backend.main:app", "--port", "10000"],
        env=env
    )

if __name__ == "__main__":
    if not os.path.exists("cloudflared.exe"):
        print("Error: cloudflared.exe not found! Please wait for it to download.")
        sys.exit(1)
        
    start_fastapi()
    time.sleep(2)
    start_cloudflared()
