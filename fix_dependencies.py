#!/usr/bin/env python3
"""
Script to fix dependency issues for the podcast generator.
This script addresses:
1. Missing FastAPI for litellm
2. Kokoro TTS installation verification
3. Environment setup for local TTS
"""

import subprocess
import sys
import importlib
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def run_command(cmd):
    """Run a shell command and return success status."""
    try:
        result = subprocess.run(cmd, shell=True, check=True, capture_output=True, text=True)
        logger.info(f"✓ Command succeeded: {cmd}")
        return True
    except subprocess.CalledProcessError as e:
        logger.error(f"✗ Command failed: {cmd}")
        logger.error(f"Error: {e.stderr}")
        return False

def check_import(module_name, package_name=None):
    """Check if a module can be imported."""
    try:
        importlib.import_module(module_name)
        logger.info(f"✓ {module_name} is available")
        return True
    except ImportError:
        logger.warning(f"✗ {module_name} not available")
        return False

def main():
    logger.info("Starting dependency fix for podcast generator...")

    # Check current state
    logger.info("Checking current imports...")
    fastapi_available = check_import("fastapi")
    kokoro_available = check_import("kokoro", "kokoro")
    soundfile_available = check_import("soundfile", "soundfile")

    # Fix FastAPI dependency for litellm
    if not fastapi_available:
        logger.info("Installing FastAPI for litellm...")
        if run_command("pip install fastapi"):
            fastapi_available = check_import("fastapi")

    # Fix Kokoro TTS
    if not kokoro_available:
        logger.info("Installing/updating Kokoro TTS...")
        # Try installing with specific version
        if run_command("pip install 'kokoro>=0.9.4'"):
            kokoro_available = check_import("kokoro")

    # Fix soundfile dependency
    if not soundfile_available:
        logger.info("Installing soundfile...")
        if run_command("pip install soundfile"):
            soundfile_available = check_import("soundfile")

    # Install additional litellm dependencies
    logger.info("Installing litellm proxy dependencies...")
    run_command("pip install 'litellm[proxy]'")

    # Final status check
    logger.info("\n=== Final Status ===")
    logger.info(f"FastAPI: {'✓' if fastapi_available else '✗'}")
    logger.info(f"Kokoro TTS: {'✓' if kokoro_available else '✗'}")
    logger.info(f"Soundfile: {'✓' if soundfile_available else '✗'}")

    if all([fastapi_available, kokoro_available, soundfile_available]):
        logger.info("\n🎉 All dependencies are now available!")
        logger.info("The podcast generator should now work with local Kokoro TTS.")
        return True
    else:
        logger.error("\n❌ Some dependencies are still missing.")
        logger.error("You may need to manually install them or check for compatibility issues.")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)