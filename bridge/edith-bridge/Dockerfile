# EDITH Bridge — lightweight WebSocket↔HTTP bridge for OpenClaw
FROM node:20-alpine

RUN apk add --no-cache curl

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY index.js ./

USER node

ENV BRIDGE_PORT=8787
EXPOSE 8787

HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8787/health || exit 1

CMD ["node", "index.js"]
