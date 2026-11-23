FROM node:26-bookworm-slim AS build
WORKDIR /app
RUN npm install --global bun@1.4.5
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_APP_ID
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
RUN npm run build

FROM node:26-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=8080
WORKDIR /app
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json firebase-applet-config.json server.ts ./
COPY --chown=node:node server ./server
COPY --chown=node:node src/db ./src/db
COPY --chown=node:node src/types ./src/types
COPY --chown=node:node src/i18n ./src/i18n
USER node
EXPOSE 8080
CMD ["node", "--import", "tsx", "server.ts"]
