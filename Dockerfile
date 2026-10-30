FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Contract emission is offline; no real database or deployment secret is needed.
RUN DATABASE_URL=postgresql://starter:starter@localhost:5432/starter npm run build
RUN npm prune --omit=dev --ignore-scripts

FROM node:24-alpine AS runtime
ENV NODE_ENV=production ENVIRONMENT=production
WORKDIR /app
COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
USER node
EXPOSE 8001
CMD ["node", "dist/main.js"]
