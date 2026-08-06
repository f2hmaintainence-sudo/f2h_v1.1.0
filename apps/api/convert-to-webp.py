import os
import tempfile
from PIL import Image
import shutil

def convert_to_webp(folder):
    count = 0
    for root, dirs, files in os.walk(folder):
        for file in files:
            file_path = os.path.join(root, file)
            # Process files that are not already .webp
            if file.lower().endswith(('.png', '.jpg', '.jpeg', '.bmp', '.tiff')):
                try:
                    # New path with .webp extension
                    base_name = os.path.splitext(file_path)[0]
                    new_file_path = base_name + '.webp'

                    with Image.open(file_path) as img:
                        if img.mode not in ('RGB', 'RGBA'):
                            img = img.convert('RGBA')

                        fd, temp_path = tempfile.mkstemp(suffix='.webp')
                        os.close(fd)
                        img.save(temp_path, "WEBP", quality=80)
                    
                    # Move to the new .webp file path
                    shutil.move(temp_path, new_file_path)
                    
                    # Remove the old file
                    if os.path.exists(file_path) and file_path != new_file_path:
                        os.remove(file_path)
                        
                    print(f"Converted {file_path} -> {new_file_path}")
                    count += 1
                except Exception as e:
                    print(f"Error converting {file_path}: {e}")
                    
    print(f"Done! Converted and renamed {count} images to .webp extensions.")

if __name__ == '__main__':
    convert_to_webp('./uploads')
