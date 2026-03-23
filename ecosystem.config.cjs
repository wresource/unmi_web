module.exports = {
  apps: [
    {
      name: 'domain-manager',
      script: '.output/server/index.mjs',
      cwd: '/www/wwwroot/unmi.io',
      env: {
        PORT: 3001,
        HOST: '127.0.0.1',
        NODE_ENV: 'production',
        DB_PATH: '/www/wwwroot/unmi.io/data/domain-manager.db',
      },
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '512M',
    },
  ],
}
