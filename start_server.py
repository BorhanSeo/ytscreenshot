import subprocess
import time
import os
import sys

def kill_stale_processes(port=10000):
    print("Checking for existing processes...")
    try:
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
    print("Starting Local Backend Server on port 10000...")
    print("="*60)
    print("YOUR LOCAL BACKEND IS RUNNING!")
    print("Just open your website: https://ytscreenshot.vercel.app")
    print("It will automatically connect to this server.")
    print("="*60)
    
    env = os.environ.copy()
    subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "backend.main:app", "--host", "127.0.0.1", "--port", "10000"],
        env=env
    )

if __name__ == "__main__":
    kill_stale_processes(10000)
    start_fastapi()
    
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("Shutting down...")
