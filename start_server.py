import subprocess
import threading
import re
import time
import os
import sys

def start_cloudflared():
    print("Starting Cloudflare tunnel...")
    if os.path.exists("cloudflared.log"):
        try:
            os.remove("cloudflared.log")
        except Exception:
            pass
        
    # Start cloudflared writing logs to cloudflared.log routing directly to 127.0.0.1 (IPv4) to avoid Windows localhost IPv6 resolution failures
    process = subprocess.Popen(
        [".\\cloudflared.exe", "tunnel", "--url", "http://127.0.0.1:10000", "--logfile", "cloudflared.log"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL
    )
    
    url_found = False
    start_time = time.time()
    while time.time() - start_time < 30:
        if os.path.exists("cloudflared.log"):
            try:
                with open("cloudflared.log", "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()
                matches = re.findall(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com", content)
                if matches:
                    url = matches[-1]
                    print("\n" + "="*60)
                    print("YOUR LIVE BACKEND URL IS:")
                    print(f"-> {url}")
                    print("="*60)
                    print("\nCopy this URL and paste it into page.tsx or local storage!")
                    with open("url.txt", "w") as f_out:
                        f_out.write(url)
                    url_found = True
                    break
            except Exception:
                pass
        time.sleep(0.5)
        
    if not url_found:
        print("Warning: Could not find tunnel URL in cloudflared.log within 30 seconds.")

def kill_stale_processes(port=10000):
    # 1. Kill stale cloudflared instances to free log file and old tunnels
    try:
        subprocess.run("taskkill /F /IM cloudflared.exe", shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception:
        pass

    # 2. Kill existing process on the backend port
    try:
        # Run netstat to find PID using the port
        output = subprocess.check_output("netstat -ano", shell=True).decode('utf-8', errors='ignore')
        for line in output.splitlines():
            if f":{port}" in line:
                parts = line.strip().split()
                if len(parts) >= 5 and "LISTENING" in parts:
                    pid = parts[-1]
                    print(f"Found existing process {pid} on port {port}. Terminating it to free the port...")
                    subprocess.run(f"taskkill /F /PID {pid}", shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                    time.sleep(1.5)
                    break
    except Exception as e:
        print(f"Warning: Could not check/kill process on port {port}: {e}")

def start_fastapi():
    print("Starting FastAPI backend...")
    env = os.environ.copy()
    subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "10000"],
        env=env
    )

if __name__ == "__main__":
    if not os.path.exists("cloudflared.exe"):
        print("Error: cloudflared.exe not found! Please wait for it to download.")
        sys.exit(1)
        
    kill_stale_processes(10000)
    start_fastapi()
    time.sleep(2)
    start_cloudflared()
    
    # Keep the main process alive so subprocesses are not terminated
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("Shutting down...")
