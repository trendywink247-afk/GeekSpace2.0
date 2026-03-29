"""
Kokoro TTS HTTP Server — High-quality neural text-to-speech (ONNX, CPU).

Endpoints:
  GET  /health → {"status": "ok", "model": "kokoro-v1.0"}
  POST /tts    → audio/wav (accepts JSON: {text, voice?, speed?})
"""

import io
import logging
import time
from flask import Flask, request, jsonify, send_file

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Lazy-load pipeline on first request to avoid startup timeout
_pipelines: dict = {}
_voices = {
    'af_heart': 'a',    # American female (default)
    'af_bella': 'a',    # American female
    'am_michael': 'a',  # American male
    'bf_emma': 'b',     # British female
    'bm_george': 'b',   # British male
}
DEFAULT_VOICE = 'af_heart'


def get_pipeline(lang_code='a'):
    global _pipelines
    if lang_code not in _pipelines:
        logger.info(f'Loading Kokoro pipeline for lang_code={lang_code}...')
        start = time.time()
        from kokoro import KPipeline
        _pipelines[lang_code] = KPipeline(lang_code=lang_code)
        logger.info(f'Kokoro pipeline loaded in {time.time() - start:.1f}s')
    return _pipelines[lang_code]


@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'model': 'kokoro-v1.0', 'voices': list(_voices.keys())})


@app.route('/tts', methods=['POST'])
def tts():
    data = request.get_json(silent=True)
    if not data or not data.get('text'):
        return jsonify({'error': 'text is required'}), 400

    text = data['text'].strip()[:4000]
    voice = data.get('voice', DEFAULT_VOICE)
    speed = float(data.get('speed', 1.0))

    if not text:
        return jsonify({'error': 'text is empty after trimming'}), 400

    # Determine language code from voice prefix
    lang_code = _voices.get(voice, 'a')

    try:
        start = time.time()
        pipeline = get_pipeline(lang_code)

        # Generate audio samples
        samples = []
        for _, _, audio in pipeline(text, voice=voice, speed=speed):
            samples.append(audio)

        if not samples:
            return jsonify({'error': 'No audio generated'}), 500

        import numpy as np
        import soundfile as sf

        # Concatenate all segments
        audio_data = np.concatenate(samples)

        # Write WAV to buffer
        buf = io.BytesIO()
        sf.write(buf, audio_data, 24000, format='WAV')
        buf.seek(0)

        elapsed = time.time() - start
        logger.info(f'TTS: {len(text)} chars, voice={voice}, speed={speed}, {elapsed:.2f}s')

        return send_file(buf, mimetype='audio/wav', download_name='speech.wav')

    except Exception as e:
        logger.error(f'TTS error: {e}')
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    logger.info('Starting Kokoro TTS server on port 5101')
    app.run(host='0.0.0.0', port=5101)
