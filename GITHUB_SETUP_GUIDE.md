# GitHub Usage & Setup Guide

## ⚡ Quick Start (5 minutes)

### 1. Clone the Repository
```bash
git clone https://github.com/RAJ-IITROORKEE/revit-mcp-datum.git
cd revit-mcp
```

### 2. Choose Your Setup

#### For Local Development (Localhost Only)
```bash
# Windows
./quick-setup-secure.bat

# Linux/Mac
chmod +x quick-setup-secure.sh
./quick-setup-secure.sh
```

#### For Remote/Network Access
```bash
# Same setup as above, then edit .env
nano .env  # or your favorite editor

# Configure:
MCP_HOST=0.0.0.0                    # Allow network access
ENABLE_IP_WHITELIST=true
WHITELIST_IPS=192.168.1.0/24        # Your office network
```

### 3. Start the Server

#### Option A: Direct Node.js
```bash
node server-secure.js
```

#### Option B: PM2 (Recommended)
```bash
npm install -g pm2
pm2 start ecosystem-secure.config.js
pm2 logs revit-mcp-secure
```

#### Option C: Docker
```bash
docker-compose up -d
docker-compose logs -f revit-mcp
```

### 4. Configure Claude Desktop

Edit `%APPDATA%\Claude\claude_desktop_config.json` (Windows) or equivalent on Mac/Linux:

```json
{
  "mcpServers": {
    "revit-mcp": {
      "url": "https://your-server-ip:3000",
      "env": {
        "Authorization": "Bearer YOUR_API_KEY_HERE"
      }
    }
  }
}
```

**API Key Location**: Check your `.env` file after running setup script

---

## 📋 Setup Options Explained

| Setup Type | Best For | Command | Security |
|-----------|---------|---------|----------|
| **Localhost Only** | Solo developers | `./quick-setup-secure.bat` | 🟢 Max |
| **Office Network** | Small teams | Edit `.env` + `ENABLE_IP_WHITELIST=true` | 🟢 Very High |
| **VPN Protected** | Enterprise | + `WHITELIST_IPS=vpn-gateway` | 🟢 Excellent |
| **Cloud Hosted** | Remote teams | Use Let's Encrypt certs | 🟢 Production |

---

## 🔒 Security Features

✅ **API Key Authentication** - All requests require valid API key  
✅ **HTTPS Encryption** - TLS 1.2+  
✅ **IP Whitelist** - Optional, restrict by network/VPN  
✅ **Rate Limiting** - 100 requests/minute (configurable)  
✅ **Security Headers** - Complete set included  
✅ **Localhost Default** - Zero public exposure by default  

---

## 📚 Available Documentation

### Getting Started
- `SECURITY_OVERVIEW.md` ⭐ **Start here** - Quick reference
- `SETUP_COMPLETE.md` - Setup summary
- `WHAT_IS_NEW_SECURITY.md` - What changed

### Detailed Guides
- `SECURITY_GUIDE.md` - Deep dive into all features
- `SECURE_DEPLOYMENT_GUIDE.md` - 4 deployment scenarios
- `ARCHITECTURE.md` - Network diagrams

### Original Setup (Basic Hosting)
- `MCP_HOSTING_GUIDE.md` - Hosting documentation
- `DEPLOYMENT_GUIDE.md` - Deployment options
- `HTTPS_SETUP_SUMMARY.md` - HTTPS setup

---

## 🛠️ Configuration Files

### Secure Version (Recommended)
- `server-secure.js` - Enhanced server with auth
- `ecosystem-secure.config.js` - PM2 config for secure server
- `.env.secure-example` - Secure config template
- `quick-setup-secure.bat/sh` - Automated setup

### Basic Version (For Reference)
- `server.js` - Basic HTTPS wrapper
- `ecosystem.config.js` - Basic PM2 config
- `.env.example` - Basic config template

---

## 🚀 Common Deployment Scenarios

### Scenario 1: Personal Machine
```bash
./quick-setup-secure.bat
node server-secure.js
```
**Security**: 🟢 Maximum

---

### Scenario 2: Office Team
```bash
./quick-setup-secure.bat

# Edit .env:
MCP_HOST=0.0.0.0
ENABLE_IP_WHITELIST=true
WHITELIST_IPS=192.168.1.0/24

pm2 start ecosystem-secure.config.js
```
**Security**: 🟢 Very High

---

### Scenario 3: Remote VPN Access
```bash
./quick-setup-secure.bat

# Edit .env:
MCP_HOST=127.0.0.1
ENABLE_IP_WHITELIST=true
WHITELIST_IPS=vpn-gateway-ip

pm2 start ecosystem-secure.config.js
```
**Security**: 🟢 Excellent

---

### Scenario 4: Cloud Deployment
```bash
# Follow SECURE_DEPLOYMENT_GUIDE.md

# Use Let's Encrypt certificate
# Configure firewall for your domain
# Set up monitoring/logging
```
**Security**: 🟢 Production-Ready

---

## 🔐 First Time Setup Checklist

- [ ] Clone repository
- [ ] Run `./quick-setup-secure.bat` (or `.sh`)
- [ ] Save your API key from .env
- [ ] Review `.env` configuration
- [ ] Add `.env` is in `.gitignore` (already done)
- [ ] Start server with PM2 or direct Node.js
- [ ] Test with `curl -k https://localhost:3000/health`
- [ ] Update Claude config with API key
- [ ] Test Claude connection

---

## 🔄 Regular Maintenance

### Monthly
- Check logs for suspicious activity
- Verify certificate expiry (if using Let's Encrypt)

### Every 90 Days
- **Rotate API key**
  ```bash
  # Generate new key
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  
  # Update .env
  # Restart server
  # Update Claude config
  ```

### Quarterly
- Review security settings
- Update Node.js dependencies
  ```bash
  npm update
  ```

---

## 🐛 Troubleshooting

### "Invalid API Key" Error
```bash
# Get key from .env
grep MCP_API_KEY .env

# Update Claude config with correct key
```

### "Rate Limit Exceeded"
```bash
# Edit .env:
RATE_LIMIT_REQUESTS=200    # Increase limit
ENABLE_RATE_LIMIT=false    # Or disable (not recommended)
```

### "Connection Refused" / "Port Already in Use"
```bash
# Check if port 3000 is in use
netstat -ano | findstr :3000  # Windows
lsof -i :3000               # Mac/Linux

# Kill process or change port in .env:
MCP_PORT=3001
```

### Certificate Errors
```bash
# Check certificate expiry
openssl x509 -in certs/server.crt -noout -dates

# Regenerate if expired
rm certs/*
openssl req -x509 -newkey rsa:4096 -keyout certs/server.key -out certs/server.crt -days 365 -nodes
```

---

## 📞 Support & Questions

- Check `SECURITY_OVERVIEW.md` for quick answers
- See `SECURITY_GUIDE.md` for detailed explanations
- Review `SECURE_DEPLOYMENT_GUIDE.md` for your scenario
- Check `ARCHITECTURE.md` for technical details

---

## 🔗 Related Documentation

- [Model Context Protocol (MCP) Docs](https://modelcontextprotocol.io)
- [Node.js HTTP Module](https://nodejs.org/api/https.html)
- [PM2 Documentation](https://pm2.keymetrics.io)
- [Docker Documentation](https://docs.docker.com)

---

## ✅ Status

Your MCP server is ready for:
- ✅ Local development
- ✅ Office network deployment
- ✅ Docker containerization
- ✅ Cloud hosting
- ✅ Enterprise setups

All with **production-grade security** built-in! 🔒✨
