# Railway Configuration Guide

## ✅ What You Need to Set in Railway

### 1. Environment Variables (Required)

Go to your Railway project → **Variables** tab → Add these:

```env
MCP_API_KEY=replace_me_with_a_secret_from_your_secret_store
NODE_ENV=production
MCP_HOST=0.0.0.0
ENABLE_IP_WHITELIST=false
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_MS=60000
```

**Note:** Railway automatically sets `PORT` - **DO NOT set it manually!**

### 2. Domain (Automatic - No Action Needed)

Railway automatically provides:
- **Free subdomain:** `your-app-production.up.railway.app`
- Find it: **Settings** → **Networking** → **Public Networking**
- Click **Generate Domain** if not visible

**Custom domain (Optional):**
- **Settings** → **Networking** → **Custom Domains**
- Enter your domain (e.g., `api.yourdomain.com`)
- Add CNAME record in your DNS provider

### 3. Port Configuration (Automatic)

✅ **Railway automatically sets the PORT** environment variable
✅ **Your app listens on:** `process.env.PORT` (already configured)
✅ **You don't need to configure anything!**

Railway's port is dynamic and changes per deployment - your app auto-detects it.

---

## 🚀 After Deployment

### Step 1: Get Your Domain
1. Go to Railway dashboard
2. Click your project
3. Go to **Settings** → **Networking**
4. Copy the domain (e.g., `revit-mcp-production.up.railway.app`)

### Step 2: Test Your Server
```bash
curl -k -H "Authorization: Bearer YOUR_MCP_API_KEY" \
  https://your-domain.railway.app/status
```

Expected response:
```json
{
  "status": "healthy",
  "uptime": 123.456,
  "authenticated": true
}
```

### Step 3: Update Claude Desktop Config

**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
**Mac:** `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "revit": {
      "url": "https://your-domain.railway.app/mcp",
      "transport": {
        "type": "http",
        "headers": {
          "Authorization": "Bearer YOUR_MCP_API_KEY"
        }
      }
    }
  }
}
```

Replace `your-domain.railway.app` with your actual Railway domain.

---

## 🔧 Troubleshooting

### "Application failed to respond"
- Check Railway logs for errors
- Verify environment variables are set (especially `MCP_API_KEY`)
- Ensure `MCP_HOST=0.0.0.0` (not 127.0.0.1)

### "Port already in use"
- Railway handles ports automatically - do NOT set PORT manually
- Delete any PORT variable you added

### "Connection refused"
- Check if deployment is active (green status in Railway)
- Wait 1-2 minutes after deployment completes
- Test with curl command above

### Certificate errors when testing locally
- Normal! Railway provides its own HTTPS termination
- Your app uses self-signed certs internally
- Railway exposes clean HTTPS to the public

---

## 📝 Summary

✅ **Domain:** Railway auto-generates (e.g., `your-app.railway.app`)
✅ **Port:** Railway auto-sets (app uses `process.env.PORT`)
✅ **HTTPS:** Railway provides SSL certificate automatically
✅ **API Key:** Set in Variables tab: `MCP_API_KEY=replace_me_with_a_secret_from_your_secret_store

**You're done! Just add environment variables and get your domain.**
