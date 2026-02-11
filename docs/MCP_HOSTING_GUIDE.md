# Revit MCP Server - HTTPS Hosting Guide

## Overview
This guide covers hosting your Revit MCP server on a private server with HTTPS support for secure communication with Claude.

## Prerequisites
- Node.js installed on your server
- SSL/TLS certificates (self-signed or from a CA like Let's Encrypt)
- A private server with fixed IP or domain name
- Port access (typically 443 for HTTPS)

## Step 1: Create an HTTPS MCP Server Wrapper

Create a new file: `server.js` in the root of your project

```javascript
const https = require('https');
const fs = require('fs');
const { spawn } = require('child_process');
const path = require('path');

// Configuration
const PORT = process.env.MCP_PORT || 3000;
const CERT_PATH = process.env.CERT_PATH || './certs/server.crt';
const KEY_PATH = process.env.KEY_PATH || './certs/server.key';

// SSL/TLS Certificate Files
const options = {
  cert: fs.readFileSync(CERT_PATH),
  key: fs.readFileSync(KEY_PATH)
};

// Start the MCP process
const mcpProcess = spawn('node', [path.join(__dirname, 'build/index.js')]);

mcpProcess.on('error', (err) => {
  console.error('Failed to start MCP process:', err);
  process.exit(1);
});

mcpProcess.stdout.on('data', (data) => {
  console.log(`[MCP stdout] ${data}`);
});

mcpProcess.stderr.on('data', (data) => {
  console.error(`[MCP stderr] ${data}`);
});

// Create HTTPS server
const httpsServer = https.createServer(options, (req, res) => {
  // Handle MCP protocol requests
  if (req.method === 'POST' && req.url === '/mcp') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        // Forward request to MCP process
        mcpProcess.stdin.write(body + '\n');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  } else if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'healthy' }));
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

httpsServer.listen(PORT, '0.0.0.0', () => {
  console.log(`MCP Server running on https://0.0.0.0:${PORT}`);
  console.log(`Health check: https://your-domain:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down gracefully...');
  httpsServer.close(() => {
    mcpProcess.kill();
    process.exit(0);
  });
});
```

## Step 2: Generate SSL Certificates

### Option A: Self-Signed Certificate (Development)
```bash
mkdir -p certs
openssl req -x509 -newkey rsa:4096 -keyout certs/server.key -out certs/server.crt -days 365 -nodes
```

When prompted, fill in your details. For CN (Common Name), use your server's IP or domain.

### Option B: Let's Encrypt (Production)
```bash
# Install certbot
sudo apt-get install certbot

# Generate certificate
sudo certbot certonly --standalone -d your-domain.com

# Copy certificates to your project
cp /etc/letsencrypt/live/your-domain.com/fullchain.pem certs/server.crt
cp /etc/letsencrypt/live/your-domain.com/privkey.pem certs/server.key
```

## Step 3: Server Deployment

### Option A: Direct Node.js Execution
```bash
# Set environment variables
export MCP_PORT=3000
export CERT_PATH=./certs/server.crt
export KEY_PATH=./certs/server.key

# Run the server
node server.js
```

### Option B: Using PM2 (Recommended)
```bash
# Install PM2
npm install -g pm2

# Create ecosystem.config.js
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'revit-mcp',
    script: './server.js',
    env: {
      MCP_PORT: 3000,
      CERT_PATH: './certs/server.crt',
      KEY_PATH: './certs/server.key',
      NODE_ENV: 'production'
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
};
EOF

# Start with PM2
pm2 start ecosystem.config.js

# Enable PM2 auto-restart on reboot
pm2 startup
pm2 save
```

### Option C: Docker (Recommended for Production)
```dockerfile
# Create Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Volumes for certificates
VOLUME ["/app/certs"]

ENV MCP_PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
```

```bash
# Build image
docker build -t revit-mcp:latest .

# Run container
docker run -d \
  --name revit-mcp \
  -p 3000:3000 \
  -v $(pwd)/certs:/app/certs \
  -e MCP_PORT=3000 \
  revit-mcp:latest
```

## Step 4: Network & Firewall Configuration

### On Your Server
```bash
# Allow HTTPS traffic
sudo ufw allow 443/tcp
sudo ufw allow 3000/tcp

# If using a cloud provider, update security groups to allow HTTPS on port 3000
```

### Port Forwarding (if behind NAT)
1. Log into your router's admin panel
2. Forward port 443/3000 to your server's internal IP
3. Ensure your firewall allows inbound traffic

## Step 5: Update Claude Configuration

Update your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "revit-mcp": {
      "url": "https://your-domain-or-ip:3000"
    }
  },
  "preferences": {
    "coworkScheduledTasksEnabled": false,
    "sidebarMode": "chat"
  }
}
```

### For Self-Signed Certificates
If using self-signed certificates, you may need to update the config:

```json
{
  "mcpServers": {
    "revit-mcp": {
      "url": "https://your-domain-or-ip:3000",
      "insecure": true
    }
  },
  "preferences": {
    "coworkScheduledTasksEnabled": false,
    "sidebarMode": "chat"
  }
}
```

## Step 6: Testing & Verification

### Health Check
```bash
# Test the health endpoint (ignore SSL warnings for self-signed)
curl -k https://your-domain-or-ip:3000/health
```

### Verify MCP Connection
1. Restart Claude Desktop
2. Check Claude's MCP settings to verify the connection
3. Test a simple MCP command to ensure functionality

## Step 7: Monitoring & Maintenance

### Log Monitoring (if using PM2)
```bash
pm2 logs revit-mcp
pm2 monit
```

### Certificate Renewal (Let's Encrypt)
```bash
# Check certificate expiry
certbot certificates

# Renew automatically (cron job)
0 2 * * * certbot renew --quiet

# Or manually
certbot renew
```

### Performance Monitoring
```bash
pm2 web  # Opens web dashboard at http://localhost:9615
```

## Troubleshooting

### Connection Issues
- Verify firewall allows port 3000
- Check certificate paths are correct
- Ensure domain/IP resolves correctly
- Test with: `curl -k https://your-server:3000/health`

### Certificate Problems
- Verify certificate and key files exist
- Check certificate expiration: `openssl x509 -in certs/server.crt -text -noout`
- For self-signed: trust the certificate on client machine

### Performance Issues
- Monitor memory/CPU with PM2
- Check logs for errors
- Consider increasing Node.js memory limit

## Security Best Practices

1. **Use Let's Encrypt** instead of self-signed for production
2. **Restrict network access** - limit to known IPs if possible
3. **Enable authentication** - add API key validation
4. **Use strong certificates** - RSA 4096 or better
5. **Keep dependencies updated** - regular `npm update`
6. **Monitor logs** - set up log aggregation
7. **Use environment variables** - don't hardcode secrets
8. **Enable CORS** if needed, but restrict origins

## Additional Resources

- [MCP Documentation](https://modelcontextprotocol.io)
- [Node.js HTTPS Module](https://nodejs.org/api/https.html)
- [Let's Encrypt](https://letsencrypt.org)
- [PM2 Documentation](https://pm2.keymetrics.io)
- [Docker Documentation](https://docs.docker.com)
