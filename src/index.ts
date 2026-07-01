import 'dotenv/config';
import express from 'express';
import { middleware, WebhookEvent } from '@line/bot-sdk';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { getPhoto, setBaseUrl } from './infra/photoStore';

const channelSecret = process.env.LINE_CHANNEL_SECRET || '';
const redisConnection = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', { maxRetriesPerRequest: null });
const webhookQueue = new Queue('line-webhook-events', { connection: redisConnection as any });

const app = express();

app.use('/assets', express.static('assets'));
app.get('/', (_req, res) => res.send('IP1 Promo Report API Gateway is running'));

// readiness probe จริง — 200 เมื่อ Redis (queue) พร้อม, ไม่งั้น 503 (ใช้แทนการเช็ค '/' ที่เป็น static)
app.get('/healthz', (_req, res) => {
  const ready = redisConnection.status === 'ready';
  res.status(ready ? 200 : 503).json({
    status: ready ? 'ok' : 'starting',
    redis: redisConnection.status,
    uptimeSec: Math.round(process.uptime()),
  });
});

app.get('/photo/:id', async (req, res) => {
  try {
    const buf = await getPhoto(req.params.id);
    if (!buf) return res.status(404).end();
    res.set('Content-Type', 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(buf);
  } catch (e: any) {
    console.error('Photo fetch error:', e?.message);
    res.status(500).end();
  }
});

const webhookStack = [
  (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    console.log(`[webhook] ${new Date().toLocaleTimeString()} ${req.method} ${req.path} — request เข้ามา`);
    const host = req.headers['x-forwarded-host'] || req.headers.host || '';
    const proto = req.headers['x-forwarded-proto'] || 'https';
    if (host) setBaseUrl(`${proto}://${host}`);
    next();
  },
  middleware({ channelSecret }),
  async (req: express.Request, res: express.Response) => {
    const events: WebhookEvent[] = req.body.events || [];
    console.log(`[webhook] ✓ signature ผ่าน, ${events.length} events: ${events.map((e: any) => e.type).join(',')}`);
    
    res.sendStatus(200);

    for (const event of events) {
      const jobId = (event as any).webhookEventId;
      try {
        await webhookQueue.add('line-event', event, {
          jobId,
          // เก็บ job ที่เสร็จแล้วไว้ 24 ชม. → ถ้า LINE redeliver event เดิม (jobId = webhookEventId เดียวกัน)
          // BullMQ จะไม่ enqueue/ประมวลผลซ้ำ = กัน report ซ้ำจาก redelivery
          removeOnComplete: { age: 86400, count: 2000 },
          removeOnFail: { count: 100 },
        });
        console.log(`[webhook] Job queued successfully for eventId: ${jobId || 'anonymous'}`);
      } catch (err: any) {
        console.error(`[webhook] Failed to queue job for eventId: ${jobId || 'anonymous'} — ${err.message}`);
      }
    }
  },
];

app.post('/webhook', ...webhookStack);
app.post('/api/LineWebhook', ...webhookStack);

app.use((err: any, _req: any, res: any, _next: any) => {
  console.error('[webhook] ❌ middleware error (signature ไม่ตรง? channel secret ผิด?):', err?.message);
  if (!res.headersSent) res.sendStatus(200);
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => console.log(`API Gateway running on :${port}/webhook`));
