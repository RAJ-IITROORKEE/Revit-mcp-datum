module.exports = {
  apps: [{
    name: 'revit-mcp-secure',
    script: './server-secure.js',
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    env: {
      MCP_PORT: 3000,
      MCP_HOST: '127.0.0.1',
      CERT_PATH: './certs/server.crt',
      KEY_PATH: './certs/server.key',
      NODE_ENV: 'production',
      MCP_API_KEY: 'CHANGE_THIS_TO_YOUR_SECURE_KEY',
      ENABLE_IP_WHITELIST: 'false',
      ENABLE_RATE_LIMIT: 'true',
      RATE_LIMIT_REQUESTS: '100',
      RATE_LIMIT_WINDOW: '60000'
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    min_uptime: '10s',
    max_restarts: 10,
    max_memory_restart: '1G',
    exp_backoff_restart_delay: 100,
    listen_timeout: 10000,
    kill_timeout: 60000
  }]
};
