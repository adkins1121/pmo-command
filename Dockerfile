# Build the Vite static bundle, then serve it with a tiny auth-gated Node server.
# Railway builds from the repo root, so paths are relative to the repo root.

FROM node:20-alpine AS build
WORKDIR /app
COPY app/package.json app/package-lock.json ./
RUN npm ci
COPY app/ ./
RUN npm run build

FROM node:20-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/dist ./dist
COPY app/server.mjs ./server.mjs
COPY app/server ./server
EXPOSE 8080
CMD ["node", "server.mjs"]
