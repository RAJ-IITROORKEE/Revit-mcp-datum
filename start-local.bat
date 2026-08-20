@echo off
echo Starting revit-mcp locally in relay mode...
echo.

set PORT=3001
set REVIT_CONNECTION_MODE=relay
if not defined MCP_API_KEY (
  echo MCP_API_KEY is required; refusing to start. 1>&2
  exit /b 1
)

echo PORT=%PORT%
echo REVIT_CONNECTION_MODE=%REVIT_CONNECTION_MODE%
echo MCP_API_KEY=***
echo.

npm start
