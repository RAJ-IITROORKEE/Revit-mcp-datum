# 🚀 START HERE - Quick Setup Guide

## 1️⃣ Auto-Setup (Recommended - 5 minutes)

### Windows
```bash
./quick-setup-secure.bat
```

### Linux/Mac
```bash
chmod +x quick-setup-secure.sh
./quick-setup-secure.sh
```

**This script automatically:**
1. ✅ Generates a **random 64-character API key**
2. ✅ Creates SSL/TLS certificates
3. ✅ Generates `.env` configuration file
4. ✅ Installs dependencies

Your API key will be displayed at the end and saved in `.env` file.

---

## 2️⃣ Configure Claude Desktop

Open Claude config file:
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Mac**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

Add this configuration:
```json
{
  "mcpServers": {
    "revit-mcp": {
      "url": "https://localhost:3000",
      "env": {
        "Authorization": "Bearer YOUR_API_KEY_HERE"
      }
    }
  }
}
```

**Get API Key from**: Your `.env` file (line: `MCP_API_KEY=replace_me_with_a_secret_from_your_secret_store

---

## 3️⃣ Start the Server

```bash
# Option A: Direct Node.js
node server-secure.cjs

# Option B: PM2 (Recommended for production)
npm install -g pm2
pm2 start ecosystem-secure.config.cjs
pm2 logs revit-mcp-secure
```

---

## 4️⃣ Test the Connection

```bash
# Health check (no auth)
curl -k https://localhost:3000/health

# Status check (requires your API key)
curl -k https://localhost:3000/status -H "X-API-Key: YOUR_API_KEY"
```

---

## ❓ How is the API Key Generated?

### Automatic (Easiest)
When you run `./quick-setup-secure.bat` or `.sh`, it:
1. Runs: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
2. Creates a random 64-character hex string
3. Saves it to `.env` automatically
4. Displays it on screen

**Example:** `a7f3d2c1e8b9f4a5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7`

### Manual (If Needed)
```bash
# Generate new key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Copy output to .env file:
MCP_API_KEY=replace_me_with_a_secret_from_your_secret_store

# Restart server
```

---

## 🔧 Configuration Options

Edit `.env` file to customize:

### Localhost Only (Default - Most Secure)
```env
MCP_HOST=127.0.0.1
MCP_API_KEY=replace_me_with_a_secret_from_your_secret_store
ENABLE_IP_WHITELIST=false
ENABLE_RATE_LIMIT=true
```

### Office Network
```env
MCP_HOST=0.0.0.0
MCP_API_KEY=replace_me_with_a_secret_from_your_secret_store
ENABLE_IP_WHITELIST=true
WHITELIST_IPS=192.168.1.0/24
ENABLE_RATE_LIMIT=true
```

### Custom Port
```env
MCP_PORT=3001  # Change from 3000 if needed
```

---

## 🔒 What's Secured?

| Threat | Protection |
|--------|-----------|
| Unauthorized access | API key required |
| Data interception | HTTPS/TLS encrypted |
| Brute force attacks | Rate limiting |
| External network attacks | IP whitelist option |
| Public internet exposure | Localhost default |

---

## 🆘 Troubleshooting

### "Invalid API Key"
```bash
# Check your API key
grep MCP_API_KEY .env

# Update Claude config with correct key
```

### "Port 3000 already in use"
```bash
# Change port in .env:
MCP_PORT=3001

# Restart server
```

### "Certificate not found"
```bash
# Regenerate certificates
rm -r certs/
./quick-setup-secure.bat (or .sh)
```

### "Connection refused"
```bash
# Verify server is running
node server-secure.cjs

# Check if port is listening
netstat -ano | findstr :3000  # Windows
lsof -i :3000               # Mac/Linux
```

---

## ✅ What You Get

After setup:
- ✅ Secure HTTPS MCP server on `https://localhost:3000`
- ✅ API key authentication (auto-generated, 64 chars)
- ✅ SSL/TLS certificates
- ✅ Rate limiting (100 requests/minute)
- ✅ Security headers
- ✅ Production-ready configuration

---

## 📖 Need More Info?

- **Deploy to production?** → See `SECURE_DEPLOYMENT_GUIDE.md` (in /docs folder)
- **Security details?** → See `SECURITY_GUIDE.md` (in /docs folder)
- **Network diagrams?** → See `ARCHITECTURE.md` (in /docs folder)

---

## 🎯 Summary

```bash
# 1. Auto-setup (generates API key automatically)
./quick-setup-secure.bat  # or .sh

# 2. Get API key from .env
grep MCP_API_KEY .env

# 3. Update Claude config (paste API key)

# 4. Start server
node server-secure.cjs

# 5. Done! 🎉
```

**API key is auto-generated and saved to `.env` file!**
