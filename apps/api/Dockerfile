# syntax=docker/dockerfile:1.7
FROM node:22-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/* \
 && corepack enable
WORKDIR /repo

FROM base AS build
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/
# pacotes já baixados ficam no servidor entre uma atualização e outra
RUN --mount=type=cache,id=intranet-pnpm,target=/pnpm-store pnpm install --frozen-lockfile --filter api... --store-dir /pnpm-store
COPY apps/api apps/api
RUN pnpm --filter api build \
 && pnpm --filter api deploy --prod --legacy /out \
 && cp -r apps/api/dist apps/api/prisma apps/api/assets /out/ \
 && cd /out && ./node_modules/.bin/prisma generate

FROM node:22-bookworm-slim AS runtime
# poppler-utils e qpdf: conferência e redução sem perdas dos PDFs anexados (Armazenamento e otimização)
RUN apt-get update && apt-get install -y --no-install-recommends openssl poppler-utils qpdf && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production PORT=4000 UPLOAD_DIR=/data/uploads
COPY --from=build --chown=node:node /out ./
RUN mkdir -p /data/uploads /data/manutencao && chown -R node:node /data
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD node -e "fetch('http://127.0.0.1:4000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node dist/main.js"]
