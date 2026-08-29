FROM node:20-alpine AS builder

WORKDIR /app

# Native build deps for better-sqlite3
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:20-alpine AS runtime

WORKDIR /app

RUN apk add --no-cache libstdc++ && chown node:node /app

COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/build ./build
COPY --from=builder --chown=node:node /app/package.json ./package.json

ENV NODE_ENV=production
ENV REVIT_CONNECTION_MODE=relay

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD node -e "const http=require('http');const port=process.env.PORT||3000;http.get(`http://127.0.0.1:${port}/health`,(r)=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1));"

USER node

CMD ["node", "build/server-combined.js"]
