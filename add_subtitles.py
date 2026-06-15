import os
import sys
import re
import argparse

# Reconfigure stdout to support UTF-8 on Windows command lines (avoids UnicodeEncodeError)
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Auto-install Pillow if not installed
try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    print("Pillow (PIL) library not found. Attempting to install it automatically...")
    import subprocess
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "pillow"])
        from PIL import Image, ImageDraw, ImageFont
        print("Pillow installed successfully!\n")
    except Exception as e:
        print(f"Failed to install Pillow: {e}")
        print("Please run: pip install pillow")
        sys.exit(1)


def natural_sort_key(text):
    """Sorts text containing numbers in a human-friendly order (e.g. img2 comes before img10)"""
    return [int(c) if c.isdigit() else c.lower() for c in re.split(r'(\d+)', text)]


def get_default_font(custom_path=None):
    """Finds a suitable TrueType font supporting Bengali/Unicode on Windows or falls back"""
    if custom_path and os.path.exists(custom_path):
        return custom_path
        
    win_font_dir = os.path.join(os.environ.get("WINDIR", "C:\\Windows"), "Fonts")
    
    # Preference list for Bengali/Unicode support
    candidates = [
        os.path.join(win_font_dir, "Nirmala.ttf"),       # Nirmala UI (Modern Windows default for Indic scripts)
        os.path.join(win_font_dir, "Nirmalab.ttf"),      # Nirmala UI Bold
        os.path.join(win_font_dir, "vrinda.ttf"),        # Vrinda (Older Windows Bengali font)
        os.path.join(win_font_dir, "SiyamRupali.ttf"),   # Siyam Rupali if installed
        os.path.join(win_font_dir, "SolaimanLipi.ttf"),  # Solaiman Lipi if installed
        os.path.join(win_font_dir, "arial.ttf"),         # Arial
        os.path.join(win_font_dir, "calibri.ttf"),       # Calibri
    ]
    
    for font_path in candidates:
        if os.path.exists(font_path):
            return font_path
            
    return None  # Will default to PIL's basic font


def wrap_text(text, font, max_width, draw):
    """Wraps text into multiple lines that fit within max_width"""
    words = text.split()
    if not words:
        return []
        
    lines = []
    current_line = []
    
    for word in words:
        test_line = " ".join(current_line + [word])
        # Get bounding box of the test line
        try:
            bbox = draw.textbbox((0, 0), test_line, font=font)
            line_width = bbox[2] - bbox[0]
        except AttributeError:
            # Fallback for older Pillow versions
            line_width, _ = draw.textsize(test_line, font=font) if hasattr(draw, "textsize") else (0, 0)
            
        if line_width <= max_width:
            current_line.append(word)
        else:
            if current_line:
                lines.append(" ".join(current_line))
                current_line = [word]
            else:
                # Word itself is wider than limit, place it on its own line
                lines.append(word)
                current_line = []
                
    if current_line:
        lines.append(" ".join(current_line))
        
    return lines


def process_subtitles(images_dir, text_file, output_dir, options):
    # Validate paths
    if not os.path.exists(images_dir):
        print(f"Error: Images directory '{images_dir}' does not exist.")
        return False
    if not os.path.exists(text_file):
        print(f"Error: Subtitle text file '{text_file}' does not exist.")
        return False
        
    os.makedirs(output_dir, exist_ok=True)
    
    # Read subtitle lines
    with open(text_file, "r", encoding="utf-8") as f:
        # Read lines, strip whitespace, keep empty lines in case user wants no subtitle on some images
        subtitles = [line.strip() for line in f.readlines()]
        
    # Get and sort images
    valid_exts = (".png", ".jpg", ".jpeg", ".bmp", ".webp")
    image_files = [f for f in os.listdir(images_dir) if f.lower().endswith(valid_exts)]
    image_files.sort(key=natural_sort_key)
    
    if not image_files:
        print(f"Error: No valid images found in '{images_dir}' (supported: {', '.join(valid_exts)})")
        return False
        
    print(f"Loaded {len(image_files)} images and {len(subtitles)} subtitle lines.")
    
    # We will loop through the minimum of images and subtitles
    process_count = min(len(image_files), len(subtitles))
    if process_count == 0:
        print("Nothing to process. Either images list or subtitle lines are empty.")
        return False
        
    font_path = get_default_font(options.font)
    if font_path:
        print(f"Using font: {os.path.basename(font_path)}")
    else:
        print("Using Pillow default font (Warning: Unicode/Bengali characters may not display correctly).")
        
    for i in range(process_count):
        img_name = image_files[i]
        subtitle_text = subtitles[i]
        
        img_path = os.path.join(images_dir, img_name)
        out_path = os.path.join(output_dir, img_name)
        
        # Open image
        try:
            with Image.open(img_path) as img:
                # Convert to RGB if it's RGBA/palette, or make a copy
                if img.mode != "RGB":
                    img = img.convert("RGB")
                else:
                    img = img.copy()
                    
                width, height = img.size
                draw = ImageDraw.Draw(img)
                
                # If subtitle is empty, save the image clean and continue
                if not subtitle_text:
                    img.save(out_path)
                    print(f"[{i+1}/{process_count}] Saved clean image (no subtitle): {img_name}")
                    continue
                
                # Determine font size (dynamic auto-scale if not specified)
                font_size = options.font_size
                if not font_size:
                    # Default: font size is 4.5% of image height
                    font_size = max(12, int(height * options.font_scale))
                    
                # Load font
                if font_path:
                    font = ImageFont.truetype(font_path, font_size)
                else:
                    font = ImageFont.load_default()
                    
                # Calculate margins and boundaries
                max_text_width = int(width * 0.9)  # 90% of image width
                bottom_margin = int(height * options.margin)
                
                # Wrap text
                wrapped_lines = wrap_text(subtitle_text, font, max_text_width, draw)
                if not wrapped_lines:
                    img.save(out_path)
                    continue
                    
                # Calculate total text block height and individual line heights
                line_heights = []
                total_text_height = 0
                line_spacing = int(font_size * 0.2)  # 20% spacing
                
                for line in wrapped_lines:
                    try:
                        bbox = draw.textbbox((0, 0), line, font=font)
                        h = bbox[3] - bbox[1]
                    except AttributeError:
                        _, h = draw.textsize(line, font=font) if hasattr(draw, "textsize") else (0, font_size)
                    line_heights.append(h)
                    
                total_text_height = sum(line_heights) + line_spacing * (len(wrapped_lines) - 1)
                
                # Y-coordinate of the start of the subtitle block
                start_y = height - bottom_margin - total_text_height
                
                # 1. Render Background Box if requested
                if options.style == "bg_box":
                    # Draw a translucent box behind text
                    box_padding_x = int(font_size * 0.5)
                    box_padding_y = int(font_size * 0.3)
                    
                    # Find maximum line width to size the box
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
                    
                    # Draw semi-transparent overlay
                    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
                    overlay_draw = ImageDraw.Draw(overlay)
                    bg_color = (0, 0, 0, int(255 * options.bg_opacity))
                    overlay_draw.rectangle([box_left, box_top, box_right, box_bottom], fill=bg_color)
                    
                    # Merge overlay back to image
                    img = Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")
                    draw = ImageDraw.Draw(img)  # Re-initialize draw on the merged image
                
                # 2. Draw lines of text
                current_y = start_y
                for idx, line in enumerate(wrapped_lines):
                    # Center the text horizontally
                    try:
                        bbox = draw.textbbox((0, 0), line, font=font)
                        w = bbox[2] - bbox[0]
                    except AttributeError:
                        w, _ = draw.textsize(line, font=font) if hasattr(draw, "textsize") else (0, 0)
                        
                    x = (width - w) // 2
                    
                    if options.style == "outline":
                        # Draw outline using newer PIL parameters (stroke_width and stroke_fill)
                        draw.text(
                            (x, current_y), 
                            line, 
                            font=font, 
                            fill=options.text_color, 
                            stroke_width=options.outline_width,
                            stroke_fill=options.outline_color
                        )
                    else:
                        # Draw standard text for bg_box style
                        draw.text((x, current_y), line, font=font, fill=options.text_color)
                        
                    current_y += line_heights[idx] + line_spacing
                    
                # Save output
                img.save(out_path)
                print(f"[{i+1}/{process_count}] Subtitled: {img_name} -> {subtitle_text[:40]}...")
                
        except Exception as e:
            print(f"❌ Error processing image {img_name}: {e}")
            
    print(f"\n🎉 Successfully processed {process_count} images! Output saved to: '{os.path.abspath(output_dir)}'")
    return True


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Image Subtitle Overlay Tool - Add text overlays to folders of images sequentially.")
    parser.add_argument("--images", "-i", default="./images", help="Path to input images directory (default: ./images)")
    parser.add_argument("--text", "-t", default="./subtitles.txt", help="Path to subtitles text file (default: ./subtitles.txt)")
    parser.add_argument("--output", "-o", default="./output_images", help="Path to output directory (default: ./output_images)")
    parser.add_argument("--font", "-f", default=None, help="Path to a custom .ttf font file")
    
    # Sizing
    parser.add_argument("--font-size", "-s", type=int, default=None, help="Fixed font size in pixels (overrides auto-scaling if provided)")
    parser.add_argument("--font-scale", type=float, default=0.045, help="Font size scale relative to image height (default: 0.045, i.e., 4.5%%)")
    parser.add_argument("--margin", "-m", type=float, default=0.08, help="Bottom margin fraction of image height (default: 0.08, i.e., 8%%)")
    
    # Styling
    parser.add_argument("--style", "-y", choices=["outline", "bg_box"], default="outline", help="Subtitle style: 'outline' (shadowed) or 'bg_box' (translucent back-bar) (default: outline)")
    parser.add_argument("--text-color", default="white", help="CSS color or hex for the text (default: white)")
    
    # Style-specific
    parser.add_argument("--outline-width", "-w", type=int, default=3, help="Outline stroke width for 'outline' style (default: 3)")
    parser.add_argument("--outline-color", default="black", help="Color of the text outline (default: black)")
    parser.add_argument("--bg-opacity", type=float, default=0.55, help="Background black bar opacity for 'bg_box' style (default: 0.55)")
    
    args = parser.parse_args()
    
    process_subtitles(args.images, args.text, args.output, args)
