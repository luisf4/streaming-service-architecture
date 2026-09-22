# syntax=docker/dockerfile:1
# Generic image for any backend/apps/* service. Build with:
#   docker build -f infra/docker/Dockerfile --build-arg APP=transcoder -t streaming/transcoder .
# APP is the directory name under backend/apps/ (e.g. "transcoder"), which by
# convention is also its package name minus the @video-streaming/ scope.
#
# Uses `turbo prune` (https://turborepo.com/docs/guides/tools/docker) so each
# image only carries the workspace packages the target app actually depends
# on, and so pnpm's install layer stays cached across apps that share deps.

FROM node:20-slim AS base
RUN corepack enable

FROM base AS pruner
WORKDIR /app
ARG APP
COPY . .
RUN pnpm install --frozen-lockfile --ignore-scripts
RUN pnpm exec turbo prune "@video-streaming/${APP}" --docker

FROM base AS installer
WORKDIR /app
ARG APP
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
RUN pnpm exec turbo run build --filter="@video-streaming/${APP}"

FROM base AS runner
WORKDIR /app
ARG APP
ENV APP=${APP} \
    NODE_ENV=production

# validator/dispatcher (ffprobe) and transcoder (ffmpeg) need the real
# binaries at runtime - installed unconditionally since the image is shared
# across every app and the extra size is small next to node_modules.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY --from=installer /app .

CMD ["sh", "-c", "node backend/apps/${APP}/dist/main.js"]
