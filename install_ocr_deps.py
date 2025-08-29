#!/usr/bin/env python3
"""
Installation script for OCR dependencies that may require system-level setup.

This script provides instructions for installing Tesseract OCR on different platforms.
Run this before using the OCR functionality.
"""

import subprocess
import sys
import platform

def check_tesseract():
    """Check if Tesseract is installed"""
    try:
        result = subprocess.run(['tesseract', '--version'], 
                              capture_output=True, text=True, check=True)
        print(f"✅ Tesseract is installed: {result.stdout.split()[1]}")
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("❌ Tesseract is not installed")
        return False

def install_instructions():
    """Provide installation instructions based on platform"""
    system = platform.system().lower()
    
    print(f"\n📋 Installation instructions for {platform.system()}:")
    
    if system == "darwin":  # macOS
        print("Install using Homebrew:")
        print("  brew install tesseract")
        print("\nFor additional language support:")
        print("  brew install tesseract-lang")
        
    elif system == "linux":
        print("Install using apt (Ubuntu/Debian):")
        print("  sudo apt update")
        print("  sudo apt install tesseract-ocr")
        print("  sudo apt install tesseract-ocr-eng")
        print("\nFor other Linux distributions, use your package manager:")
        print("  # CentOS/RHEL: sudo yum install tesseract")
        print("  # Arch: sudo pacman -S tesseract")
        
    elif system == "windows":
        print("Option 1 - Download installer:")
        print("  https://github.com/UB-Mannheim/tesseract/wiki")
        print("\nOption 2 - Using Chocolatey:")
        print("  choco install tesseract")
        print("\nOption 3 - Using conda:")
        print("  conda install -c conda-forge tesseract")
        
    else:
        print("Please install Tesseract OCR for your platform.")
        print("Visit: https://tesseract-ocr.github.io/tessdoc/Installation.html")

def check_opencv():
    """Check if OpenCV is working"""
    try:
        import cv2
        print(f"✅ OpenCV is available: {cv2.__version__}")
        return True
    except ImportError:
        print("❌ OpenCV is not available")
        return False

def main():
    print("🔍 DietIntel OCR Dependencies Check")
    print("=" * 40)
    
    tesseract_ok = check_tesseract()
    opencv_ok = check_opencv()
    
    if not tesseract_ok:
        install_instructions()
        
    if not opencv_ok:
        print("\n📦 OpenCV should be installed via pip:")
        print("  pip install opencv-python")
    
    if tesseract_ok and opencv_ok:
        print("\n🎉 All OCR dependencies are ready!")
        print("\nYou can now use the /product/scan-label endpoint.")
    else:
        print("\n⚠️  Please install missing dependencies before using OCR features.")

if __name__ == "__main__":
    main()