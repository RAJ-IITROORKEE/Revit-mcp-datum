#!/bin/bash

# Revit MCP Server - Secure Setup Script

set -e

echo "================================"
echo "Revit MCP Server - Secure Setup"
echo "================================"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

echo "[OK] Node.js found: $(node --version)"
echo ""

# Create directories
echo "[*] Creating necessary directories..."
mkdir -p certs logs

# Check if certificates exist
if [ ! -f "certs/server.crt" ] || [ ! -f "certs/server.key" ]; then
    echo ""
    echo "[*] SSL certificates not found. Generating self-signed certificate..."
    echo ""
    echo "Please provide information for the SSL certificate:"
    echo "(For development, you can use defaults)"
    echo ""
    
    openssl req -x509 -newkey rsa:4096 -keyout certs/server.key -out certs/server.crt -days 365 -nodes
    
    echo ""
    echo "[OK] Certificate generated!"
else
    echo "[OK] SSL certificates found"
fi

echo ""
echo "[*] Installing dependencies..."
npm install

echo ""
echo "[*] Generating API key..."
API_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

echo ""
echo "================================"
echo "IMPORTANT - Save Your API Key!"
echo "================================"
echo ""
echo "Your generated API key:"
echo "  $API_KEY"
echo ""
echo "Copy this to your .env file as MCP_API_KEY"
echo ""

# Create .env file
if [ ! -f ".env" ]; then
    echo "[*] Creating .env file..."
    cat > .env << EOF
# Auto-generated secure configuration
MCP_PORT=3000
MCP_HOST=127.0.0.1
CERT_PATH=./certs/server.crt
KEY_PATH=./certs/server.key
NODE_ENV=production
MCP_API_KEY=$API_KEY
ENABLE_IP_WHITELIST=false
ENABLE_RATE_LIMIT=true
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=60000
EOF
    echo "[OK] .env file created"
else
    echo "[WARNING] .env file already exists. Update MCP_API_KEY manually if needed."
fi

echo ""
echo "================================"
echo "Setup Complete!"
echo "================================"
echo ""
echo "Next steps:"
echo ""
echo "1. Review and customize .env file:"
echo "   - Update API key if needed"
echo "   - Set MCP_HOST if you need remote access"
echo "   - Configure IP whitelist and rate limiting"
echo ""
echo "2. Start the secure server:"
echo ""
echo "   Option A - Direct execution:"
echo "     export MCP_API_KEY=\"$API_KEY\""
echo "     node server-secure.js"
echo ""
echo "   Option B - Using PM2:"
echo "     npm install -g pm2"
echo "     pm2 start ecosystem-secure.config.js"
echo "     pm2 logs revit-mcp-secure"
echo ""
echo "3. Update Claude Desktop config:"
echo ""
echo "   File: ~/.config/Claude/claude_desktop_config.json (Linux/Mac)"
echo "   or similar location on your system"
echo ""
echo "   Add:"
echo "   {\"revit-mcp\": {\"url\": \"https://localhost:3000\", \"env\": {\"Authorization\": \"Bearer $API_KEY\"}}}"
echo ""
echo "4. Test the connection:"
echo ""
echo "   curl -k https://localhost:3000/health"
echo "   curl -k https://localhost:3000/status -H \"X-API-Key: $API_KEY\""
echo ""
echo "5. For production deployment:"
echo "   - Replace self-signed certs with Let's Encrypt"
echo "   - Set strong API key (consider monthly rotation)"
echo "   - Enable IP whitelist if possible"
echo "   - Configure firewall rules"
echo "   - See SECURITY_GUIDE.md for best practices"
echo ""
echo "API Key: $API_KEY"
echo ""
echo "[IMPORTANT] Keep your API key SECRET!"
echo "[IMPORTANT] Add .env to .gitignore"
echo ""
