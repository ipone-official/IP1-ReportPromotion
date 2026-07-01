// PM2 config — รันบอท IP1 บน server บริษัท ให้ทำงาน 24/7 + ฟื้นเองถ้าล่ม
// Redis + Meilisearch รันจากในโปรเจกต์เอง (bin/) — ไม่ใช้ Docker, ไม่ต้องลง service แยก
// เตรียม binary ครั้งเดียว:  powershell -ExecutionPolicy Bypass -File .\scripts\setup-infra.ps1
// Deploy: git pull ; npm ci ; npm run build ; pm2 start ecosystem.config.js ; pm2 save
// IIS app: line-promo-bot @ https://portal.ip-one.com/line-promo-bot/webhook
module.exports = {
  apps: [
    // ── Redis (Windows build, in-project) — ต้องขึ้นก่อน bot/worker ──
    {
      name: 'ip1-redis',
      script: './bin/redis/redis-server.exe',
      args: './bin/redis/redis.conf',
      interpreter: 'none',          // รัน .exe ตรง ๆ (ไม่ผ่าน node)
      cwd: __dirname,
      autorestart: true,
      max_restarts: 20,
      min_uptime: '10s',
      time: true,
    },
    // ── Meilisearch (single exe, in-project) — optional แต่ช่วยเรื่องพิมพ์ผิด ──
    {
      name: 'ip1-meili',
      script: './bin/meilisearch.exe',
      args: '--db-path ./data/meili --http-addr 127.0.0.1:7700 --env development --no-analytics',
      interpreter: 'none',
      cwd: __dirname,
      autorestart: true,
      max_restarts: 20,
      min_uptime: '10s',
      time: true,
    },
    // ── Gateway (รับ webhook) ──
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
    // ── Worker (ประมวลผลคิว) — ★ ตัวเดียวเท่านั้น ──
    {
      name: 'ip1promo-worker',
      script: 'dist/worker.js',
      cwd: __dirname,
      instances: 1,               // ★ ห้ามเกิน 1 — worker หลายตัวจะแย่งคิวเดียวกันทำผลเพี้ยน
      exec_mode: 'fork',          // fork ไม่ใช่ cluster (กันถูก scale หลาย instance)
      autorestart: true,          // ล่ม → ฟื้นเอง
      max_restarts: 20,
      min_uptime: '10s',
      restart_delay: 3000,
      time: true,
      env: {
        NODE_ENV: 'production',
        WORKER_CONCURRENCY: '5',
      },
    },
  ],
};
