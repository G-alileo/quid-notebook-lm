# Podcast Generator Fix: Kokoro TTS Setup

## Issues Identified

1. **Missing FastAPI Dependency**: LiteLLM is trying to import FastAPI for proxy features, causing logging errors
2. **Kokoro TTS Import Issues**: The local Kokoro model isn't being loaded successfully
3. **Dependency Chain Problems**: Missing soundfile or kokoro packages

## Root Causes

- LiteLLM's logging system tries to import FastAPI even when proxy features aren't needed
- Kokoro TTS package may not be properly installed or has missing dependencies
- The error handling wasn't providing clear feedback about what's missing

## Solutions Applied

### 1. Fixed LiteLLM FastAPI Errors

Updated `app.py` to:
- Disable LiteLLM proxy features entirely with `LITELLM_DISABLE_PROXY=True`
- Suppress litellm logging at the module level
- Added better environment variable configuration

```python
# Disable litellm proxy features that require FastAPI
os.environ.setdefault('LITELLM_DISABLE_PROXY', 'True')
# Suppress litellm logging errors
import logging
logging.getLogger('litellm').setLevel(logging.CRITICAL)
```

### 2. Improved TTS Error Handling

Enhanced the TTS import logic to provide detailed error messages:
- Identifies whether kokoro or soundfile is missing
- Provides specific installation instructions
- Gives clear feedback about functionality limitations

### 3. Dependency Installation Script

Created `fix_dependencies.py` that:
- Checks current dependency status
- Installs missing packages (fastapi, kokoro, soundfile)
- Provides detailed status feedback
- Verifies successful installation

## How to Fix

### Option 1: Run the Automated Fix
```bash
cd quid-notebook-lm
python fix_dependencies.py
```

### Option 2: Manual Installation
```bash
# Fix FastAPI for litellm
pip install fastapi

# Install Kokoro TTS and dependencies
pip install 'kokoro>=0.9.4' soundfile

# Install full litellm with proxy support
pip install 'litellm[proxy]'
```

### Option 3: Using UV (Recommended for this project)
```bash
# Add missing dependencies
uv add fastapi 'kokoro>=0.9.4' soundfile

# Or update existing packages
uv sync
```

## Verification

After running the fixes, you should see:
- No more FastAPI import errors in logs
- "✓ Kokoro TTS is available for podcast generation" message
- Audio generation option in the Studio interface
- No more "TTS not available" warnings

## Expected Behavior

Once fixed:
1. **Script Generation**: Works regardless of TTS status
2. **Audio Generation**: Available with local Kokoro TTS
3. **Clean Logs**: No more litellm dependency errors
4. **Studio Interface**: Shows audio generation options

## Testing

Test the fix by:
1. Starting the app: `streamlit run app.py`
2. Going to Studio tab
3. Selecting a document source
4. Generating a podcast
5. Checking that audio generation is offered

## Kokoro Voice Options

The TTS uses these default voices:
- **Speaker 1**: `af_heart` (Female voice)
- **Speaker 2**: `am_liam` (Male voice)

These can be customized in `src/podcast/text_to_speech.py` line 38-41.

## Future Improvements

Consider:
- Adding voice selection in the Studio UI
- Supporting more Kokoro languages (current: lang_code='a')
- Implementing voice cloning for custom speakers
- Adding speed/pitch controls