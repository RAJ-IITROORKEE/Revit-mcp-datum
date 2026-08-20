# Revit MCP Server - Security Guide

## 🔒 Security Overview

Your MCP server can now be hosted securely with multiple layers of protection against unauthorized access.

## Security Features

### 1. **HTTPS Encryption** ✅
- All communication is encrypted with TLS 1.2+
- Self-signed certificates for development
- Let's Encrypt for production

### 2. **API Key Authentication** ✅ (Secure Version)
- All requests (except `/health`) require a valid API key
- Supports two authentication methods:
  - `Authorization: Bearer <API_KEY>`
  - `X-API-Key: <API_KEY>`
- Uses timing-safe comparison to prevent timing attacks

### 3. **IP Whitelist** ✅ (Secure Version)
- Optional IP whitelist to allow only specific addresses
- Perfect for corporate networks or known servers
- Localhost (127.0.0.1) always allowed

### 4. **Rate Limiting** ✅ (Secure Version)
- Prevent brute force and DoS attacks
- Configurable requests per time window
- Per-IP tracking

### 5. **Security Headers** ✅ (Secure Version)
- `X-Content-Type-Options: nosniff` - Prevent MIME sniffing
- `X-Frame-Options: DENY` - Prevent clickjacking
- `X-XSS-Protection: 1; mode=block` - XSS protection
- `Strict-Transport-Security` - Force HTTPS connections

### 6. **Default Secure Configuration** ✅
- Host defaults to `127.0.0.1` (localhost only)
- No public internet access by default
- CORS disabled by default

---

## 🚀 Getting Started with Secure Version

### Step 1: Generate API Key

```bash
# Generate a random 64-character API key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

This will output something like:
```
a7f3d2c1e8b9f4a5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7
```

### Step 2: Create `.env` file

Copy `.env.example` to `.env` and set your API key:

```bash
# Create .env from template
cp .env.example .env
```

Edit `.env`:
```env
# MCP Server Configuration
MCP_PORT=3000
MCP_HOST=127.0.0.1          # Only localhost by default
MCP_CERT_PATH=./certs/server.crt
MCP_KEY_PATH=./certs/server.key
NODE_ENV=production

# Security Settings
MCP_API_KEY=replace_me_with_a_secret_from_your_secret_store
ENABLE_IP_WHITELIST=false
ENABLE_RATE_LIMIT=true
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=60000
```

### Step 3: Use Secure Server

```bash
# Start with secure version
node server-secure.cjs

# Or with PM2
pm2 start server-secure.cjs --name revit-mcp-secure
```

### Step 4: Update Claude Desktop Config

```json
{
  "mcpServers": {
    "revit-mcp": {
      "url": "https://your-domain-or-ip:3000",
      "env": {
        "Authorization": "Bearer a7f3d2c1e8b9f4a5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7"
      }
    }
  }
}
```

---

## 🔐 Configuration Options

### API Key Authentication

Set a strong API key (minimum 32 characters):
```bash
export MCP_API_KEY=replace_me_with_a_secret_from_your_secret_store
```

### IP Whitelist (For Known Servers Only)

```env
ENABLE_IP_WHITELIST=true
WHITELIST_IPS=192.168.1.100,10.0.0.50
```

This only allows requests from these IPs (plus localhost).

### Rate Limiting

Control how many requests per time window:
```env
ENABLE_RATE_LIMIT=true
RATE_LIMIT_REQUESTS=100         # Max requests
RATE_LIMIT_WINDOW=60000         # Per 60 seconds
```

### Host Configuration

**For Local Development:**
```env
MCP_HOST=127.0.0.1              # Only localhost
```

**For Remote Access (with IP whitelist):**
```env
MCP_HOST=0.0.0.0                # All interfaces
ENABLE_IP_WHITELIST=true
WHITELIST_IPS=your-office-ip
```

---

## 📋 Deployment Security Checklist

### Before Going to Production:

- ✅ Generate strong API key (32+ characters)
- ✅ Use Let's Encrypt certificates (not self-signed)
- ✅ Set `MCP_HOST=127.0.0.1` unless you need remote access
- ✅ Enable IP whitelist if possible
- ✅ Enable rate limiting
- ✅ Use environment variables (not hardcoded secrets)
- ✅ Rotate API keys regularly
- ✅ Monitor logs for suspicious activity
- ✅ Use firewall to restrict port access
- ✅ Keep Node.js and dependencies updated

### Network Security:

```
Internet → Firewall (Port 3000 blocked) → Internal Network → MCP Server
                    ↓ (Optional VPN)
                    Your Desktop/Office
```

---

## 🧪 Testing Authentication

### Test Without API Key (Should Fail):
```bash
curl -k https://localhost:3000/health   # ✅ Works (no auth needed)
curl -k https://localhost:3000/status   # ❌ Fails (auth required)
```

### Test With API Key (Should Succeed):
```bash
# Using Bearer token
curl -k https://localhost:3000/status \
  -H "Authorization: Bearer YOUR_API_KEY"

# Using X-API-Key header
curl -k https://localhost:3000/status \
  -H "X-API-Key: YOUR_API_KEY"
```

---

## 🚨 Security Best Practices

### 1. **Never Commit Secrets**
```bash
# Add to .gitignore
echo ".env" >> .gitignore
echo "certs/" >> .gitignore
```

### 2. **Use Environment Variables**
```bash
# ❌ BAD - Hardcoded
const mcpCredential = process.env.MCP_API_KEY;

# ✅ GOOD - Environment variable
const mcpCredential = process.env.MCP_API_KEY;
```

### 3. **Rotate API Keys Regularly**
- Change API key every 90 days
- Change immediately if compromised
- Keep old key for transition period

### 4. **Monitor Access Logs**

```bash
# View logs with PM2
pm2 logs revit-mcp-secure

# Or with Docker
docker-compose logs -f revit-mcp
```

Look for:
- 401 (Unauthorized) attempts
- 429 (Rate limit) triggers
- Repeated failures from same IP

### 5. **Firewall Configuration**

**UFW (Ubuntu):**
```bash
# Allow SSH only from office
sudo ufw allow from 203.0.113.0/24 to any port 22

# Allow MCP only from office (redirect via VPN for remote)
sudo ufw allow from 203.0.113.0/24 to any port 3000
sudo ufw deny 3000
```

**Windows Firewall:**
```powershell
# Allow specific IP
New-NetFirewallRule -DisplayName "MCP Server" `
  -Direction Inbound -Action Allow -Protocol TCP `
  -LocalPort 3000 -RemoteAddress 203.0.113.0/24
```

### 6. **VPN for Remote Access**

For remote offices, use VPN instead of exposing directly:
```
Remote Office → VPN → Server IP whitelist check → MCP Server
```

---

## 🔄 Certificate Management

### Self-Signed (Development Only):
```bash
openssl req -x509 -newkey rsa:4096 \
  -keyout certs/server.key \
  -out certs/server.crt \
  -days 365 -nodes
```

### Let's Encrypt (Production):
```bash
sudo certbot certonly --standalone -d your-domain.com

# Copy certificates
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem certs/server.crt
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem certs/server.key
sudo chown $USER:$USER certs/*
```

### Auto-Renewal with Cron:
```bash
# Add to crontab
0 2 * * * certbot renew --quiet && systemctl restart revit-mcp
```

---

## 🆘 Security Incident Response

### If API Key is Compromised:

1. **Immediately**
   ```bash
   # Generate new API key
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   
   # Update environment
   export MCP_API_KEY=replace_me_with_a_secret_from_your_secret_store
   ```

2. **Stop server and restart**
   ```bash
   pm2 restart revit-mcp-secure
   ```

3. **Update Claude Desktop config**
   - Add new key to config
   - Keep old key for 24 hours for transition

4. **Monitor logs**
   ```bash
   pm2 logs revit-mcp-secure | grep "Invalid API key"
   ```

### If Server is Hacked:

1. **Immediate isolation**
   - Unplug from network or block firewall
   - Don't shut down (preserve logs)

2. **Preserve evidence**
   ```bash
   # Backup logs
   cp -r logs/ backup-logs-$(date +%s)/
   pm2 logs revit-mcp-secure > server-logs.txt
   ```

3. **Restart securely**
   ```bash
   # Fresh certificate
   rm certs/*
   npm run setup
   
   # New API key
   export MCP_API_KEY=replace_me_with_a_secret_from_your_secret_store
   ```

---

## 📊 Monitoring & Alerts

### Key Metrics to Monitor:

- **Unauthorized attempts (401)** - Possible attack
- **Rate limit hits (429)** - Possible DoS
- **Certificate expiry** - Set alert 30 days before
- **CPU/Memory usage** - Possible resource exhaustion
- **Response time** - Slow degradation

### Example Monitoring Setup:

```bash
# Watch for unauthorized attempts
watch 'pm2 logs revit-mcp-secure | grep "401\|Unauthorized" | wc -l'

# Check certificate expiry
openssl x509 -in certs/server.crt -noout -dates

# Monitor memory
pm2 monit
```

---

## 🎯 Recommended Setup by Use Case

### For Solo Developer:
```env
MCP_HOST=127.0.0.1
MCP_API_KEY=replace_me_with_a_secret_from_your_secret_store
ENABLE_IP_WHITELIST=false
ENABLE_RATE_LIMIT=true
```

### For Small Team (Same Office):
```env
MCP_HOST=0.0.0.0
MCP_API_KEY=replace_me_with_a_secret_from_your_secret_store
ENABLE_IP_WHITELIST=true
WHITELIST_IPS=10.0.0.0/24
ENABLE_RATE_LIMIT=true
```

### For Enterprise:
```env
MCP_HOST=127.0.0.1            # With VPN only
MCP_API_KEY=replace_me_with_a_secret_from_your_secret_store
ENABLE_IP_WHITELIST=true
WHITELIST_IPS=corporate-vpn-gateway
ENABLE_RATE_LIMIT=true
RATE_LIMIT_REQUESTS=500
```

### For Cloud Hosting:
```env
MCP_HOST=127.0.0.1            # Behind load balancer
MCP_API_KEY=replace_me_with_a_secret_from_your_secret_store
ENABLE_IP_WHITELIST=true
WHITELIST_IPS=load-balancer-ip
ENABLE_RATE_LIMIT=true
# Use Let's Encrypt for certificates
```

---

## 📚 Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Checklist](https://nodejs.org/en/docs/guides/nodejs-security/)
- [TLS/SSL Best Practices](https://wiki.mozilla.org/Security/Server_Side_TLS)
- [HMAC Documentation](https://nodejs.org/api/crypto.html#crypto_class_hmac)

---

## ⚠️ Important Notes

1. **Never share your API key** - Treat it like a password
2. **Use HTTPS only** - Never expose over HTTP
3. **Certificates in production** - Use Let's Encrypt, not self-signed
4. **Monitor logs regularly** - Look for suspicious activity
5. **Keep updated** - Regularly update Node.js and dependencies
6. **Test security** - Regularly test your authentication

---

**Your MCP server is now production-ready and secure!** 🔒🚀
