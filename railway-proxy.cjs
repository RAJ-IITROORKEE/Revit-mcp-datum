#!/usr/bin/env node
/**
 * Railway MCP Proxy for Claude Desktop
 * Simple, bulletproof stdio ↔ HTTPS bridge
 */

const https = require('https');
const readline = require('readline');

const RAILWAY_URL = 'revit-mcp-datum-production.up.railway.app';
const mcpCredential = (process.env.MCP_API_KEY || '').trim();

if (!mcpCredential) {
  console.error('[Proxy] MCP_API_KEY is required; refusing to start.');
  process.exit(1);
}

let sessionId = null;

// Read JSON-RPC from stdin line by line
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

console.error('[Proxy] Railway MCP Proxy starting...');

rl.on('line', (line) => {
  try {
    const request = JSON.parse(line);
    console.error(`[Proxy] Request: ${request.method || 'unknown'}`);
    forwardToRailway(request);
  } catch (e) {
    console.error(`[Proxy] Parse error: ${e.message}`);
  }
});

function forwardToRailway(request) {
  const body = JSON.stringify(request);
  
  const options = {
    hostname: RAILWAY_URL,
    port: 443,
    path: '/mcp',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'Authorization': `Bearer ${mcpCredential}`,
      'Content-Length': Buffer.byteLength(body)
    }
  };
  
  if (sessionId) {
    options.headers['mcp-session-id'] = sessionId;
  }
  
  const req = https.request(options, (res) => {
    // Save session ID
    if (res.headers['mcp-session-id']) {
      sessionId = res.headers['mcp-session-id'];
    }
    
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const response = JSON.parse(data);
        console.log(JSON.stringify(response));
      } catch (e) {
        console.error(`[Proxy] Response parse error: ${e.message}`);
        console.log(JSON.stringify({
          jsonrpc: '2.0',
          error: { code: -32700, message: 'Parse error' },
          id: request.id || null
        }));
      }
    });
  });
  
  req.on('error', (e) => {
    console.error(`[Proxy] Request failed: ${e.message}`);
    console.log(JSON.stringify({
      jsonrpc: '2.0',
      error: { code: -32603, message: `Connection error: ${e.message}` },
      id: request.id || null
    }));
  });
  
  req.write(body);
  req.end();
}

console.error('[Proxy] Ready and listening on stdin');
