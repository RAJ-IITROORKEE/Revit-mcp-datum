FROM node:18-alpine

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including devDependencies needed for build)
RUN npm ci

# Copy application source
COPY . .

# Build TypeScript -> JavaScript
RUN npm run build

# Remove devDependencies to reduce image size
RUN npm prune --production

# Create logs directory
RUN mkdir -p logs

# Environment variables (Railway overrides PORT automatically)
ENV PORT=3000
ENV MCP_HOST=0.0.0.0
ENV NODE_ENV=production

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD node -e "const http=require('http');http.get('http://localhost:'+process.env.PORT+'/health',(r)=>r.statusCode===200?process.exit(0):process.exit(1)).on('error',()=>process.exit(1))"

# Start the HTTP server directly (Railway provides HTTPS termination)
CMD ["node", "build/server-http.js"]
