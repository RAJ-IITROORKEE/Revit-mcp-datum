FROM node:18-alpine

# Install OpenSSL for certificate generation
RUN apk add --no-cache openssl

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY . .

# Make startup script executable
RUN chmod +x start.sh

# Create logs and certs directories
RUN mkdir -p logs certs

# Environment variables (Railway will override PORT automatically)
ENV PORT=3000
ENV MCP_HOST=0.0.0.0
ENV CERT_PATH=./certs/server.crt
ENV KEY_PATH=./certs/server.key
ENV NODE_ENV=production

# Expose port (Railway uses dynamic PORT)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('https').get('https://localhost:3000/health', {rejectUnauthorized: false}, (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1)).on('error', () => process.exit(1))"

# Start application
CMD ["./start.sh"]
