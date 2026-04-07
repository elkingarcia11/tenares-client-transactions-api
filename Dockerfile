FROM node:18-slim

# Cloud Run listens on $PORT (default 8080)
ENV NODE_ENV=production
ENV PORT=8080

WORKDIR /app

# Install dependencies first (better layer caching)
COPY functions/package*.json ./functions/
RUN cd functions && npm ci --omit=dev

# Copy service source
COPY functions ./functions

EXPOSE 8080

# Run Functions Framework (target is configured in package.json)
CMD ["npm", "--prefix", "functions", "start"]

