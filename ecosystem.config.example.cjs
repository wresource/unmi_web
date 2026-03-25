// PM2 Ecosystem Configuration
// Copy this file to ecosystem.config.cjs and fill in your values:
//   cp ecosystem.config.example.cjs ecosystem.config.cjs

module.exports = {
  apps: [
    {
      name: 'domain-manager',
      script: '.output/server/index.mjs',
      cwd: '/your/project/path',          // ← Change to your project path
      env: {
        PORT: 3001,
        HOST: '127.0.0.1',
        NODE_ENV: 'production',
        DB_PATH: '/your/project/path/data/domain-manager.db',  // ← Change path

        // DropCatch API (optional - for real auction data)
        // Sign up at https://www.dropcatch.com/hiw/dropcatch-api
        // DROPCATCH_CLIENT_ID: 'your_client_id',
        // DROPCATCH_CLIENT_SECRET: 'your_client_secret',
      },
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '512M',
    },
  ],
}
