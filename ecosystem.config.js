// PM2 config — รันบอท IP1 บน server บริษัท ให้ทำงาน 24/7 + ฟื้นเองถ้าล่ม
// ต้อง build ก่อน: npm run build   แล้ว: pm2 start ecosystem.config.js
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
