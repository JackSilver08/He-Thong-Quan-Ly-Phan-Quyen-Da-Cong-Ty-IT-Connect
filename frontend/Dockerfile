FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1

# Copy package.json and install only production dependencies inside the
# container (much smaller download than full dev deps).  The .next build
# output is created on the host with "npm run build" beforehand.
COPY package.json ./

RUN --mount=type=cache,target=/root/.npm \
    npm config set fetch-retries 10 \
    && npm config set fetch-retry-factor 5 \
    && npm config set fetch-retry-mintimeout 30000 \
    && npm config set fetch-retry-maxtimeout 180000 \
    && npm config set fetch-timeout 600000 \
    && npm install --omit=dev

# Copy pre-built Next.js output from the host.
COPY .next ./.next

EXPOSE 3000
CMD ["npm","start"]
