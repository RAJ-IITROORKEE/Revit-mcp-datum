#!/bin/sh
# Railway startup script - generates certificates if missing

set -e

echo "Starting Revit MCP Server..."

# Create directories
mkdir -p certs logs

# Generate self-signed certificate if not exists
if [ ! -f "./certs/server.crt" ] || [ ! -f "./certs/server.key" ]; then
  echo "Generating self-signed SSL certificates..."
  openssl req -nodes -new -x509 \
    -keyout ./certs/server.key \
    -out ./certs/server.crt \
    -days 365 \
    -subj "/CN=localhost" 2>/dev/null || echo "Certificate generation skipped"
fi

# Start the server
echo "Starting server on port ${PORT:-3000}..."
node server-secure.js
