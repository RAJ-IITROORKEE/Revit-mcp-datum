@echo off
REM Revit MCP Server - Health Check and Diagnostic Script for Windows

setlocal enabledelayedexpansion

echo ================================
echo Revit MCP Server Diagnostics
echo ================================
echo.

REM Check Node.js
echo Checking Node.js...
where node >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
    echo   [OK] !NODE_VERSION!
) else (
    echo   [FAIL] Node.js not found
)

REM Check npm
echo Checking npm...
where npm >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i
    echo   [OK] !NPM_VERSION!
) else (
    echo   [FAIL] npm not found
)

REM Check certificates
echo.
echo Checking SSL Certificates...
if exist "certs\server.crt" (
    echo   [OK] server.crt found
) else (
    echo   [FAIL] server.crt not found
)

if exist "certs\server.key" (
    echo   [OK] server.key found
) else (
    echo   [FAIL] server.key not found
)

REM Check directories
echo.
echo Checking directories...
if exist "build" (
    echo   [OK] build/ directory found
) else (
    echo   [FAIL] build/ directory not found
)

if exist "logs" (
    echo   [OK] logs/ directory found
) else (
    echo   [FAIL] logs/ directory not found
)

REM Check required files
echo.
echo Checking required files...
if exist "server.js" (
    echo   [OK] server.js found
) else (
    echo   [FAIL] server.js not found
)

if exist "build\index.js" (
    echo   [OK] build\index.js found
) else (
    echo   [FAIL] build\index.js not found
)

if exist "package.json" (
    echo   [OK] package.json found
) else (
    echo   [FAIL] package.json not found
)

REM Check environment variables
echo.
echo Environment variables...
if not defined MCP_PORT (
    echo   MCP_PORT: [not set - using default 3000]
) else (
    echo   MCP_PORT: !MCP_PORT!
)

if not defined MCP_HOST (
    echo   MCP_HOST: [not set - using default 0.0.0.0]
) else (
    echo   MCP_HOST: !MCP_HOST!
)

if not defined CERT_PATH (
    echo   CERT_PATH: [not set - using default ./certs/server.crt]
) else (
    echo   CERT_PATH: !CERT_PATH!
)

if not defined KEY_PATH (
    echo   KEY_PATH: [not set - using default ./certs/server.key]
) else (
    echo   KEY_PATH: !KEY_PATH!
)

REM Check if port is in use
echo.
echo Checking port availability...
set PORT=3000
if not "%MCP_PORT%"=="" set PORT=%MCP_PORT%

netstat -ano | findstr :%PORT% >nul
if %ERRORLEVEL% EQU 0 (
    echo   [WARNING] Port %PORT% appears to be in use
) else (
    echo   [OK] Port %PORT% is available
)

echo.
echo ================================
echo Testing server connectivity...
echo ================================
echo.

REM Start server in background
echo Starting MCP server...
start /min cmd /c "node server.js > logs\test.log 2>&1"

REM Wait for server to start
echo Waiting for server to start (5 seconds)...
timeout /t 5 /nobreak >nul

REM Test health endpoint
echo.
echo Testing /health endpoint...
curl -k https://localhost:3000/health 2>nul
if %ERRORLEVEL% EQU 0 (
    echo   [OK] Health check passed
) else (
    echo   [FAIL] Health check failed
)

REM Test status endpoint
echo.
echo Testing /status endpoint...
curl -k https://localhost:3000/status 2>nul
if %ERRORLEVEL% EQU 0 (
    echo   [OK] Status check passed
) else (
    echo   [FAIL] Status check failed
)

echo.
echo ================================
echo Stopping server...
echo ================================
taskkill /F /IM node.exe >nul 2>&1

echo.
echo Diagnostics complete!
echo.
echo For more information, check:
echo   logs\test.log - Server output
echo   logs\err.log - Error logs
echo   logs\out.log - Output logs
echo.
pause
