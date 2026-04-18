@echo off
echo Starting revit-mcp locally in relay mode...
echo.

set PORT=3001
set REVIT_CONNECTION_MODE=relay
set MCP_API_KEY=c8e331f621c4e46b0be5c9d815a171a261ad2dacff7324cf737bb42442b0094d

echo PORT=%PORT%
echo REVIT_CONNECTION_MODE=%REVIT_CONNECTION_MODE%
echo MCP_API_KEY=***
echo.

npm start
