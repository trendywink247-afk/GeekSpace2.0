#!/bin/bash
set -e

MODEL_DIR="/app/models"
mkdir -p "$MODEL_DIR"

echo "Downloading Kokoro v1.0 ONNX model..."
# kokoro pip package auto-downloads models on first use, but we pre-warm here
python3 -c "
from kokoro import KPipeline
# Initialize pipeline to trigger model download
pipeline = KPipeline(lang_code='a')
print('Kokoro model downloaded successfully')
" || echo "Warning: Model pre-download failed, will download on first request"
