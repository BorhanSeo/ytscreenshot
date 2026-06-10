from playwright.sync_api import sync_playwright
import cv2
import time
import os

VIDEO_URL = "https://www.youtube.com/watch?v=ssEnVGv_bww"
SCREENSHOT_INTERVAL = 5
OUTPUT_FOLDER = "yt_screenshots"

os.makedirs(OUTPUT_FOLDER, exist_ok=True)


def clean_crop(image_path, output_path):
    img = cv2.imread(image_path)
    height, width = img.shape[:2]

    # ✅ মাঝের আসল content crop করো
    left   = int(width * 0.26)   # বাম কালো অংশ + logo বাদ
    right  = int(width * 0.90)   # ডান text/border বাদ
    top    = int(height * 0.05)  # উপরের logo বাদ
    bottom = int(height * 0.92)  # নিচের blur বাদ

    cropped = img[top:bottom, left:right]
    cv2.imwrite(output_path, cropped)


with sync_playwright() as p:
    browser = p.chromium.launch(
        headless=False,
        args=['--disable-blink-features=AutomationControlled']
    )

    context = browser.new_context(
        user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        viewport={"width": 1920, "height": 1080},
        is_mobile=False,
        has_touch=False,
        locale="en-US",
        timezone_id="Asia/Dhaka",
    )

    context.add_init_script("""
        Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
        Object.defineProperty(navigator, 'plugins', {get: () => [1, 2, 3, 4, 5]});
        window.chrome = { runtime: {} };
    """)

    page = context.new_page()
    page.on("dialog", lambda dialog: dialog.dismiss())

    print("🌐 YouTube এ যাচ্ছি...")
    page.goto(VIDEO_URL, wait_until="domcontentloaded", timeout=30000)
    time.sleep(4)

    # Popup বন্ধ করো
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
    print("✅ Video পাওয়া গেছে!")

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
            print("✅ Fullscreen চালু!")
            time.sleep(2)
    except:
        pass

    # YouTube subtitle বন্ধ
    try:
        cc_button = page.query_selector('.ytp-subtitles-button[aria-pressed="true"]')
        if cc_button:
            cc_button.click()
            print("✅ Subtitle বন্ধ!")
    except:
        pass

    time.sleep(2)
    video_duration = page.evaluate("document.querySelector('video').duration")
    print(f"⏱️ Video র মোট সময়: {int(video_duration)} সেকেন্ড")
    print("📸 Screenshot নেওয়া শুরু...")

    screenshot_count = 0

    while True:
        current_time = page.evaluate("document.querySelector('video').currentTime")
        is_ended = page.evaluate("document.querySelector('video').ended")
        is_paused = page.evaluate("document.querySelector('video').paused")

        if is_ended:
            print("🎬 Video শেষ হয়েছে!")
            break

        if is_paused:
            page.evaluate("document.querySelector('video').play()")

        raw_path = f"{OUTPUT_FOLDER}/raw_temp.png"
        final_path = f"{OUTPUT_FOLDER}/screenshot_{screenshot_count + 1}.png"

        try:
            video_element = page.query_selector('video')
            if video_element:
                video_element.screenshot(path=raw_path)

                # ✅ Logo, text, border crop করো
                clean_crop(raw_path, final_path)

                if os.path.exists(raw_path):
                    os.remove(raw_path)

                screenshot_count += 1
                print(f"✅ Screenshot {screenshot_count} | {int(current_time)}s / {int(video_duration)}s")

        except Exception as e:
            print(f"❌ Error: {e}")

        time.sleep(SCREENSHOT_INTERVAL)

    context.close()
    browser.close()
    print(f"\n🎉 মোট {screenshot_count}টি screenshot নেওয়া শেষ!")