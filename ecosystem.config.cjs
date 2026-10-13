require('dotenv').config();

module.exports = {
  apps: [
    {
      name: 'ai-calling-web',
      script: 'npm',
      args: 'start',
      autorestart: true,
      out_file: './logs/pm2-web-out.log',
      error_file: './logs/pm2-web-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      env: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 4050,
      },
    },
    {
      name: 'ai-calling-worker',
      script: 'npm',
      args: 'run worker',
      autorestart: true,
      out_file: './logs/pm2-worker-out.log',
      error_file: './logs/pm2-worker-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
