# 🏗️ Secure MCP Server - Architecture & Network Diagrams

## Current Architecture (With Security)

### Level 1: Default (Maximum Security - Localhost Only)
```
┌─────────────────────────────────────────────────────────────────┐
│ Internet                                                        │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  │ BLOCKED - Server not listening on public IP
                  │
                  ✗ Connection Failed
                  
┌─────────────────────────────────────────────────────────────────┐
│ Local Machine                                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Claude Desktop                                                │
│  ┌──────────────────────────────────┐                          │
│  │ Authorization: Bearer <API_KEY>  │                          │
│  └────────────┬─────────────────────┘                          │
│               │                                                │
│               │ HTTPS (Encrypted)                             │
│               │                                                │
│               ▼                                                │
│  ┌──────────────────────────────────┐                          │
│  │  server-secure.cjs (Port 3000)   │                          │
│  │  ┌────────────────────────────┐  │                          │
│  │  │ 1. Verify API Key          │  │  ✅ PASS                 │
│  │  │ (Bearer/X-API-Key header)  │  │                          │
│  │  └────────────────────────────┘  │                          │
│  │  ┌────────────────────────────┐  │                          │
│  │  │ 2. Check Rate Limit        │  │  ✅ PASS                 │
│  │  │ (100 req/min per IP)       │  │                          │
│  │  └────────────────────────────┘  │                          │
│  │  ┌────────────────────────────┐  │                          │
│  │  │ 3. Process MCP Request     │  │  ✅ PASS                 │
│  │  │ → Forward to MCP process   │  │                          │
│  │  └────────────────────────────┘  │                          │
│  └────────────────┬─────────────────┘                          │
│                   │                                            │
│                   ▼                                            │
│  ┌──────────────────────────────────┐                          │
│  │  MCP Process (build/index.js)    │                          │
│  │    ↓ Revit Tools ↓               │                          │
│  │    Tools & Data Exchange         │                          │
│  └──────────────────────────────────┘                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

Configuration:
  MCP_HOST=127.0.0.1           (localhost only)
  MCP_PORT=3000
  MCP_API_KEY=replace_me_with_a_secret_from_your_secret_store
  ENABLE_IP_WHITELIST=false
  ENABLE_RATE_LIMIT=true

✅ Perfect for: Solo developers, local machines
✅ Security: MAXIMUM (completely isolated)
```

---

### Level 2: Office Network (IP Whitelist)
```
┌──────────────────────────────────────────────────────────────┐
│ Internet                                                     │
└──────────┬──────────────────────────────────────────────────┘
           │
           ✗ Blocked by Router/Firewall
           
┌──────────────────────────────────────────────────────────────┐
│ Office Network: 192.168.1.0/24                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Office Desktop 1 (192.168.1.100)                           │
│  ┌────────────────────────────────┐                         │
│  │ Authorization: Bearer <KEY>   │                         │
│  └─────────┬──────────────────────┘                         │
│            │ HTTPS                                          │
│            ▼                                                │
│  
│  Office Desktop 2 (192.168.1.101)                           │
│  ┌────────────────────────────────┐                         │
│  │ Authorization: Bearer <KEY>   │                         │
│  └─────────┬──────────────────────┘                         │
│            │ HTTPS                                          │
│            ▼                                                │
│            
│  ┌────────────────────────────────────────────────────┐     │
│  │  MCP Server (192.168.1.50:3000)                    │     │
│  │  ┌──────────────────────────────────────────────┐  │     │
│  │  │ [1] IP Whitelist: 192.168.1.0/24            │  │     │
│  │  │     ✅ 192.168.1.100 - ALLOWED              │  │     │
│  │  │     ✅ 192.168.1.101 - ALLOWED              │  │     │
│  │  │     ❌ Any other IP - BLOCKED               │  │     │
│  │  └──────────────────────────────────────────────┘  │     │
│  │  ┌──────────────────────────────────────────────┐  │     │
│  │  │ [2] Verify API Key                          │  │     │
│  │  │     (Bearer or X-API-Key header)            │  │     │
│  │  └──────────────────────────────────────────────┘  │     │
│  │  ┌──────────────────────────────────────────────┐  │     │
│  │  │ [3] Rate Limit Check                        │  │     │
│  │  │     Per-IP: 100 requests/minute             │  │     │
│  │  └──────────────────────────────────────────────┘  │     │
│  │  ┌──────────────────────────────────────────────┐  │     │
│  │  │ [4] Process MCP Request                     │  │     │
│  │  └──────────────────────────────────────────────┘  │     │
│  └────────────────────────────────────────────────────┘     │
│                                                              │
│ External Attacker (192.168.2.100)                           │
│ ┌────────────────────────────────┐                          │
│ │ Request to 192.168.1.50:3000  │                          │
│ │ ❌ BLOCKED                      │                          │
│ │ Access Denied (Not in whitelist)│                          │
│ └────────────────────────────────┘                          │
│                                                              │
└──────────────────────────────────────────────────────────────┘

Configuration:
  MCP_HOST=0.0.0.0               (all interfaces)
  ENABLE_IP_WHITELIST=true
  WHITELIST_IPS=192.168.1.0/24
  MCP_API_KEY=replace_me_with_a_secret_from_your_secret_store
  ENABLE_RATE_LIMIT=true

✅ Perfect for: Small teams, office networks
✅ Security: VERY HIGH (network + auth + rate limit)
```

---

### Level 3: Remote Access (VPN Protected)
```
┌─────────────────────────────────────────────────────────────┐
│ Remote Location A                                           │
├─────────────────────────────────────────────────────────────┤
│ Desktop with VPN Enabled (10.0.0.100)                       │
│ ┌─────────────────────────────────┐                         │
│ │ Authorization: Bearer <KEY>    │                         │
│ └────────┬────────────────────────┘                         │
│          │                                                  │
└──────────┼──────────────────────────────────────────────────┘
           │ Encrypted VPN Tunnel
           │
┌──────────┼──────────────────────────────────────────────────┐
│          │                                                  │
│          ▼                                                  │
│ ┌──────────────────────┐                                   │
│ │  VPN Gateway         │                                   │
│ │  203.0.113.50        │                                   │
│ └────────┬─────────────┘                                   │
│          │                                                  │
│          │ Internal Network Only                           │
│          │                                                  │
│          ▼                                                  │
│ ┌──────────────────────────────────────────────────────┐   │
│ │  MCP Server (127.0.0.1:3000)                         │   │
│ │  Only accessible via localhost/127.0.0.1            │   │
│ │  ┌────────────────────────────────────────────────┐ │   │
│ │  │ [1] IP Whitelist: 203.0.113.50 (VPN Gateway)  │ │   │
│ │  │     ✅ VPN connections - ALLOWED               │ │   │
│ │  │     ❌ Direct internet - BLOCKED               │ │   │
│ │  └────────────────────────────────────────────────┘ │   │
│ │  ┌────────────────────────────────────────────────┐ │   │
│ │  │ [2] Verify API Key                            │ │   │
│ │  └────────────────────────────────────────────────┘ │   │
│ │  ┌────────────────────────────────────────────────┐ │   │
│ │  │ [3] Rate Limit Check                          │ │   │
│ │  │     Per-IP: 100 requests/minute               │ │   │
│ │  └────────────────────────────────────────────────┘ │   │
│ │  ┌────────────────────────────────────────────────┐ │   │
│ │  │ [4] Process MCP Request                       │ │   │
│ │  └────────────────────────────────────────────────┘ │   │
│ └────────────────────────────────────────────────────────┘ │
│                                                            │
└────────────────────────────────────────────────────────────┘

External Attacker (Random Internet Address)
│
├─ Tries to access VPN gateway directly
│  ❌ BLOCKED - VPN authentication required
│
├─ Knows server IP from somewhere
│  ❌ BLOCKED - Server only listens on 127.0.0.1
│  ❌ BLOCKED - Not whitelisted IP
│
└─ Somehow bypasses VPN and gets to 127.0.0.1
   ❌ BLOCKED - No valid API key

Configuration:
  MCP_HOST=127.0.0.1             (VPN/bastion only)
  ENABLE_IP_WHITELIST=true
  WHITELIST_IPS=203.0.113.50     (VPN gateway)
  MCP_API_KEY=replace_me_with_a_secret_from_your_secret_store
  ENABLE_RATE_LIMIT=true

✅ Perfect for: Enterprise, distributed teams
✅ Security: EXCELLENT (VPN + localhost + auth + whitelist)
```

---

## Request Flow Diagram

### Successful Request
```
1. Client prepares request
   ├─ URL: https://server:3000/mcp
   ├─ Header: Authorization: Bearer <API_KEY>
   └─ Method: POST
   
2. Network Layer (TLS 1.2+)
   └─ HTTPS Encryption
   
3. Server-secure.js receives request
   ├─ [CHECK 1] GET CLIENT IP
   │  └─ IP = 192.168.1.100
   │
   ├─ [CHECK 2] IP WHITELIST?
   │  ├─ Enabled: true
   │  ├─ Whitelist: 192.168.1.0/24
   │  └─ ✅ PASS (192.168.1.100 in range)
   │
   ├─ [CHECK 3] RATE LIMIT?
   │  ├─ Requests from 192.168.1.100: 45/100
   │  └─ ✅ PASS (below limit)
   │
   ├─ [CHECK 4] VERIFY API KEY
   │  ├─ Received: a7f3d2c1e8b9...
   │  ├─ Expected: a7f3d2c1e8b9...
   │  ├─ Timing-safe comparison: TRUE
   │  └─ ✅ PASS
   │
   └─ [PROCESS] Forward to MCP
      ├─ Write to stdin
      ├─ MCP processes request
      └─ Return response
      
4. Response sent
   ├─ Status: 200 OK
   ├─ Security headers added
   ├─ HTTPS encrypted
   └─ ✅ Delivered to client
```

### Failed Request (Invalid API Key)
```
1. Client sends request
   ├─ URL: https://server:3000/mcp
   ├─ Header: Authorization: Bearer WRONG_KEY
   └─ Method: POST
   
2. Network Layer
   └─ HTTPS Encryption ✅
   
3. Server checks
   ├─ [CHECK 1] GET CLIENT IP
   │  └─ IP = 192.168.1.101 ✅
   │
   ├─ [CHECK 2] IP WHITELIST?
   │  └─ ✅ PASS (in whitelist)
   │
   ├─ [CHECK 3] RATE LIMIT?
   │  └─ ✅ PASS
   │
   ├─ [CHECK 4] VERIFY API KEY
   │  ├─ Received: WRONG_KEY
   │  ├─ Expected: a7f3d2c1e8b9...
   │  ├─ Comparison: FALSE
   │  ├─ Logging: "[Security] Invalid API key attempt from 192.168.1.101"
   │  └─ ❌ FAIL
   │
   └─ [REJECT] Send error response
      
4. Response sent
   ├─ Status: 401 Unauthorized
   ├─ Body: {"error": "Unauthorized - Invalid API key"}
   ├─ Log: Security warning
   └─ ✅ Connection closed
```

---

## Attack Prevention Matrix

| Attack Type | Basic Server | Secure Server | Prevention Method |
|------------|--------------|---------------|-------------------|
| **URL Scanning** | ❌ Vulnerable | ✅ Protected | API Key Required |
| **Brute Force Key** | ❌ Vulnerable | ✅ Protected | Rate Limiting |
| **MITM Attack** | ❌ Vulnerable | ✅ Protected | HTTPS/TLS |
| **Timing Attack** | ❌ Vulnerable | ✅ Protected | Timing-Safe Comparison |
| **IP Spoofing** | ❌ Vulnerable | ✅ Protected | IP Whitelist |
| **Replay Attack** | ❌ Vulnerable | ✅ Protected | HTTPS Session |
| **DoS Attack** | ❌ Vulnerable | ✅ Protected | Rate Limiting |
| **Public Access** | ❌ Vulnerable | ✅ Protected | Localhost Default + Auth |

---

## Configuration Decision Tree

```
START
 │
 ├─ Are you deploying to production?
 │  ├─ NO: Skip to "LOCAL DEVELOPMENT"
 │  └─ YES: Continue...
 │
 ├─ Will only localhost access it?
 │  ├─ YES: Use config "LEVEL 1"
 │  └─ NO: Continue...
 │
 ├─ Is everyone in the same office building?
 │  ├─ YES: Use config "LEVEL 2"
 │  └─ NO: Continue...
 │
 ├─ Do you have a VPN/Bastion server?
 │  ├─ YES: Use config "LEVEL 3"
 │  └─ NO: STOP - Set up VPN first
 │
 └─ END: Proceed with deployment


LOCAL DEVELOPMENT SETTINGS:
  MCP_HOST=127.0.0.1
  ENABLE_IP_WHITELIST=false
  ENABLE_RATE_LIMIT=true (but high limit for testing)
  Use self-signed certificates

LEVEL 1 SETTINGS (Localhost):
  MCP_HOST=127.0.0.1
  API_KEY=replace_me_with_a_secret_from_your_secret_store
  ENABLE_IP_WHITELIST=false
  ENABLE_RATE_LIMIT=true
  Minimal configuration needed

LEVEL 2 SETTINGS (Office Network):
  MCP_HOST=0.0.0.0
  API_KEY=replace_me_with_a_secret_from_your_secret_store
  ENABLE_IP_WHITELIST=true
  WHITELIST_IPS=<office-subnet>
  Use Let's Encrypt certificates

LEVEL 3 SETTINGS (Enterprise):
  MCP_HOST=127.0.0.1
  API_KEY=replace_me_with_a_secret_from_your_secret_store
  ENABLE_IP_WHITELIST=true
  WHITELIST_IPS=<vpn-gateway>
  Use Let's Encrypt certificates
  Monitor and log all access
```

---

## Security Layers Visualization

```
                    SECURITY LAYERS
                    
        ╔═══════════════════════════════════╗
        ║  Layer 1: SSL/TLS Encryption      ║  (HTTPS)
        ║  Protects: Data in transit        ║
        ╚═══════════════════════════════════╝
                        ▲
                        │ (encrypted data only)
                        │
        ╔═══════════════════════════════════╗
        ║  Layer 2: API Key Authentication  ║  (Authorization header)
        ║  Protects: Unauthorized access    ║
        ╚═══════════════════════════════════╝
                        ▲
                        │ (authenticated users only)
                        │
        ╔═══════════════════════════════════╗
        ║  Layer 3: IP Whitelist            ║  (Optional)
        ║  Protects: Unknown networks       ║
        ╚═══════════════════════════════════╝
                        ▲
                        │ (whitelisted IPs only)
                        │
        ╔═══════════════════════════════════╗
        ║  Layer 4: Rate Limiting           ║  (Per-IP throttling)
        ║  Protects: Brute force / DoS      ║
        ╚═══════════════════════════════════╝
                        ▲
                        │ (rate limit OK)
                        │
        ╔═══════════════════════════════════╗
        ║  Layer 5: Default Localhost       ║  (127.0.0.1)
        ║  Protects: Public internet access ║
        ╚═══════════════════════════════════╝
                        ▲
                        │ (localhost only by default)
                        │
                    ✅ REQUEST PROCESSED
```

---

## Key Features Comparison

### TLS encryption (✅ Basic + Secure)
- Protects data in transit
- Requires HTTPS certificate
- Version: 1.2+ required

### API Key Authentication (✅ Secure ONLY)
- Every request verified
- Bearer token or X-API-Key header
- Timing-safe comparison

### IP Whitelist (✅ Secure - Optional)
- Can restrict to office/VPN network
- Supports CIDR notation
- Localhost always allowed

### Rate Limiting (✅ Secure - Optional)
- Limits per IP/time window
- Prevents brute force
- Configurable requests/window

### Default Localhost (✅ Secure)
- Bound to 127.0.0.1 only
- Zero public internet exposure
- Can be changed for remote access

### Security Headers (✅ Secure)
- X-Content-Type-Options
- X-Frame-Options  
- Strict-Transport-Security
- X-XSS-Protection

---

**Architecture is production-ready and secure!** 🔒✨
