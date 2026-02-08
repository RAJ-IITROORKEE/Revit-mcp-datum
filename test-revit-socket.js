/**
 * Socket Test Utility for Revit MCP Plugin
 * 
 * Tests direct communication with the Revit plugin socket server
 * Run this while Revit with the MCP plugin is open
 * 
 * Usage: node test-revit-socket.js
 */

const net = require('net');

console.log('=== Revit MCP Socket Test ===\n');

// Test configuration
const HOST = 'localhost';
const PORT = 8080;
const TIMEOUT = 10000; // 10 seconds

// Test command - get current view info (simple read operation)
const testCommand = {
  jsonrpc: "2.0",
  method: "get_current_view_info",
  params: {},
  id: `test_${Date.now()}`
};

console.log(`1. Attempting to connect to ${HOST}:${PORT}...`);

const client = net.createConnection({ port: PORT, host: HOST }, () => {
  console.log('✓ Connected to Revit plugin!\n');
  
  console.log('2. Sending test command:');
  console.log(JSON.stringify(testCommand, null, 2));
  
  const commandString = JSON.stringify(testCommand);
  client.write(commandString);
  console.log(`\n✓ Sent ${commandString.length} bytes\n`);
  console.log('3. Waiting for response...');
});

let responseBuffer = '';
let responseReceived = false;

client.on('data', (data) => {
  responseBuffer += data.toString();
  
  try {
    // Try to parse complete JSON response
    const response = JSON.parse(responseBuffer);
    responseReceived = true;
    
    console.log('\n✓ Received response:');
    console.log(JSON.stringify(response, null, 2));
    
    if (response.error) {
      console.log('\n✗ ERROR in response:', response.error.message);
    } else if (response.result) {
      console.log('\n✓ SUCCESS - Command executed successfully');
      if (response.result.viewName) {
        console.log(`  View Name: ${response.result.viewName}`);
        console.log(`  View Type: ${response.result.viewType}`);
      }
    }
    
    client.end();
  } catch (e) {
    // JSON incomplete, wait for more data
    console.log(`  Received partial data: ${data.length} bytes`);
  }
});

client.on('end', () => {
  if (responseReceived) {
    console.log('\n✓ Connection closed normally');
    console.log('\n=== TEST PASSED ===');
    process.exit(0);
  } else {
    console.log('\n✗ Connection closed without response');
    console.log('Partial data received:', responseBuffer);
    console.log('\n=== TEST FAILED ===');
    process.exit(1);
  }
});

client.on('error', (err) => {
  console.log('\n✗ Socket error:', err.message);
  
  if (err.code === 'ECONNREFUSED') {
    console.log('\nPossible causes:');
    console.log('  1. Revit is not running');
    console.log('  2. MCP plugin is not loaded in Revit');
    console.log('  3. Plugin failed to start socket server on port 8080');
    console.log('  4. Firewall is blocking localhost:8080');
    console.log('\nTroubleshooting:');
    console.log('  1. Open Revit 2026');
    console.log('  2. Check Add-Ins tab for MCP plugin');
    console.log('  3. Check plugin logs at: C:\\Users\\YOUR_USERNAME\\AppData\\Local\\revit-mcp-plugin\\Logs\\');
    console.log('  4. Look for "Socket service initialized on port 8080" message');
  }
  
  console.log('\n=== TEST FAILED ===');
  process.exit(1);
});

client.setTimeout(TIMEOUT, () => {
  console.log(`\n✗ Timeout after ${TIMEOUT/1000} seconds`);
  console.log('Response never received from Revit plugin');
  
  console.log('\nPossible causes:');
  console.log('  1. Plugin received command but failed to execute');
  console.log('  2. Plugin is stuck or crashed');
  console.log('  3. Command execution takes too long');
  console.log('  4. Response format incompatibility');
  
  console.log('\nTroubleshooting:');
  console.log('  1. Check Revit is responsive (not frozen)');
  console.log('  2. Check plugin logs for errors');
  console.log('  3. Try restarting Revit');
  console.log('  4. Verify plugin is compiled for Revit 2026 API');
  
  client.end();
  console.log('\n=== TEST FAILED ===');
  process.exit(1);
});

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n\nTest interrupted by user');
  client.end();
  process.exit(1);
});
