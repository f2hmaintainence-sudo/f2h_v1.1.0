module.exports = {
  apps: [
    {
      name: 'api-f2hfresh',
      cwd: '/home/f2hfresh/htdocs/f2hfresh.com/apps/api',
      script: 'dist/main.js',
      env: {
        NODE_ENV: 'production',
        APP_PORT: 5001,
        PORT: 5001,
      },
    },
    {
      name: 'frontend-f2hfresh',
      cwd: '/home/f2hfresh/htdocs/f2hfresh.com/apps/web',
      script: 'node_modules/next/dist/bin/next',
      args: 'dev -H 0.0.0.0 -p 5002',
      env: {
        NODE_ENV: 'development',
        PORT: 5002,
      },
    },
  ],
};
