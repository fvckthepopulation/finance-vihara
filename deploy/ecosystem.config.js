// PM2 process file for vihara-finance-web.
// Deployed via CloudPanel reverse-proxy site → 127.0.0.1:3510. Run from the
// checkout directory on the VPS:
//   pm2 start deploy/ecosystem.config.js
//   pm2 save && pm2 startup   # persist across reboots
//
// NOTE: NEXT_PUBLIC_API_URL is baked at `next build` time via .env.production.
// The PORT below is the only env that matters at runtime.

module.exports = {
  apps: [
    {
      name: "vihara-finance-web",
      script: "node_modules/next/dist/bin/next",
      args: "start --port 3510",
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: "3510",
      },
    },
  ],
};
