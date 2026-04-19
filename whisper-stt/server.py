"""
whisper.cpp STT HTTP Server — Local speech-to-text (CPU optimized).

Endpoints:
  GET  /health      → {"status": "ok", "model": "base.en"}
  POST /transcribe  → {"text": "...", "language": "en", "duration": 5.2}
                      Accepts multipart form with 'file' field (audio: ogg, webm, mp3, wav, m4a)
"""

import logging
import os
import subprocess
import tempfile
import time
import json
from flask import Flask, request, jsonify

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)

MODEL_PATH = '/app/models/ggml-base.en.bin'
WHISPER_BIN = '/usr/local/bin/whisper-cli'
MAX_AUDIO_BYTES = 25 * 1024 * 1024  # 25MB


@app.route('/health', methods=['GET'])
def health():
    model_ok = os.path.exists(MODEL_PATH)
    bin_ok = os.path.exists(WHISPER_BIN)
    return jsonify({
        'status': 'ok' if (model_ok and bin_ok) else 'error',
        'model': 'base.en',
        'model_exists': model_ok,
        'binary_exists': bin_ok,
    })


@app.route('/transcribe', methods=['POST'])
def transcribe():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided. Send multipart form with "file" field.'}), 400

    audio_file = request.files['file']
    audio_data = audio_file.read()

    if len(audio_data) == 0:
        return jsonify({'error': 'Empty audio file'}), 400
    if len(audio_data) > MAX_AUDIO_BYTES:
        return jsonify({'error': f'Audio too large (max {MAX_AUDIO_BYTES // 1024 // 1024}MB)'}), 413

    mime = audio_file.content_type or ''
    ext = 'ogg'
    if 'wav' in mime:
        ext = 'wav'
    elif 'mp3' in mime or 'mpeg' in mime:
        ext = 'mp3'
    elif 'webm' in mime:
        ext = 'webm'
    elif 'mp4' in mime or 'm4a' in mime:
        ext = 'm4a'

    try:
        start = time.time()

        with tempfile.NamedTemporaryFile(suffix=f'.{ext}', delete=False) as tmp_in:
            tmp_in.write(audio_data)
            input_path = tmp_in.name

        # Convert to 16kHz mono WAV (whisper.cpp requirement)
        wav_path = input_path + '.wav'
        subprocess.run(
            ['ffmpeg', '-i', input_path, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le',
             wav_path, '-y', '-loglevel', 'quiet'],
            check=True, timeout=30,
        )

        # Run whisper.cpp
        result = subprocess.run(
            [WHISPER_BIN, '-m', MODEL_PATH, '-f', wav_path, '--output-json', '-oj'],
            capture_output=True, text=True, timeout=120,
        )

        # Clean up temp files
        for f in [input_path, wav_path]:
            try:
                os.unlink(f)
            except OSError:
                pass

        if result.returncode != 0:
            logger.error(f'whisper.cpp failed: {result.stderr[:500]}')
            return jsonify({'error': 'Transcription failed', 'detail': result.stderr[:200]}), 500

        # Parse whisper.cpp JSON output
        try:
            whisper_out = json.loads(result.stdout)
            text = whisper_out.get('transcription', [{}])[0].get('text', '').strip()
            if not text:
                # Try alternate format
                segments = whisper_out.get('transcription', [])
                text = ' '.join(seg.get('text', '') for seg in segments).strip()
        except (json.JSONDecodeError, IndexError, KeyError):
            # Fallback: whisper.cpp sometimes outputs plain text
            text = result.stdout.strip()

        elapsed = time.time() - start
        logger.info(f'STT: {len(audio_data)} bytes, {elapsed:.2f}s, {len(text)} chars')

        return jsonify({
            'text': text,
            'language': 'en',
            'duration': round(elapsed, 2),
        })

    except subprocess.TimeoutExpired:
        return jsonify({'error': 'Transcription timed out'}), 504
    except Exception as e:
        logger.error(f'STT error: {e}')
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    logger.info('Starting whisper.cpp STT server on port 5102')
    # nosemgrep: python.flask.security.audit.app-run-param-config.avoid_app_run_with_bad_host — sidecar runs inside a Docker container on the internal geekspace-net network; 0.0.0.0 is required to bind inside the container and is never exposed publicly
    app.run(host='0.0.0.0', port=5102)
