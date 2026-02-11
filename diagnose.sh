#!/bin/bash

# Revit MCP Server - Health Check and Diagnostic Script

set -e

echo "================================"
echo "Revit MCP Server Diagnostics"
echo "================================"
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check Node.js
echo -n "Checking Node.js... "
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✓${NC} $NODE_VERSION"
else
    echo -e "${RED}✗ Not found${NC}"
fi

# Check npm
echo -n "Checking npm... "
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo -e "${GREEN}✓${NC} $NPM_VERSION"
else
    echo -e "${RED}✗ Not found${NC}"
fi

# Check certificates
echo ""
echo "Checking SSL Certificates..."
echo -n "  server.crt... "
if [ -f "certs/server.crt" ]; then
    echo -e "${GREEN}✓ Found${NC}"
    echo -n "    Expires: "
    openssl x509 -in certs/server.crt -noout -enddate
else
    echo -e "${RED}✗ Not found${NC}"
fi

echo -n "  server.key... "
if [ -f "certs/server.key" ]; then
    echo -e "${GREEN}✓ Found${NC}"
else
    echo -e "${RED}✗ Not found${NC}"
fi

# Check directories
echo ""
echo "Checking directories..."
for dir in build logs; do
    echo -n "  $dir/... "
    if [ -d "$dir" ]; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${RED}✗ Missing${NC}"
    fi
done

# Check required files
echo ""
echo "Checking required files..."
for file in server.js build/index.js package.json; do
    echo -n "  $file... "
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${RED}✗ Missing${NC}"
    fi
done

# Check port availability
echo ""
echo "Checking port availability..."
PORT=${MCP_PORT:-3000}
echo -n "  Port $PORT... "
if command -v lsof &> /dev/null; then
    if ! lsof -i :$PORT > /dev/null; then
        echo -e "${GREEN}✓ Available${NC}"
    else
        echo -e "${YELLOW}⚠ In use${NC}"
        lsof -i :$PORT
    fi
else
    echo -e "${YELLOW}? Unable to check${NC}"
fi

# Check environment variables
echo ""
echo "Environment variables..."
echo "  MCP_PORT: ${MCP_PORT:-3000}"
echo "  MCP_HOST: ${MCP_HOST:-0.0.0.0}"
echo "  CERT_PATH: ${CERT_PATH:-./certs/server.crt}"
echo "  KEY_PATH: ${KEY_PATH:-./certs/server.key}"
echo "  NODE_ENV: ${NODE_ENV:-production}"

# Try to start server and test
echo ""
echo "Testing server connectivity..."
echo ""

# Start server in background
SERVER_PID=""
if [ -z "$SERVER_PID" ]; then
    echo "Starting MCP server..."
    MCP_PORT=${MCP_PORT:-3000} \
    CERT_PATH=${CERT_PATH:-./certs/server.crt} \
    KEY_PATH=${KEY_PATH:-./certs/server.key} \
    node server.js > logs/test.log 2>&1 &
    SERVER_PID=$!
    
    # Wait for server to start
    echo "Waiting for server to start..."
    sleep 3
fi

# Test health endpoint
echo -n "Testing /health endpoint... "
if curl -s -k https://localhost:${MCP_PORT:-3000}/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC}"
    curl -s -k https://localhost:${MCP_PORT:-3000}/health | python3 -m json.tool 2>/dev/null || echo "  (response received)"
else
    echo -e "${RED}✗ Failed${NC}"
fi

# Test status endpoint
echo -n "Testing /status endpoint... "
if curl -s -k https://localhost:${MCP_PORT:-3000}/status > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC}"
    curl -s -k https://localhost:${MCP_PORT:-3000}/status | python3 -m json.tool 2>/dev/null || echo "  (response received)"
else
    echo -e "${RED}✗ Failed${NC}"
fi

# Cleanup
echo ""
echo "Cleaning up test server..."
if [ ! -z "$SERVER_PID" ]; then
    kill $SERVER_PID 2>/dev/null || true
fi

echo ""
echo "================================"
echo "Diagnostics Complete"
echo "================================"
