FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm config set fetch-retries 10 \
    && npm config set fetch-retry-factor 5 \
    && npm config set fetch-retry-mintimeout 30000 \
    && npm config set fetch-retry-maxtimeout 180000 \
    && npm config set fetch-timeout 600000 \
    && npm ci

FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/package-lock.json ./package-lock.json
COPY --from=build /app/node_modules ./node_modules
EXPOSE 3000
HEALTHCHECK --interval=5s --timeout=3s --start-period=10s --retries=12 CMD wget -qO- http://127.0.0.1:3000/login >/dev/null || exit 1
CMD ["npm","start","--","-H","0.0.0.0"]
