@echo off
REM Revit MCP Server - Secure Setup for Windows

setlocal enabledelayedexpansion

echo ================================
echo Revit MCP Server - Secure Setup
echo ================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed. Please install Node.js 18+ first.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo [OK] Node.js found: %NODE_VERSION%
echo.

REM Create directories
echo [*] Creating necessary directories...
if not exist "certs" mkdir certs
if not exist "logs" mkdir logs

REM Check if certificates exist
if not exist "certs\server.crt" (
    echo.
    echo [*] SSL certificates not found. Generating self-signed certificate...
    echo.
    echo Please provide information for the SSL certificate:
    echo (For development, press Enter to use defaults)
    echo.
    pause
    
    REM Check if OpenSSL is installed
    where openssl >nul 2>nul
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] OpenSSL is not installed.
        echo Please install it from: https://slproweb.com/products/Win32OpenSSL.html
        pause
        exit /b 1
    )
    
    openssl req -x509 -newkey rsa:4096 -keyout certs\server.key -out certs\server.crt -days 365 -nodes
    
    if %ERRORLEVEL% EQU 0 (
        echo.
        echo [OK] Certificate generated!
    ) else (
        echo [ERROR] Failed to generate certificate
        pause
        exit /b 1
    )
) else (
    echo [OK] SSL certificates found
)

echo.
echo [*] Installing dependencies...
call npm install

if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo [*] Generating API key...
for /f "tokens=*" %%i in ('node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"') do set API_KEY=%%i

echo.
echo ================================
echo IMPORTANT - Save Your API Key!
echo ================================
echo.
echo Your generated API key:
echo   %API_KEY%
echo.
echo Copy this to your .env file as MCP_API_KEY
echo.

REM Create .env file
if not exist ".env" (
    echo [*] Creating .env file...
    (
        echo # Auto-generated secure configuration
        echo MCP_PORT=3000
        echo MCP_HOST=127.0.0.1
        echo CERT_PATH=./certs/server.crt
        echo KEY_PATH=./certs/server.key
        echo NODE_ENV=production
        echo MCP_API_KEY=%API_KEY%
        echo ENABLE_IP_WHITELIST=false
        echo ENABLE_RATE_LIMIT=true
        echo RATE_LIMIT_REQUESTS=100
        echo RATE_LIMIT_WINDOW=60000
    ) > .env
    echo [OK] .env file created
) else (
    echo [WARNING] .env file already exists. Update MCP_API_KEY manually if needed.
)

echo.
echo ================================
echo Setup Complete!
echo ================================
echo.
echo Next steps:
echo.
echo 1. Review and customize .env file:
echo    - Update API key if needed
echo    - Set MCP_HOST if you need remote access
echo    - Configure IP whitelist and rate limiting
echo.
echo 2. Start the secure server:
echo.
echo    Option A - Direct execution:
echo      $env:MCP_API_KEY = "!API_KEY!"
echo      node server-secure.js
echo.
echo    Option B - Using PM2:
echo      npm install -g pm2
echo      pm2 start ecosystem-secure.config.js
echo      pm2 logs revit-mcp-secure
echo.
echo 3. Update Claude Desktop config:
echo.
echo    File: %%APPDATA%%\Claude\claude_desktop_config.json
echo.
echo    Add:
echo      "revit-mcp": {
echo        "url": "https://localhost:3000",
echo        "env": {
echo          "Authorization": "Bearer !API_KEY!"
echo        }
echo      }
echo.
echo 4. Test the connection:
echo.
echo    curl -k https://localhost:3000/health
echo    curl -k https://localhost:3000/status -H "X-API-Key: !API_KEY!"
echo.
echo 5. For production deployment:
echo    - Replace self-signed certs with Let's Encrypt
echo    - Set strong API key (consider monthly rotation)
echo    - Enable IP whitelist if possible
echo    - Configure firewall rules
echo    - See SECURITY_GUIDE.md for best practices
echo.
echo API Key: !API_KEY!
echo.
echo [IMPORTANT] Keep your API key SECRET!
echo [IMPORTANT] Add .env to .gitignore
echo.
pause
