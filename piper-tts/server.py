"""
Piper TTS HTTP Server — Fast CPU-friendly text-to-speech (ONNX).

Endpoints:
  GET  /health → {"status": "ok", "voices": [...]}
  POST /tts    → audio/wav (accepts JSON: {text, voice?, speed?})
"""

import io
import logging
import os
import threading
import time
import wave
from flask import Flask, request, jsonify, send_file

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)

VOICE_DIR = '/app/voices'

# Lazy-load voices on first request
_voices = {}
_default_voice = None
_voice_lock = threading.Lock()

VOICE_MAP = {
    'en_US-amy-medium': os.path.join(VOICE_DIR, 'en_US-amy-medium.onnx'),
    'en_US-ryan-medium': os.path.join(VOICE_DIR, 'en_US-ryan-medium.onnx'),
}


def get_voice(name=None):
    global _default_voice
    from piper import PiperVoice

    voice_name = name or 'en_US-amy-medium'
    if voice_name in _voices:
        return _voices[voice_name]

    with _voice_lock:
        if voice_name in _voices:
            return _voices[voice_name]

        model_path = VOICE_MAP.get(voice_name)
        if not model_path or not os.path.exists(model_path):
            # Fallback to first available voice
            for vn, vp in VOICE_MAP.items():
                if os.path.exists(vp):
                    voice_name = vn
                    model_path = vp
                    break
            else:
                raise FileNotFoundError(f'No voice models found in {VOICE_DIR}')

        # After fallback resolution, re-check cache
        if voice_name in _voices:
            return _voices[voice_name]

        logger.info(f'Loading Piper voice: {voice_name}')
        start = time.time()
        voice = PiperVoice.load(model_path)
        _voices[voice_name] = voice
        logger.info(f'Piper voice loaded in {time.time() - start:.1f}s')

        if _default_voice is None:
            _default_voice = voice_name

        return voice


def available_voices():
    return [name for name, path in VOICE_MAP.items() if os.path.exists(path)]


@app.route('/health', methods=['GET'])
def health():
    voices = available_voices()
    return jsonify({'status': 'ok' if voices else 'no_voices', 'voices': voices})


@app.route('/tts', methods=['POST'])
def tts():
    data = request.get_json(silent=True)
    if not data or not data.get('text'):
        return jsonify({'error': 'text is required'}), 400

    text = data['text'].strip()[:4000]
    voice_name = data.get('voice', None)
    try:
        speed = float(data.get('speed', 1.0))
    except (TypeError, ValueError):
        return jsonify({'error': 'speed must be a positive number'}), 400
    if speed <= 0:
        return jsonify({'error': 'speed must be a positive number'}), 400

    if not text:
        return jsonify({'error': 'text is empty after trimming'}), 400

    try:
        start = time.time()
        voice = get_voice(voice_name)

        # Synthesize to WAV in memory
        buf = io.BytesIO()
        with wave.open(buf, 'wb') as wav_file:
            voice.synthesize(text, wav_file, length_scale=1.0 / speed)
        buf.seek(0)

        elapsed = time.time() - start
        logger.info(f'TTS: {len(text)} chars, voice={voice_name or "default"}, speed={speed}, {elapsed:.2f}s')

        return send_file(buf, mimetype='audio/wav', download_name='speech.wav')

    except Exception as e:
        logger.error(f'TTS error: {e}')
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    logger.info('Starting Piper TTS server on port 5100')
    # nosemgrep: python.flask.security.audit.app-run-param-config.avoid_app_run_with_bad_host — sidecar runs inside a Docker container on the internal geekspace-net network; 0.0.0.0 is required to bind inside the container and is never exposed publicly
    app.run(host='0.0.0.0', port=5100)
