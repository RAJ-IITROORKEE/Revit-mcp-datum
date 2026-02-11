FROM node:18-slim

WORKDIR /app

# Install build tools for native modules (better-sqlite3)
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install ALL dependencies (devDeps needed for TypeScript build)
RUN npm ci

# Copy source
COPY . .

# Build TypeScript
RUN npm run build

# Remove devDependencies
RUN npm prune --production

# Railway sets PORT automatically
ENV NODE_ENV=production
EXPOSE 8080

# Start HTTP server (Railway provides HTTPS termination)
CMD ["node", "build/server-http.js"]
