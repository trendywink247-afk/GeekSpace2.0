#!/bin/bash
set -euo pipefail

VOICE_DIR="/app/voices"
mkdir -p "$VOICE_DIR"

BASE_URL="https://github.com/rhasspy/piper/releases/download/2023.11.14-2"

echo "Downloading Piper voice models..."

# English female (Amy — medium quality, natural sounding)
curl -fL --retry 3 --retry-all-errors --connect-timeout 15 --max-time 600 \
  -o "$VOICE_DIR/en_US-amy-medium.onnx" \
  "$BASE_URL/voice-en_US-amy-medium.onnx"
curl -L -o "$VOICE_DIR/en_US-amy-medium.onnx.json" \
  "$BASE_URL/voice-en_US-amy-medium.onnx.json" || true

# English male (Ryan — medium quality)
curl -fL --retry 3 --retry-all-errors --connect-timeout 15 --max-time 600 \
  -o "$VOICE_DIR/en_US-ryan-medium.onnx" \
  "$BASE_URL/voice-en_US-ryan-medium.onnx"
curl -L -o "$VOICE_DIR/en_US-ryan-medium.onnx.json" \
  "$BASE_URL/voice-en_US-ryan-medium.onnx.json" || true

echo "Voice models downloaded to $VOICE_DIR"
ls -la "$VOICE_DIR/"

test -s "$VOICE_DIR/en_US-amy-medium.onnx"
test -s "$VOICE_DIR/en_US-ryan-medium.onnx"
