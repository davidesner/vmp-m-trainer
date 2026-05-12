# ---- Build stage ----
FROM node:22-alpine AS build

RUN corepack enable
WORKDIR /app

# Install deps with frozen lockfile
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Build the SPA
COPY . .
RUN pnpm build

# ---- Runtime stage ----
FROM node:22-alpine AS runtime

RUN corepack enable
WORKDIR /app

# Production deps + tsx so we can run server/node.ts as-is (no separate server build step)
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod && pnpm add tsx

# Copy build output + server source + migrations
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/public ./public

ENV NODE_ENV=production
ENV DATABASE_URL=file:/data/app.db
ENV PORT=3000
ENV SESSION_COOKIE_SECURE=true

VOLUME ["/data"]
EXPOSE 3000

CMD ["pnpm", "start"]
