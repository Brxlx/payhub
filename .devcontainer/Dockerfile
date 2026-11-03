FROM node:24-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    git \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# pnpm vem via corepack, usando a versão fixada em package.json/pnpm-lock.yaml
RUN corepack enable

USER node

WORKDIR /workspace
