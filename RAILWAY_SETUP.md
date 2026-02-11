# Railway Deployment Setup

## Quick Deploy to Railway

### 1. Push Changes to GitHub
```bash
git add .
git commit -m "Fix Railway deployment - remove VOLUME, add startup script"
git push origin main
```

### 2. Connect to Railway
1. Go to [railway.app](https://railway.app)
2. Sign in with GitHub
3. Click **New Project**
4. Select **Deploy from GitHub repo**
5. Choose your `revit-mcp` repository

### 3. Configure Environment Variables
In Railway dashboard, go to **Variables** and add:

```env
MCP_API_KEY=c8e331f621c4e46b0be5c9d815a171a261ad2dacff7324cf737bb42442b0094d
MCP_PORT=3000
MCP_HOST=0.0.0.0
NODE_ENV=production
CERT_PATH=./certs/server.crt
KEY_PATH=./certs/server.key
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_MS=60000
ENABLE_IP_WHITELIST=false
```

### 4. Get Your Domain
Railway automatically assigns a domain like:
```
https://your-app-production.up.railway.app
```

Find it in **Settings** → **Networking** → **Public Networking**

### 5. Update Claude Desktop Config
Use your Railway domain in Claude Desktop:

**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "revit": {
      "url": "https://your-app-production.up.railway.app/mcp",
      "transport": {
        "type": "http",
        "headers": {
          "Authorization": "Bearer c8e331f621c4e46b0be5c9d815a171a261ad2dacff7324cf737bb42442b0094d"
        }
      }
    }
  }
}
```

## What Was Fixed

❌ **Before:** `VOLUME ["/app/certs"]` - Railway banned this
✅ **After:** Certificates auto-generated at startup via `start.sh`

❌ **Before:** `CMD ["node", "server.js"]` - Wrong file
✅ **After:** `CMD ["./start.sh"]` - Proper startup with cert generation

## Troubleshooting

**Build fails?**
- Check Railway logs for specific errors
- Ensure all environment variables are set

**Can't connect?**
- Verify your API key is correct in both Railway and Claude config
- Check Railway deployment status is "Active"
- Test with: `curl -k -H "Authorization: Bearer YOUR_API_KEY" https://your-domain.railway.app/status`

**Certificate errors?**
- Railway auto-generates self-signed certs at startup
- This is normal for HTTPS within the container
- Railway provides HTTPS termination at the edge
