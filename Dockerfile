FROM oven/bun:1.4-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

FROM base AS builder
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM base AS production
LABEL org.opencontainers.image.title="fleet" \
      org.opencontainers.image.description="A live map of a Coolify server and the projects running on it" \
      org.opencontainers.image.source="https://github.com/3nd3r1/fleet" \
      org.opencontainers.image.licenses="MIT"
ENV NODE_ENV=production
USER bun
COPY --from=deps --chown=bun:bun /app/node_modules ./node_modules
COPY --from=builder --chown=bun:bun /app/dist ./dist
COPY --chown=bun:bun server ./server
COPY --chown=bun:bun src/validators ./src/validators
COPY --chown=bun:bun package.json tsconfig.json ./
# No config is baked in. Mount one at /app/fleet.config.json, point
# FLEET_CONFIG at a file, or put the JSON in FLEET_CONFIG_JSON.
EXPOSE 3000
CMD ["bun", "server/index.ts"]
