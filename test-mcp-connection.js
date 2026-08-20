// Test MCP connection from Claude Desktop perspective
import https from 'https';

const mcpCredential = (process.env.MCP_API_KEY || '').trim();
if (!mcpCredential) {
  console.error('MCP_API_KEY is required; refusing to start.');
  process.exit(1);
}

const options = {
  hostname: 'revit-mcp-datum-production.up.railway.app',
  port: 443,
  path: '/mcp',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream',
    'Authorization': `Bearer ${mcpCredential}`
  }
};

const data = JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'claude-test', version: '1.0' }
  }
});

console.log('Testing MCP connection...\n');

const req = https.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log(`Headers:`, res.headers);
  
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log('\nResponse:', body);
    try {
      const json = JSON.parse(body);
      console.log('\n✅ SUCCESS! Server info:', json.result?.serverInfo);
    } catch (e) {
      console.log('Parse error:', e.message);
    }
  });
});

req.on('error', (e) => {
  console.error('❌ ERROR:', e.message);
});

req.write(data);
req.end();
