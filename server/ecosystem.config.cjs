// PM2 cluster config for GeekSpace API
// Runs 2 Node.js workers to utilise multiple CPU cores.
// Schedulers/Telegram/cron only run in worker 0 (guarded by NODE_APP_INSTANCE).
module.exports = {
  apps: [
    {
      name: 'geekspace',
      script: 'server/dist/index.js',
      instances: 2,
      exec_mode: 'cluster',
      max_memory_restart: '450M',
      // Graceful shutdown — wait for in-flight requests
      kill_timeout: 5000,
      wait_ready: false,
      // Logging (Docker captures stdout/stderr)
      log_date_format: '',
      merge_logs: true,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
