# syntax=docker/dockerfile:1.7
FROM node:22-bookworm-slim AS build
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json apps/web/
# pacotes já baixados ficam no servidor entre uma atualização e outra
RUN --mount=type=cache,id=intranet-pnpm,target=/pnpm-store pnpm install --frozen-lockfile --filter web... --store-dir /pnpm-store
COPY apps/web apps/web
ENV NEXT_TELEMETRY_DISABLED=1 API_INTERNAL_URL=http://api:4000
RUN pnpm --filter web build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /repo/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
