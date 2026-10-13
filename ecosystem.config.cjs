const path = require('path');
const dotenv = require('dotenv');

// Always load .env from the project directory.
// override: true ensures stale variables inherited by PM2
// do not override the values configured in this file.
const envPath = path.resolve(__dirname, '.env');
const dotenvResult = dotenv.config({
  path: envPath,
  override: true,
});

if (dotenvResult.error) {
  throw new Error(`Failed to load environment file: ${envPath}`);
}

const webhookSecret = process.env.VAPI_WEBHOOK_SECRET;

if (!webhookSecret || !webhookSecret.trim()) {
  throw new Error('VAPI_WEBHOOK_SECRET is missing from .env');
}

if (webhookSecret === 'vapi_test_secret') {
  throw new Error('Refusing to start with the default VAPI webhook secret.');
}

const port = process.env.PORT || 4050;

module.exports = {
  apps: [
    {
      name: 'ai-calling-web',
      cwd: __dirname,
      script: 'npm',
      args: 'start',
      autorestart: true,
      out_file: './logs/pm2-web-out.log',
      error_file: './logs/pm2-web-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      env: {
        NODE_ENV: 'development',
        PORT: port,
      },

      env_production: {
        NODE_ENV: 'production',
        PORT: port,
        VAPI_WEBHOOK_SECRET: webhookSecret,
      },
    },

    {
      name: 'ai-calling-worker',
      cwd: __dirname,
      script: 'npm',
      args: 'run worker',
      autorestart: true,
      out_file: './logs/pm2-worker-out.log',
      error_file: './logs/pm2-worker-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      env: {
        NODE_ENV: 'development',
      },

      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
};