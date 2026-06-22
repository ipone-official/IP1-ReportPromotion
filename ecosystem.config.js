// PM2 config — รันบอท IP1 บน server บริษัท ให้ทำงาน 24/7 + ฟื้นเองถ้าล่ม
// Deploy: git pull && .\deploy.ps1
// IIS app: IP1-Reportpomotion @ https://portal.ip-one.com/IP1-Reportpomotion/webhook
// (รัน dist/index.js ตรงๆ ด้วย node — ไม่ใช้ npx/tsx เลี่ยงปัญหา .CMD บน Windows)
module.exports = {
  apps: [
    {
      name: 'ip1promo-bot',
      script: 'dist/index.js',
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
