const MONOREPO = '/home/f2hfresh/htdocs/f2hfresh.com';

module.exports = {
  apps: [
    {
      name: 'api-f2hfresh',
      cwd: `${MONOREPO}/apps/api`,
      script: 'dist/main.js',
      exec_mode: 'cluster',
      instances: 2,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      env: {
        NODE_ENV: 'production',
        APP_PORT: 5001,
        PORT: 5001,
        PATH: `${MONOREPO}/node_modules/.bin:${process.env.PATH}`,
      },
      out_file: '/home/f2hfresh/logs/pm2/api-out.log',
      error_file: '/home/f2hfresh/logs/pm2/api-err.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
    {
      name: 'frontend-f2hfresh',
      cwd: `${MONOREPO}/apps/web`,
      script: `${MONOREPO}/node_modules/.bin/next`,
      args: 'start -H 0.0.0.0 -p 5002',
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      env: {
        NODE_ENV: 'production',
        PORT: 5002,
        NEXT_TELEMETRY_DISABLED: '1',
        PATH: `${MONOREPO}/node_modules/.bin:${process.env.PATH}`,
      },
      out_file: '/home/f2hfresh/logs/pm2/frontend-out.log',
      error_file: '/home/f2hfresh/logs/pm2/frontend-err.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};

