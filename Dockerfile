# ============================================================
# GeekSpace 2.0 — Multi-stage production build
# Stage 1: Build frontend (Vite) + compile server (TypeScript)
# Stage 2: Slim production image
# ============================================================

# ---- Stage 1: Build ----
FROM node:20-alpine AS builder

WORKDIR /app

# Install frontend deps
COPY package.json package-lock.json ./
RUN npm ci

# Install server deps
COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci

# Copy source
COPY . .

# Build frontend (vite build)
RUN npm run build

# Build server (tsc)
RUN cd server && npm run build

# ---- Stage 2: Production ----
FROM node:20-alpine AS production

RUN apk add --no-cache curl

WORKDIR /app

# Copy server production deps
COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci --omit=dev

# Copy compiled server
COPY --from=builder /app/server/dist ./server/dist

# Copy built frontend
COPY --from=builder /app/dist ./dist

# Copy admin dashboard
COPY --from=builder /app/admin-dashboard ./admin-dashboard

# Copy APM Insight config
COPY apminsightnode.json ./

# Create data directory for SQLite and APM logs directory
RUN mkdir -p /app/data /app/apminsightdata && chown -R node:node /app/data /app/apminsightdata

# Run as non-root
USER node

ENV NODE_ENV=production
ENV PORT=3001
ENV DB_PATH=/app/data/geekspace.db

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3001/api/health || exit 1

CMD ["node", "server/dist/index.js"]
