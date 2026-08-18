/**
 * PM2 Ecosystem — DEVELOPMENT MODE
 *
 * NestJS  : nest start --watch  (SWC — instant TypeScript reload)
 * Next.js : next dev --webpack  (Webpack dev server with HMR)
 *
 * Flutter web apps run separately via ./dev-flutter.sh
 */

const MONOREPO = '/home/f2hfresh/htdocs/f2hfresh.com';

module.exports = {
  apps: [
    {
      name: 'api-f2hfresh',
      cwd: `${MONOREPO}/apps/api`,
      script: `${MONOREPO}/node_modules/.bin/nest`,
      args: 'start --watch',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      env: {
        NODE_ENV: 'development',
        APP_PORT: 5001,
        PORT: 5001,
        INTERNAL_API_URL: 'http://localhost:5001',
        PATH: `${MONOREPO}/node_modules/.bin:${process.env.PATH}`,
      },
      out_file: '/home/f2hfresh/logs/pm2/api-out.log',
      error_file: '/home/f2hfresh/logs/pm2/api-err.log',
      merge_logs: true,
      log_date_format: 'HH:mm:ss',
    },

    {
      name: 'frontend-f2hfresh',
      cwd: `${MONOREPO}/apps/web`,
      script: 'npm',
      args: 'run dev',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      env: {
        NODE_ENV: 'development',
        PORT: 5002,
        NEXT_TELEMETRY_DISABLED: '1',
        INTERNAL_API_URL: 'http://localhost:5001',
        PATH: `${MONOREPO}/node_modules/.bin:${process.env.PATH}`,
      },
      out_file: '/home/f2hfresh/logs/pm2/frontend-out.log',
      error_file: '/home/f2hfresh/logs/pm2/frontend-err.log',
      merge_logs: true,
      log_date_format: 'HH:mm:ss',
    },

    {
      name: 'dev-broadcaster',
      cwd: MONOREPO,
      script: 'dev-broadcaster.js',
      watch: false,
      autorestart: true,
      env: {
        NODE_ENV: 'development',
      },
      out_file: '/home/f2hfresh/logs/pm2/broadcaster-out.log',
      error_file: '/home/f2hfresh/logs/pm2/broadcaster-err.log',
      merge_logs: true,
      log_date_format: 'HH:mm:ss',
    },
  ],
};
