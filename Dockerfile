# Google Cloud Run — Node 18
# Cloud Run injects PORT and your service env vars at runtime (including paths for
# Secret Manager volume mounts). Do not bake credentials or .env into the image.
FROM node:18-slim

ENV NODE_ENV=production
# Default when running the image locally; Cloud Run overwrites PORT.
ENV PORT=8080

WORKDIR /app

COPY functions/package*.json ./functions/
RUN cd functions && npm ci --omit=dev && npm cache clean --force

# Application source. Excluded by .dockerignore: .env*, local.json, service account JSON, etc.
COPY functions ./functions

WORKDIR /app/functions

EXPOSE 8080

CMD ["npm", "start"]
