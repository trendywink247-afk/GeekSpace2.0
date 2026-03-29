FROM python:3.11-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential cmake git && \
    rm -rf /var/lib/apt/lists/*

# Build whisper.cpp from source
WORKDIR /build
RUN git clone --depth 1 https://github.com/ggerganov/whisper.cpp.git && \
    cd whisper.cpp && \
    cmake -B build -DCMAKE_BUILD_TYPE=Release && \
    cmake --build build --config Release -j$(nproc) && \
    cp build/bin/whisper-cli /usr/local/bin/whisper-cli

# Download model
COPY download-model.sh /build/
RUN chmod +x /build/download-model.sh && /build/download-model.sh

# --- Production stage ---
FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ffmpeg libgomp1 && \
    rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir flask

WORKDIR /app

COPY --from=builder /usr/local/bin/whisper-cli /usr/local/bin/whisper-cli
COPY --from=builder /app/models /app/models
COPY server.py .

EXPOSE 5102

USER nobody
CMD ["python", "server.py"]
