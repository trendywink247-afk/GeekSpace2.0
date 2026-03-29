FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN pip install --no-cache-dir piper-tts flask

COPY download-voices.sh .
RUN chmod +x download-voices.sh && ./download-voices.sh

COPY server.py .

EXPOSE 5100

USER nobody
CMD ["python", "server.py"]
