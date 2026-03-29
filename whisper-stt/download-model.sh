#!/bin/bash
set -e

MODEL_DIR="/app/models"
mkdir -p "$MODEL_DIR"

echo "Downloading Whisper base.en model (142MB)..."
curl -L -o "$MODEL_DIR/ggml-base.en.bin" \
  "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin"

echo "Model downloaded:"
ls -la "$MODEL_DIR/"
