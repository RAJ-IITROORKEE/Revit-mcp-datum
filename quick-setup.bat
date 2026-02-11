@echo off
REM Revit MCP Server - Quick Start Guide for Windows

setlocal enabledelayedexpansion

echo ================================
echo Revit MCP Server - Quick Setup
echo ================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Node.js is not installed. Please install Node.js 18+ first.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo ✓ Node.js found: %NODE_VERSION%
echo.

REM Create directories
echo 📁 Creating necessary directories...
if not exist "certs" mkdir certs
if not exist "logs" mkdir logs

REM Check if certificates exist
if not exist "certs\server.crt" (
    echo.
    echo 🔐 SSL certificates not found. Generating self-signed certificate...
    echo.
    echo.
    echo For self-signed development, you can use default values for most prompts.
    echo When asked for "Common Name (CN)", enter your server IP or domain.
    echo.
    pause
    
    REM Check if OpenSSL is installed
    where openssl >nul 2>nul
    if %ERRORLEVEL% NEQ 0 (
        echo ⚠️  OpenSSL is not installed. Please install it from: https://slproweb.com/products/Win32OpenSSL.html
        echo Then run this script again.
        pause
        exit /b 1
    )
    
    openssl req -x509 -newkey rsa:4096 -keyout certs\server.key -out certs\server.crt -days 365 -nodes
    
    if %ERRORLEVEL% EQU 0 (
        echo.
        echo ✓ Certificate generated!
    ) else (
        echo ❌ Failed to generate certificate
        pause
        exit /b 1
    )
) else (
    echo ✓ SSL certificates found
)

echo.
echo 📦 Installing dependencies...
call npm install

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✓ Setup complete!
) else (
    echo ❌ Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo ================================
echo Next Steps:
echo ================================
echo.
echo Option 1 - Direct Execution (PowerShell):
echo.   $env:MCP_PORT = "3000"
echo.   $env:CERT_PATH = "./certs/server.crt"
echo.   $env:KEY_PATH = "./certs/server.key"
echo.   node server.js
echo.
echo Option 2 - Using PM2:
echo.   npm install -g pm2
echo.   pm2 start ecosystem.config.js
echo.   pm2 logs revit-mcp
echo.
echo Option 3 - Using Docker:
echo.   docker build -t revit-mcp:latest .
echo.   docker run -d -p 3000:3000 -v %cd%\certs:/app/certs revit-mcp:latest
echo.
echo Option 4 - Using Docker Compose:
echo.   docker-compose up -d
echo.
echo Testing:
echo.   curl -k https://localhost:3000/health
echo.
echo ================================
echo Configuration:
echo ================================
echo.
echo Update your Claude Desktop config file with:
echo.   "revit-mcp": { "url": "https://your-domain-or-ip:3000" }
echo.
echo The config is typically located at:
echo.   %%APPDATA%%\Claude\claude_desktop_config.json
echo.
pause
