FROM node:22-alpine AS deps
WORKDIR /app

COPY package.json ./

# npm is allowed to retry slow registry connections and uses a BuildKit cache.
RUN --mount=type=cache,target=/root/.npm \
    npm config set fetch-retries 6 \
    && npm config set fetch-retry-factor 2 \
    && npm config set fetch-retry-mintimeout 20000 \
    && npm config set fetch-retry-maxtimeout 120000 \
    && npm install

FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1

COPY --from=build /app/.next ./.next
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
# No public/ directory is required by the current application.

EXPOSE 3000
CMD ["npm","start"]
