FROM node:20-alpine

WORKDIR /app

# Native build deps for better-sqlite3
RUN apk add --no-cache python3 make g++

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

ENV NODE_ENV=production

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD node -e "const http=require('http');const port=process.env.PORT||3000;http.get(`http://127.0.0.1:${port}/health`,(r)=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1));"

CMD ["node", "build/server-combined.js"]
