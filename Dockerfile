# GridWorld dedicated server in a container: builds the game and runs server/main.mjs (the game + multiplayer on one port).
#   docker build -t gridworld . && docker run -d --name gridworld -p 8517:8517 -v gridworld-data:/app/server/data --restart unless-stopped gridworld
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8517
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
VOLUME /app/server/data
EXPOSE 8517
USER node
CMD ["node", "server/main.mjs"]
