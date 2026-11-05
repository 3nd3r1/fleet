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
ENV NODE_ENV=production
USER bun
COPY --from=deps --chown=bun:bun /app/node_modules ./node_modules
COPY --from=builder --chown=bun:bun /app/dist ./dist
COPY --chown=bun:bun server ./server
COPY --chown=bun:bun package.json tsconfig.json ./
EXPOSE 3000
CMD ["bun", "server/index.ts"]
