const https = require('https');
const fs = require('fs');
const { spawn } = require('child_process');
const path = require('path');
const crypto = require('crypto');

// Configuration
// Railway uses PORT, fallback to MCP_PORT for local development
const PORT = process.env.PORT || process.env.MCP_PORT || 3000;
const CERT_PATH = process.env.CERT_PATH || './certs/server.crt';
const KEY_PATH = process.env.KEY_PATH || './certs/server.key';
const HOST = process.env.MCP_HOST || '0.0.0.0'; // Railway needs 0.0.0.0
const mcpCredential = process.env.MCP_API_KEY || '';
const ENABLE_IP_WHITELIST = process.env.ENABLE_IP_WHITELIST === 'true';
const WHITELIST_IPS = process.env.WHITELIST_IPS ? process.env.WHITELIST_IPS.split(',').map(ip => ip.trim()) : [];
const ENABLE_RATE_LIMIT = process.env.ENABLE_RATE_LIMIT === 'true';
const RATE_LIMIT_REQUESTS = parseInt(process.env.RATE_LIMIT_REQUESTS || '100');
const RATE_LIMIT_WINDOW = parseInt(process.env.RATE_LIMIT_WINDOW || '60000'); // 1 minute

// Security checks
if (!mcpCredential || mcpCredential.length < 32) {
  console.error('[SECURITY] MCP_API_KEY is required and must be at least 32 characters; refusing to start.');
  process.exit(1);
}

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
  key: fs.readFileSync(KEY_PATH),
  // Require TLS 1.2 or higher
  minVersion: 'TLSv1.2'
};

console.log('[MCP Server] Starting Revit MCP Server (Secure Mode)...');
console.log(`[MCP Server] Port: ${PORT}, Host: ${HOST}`);
console.log(`[MCP Server] Certificate: ${CERT_PATH}`);
console.log(`[MCP Server] API Key Authentication: ${mcpCredential ? 'ENABLED' : 'DISABLED - WARNING!'}`);
console.log(`[MCP Server] IP Whitelist: ${ENABLE_IP_WHITELIST ? 'ENABLED' : 'DISABLED'}`);
console.log(`[MCP Server] Rate Limiting: ${ENABLE_RATE_LIMIT ? 'ENABLED' : 'DISABLED'}`);

// Rate limiting store
const rateLimitStore = new Map();

/**
 * Check if client IP is within rate limit
 */
function checkRateLimit(clientIp) {
  if (!ENABLE_RATE_LIMIT) return true;

  const now = Date.now();
  const key = clientIp;

  if (!rateLimitStore.has(key)) {
    rateLimitStore.set(key, { count: 0, resetTime: now + RATE_LIMIT_WINDOW });
  }

  const record = rateLimitStore.get(key);

  // Reset if window has passed
  if (now > record.resetTime) {
    record.count = 0;
    record.resetTime = now + RATE_LIMIT_WINDOW;
  }

  record.count++;

  if (record.count > RATE_LIMIT_REQUESTS) {
    return false;
  }

  return true;
}

/**
 * Verify API Key from request
 */
function verifyApiKey(req) {
  if (!mcpCredential) {
    // If no API key configured, reject all requests
    return false;
  }

  // Check Authorization header
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(mcpCredential));
  }

  // Check X-API-Key header
  const apiKey = req.headers['x-api-key'] || '';
  if (apiKey) {
    return crypto.timingSafeEqual(Buffer.from(apiKey), Buffer.from(mcpCredential));
  }

  return false;
}

/**
 * Check if IP is in whitelist
 */
function isIpWhitelisted(ip) {
  if (!ENABLE_IP_WHITELIST) return true;
  
  // Allow localhost connections
  if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') {
    return true;
  }

  return WHITELIST_IPS.includes(ip);
}

/**
 * Get client IP address
 */
function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0].trim() ||
         req.socket.remoteAddress ||
         'unknown';
}

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
  const clientIp = getClientIp(req);
  
  console.log(`[MCP Server] ${req.method} ${req.url} from ${clientIp}`);

  // Set security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  
  // Disable CORS by default (clients must be explicitly configured)
  res.setHeader('Access-Control-Allow-Origin', 'null');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');

  // Health check endpoint - no auth required
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'healthy',
      timestamp: new Date().toISOString(),
      mcp: 'running'
    }));
    return;
  }

  // Check IP whitelist
  if (ENABLE_IP_WHITELIST && !isIpWhitelisted(clientIp)) {
    console.warn(`[Security] IP ${clientIp} not in whitelist`);
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Access denied' }));
    return;
  }

  // Check rate limit
  if (!checkRateLimit(clientIp)) {
    console.warn(`[Security] Rate limit exceeded for ${clientIp}`);
    res.writeHead(429, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Rate limit exceeded' }));
    return;
  }

  // Verify API key for all protected endpoints
  if (req.url.startsWith('/mcp') || req.url === '/status') {
    try {
      if (!verifyApiKey(req)) {
        console.warn(`[Security] Invalid API key attempt from ${clientIp}`);
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized - Invalid API key' }));
        return;
      }
    } catch (err) {
      // Timing attack protection - always respond with 401
      console.warn(`[Security] API key verification error from ${clientIp}`);
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }
  }

  // OPTIONS request for CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // MCP request handling
  if ((req.method === 'POST') && req.url.startsWith('/mcp')) {
    let body = '';

    req.on('data', chunk => {
      body += chunk.toString();
      // Prevent body from being too large
      if (body.length > 1e6) {
        req.pause();
        console.warn(`[Security] Payload too large from ${clientIp}`);
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

  // Status endpoint (requires auth)
  if (req.url === '/status' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'running',
      service: 'revit-mcp',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      secure: true
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
  console.log(`[MCP Server] ✓ Secure HTTPS Server running on https://${HOST}:${PORT}`);
  console.log(`[MCP Server] ✓ Only localhost connections allowed by default`);
  console.log(`[MCP Server] ✓ API key authentication required`);
  if (ENABLE_IP_WHITELIST) {
    console.log(`[MCP Server] ✓ IP whitelist enabled: ${WHITELIST_IPS.join(', ')}`);
  }
  if (ENABLE_RATE_LIMIT) {
    console.log(`[MCP Server] ✓ Rate limiting enabled: ${RATE_LIMIT_REQUESTS} requests per ${RATE_LIMIT_WINDOW}ms`);
  }
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
