module.exports = {
  apps: [
    {
      name: 'api-f2hfresh',
      cwd: '/home/f2hfresh/htdocs/f2hfresh.com/apps/api',
      script: 'npm',
      args: 'run start:dev',
      env: {
        NODE_ENV: 'development',
        APP_PORT: 5001,
        PORT: 5001,
      },
    },
    {
      name: 'frontend-f2hfresh',
      cwd: '/home/f2hfresh/htdocs/f2hfresh.com/apps/web',
      script: 'npm',
      args: 'run dev',
      env: {
        NODE_ENV: 'development',
        PORT: 5002,
      },
    },
  ],
};
