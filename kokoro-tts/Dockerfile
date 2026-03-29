FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl libsndfile1 && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install kokoro with ONNX runtime (CPU only — no PyTorch needed)
RUN pip install --no-cache-dir \
    kokoro>=0.9 \
    onnxruntime \
    soundfile \
    numpy \
    flask

COPY download-model.sh .
RUN chmod +x download-model.sh && ./download-model.sh

COPY server.py .

EXPOSE 5101

USER nobody
CMD ["python", "server.py"]
