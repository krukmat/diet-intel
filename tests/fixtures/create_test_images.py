#!/usr/bin/env python3
"""
Create test image fixtures for OCR testing
"""
import os
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont


def create_test_images():
    """Create various test images for OCR testing"""
    
    fixtures_dir = os.path.dirname(os.path.abspath(__file__))
    images_dir = os.path.join(fixtures_dir, 'images')
    os.makedirs(images_dir, exist_ok=True)
    
    # 1. Standard nutrition label
    create_standard_nutrition_label(os.path.join(images_dir, 'standard_nutrition.png'))
    
    # 2. Spanish nutrition label
    create_spanish_nutrition_label(os.path.join(images_dir, 'spanish_nutrition.png'))
    
    # 3. European nutrition label
    create_european_nutrition_label(os.path.join(images_dir, 'european_nutrition.png'))
    
    # 4. Low quality/blurry image
    create_blurry_nutrition_label(os.path.join(images_dir, 'blurry_nutrition.png'))
    
    # 5. High contrast image
    create_high_contrast_nutrition_label(os.path.join(images_dir, 'high_contrast_nutrition.png'))
    
    # 6. Small image that needs upscaling
    create_small_nutrition_label(os.path.join(images_dir, 'small_nutrition.png'))
    
    # 7. Rotated nutrition label
    create_rotated_nutrition_label(os.path.join(images_dir, 'rotated_nutrition.png'))
    
    # 8. Nutrition label with noise
    create_noisy_nutrition_label(os.path.join(images_dir, 'noisy_nutrition.png'))
    
    print(f"Created test image fixtures in {images_dir}")


def create_standard_nutrition_label(output_path):
    """Create a standard English nutrition label"""
    img = Image.new('RGB', (400, 500), color='white')
    draw = ImageDraw.Draw(img)
    
    try:
        # Try to use a decent font
        font_large = ImageFont.truetype('/System/Library/Fonts/Arial.ttf', 16)
        font_medium = ImageFont.truetype('/System/Library/Fonts/Arial.ttf', 14)
        font_small = ImageFont.truetype('/System/Library/Fonts/Arial.ttf', 12)
    except:
        # Fallback to default font
        font_large = ImageFont.load_default()
        font_medium = ImageFont.load_default()
        font_small = ImageFont.load_default()
    
    # Draw nutrition facts
    y = 20
    draw.text((20, y), "Nutrition Facts", fill='black', font=font_large)
    y += 30
    draw.text((20, y), "Per 100g", fill='black', font=font_medium)
    y += 40
    
    nutrition_data = [
        "Energy: 250 kcal",
        "Protein: 12.5g",
        "Total Fat: 8.2g",
        "Total Carbohydrates: 35.0g",
        "  of which sugars: 5.8g",
        "Salt: 1.2g",
        "Dietary Fiber: 3.5g"
    ]
    
    for item in nutrition_data:
        draw.text((30, y), item, fill='black', font=font_small)
        y += 25
    
    img.save(output_path)


def create_spanish_nutrition_label(output_path):
    """Create a Spanish nutrition label"""
    img = Image.new('RGB', (400, 500), color='white')
    draw = ImageDraw.Draw(img)
    
    try:
        font_large = ImageFont.truetype('/System/Library/Fonts/Arial.ttf', 16)
        font_medium = ImageFont.truetype('/System/Library/Fonts/Arial.ttf', 14)
        font_small = ImageFont.truetype('/System/Library/Fonts/Arial.ttf', 12)
    except:
        font_large = ImageFont.load_default()
        font_medium = ImageFont.load_default()
        font_small = ImageFont.load_default()
    
    y = 20
    draw.text((20, y), "Información Nutricional", fill='black', font=font_large)
    y += 30
    draw.text((20, y), "Por 100g", fill='black', font=font_medium)
    y += 40
    
    nutrition_data = [
        "Energía: 300 kcal",
        "Proteínas: 15.0g",
        "Grasas: 10.5g",
        "Hidratos de carbono: 40.0g",
        "  de los cuales azúcares: 8.2g",
        "Sal: 0.8g",
        "Fibra: 4.0g"
    ]
    
    for item in nutrition_data:
        draw.text((30, y), item, fill='black', font=font_small)
        y += 25
    
    img.save(output_path)


def create_european_nutrition_label(output_path):
    """Create a European-style nutrition label with kJ and commas"""
    img = Image.new('RGB', (400, 500), color='white')
    draw = ImageDraw.Draw(img)
    
    try:
        font_large = ImageFont.truetype('/System/Library/Fonts/Arial.ttf', 16)
        font_medium = ImageFont.truetype('/System/Library/Fonts/Arial.ttf', 14)
        font_small = ImageFont.truetype('/System/Library/Fonts/Arial.ttf', 12)
    except:
        font_large = ImageFont.load_default()
        font_medium = ImageFont.load_default()
        font_small = ImageFont.load_default()
    
    y = 20
    draw.text((20, y), "Nährwerte pro 100g", fill='black', font=font_large)
    y += 40
    
    nutrition_data = [
        "Brennwert: 1050 kJ / 250 kcal",
        "Eiweiß: 12,5g",
        "Kohlenhydrate: 35,0g",
        "  davon Zucker: 5,8g",
        "Fett: 8,2g",
        "Salz: 1,2g"
    ]
    
    for item in nutrition_data:
        draw.text((30, y), item, fill='black', font=font_small)
        y += 25
    
    img.save(output_path)


def create_blurry_nutrition_label(output_path):
    """Create a blurry nutrition label for low-quality testing"""
    # First create a standard label
    create_standard_nutrition_label(output_path)
    
    # Then make it blurry using OpenCV
    img = cv2.imread(output_path)
    blurry = cv2.GaussianBlur(img, (15, 15), 3)
    cv2.imwrite(output_path, blurry)


def create_high_contrast_nutrition_label(output_path):
    """Create a high contrast nutrition label"""
    img = Image.new('RGB', (400, 500), color='black')  # Black background
    draw = ImageDraw.Draw(img)
    
    try:
        font_large = ImageFont.truetype('/System/Library/Fonts/Arial.ttf', 16)
        font_medium = ImageFont.truetype('/System/Library/Fonts/Arial.ttf', 14)
        font_small = ImageFont.truetype('/System/Library/Fonts/Arial.ttf', 12)
    except:
        font_large = ImageFont.load_default()
        font_medium = ImageFont.load_default()
        font_small = ImageFont.load_default()
    
    y = 20
    draw.text((20, y), "Nutrition Facts", fill='white', font=font_large)  # White text
    y += 30
    draw.text((20, y), "Per 100g", fill='white', font=font_medium)
    y += 40
    
    nutrition_data = [
        "Energy: 250 kcal",
        "Protein: 12.5g",
        "Total Fat: 8.2g",
        "Total Carbohydrates: 35.0g",
        "Salt: 1.2g"
    ]
    
    for item in nutrition_data:
        draw.text((30, y), item, fill='white', font=font_small)
        y += 25
    
    img.save(output_path)


def create_small_nutrition_label(output_path):
    """Create a small nutrition label that needs upscaling"""
    img = Image.new('RGB', (200, 250), color='white')  # Small size
    draw = ImageDraw.Draw(img)
    
    try:
        font_small = ImageFont.truetype('/System/Library/Fonts/Arial.ttf', 8)
    except:
        font_small = ImageFont.load_default()
    
    y = 10
    draw.text((10, y), "Nutrition Facts", fill='black', font=font_small)
    y += 15
    draw.text((10, y), "Per 100g", fill='black', font=font_small)
    y += 20
    
    nutrition_data = [
        "Energy: 250 kcal",
        "Protein: 12.5g",
        "Fat: 8.2g",
        "Carbs: 35.0g",
        "Salt: 1.2g"
    ]
    
    for item in nutrition_data:
        draw.text((15, y), item, fill='black', font=font_small)
        y += 15
    
    img.save(output_path)


def create_rotated_nutrition_label(output_path):
    """Create a rotated nutrition label"""
    # First create a standard label
    temp_path = output_path.replace('.png', '_temp.png')
    create_standard_nutrition_label(temp_path)
    
    # Rotate it using OpenCV
    img = cv2.imread(temp_path)
    height, width = img.shape[:2]
    center = (width // 2, height // 2)
    
    # Rotate by 15 degrees
    rotation_matrix = cv2.getRotationMatrix2D(center, 15, 1.0)
    rotated = cv2.warpAffine(img, rotation_matrix, (width, height), 
                           borderMode=cv2.BORDER_CONSTANT, borderValue=(255, 255, 255))
    
    cv2.imwrite(output_path, rotated)
    
    # Clean up temp file
    os.remove(temp_path)


def create_noisy_nutrition_label(output_path):
    """Create a nutrition label with noise"""
    # First create a standard label
    create_standard_nutrition_label(output_path)
    
    # Add noise using OpenCV
    img = cv2.imread(output_path)
    noise = np.random.randint(0, 50, img.shape, dtype=np.uint8)
    noisy = cv2.add(img, noise)
    cv2.imwrite(output_path, noisy)


if __name__ == "__main__":
    create_test_images()