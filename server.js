const https = require('https');
const fs = require('fs');
const { spawn } = require('child_process');
const path = require('path');

// Configuration
const PORT = process.env.MCP_PORT || 3000;
const CERT_PATH = process.env.CERT_PATH || './certs/server.crt';
const KEY_PATH = process.env.KEY_PATH || './certs/server.key';
const HOST = process.env.MCP_HOST || '0.0.0.0';

// Verify certificate files exist
if (!fs.existsSync(CERT_PATH)) {
  console.error(`Certificate file not found: ${CERT_PATH}`);
  process.exit(1);
}
if (!fs.existsSync(KEY_PATH)) {
  console.error(`Key file not found: ${KEY_PATH}`);
  process.exit(1);
}

// SSL/TLS Certificate Options
const options = {
  cert: fs.readFileSync(CERT_PATH),
  key: fs.readFileSync(KEY_PATH)
};

console.log('[MCP Server] Starting Revit MCP Server...');
console.log(`[MCP Server] Port: ${PORT}, Host: ${HOST}`);
console.log(`[MCP Server] Certificate: ${CERT_PATH}`);
console.log(`[MCP Server] Key: ${KEY_PATH}`);

// Start the MCP process
const mcpProcess = spawn('node', [path.join(__dirname, 'build/index.js')], {
  stdio: ['pipe', 'pipe', 'pipe']
});

mcpProcess.on('error', (err) => {
  console.error('[MCP Server] Failed to start MCP process:', err);
  process.exit(1);
});

mcpProcess.stdout.on('data', (data) => {
  console.log(`[MCP stdout] ${data.toString().trim()}`);
});

mcpProcess.stderr.on('data', (data) => {
  console.error(`[MCP stderr] ${data.toString().trim()}`);
});

mcpProcess.on('close', (code) => {
  console.log(`[MCP Server] MCP process exited with code ${code}`);
  process.exit(code);
});

// Create HTTPS server
const httpsServer = https.createServer(options, (req, res) => {
  console.log(`[MCP Server] ${req.method} ${req.url} from ${req.socket.remoteAddress}`);

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Health check endpoint
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'healthy',
      timestamp: new Date().toISOString(),
      mcp: 'running'
    }));
    return;
  }

  // MCP request handling
  if ((req.method === 'POST' || req.method === 'GET') && req.url.startsWith('/mcp')) {
    let body = '';

    req.on('data', chunk => {
      body += chunk.toString();
      // Prevent body from being too large
      if (body.length > 1e6) {
        req.pause();
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Payload too large' }));
      }
    });

    req.on('end', () => {
      try {
        // Forward request to MCP process via stdin
        mcpProcess.stdin.write(body + '\n', (err) => {
          if (err) {
            console.error('[MCP Server] Error writing to MCP process:', err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal server error' }));
          } else {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'request_received' }));
          }
        });
      } catch (err) {
        console.error('[MCP Server] Error processing request:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });

    req.on('error', (err) => {
      console.error('[MCP Server] Request error:', err);
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Bad request' }));
    });

    return;
  }

  // Status endpoint
  if (req.url === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'running',
      service: 'revit-mcp',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    }));
    return;
  }

  // Default 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Endpoint not found' }));
});

// Handle server errors
httpsServer.on('error', (err) => {
  console.error('[MCP Server] HTTPS Server error:', err);
  process.exit(1);
});

// Start listening
httpsServer.listen(PORT, HOST, () => {
  console.log(`[MCP Server] ✓ HTTPS Server running on https://${HOST}:${PORT}`);
  console.log(`[MCP Server] Health check: https://your-domain:${PORT}/health`);
  console.log(`[MCP Server] Status: https://your-domain:${PORT}/status`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[MCP Server] SIGTERM received, shutting down gracefully...');
  httpsServer.close(() => {
    console.log('[MCP Server] HTTPS server closed');
    mcpProcess.kill('SIGTERM');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('[MCP Server] SIGINT received, shutting down gracefully...');
  httpsServer.close(() => {
    console.log('[MCP Server] HTTPS server closed');
    mcpProcess.kill('SIGINT');
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('[MCP Server] Uncaught exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[MCP Server] Unhandled rejection at:', promise, 'reason:', reason);
});
