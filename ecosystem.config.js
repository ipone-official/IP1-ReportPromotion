// PM2 config — รันบอท IP1 บน server บริษัท ให้ทำงาน 24/7 + ฟื้นเองถ้าล่ม
// ใช้: pm2 start ecosystem.config.js   (ดูสเต็ปเต็มใน DEPLOY.md)
module.exports = {
  apps: [
    {
      name: 'ip1promo-bot',
      script: 'npx',
      args: 'tsx src/index.ts',
      cwd: __dirname,
      autorestart: true,          // ล่ม → ฟื้นเอง
      max_restarts: 20,
      min_uptime: '10s',
      restart_delay: 3000,
      time: true,                 
      env: {
        NODE_ENV: 'production',
        PORT: '3000',             
      },
    },
  ],
};
