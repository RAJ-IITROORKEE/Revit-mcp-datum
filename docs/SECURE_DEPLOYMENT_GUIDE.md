# Revit MCP Server - Secure Deployment Guide

## ⚡ Quick Start (5 minutes)

### For Windows:
```bash
./quick-setup-secure.bat
```

### For Linux/Mac:
```bash
chmod +x quick-setup-secure.sh
./quick-setup-secure.sh
```

This will:
1. ✅ Generate SSL certificates
2. ✅ Create `.env` file with random API key
3. ✅ Install dependencies
4. ✅ Display next steps

---

## 🔒 Comparison: Basic vs Secure Version

| Feature | Basic Server | Secure Server |
|---------|--------------|---------------|
| **HTTPS** | ✅ Yes | ✅ Yes |
| **API Key Auth** | ❌ No | ✅ Yes |
| **IP Whitelist** | ❌ No | ✅ Optional |
| **Rate Limiting** | ❌ No | ✅ Optional |
| **Security Headers** | ⚠️ Basic | ✅ Complete |
| **Default Host** | 0.0.0.0 (Public) | 127.0.0.1 (Local) |
| **Production Ready** | ⚠️ Not Recommended | ✅ Yes |

---

## 📋 Migration Path

### From Basic to Secure (5 steps)

1. **Stop current server**
   ```bash
   pm2 stop revit-mcp
   ```

2. **Generate API key**
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

3. **Create .env file**
   ```bash
   cp .env.secure-example .env
   # Edit and set your API_KEY
   ```

4. **Start secure server**
   ```bash
   pm2 start ecosystem-secure.config.js --name revit-mcp-secure
   ```

5. **Update Claude config**
   ```json
   {
     "revit-mcp": {
       "url": "https://localhost:3000",
       "env": {
         "Authorization": "Bearer YOUR_API_KEY_HERE"
       }
     }
   }
   ```

---

## 🚀 Deployment Scenarios

### Scenario 1: Solo Developer (Local Development)

**Setup:**
```env
MCP_HOST=127.0.0.1
MCP_API_KEY=your-random-key
ENABLE_IP_WHITELIST=false
ENABLE_RATE_LIMIT=true
```

**Start:**
```bash
node server-secure.js
# or
pm2 start ecosystem-secure.config.js
```

**Claude Config:**
```json
{
  "revit-mcp": {
    "url": "https://localhost:3000",
    "env": {
      "Authorization": "Bearer YOUR_API_KEY"
    }
  }
}
```

---

### Scenario 2: Small Team (Same Office Network)

**Setup:**
```env
MCP_HOST=192.168.1.100      # Your office IP
MCP_PORT=3000
MCP_API_KEY=your-strong-key
ENABLE_IP_WHITELIST=true
WHITELIST_IPS=192.168.1.0/24, 10.0.0.100
ENABLE_RATE_LIMIT=true
RATE_LIMIT_REQUESTS=200
RATE_LIMIT_WINDOW=60000
```

**Network Setup:**
```
Office Network (192.168.1.x)
    ↓
  [MCP Server on 192.168.1.100:3000]
    ↑
  Each Desktop (API Key required)
```

---

### Scenario 3: Remote Team (Cloud Server)

**Setup:**
```env
MCP_HOST=127.0.0.1              # VPN/Bastion only
MCP_API_KEY=rotate-monthly
ENABLE_IP_WHITELIST=true
WHITELIST_IPS=vpn-gateway-ip
ENABLE_RATE_LIMIT=true
RATE_LIMIT_REQUESTS=500
```

**Network Setup:**
```
Remote Desktop
    ↓ (VPN)
  [VPN Gateway / Bastion Host]
    ↓
  [Cloud Server - Port restricted to VPN]
    ↓
  [MCP Server on 127.0.0.1:3000]
```

**Claude Config (on remote desktop):**
```json
{
  "revit-mcp": {
    "url": "https://vpn-gateway:3000",
    "env": {
      "Authorization": "Bearer YOUR_API_KEY"
    }
  }
}
```

---

### Scenario 4: Enterprise Deployment

**Setup:**
```env
MCP_HOST=127.0.0.1              # Behind load balancer only
MCP_API_KEY=use-secrets-manager-integration
ENABLE_IP_WHITELIST=true
WHITELIST_IPS=corporate-load-balancer-ip
ENABLE_RATE_LIMIT=true
RATE_LIMIT_REQUESTS=1000
```

**Use Let's Encrypt certificates:**
```bash
sudo certbot certonly --standalone -d revit-mcp.yourcompany.com
cp /etc/letsencrypt/live/revit-mcp.yourcompany.com/fullchain.pem certs/server.crt
cp /etc/letsencrypt/live/revit-mcp.yourcompany.com/privkey.pem certs/server.key
```

**Network Setup:**
```
Corporate Network
    ↓
  [Load Balancer / SSL Termination]
    ↓
  [MCP Server - Localhost only]
    ↓ (Restricted network)
  [Revit Automation]
```

---

## 🔑 API Key Management

### Generate Key
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Store Securely

**Option 1: Environment Variable (.env - LOCAL ONLY)**
```env
MCP_API_KEY=your-super-secret-key
```

**Option 2: Secrets Manager (AWS/Azure/GCP)**
```javascript
// Load from secrets manager instead of env
const AWS = require('aws-sdk');
const secretsManager = new AWS.SecretsManager();
const API_KEY = await secretsManager.getSecretValue({SecretId: 'mcp-api-key'});
```

**Option 3: Docker Secrets**
```yaml
# docker-compose.yml
services:
  revit-mcp:
    secrets:
      - mcp_api_key
    environment:
      MCP_API_KEY_FILE: /run/secrets/mcp_api_key

secrets:
  mcp_api_key:
    file: ./secrets/mcp_api_key.txt
```

### Rotate Key
```bash
# 1. Generate new key
NEW_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

# 2. Update .env
echo "MCP_API_KEY=$NEW_KEY" > .env

# 3. Restart server
pm2 restart revit-mcp-secure

# 4. Update Claude config within 24 hours
```

---

## 📊 Monitoring & Logging

### View Logs
```bash
# With PM2
pm2 logs revit-mcp-secure

# With Docker
docker-compose logs -f revit-mcp

# With Docker Compose + tail
tail -f logs/*.log
```

### Monitor Security Events
```bash
# Count unauthorized attempts
grep "Invalid API key" logs/*.log | wc -l

# Count rate limit hits
grep "Rate limit" logs/*.log | wc -l

# Monitor in real-time
watch 'tail -20 logs/combined.log'
```

### Set Up Alerts
```bash
# Example: Alert on 401 errors
tail -f logs/combined.log | grep "401\|Invalid API key" | mail -s "MCP Security Alert" admin@example.com
```

---

## 🛡️ Firewall Configuration

### UFW (Ubuntu)
```bash
# Allow from specific IP only
sudo ufw allow from 203.0.113.100 to any port 3000

# Allow from subnet
sudo ufw allow from 10.0.0.0/24 to any port 3000

# Deny all others
sudo ufw default deny incoming
sudo ufw enable
```

### iptables (Linux)
```bash
# Allow specific IP
sudo iptables -A INPUT -p tcp --dport 3000 -s 203.0.113.100 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 3000 -j DROP

# Save rules
sudo netfilter-persistent save
```

### Windows Defender Firewall
```powershell
# Allow specific IP
New-NetFirewallRule -DisplayName "MCP Server" `
  -Direction Inbound -Action Allow -Protocol TCP `
  -LocalPort 3000 -RemoteAddress 203.0.113.100

# Block all other IPs
New-NetFirewallRule -DisplayName "Block MCP" `
  -Direction Inbound -Action Block -Protocol TCP `
  -LocalPort 3000
```

---

## 🔐 SSL/TLS Certificates

### Self-Signed (Development)
```bash
mkdir -p certs
openssl req -x509 -newkey rsa:4096 \
  -keyout certs/server.key \
  -out certs/server.crt \
  -days 365 -nodes
```

### Let's Encrypt (Production)
```bash
# Install certbot
sudo apt-get install certbot

# Generate certificate
sudo certbot certonly --standalone -d your-mcp-domain.com

# Copy to app directory
sudo cp /etc/letsencrypt/live/your-mcp-domain.com/fullchain.pem certs/server.crt
sudo cp /etc/letsencrypt/live/your-mcp-domain.com/privkey.pem certs/server.key
sudo chown $USER:$USER certs/*
```

### Auto-Renewal
```bash
# Add to crontab
crontab -e

# Add this line
0 2 * * * certbot renew --quiet --post-hook "cd /path/to/revit-mcp && pm2 restart revit-mcp-secure"
```

---

## ✅ Security Checklist

Before deploying to production:

- [ ] API key is 32+ characters (use `quick-setup-secure.sh`)
- [ ] .env file is in .gitignore
- [ ] Certificates are valid and not self-signed
- [ ] MCP_HOST is not 0.0.0.0 (unless behind firewall)
- [ ] IP whitelist is enabled if possible
- [ ] Rate limiting is enabled
- [ ] Firewall rules are configured
- [ ] Logs are monitored for suspicious activity
- [ ] Certificate renewal is automated
- [ ] Backup plan for API key compromise exists
- [ ] Team knows not to share API key
- [ ] Regular key rotation schedule is set (every 90 days)

---

## 🚨 Troubleshooting

### "Invalid API Key" Error
```bash
# Check if API key matches
cat .env | grep MCP_API_KEY

# Test with curl
curl -k https://localhost:3000/status \
  -H "X-API-Key: YOUR_KEY_HERE"
```

### "Access Denied" (IP Whitelist)
```bash
# Check your IP
curl ifconfig.me

# Add to WHITELIST_IPS in .env
WHITELIST_IPS=your-ip-here
```

### "Rate Limit Exceeded"
```bash
# Disable for testing
ENABLE_RATE_LIMIT=false

# Or increase limits
RATE_LIMIT_REQUESTS=500
RATE_LIMIT_WINDOW=120000
```

### Certificate Errors
```bash
# Check certificate validity
openssl x509 -in certs/server.crt -noout -dates

# Regenerate if expired
rm certs/*
npm run setup  # or run quick-setup-secure.sh
```

---

## 📚 Next Steps

1. **Run setup script** → `./quick-setup-secure.bat` or `./quick-setup-secure.sh`
2. **Review SECURITY_GUIDE.md** → Understand all security features
3. **Configure .env** → Set API key, whitelist, rate limits
4. **Deploy** → Use PM2, Docker, or directly with Node.js
5. **Monitor** → Watch logs for suspicious activity
6. **Rotate keys** → Every 90 days
7. **Update certificates** → Before expiration

---

**Your MCP server is now protected and production-ready!** 🔒✅
