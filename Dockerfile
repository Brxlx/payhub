# syntax=docker/dockerfile:1.7

################################
# Base: node + pnpm via corepack
################################
FROM node:24-bookworm-slim AS base
# versão do pnpm vem do campo "packageManager" do package.json
RUN corepack enable
WORKDIR /app

################################
# Stage 1: deps completas (para build)
################################
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && \
    pnpm install --frozen-lockfile

################################
# Stage 2: build
################################
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml nest-cli.json tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN pnpm build

################################
# Stage 3: deps somente de produção
################################
FROM base AS prod-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && \
    pnpm install --prod --frozen-lockfile --ignore-scripts

################################
# Stage 4: runtime final (enxuto)
################################
FROM node:24-bookworm-slim AS runner
ENV NODE_ENV=production
WORKDIR /app

COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./

USER node
EXPOSE 3333

ENTRYPOINT ["node", "dist/src/infra/main.js"]
