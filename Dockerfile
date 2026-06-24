# syntax=docker/dockerfile:1

FROM node:24-alpine AS build

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY scripts ./scripts
COPY src ./src
COPY test ./test

RUN pnpm install --frozen-lockfile
RUN pnpm run build
RUN pnpm run build:docker

FROM node:24-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/dist/docker ./dist/docker

USER node

ENTRYPOINT ["node", "/app/dist/docker/towngas-mcp.js"]
