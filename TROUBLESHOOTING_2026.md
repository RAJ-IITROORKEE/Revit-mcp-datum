# Revit 2026 Timeout Issues - Troubleshooting Guide

## Problem Summary
Commands timeout in Revit 2026 but work fine in Revit 2024. Plugin logs show only 10 commands loaded, but no command execution logs appear.

## Root Causes Identified

### 1. Missing Command Implementations in DLL
**Issue:** Plugin logs show only 10 commands loaded from RevitMCPCommandSet.dll:
- create_point_based_element
- create_line_based_element
- create_surface_based_element
- color_splash
- tag_walls
- get_selected_elements
- get_available_family_types
- get_current_view_elements
- get_current_view_info
- delete_element

**Expected:** 43+ commands registered in commandRegistry.json

**Impact:** 33 new commands (create_view, create_room, create_dimension, etc.) have no C# implementation in the 2026 DLL

**Solution:** The RevitMCPCommandSet.dll for 2026 needs to be recompiled with all command implementations.

### 2. Socket Communication Not Working
**Issue:** Plugin logs show "Socket service initialized on port 8080" but NO command execution logs when Claude tries to execute commands.

**Symptoms:**
- Commands timeout after 2 minutes
- No "Received command" or "Executing command" entries in logs
- Even basic read operations (get_current_view_info) that work initially start timing out

**Possible Causes:**
- Revit 2026 API requires commands to execute on UI thread via ExternalEvent/IdlingEvent
- Firewall blocking localhost:8080 communication
- Plugin not properly handling JSON-RPC 2.0 format messages
- Socket buffer issues with larger command payloads

## Diagnostic Steps

### Step 1: Verify Socket Connection
1. Open PowerShell and run:
```powershell
Test-NetConnection -ComputerName localhost -Port 8080
```
This should show "TcpTestSucceeded: True" when Revit with plugin is running.

### Step 2: Test Direct Socket Communication
Create a test file `test-socket.js`:
```javascript
const net = require('net');

const client = net.createConnection({ port: 8080, host: 'localhost' }, () => {
  console.log('Connected to Revit plugin');
  
  const command = {
    jsonrpc: "2.0",
    method: "get_current_view_info",
    params: {},
    id: "test123"
  };
  
  client.write(JSON.stringify(command));
  console.log('Sent command:', JSON.stringify(command));
});

client.on('data', (data) => {
  console.log('Received:', data.toString());
  client.end();
});

client.on('error', (err) => {
  console.error('Error:', err);
});

client.setTimeout(10000, () => {
  console.error('Timeout after 10 seconds');
  client.end();
});
```

Run: `node test-socket.js` while Revit 2026 is open with the plugin loaded.

**Expected:** Should receive JSON response within 1-2 seconds  
**If timeout:** Socket communication is broken

### Step 3: Check Plugin DLL Dependencies
Navigate to: `C:\Users\rajra\AppData\Local\revit-mcp-plugin\commands\Commandset\2026\`

Verify these DLLs exist:
- RevitMCPCommandSet.dll (main command implementations)
- RevitMCPSDK.dll
- revit-mcp-sdk.dll
- Nice3point.Revit.Extensions.dll
- Nice3point.Revit.Toolkit.dll
- Newtonsoft.Json.dll

Check file dates - should match when plugin was compiled for 2026.

### Step 4: Compare 2024 vs 2026 DLLs
```powershell
# Compare file sizes
Get-ChildItem "C:\Users\rajra\AppData\Local\revit-mcp-plugin\commands\Commandset\2024\RevitMCPCommandSet.dll" | Select Name, Length, LastWriteTime
Get-ChildItem "C:\Users\rajra\AppData\Local\revit-mcp-plugin\commands\Commandset\2026\RevitMCPCommandSet.dll" | Select Name, Length, LastWriteTime
```

If 2026 DLL is significantly smaller or older than 2024, it may be missing implementations.

### Step 5: Enable Verbose Logging
Check if there's a config file for the plugin that enables debug/verbose logging. File might be at:
- `C:\Users\rajra\AppData\Local\revit-mcp-plugin\config.json`
- `C:\Users\rajra\AppData\Roaming\Autodesk\Revit\Addins\2026\revit-mcp-plugin.addin`

## Immediate Fixes

### Fix 1: Increase MCP Server Timeout
Edit `d:\Web development\MCP\revit-mcp\src\utils\SocketClient.ts` line 143:

Change from:
```typescript
}, 120000); // 2分钟超时
```

To:
```typescript
}, 300000); // 5 minute timeout
```

This gives more time for Revit 2026 to process commands.

### Fix 2: Add Retry Logic
The MCP server could retry failed commands with exponential backoff.

### Fix 3: Use Revit 2024 Temporarily
Until the 2026 DLL issue is resolved, continue using Revit 2024 where commands work properly.

## Long-Term Solutions

### Solution 1: Rebuild Plugin for Revit 2026
The RevitMCPCommandSet.dll needs to be recompiled against Revit 2026 API with:
1. All 43+ command implementations
2. Proper ExternalEvent or IdlingEvent handling for thread safety
3. Updated API calls for Revit 2026 changes

Reference: [Revit 2026 API Changes](https://help.autodesk.com/view/RVT/2026/ENU/?guid=Revit_API_Revit_API_Developers_Guide_Introduction_Changes_and_Additions_html)

### Solution 2: Add Connection Health Checks
Implement periodic ping/pong messages between MCP server and plugin to detect and recover from connection issues.

### Solution 3: Command Queue System
Instead of direct socket calls, implement a command queue that:
1. Queues commands in Revit's IdlingEvent
2. Executes one command per idle cycle
3. Returns results asynchronously

## Revit 2026 Specific Issues

### API Thread Safety
Revit 2026 may have stricter requirements for modifying the model:
- Commands MUST execute within a Transaction
- Commands MUST execute on the main UI thread
- Long operations may need SplitButton or separate ExternalCommand

### Transaction Timeouts
Revit 2026 may have reduced transaction timeouts. Check transaction creation:
```csharp
using (Transaction trans = new Transaction(doc, "Command"))
{
    trans.Start();
    try 
    {
        // Set longer timeout if needed
        FailureHandlingOptions options = trans.GetFailureHandlingOptions();
        options.SetDelayedMiniWarnings(true);
        trans.SetFailureHandlingOptions(options);
        
        // Your code here
        
        trans.Commit();
    }
    catch (Exception ex)
    {
        trans.RollBack();
        throw;
    }
}
```

## Testing Commands

### Test with Simple Commands First
1. **get_current_view_info** - Read only, should always work
2. **get_selected_elements** - Read only with user interaction
3. **create_line_based_element** - Simple write operation

### If Basic Commands Fail
The issue is socket communication or plugin initialization.

### If Only Create/Modify Commands Fail  
The issue is transaction handling or API compatibility with 2026.

## Contact Points

For plugin source code and 2026 compatibility:
- Repository: https://github.com/revit-mcp/revit-mcp-plugin
- Issues: Check for Revit 2026 compatibility issues

## Quick Diagnostic Command

Run this in PowerShell while Revit 2026 is running:
```powershell
# Check if plugin is listening
netstat -ano | Select-String "8080"

# Should show LISTENING on port 8080 with a process ID
# Cross-reference process ID with Revit.exe:
Get-Process | Where-Object {$_.Id -eq <PROCESS_ID>}
```

## Summary

**Primary Issue:** RevitMCPCommandSet.dll for 2026 appears to only have 10 command implementations instead of 43+

**Secondary Issue:** Socket commands not being received/logged by plugin even for implemented commands

**Recommended Action:**
1. Verify socket communication with test script
2. Compare 2024 vs 2026 DLL implementations
3. Contact plugin developer for proper 2026-compiled DLL with all commands
4. Consider using Revit 2024 until 2026 compatibility is confirmed
