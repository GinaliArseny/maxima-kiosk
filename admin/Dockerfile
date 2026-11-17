# Сервер админки киоска. Контекст сборки — каталог admin/ после `npm run admin:build`:
#   docker compose -f admin/docker-compose.yml up -d --build
FROM node:22-slim
WORKDIR /app
# sharp — нативный модуль, в бандл не входит.
RUN npm init -y >/dev/null && npm install --omit=dev sharp@0.35.5 && npm cache clean --force
COPY server/dist/main.mjs server/dist/user.mjs ./
COPY web/dist ./web
ENV NODE_ENV=production CONTENT_ROOT=/content USERS_FILE=/admin-data/users.json WEB_DIR=/app/web PORT=8787 HOST=0.0.0.0 COOKIE_SECURE=1
USER node
EXPOSE 8787
CMD ["node", "main.mjs"]
