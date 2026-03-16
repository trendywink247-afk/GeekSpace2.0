FROM node:22-slim

WORKDIR /app

# Install ElizaOS CLI globally
RUN npm install -g @elizaos/cli@latest 2>/dev/null || npm install -g elizaos@latest

# Copy character files
COPY characters/ /app/characters/

# ElizaOS env — routes LLM calls back to Agentin waterfall proxy
ENV OPENAI_API_KEY=agentin-internal-proxy
ENV OPENAI_BASE_URL=http://geekspace:3001/api/geekos-llm/v1
ENV SMALL_MODEL=agentin-default
ENV MEDIUM_MODEL=agentin-default
ENV LARGE_MODEL=agentin-default

EXPOSE 3000

CMD ["elizaos", "start", "--characters", "/app/characters/"]
