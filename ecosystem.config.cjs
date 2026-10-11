/**
 * PM2 Ecosystem Configuration for AI Calling System
 * Manages both the Next.js Web Server (cluster mode) and
 * the Background SMS/Retry Notification Worker (single fork).
 *
 * Usage:
 *   pm2 start ecosystem.config.cjs --env production
 *   pm2 reload ecosystem.config.cjs --env production
 *   pm2 stop ecosystem.config.cjs
 *   pm2 logs
 */

const path = require('path');
try {
  require('dotenv').config({ path: path.resolve(__dirname, '.env') });
} catch {
  // dotenv optional if loaded by process
}

const CUSTOM_PORT = process.env.PORT || '4050';

module.exports = {
  apps: [
    {
      name: 'ai-calling-web',
      script: 'node_modules/next/dist/bin/next',
      args: 'start --port ' + CUSTOM_PORT,
      cwd: './',
      // Cluster mode for multi-core load distribution on VPS
      instances: process.env.WEB_INSTANCES || 2,
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
        PORT: CUSTOM_PORT,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: CUSTOM_PORT,
      },
      // Logging
      error_file: './logs/pm2-web-error.log',
      out_file: './logs/pm2-web-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      // Graceful shutdown handling
      kill_timeout: 5000,
      listen_timeout: 8000,
    },
    {
      name: 'ai-calling-worker',
      script: 'node_modules/tsx/dist/cli.mjs',
      args: 'src/jobs/worker.ts',
      cwd: './',
      // Worker MUST run in single instance (fork) to prevent duplicate DB queue polling
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
      // Logging
      error_file: './logs/pm2-worker-error.log',
      out_file: './logs/pm2-worker-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      // Graceful shutdown handling
      kill_timeout: 5000,
    },
  ],
};
