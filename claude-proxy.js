#!/usr/bin/env node
/**
 * Claude Desktop → Railway MCP Proxy
 * Bridges stdio (Claude Desktop) to HTTP (Railway server)
 */

import https from 'https';
import { stdin, stdout, stderr } from 'process';

const RAILWAY_URL = 'https://revit-mcp-datum-production.up.railway.app/mcp';
const API_KEY = 'c8e331f621c4e46b0be5c9d815a171a261ad2dacff7324cf737bb42442b0094d';

let sessionId = null;
let buffer = '';

stderr.write('[Proxy] Starting Railway MCP proxy...\n');

// Read from stdin (Claude Desktop)
stdin.setEncoding('utf8');
stdin.on('data', (chunk) => {
  buffer += chunk;
  
  // Try to parse complete JSON-RPC messages
  const lines = buffer.split('\n');
  buffer = lines.pop() || ''; // Keep incomplete line in buffer
  
  for (const line of lines) {
    if (line.trim()) {
      try {
        const message = JSON.parse(line);
        forwardToRailway(message);
      } catch (e) {
        stderr.write(`[Proxy] Parse error: ${e.message}\n`);
      }
    }
  }
});

// Forward request to Railway HTTP server
function forwardToRailway(message) {
  const data = JSON.stringify(message);
  
  const options = {
    hostname: 'revit-mcp-datum-production.up.railway.app',
    port: 443,
    path: '/mcp',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Length': data.length
    }
  };
  
  if (sessionId) {
    options.headers['mcp-session-id'] = sessionId;
  }
  
  const req = https.request(options, (res) => {
    // Capture session ID
    const newSessionId = res.headers['mcp-session-id'];
    if (newSessionId) {
      sessionId = newSessionId;
      stderr.write(`[Proxy] Session ID: ${sessionId}\n`);
    }
    
    let responseData = '';
    res.on('data', (chunk) => responseData += chunk);
    res.on('end', () => {
      try {
        // Parse and validate response
        const parsed = JSON.parse(responseData);
        
        // If HTTP error status but valid JSON-RPC response, forward it
        if (res.statusCode !== 200) {
          stderr.write(`[Proxy] HTTP ${res.statusCode}: ${responseData}\n`);
          
          // If it's a proper JSON-RPC error, forward it
          if (parsed.jsonrpc && parsed.error) {
            stdout.write(JSON.stringify(parsed) + '\n');
            return;
          }
          
          // Otherwise create a proper error response
          const errorResponse = {
            jsonrpc: '2.0',
            error: {
              code: -32603,
              message: parsed.message || `HTTP ${res.statusCode}`,
              data: parsed
            },
            id: message.id || null
          };
          stdout.write(JSON.stringify(errorResponse) + '\n');
          return;
        }
        
        // Success - forward response as-is
        stdout.write(JSON.stringify(parsed) + '\n');
      } catch (e) {
        stderr.write(`[Proxy] Parse error: ${e.message}\n${responseData}\n`);
        const errorResponse = {
          jsonrpc: '2.0',
          error: { code: -32700, message: `Parse error: ${e.message}` },
          id: message.id || null
        };
        stdout.write(JSON.stringify(errorResponse) + '\n');
      }
    });
  });
  
  req.on('error', (e) => {
    stderr.write(`[Proxy] Request error: ${e.message}\n`);
    const errorResponse = {
      jsonrpc: '2.0',
      error: { code: -32603, message: `Proxy error: ${e.message}` },
      id: message.id || null
    };
    stdout.write(JSON.stringify(errorResponse) + '\n');
  });
  
  req.write(data);
  req.end();
}

stderr.write('[Proxy] Ready - forwarding stdio ↔ Railway HTTPS\n');
