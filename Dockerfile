# Production image (Railway or any Docker host), see docs/DEPLOY.md.
# Everything the site saves (SQLite database, uploaded pictures, backups) goes
# to DATA_DIR=/data: mount a volume there, or it is lost on every deploy.

FROM node:24-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && rm -rf .next/cache

FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    DATA_DIR=/data \
    PORT=3000
COPY --from=build /app/package.json /app/package-lock.json /app/next.config.js /app/jsconfig.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
# Used at run time: scripts (check-services, admin:password, backup) and the usage guide.
COPY --from=build /app/src ./src
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/docs ./docs
EXPOSE 3000
# Runs as root: Railway mounts volumes owned by root, so the app can write to /data.
CMD ["node", "node_modules/next/dist/bin/next", "start", "-H", "0.0.0.0"]
