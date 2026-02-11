#!/bin/bash

# Revit MCP Server - Quick Start Guide

set -e

echo "================================"
echo "Revit MCP Server - Quick Setup"
echo "================================"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

echo "✓ Node.js found: $(node --version)"
echo ""

# Create directories
echo "📁 Creating necessary directories..."
mkdir -p certs logs

# Check if certificates exist
if [ ! -f "certs/server.crt" ] || [ ! -f "certs/server.key" ]; then
    echo ""
    echo "🔐 SSL certificates not found. Generating self-signed certificate..."
    echo ""
    echo "Please provide information for the SSL certificate:"
    echo "(For self-signed development, you can use defaults)"
    echo ""
    
    openssl req -x509 -newkey rsa:4096 -keyout certs/server.key -out certs/server.crt -days 365 -nodes
    
    echo ""
    echo "✓ Certificate generated!"
else
    echo "✓ SSL certificates found"
fi

echo ""
echo "📦 Installing dependencies..."
npm install

echo ""
echo "✓ Setup complete!"
echo ""
echo "================================"
echo "Next Steps:"
echo "================================"
echo ""
echo "Option 1 - Direct Execution:"
echo "  export MCP_PORT=3000"
echo "  export CERT_PATH=./certs/server.crt"
echo "  export KEY_PATH=./certs/server.key"
echo "  node server.js"
echo ""
echo "Option 2 - Using PM2:"
echo "  npm install -g pm2"
echo "  pm2 start ecosystem.config.js"
echo "  pm2 logs revit-mcp"
echo ""
echo "Option 3 - Using Docker:"
echo "  docker build -t revit-mcp:latest ."
echo "  docker run -d -p 3000:3000 -v $(pwd)/certs:/app/certs revit-mcp:latest"
echo ""
echo "Option 4 - Using Docker Compose:"
echo "  docker-compose up -d"
echo ""
echo "Testing:"
echo "  curl -k https://localhost:3000/health"
echo ""
echo "================================"
echo "Configuration:"
echo "================================"
echo ""
echo "Update your Claude Desktop config file with:"
echo "  \"revit-mcp\": { \"url\": \"https://your-domain-or-ip:3000\" }"
echo ""
