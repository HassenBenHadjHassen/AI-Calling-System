require('dotenv').config();

module.exports = {
  apps: [
    {
      name: 'ai-calling-web',
      script: 'npm',
      args: 'start',
      autorestart: true,
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
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
