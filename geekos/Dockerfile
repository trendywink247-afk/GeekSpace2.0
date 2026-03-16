FROM node:22-bookworm-slim

# Install build deps + bun
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ curl git ca-certificates unzip \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://bun.sh/install | bash \
    && cp /root/.bun/bin/bun /usr/local/bin/bun \
    && cp /root/.bun/bin/bunx /usr/local/bin/bunx

WORKDIR /app

# Install ElizaOS:
# 1. Skip all postinstall scripts (some require bun npm package which creates circular dep)
# 2. Manually run the bun npm package postinstall to bootstrap bun
# 3. Re-run remaining postinstalls
RUN npm init -y \
    && npm install elizaos@1.7.2 --ignore-scripts \
    && cd node_modules/bun && node install.js; cd /app \
    && npm rebuild 2>/dev/null; true

# Copy character files
COPY characters/ /app/characters/

# ElizaOS env — routes LLM calls back to Agentin waterfall proxy
ENV OPENAI_API_KEY=agentin-internal-proxy
ENV OPENAI_BASE_URL=http://geekspace:3001/api/geekos-llm/v1
ENV SMALL_MODEL=agentin-default
ENV MEDIUM_MODEL=agentin-default
ENV LARGE_MODEL=agentin-default

COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

EXPOSE 3000

CMD ["/app/start.sh"]
