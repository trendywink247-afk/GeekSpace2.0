#!/bin/bash
set -euo pipefail

MODEL_DIR="/app/models"
mkdir -p "$MODEL_DIR"

echo "Downloading Whisper base.en model (142MB)..."
curl -fL --retry 3 --retry-all-errors --connect-timeout 15 --max-time 600 \
  -o "$MODEL_DIR/ggml-base.en.bin" \
  "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin"

# Validate download
test -s "$MODEL_DIR/ggml-base.en.bin"

echo "Model downloaded:"
ls -la "$MODEL_DIR/"
