# Test proxy with detailed logging
Write-Output "Testing proxy connection to Railway..."
Write-Output ""

$testMessage = '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'

Write-Output "Sending initialize request..."
$testMessage | node "D:\Web development\MCP\revit-mcp\claude-proxy.js" 2>&1 | ForEach-Object {
    if ($_ -match '^\[Proxy\]') {
        Write-Host $_ -ForegroundColor Cyan
    } elseif ($_ -match 'error|Error|ERROR') {
        Write-Host $_ -ForegroundColor Red
    } elseif ($_ -match '\{.*\}') {
        Write-Host $_ -ForegroundColor Green
    } else {
        Write-Host $_
    }
}
