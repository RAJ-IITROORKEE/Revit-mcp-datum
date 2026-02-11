module.exports = {
  apps: [{
    name: 'revit-mcp',
    script: './server.js',
    instances: 1,
    exec_mode: 'cluster',
    watch: false,
    env: {
      MCP_PORT: 3000,
      MCP_HOST: '0.0.0.0',
      CERT_PATH: './certs/server.crt',
      KEY_PATH: './certs/server.key',
      NODE_ENV: 'production'
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
