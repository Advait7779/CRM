module.exports = {
  apps: [
    {
      name: 'service-crm-backend',
      script: './server/index.js',
      // Keep one process until Socket.IO uses a shared adapter and scheduled
      // jobs use a distributed lock. Multiple workers would duplicate reminders.
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env_production: {
        NODE_ENV: 'production',
        PORT: 5001
      }
    }
  ]
};
