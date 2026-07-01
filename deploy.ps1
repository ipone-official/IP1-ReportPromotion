# Deploy IP1 Promo Report (Gateway + Worker + Redis + Meilisearch + SQL)
# First time:
#   npm install -g pm2 pm2-windows-startup && pm2-startup install
#   + ติดตั้ง Redis + Meilisearch เป็น Windows service (ดู docs/DEPLOY.md)
# After pull: .\deploy.ps1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

# ---- 0) .env ต้องมี (ไม่มี = หยุดเลย ไม่ใช่แค่ warn) ----
if (-not (Test-Path ".\.env")) {
  throw ".env not found - คัดลอก .env.example เป็น .env แล้วใส่ค่าจริงก่อน deploy"
}

# parse .env เป็น hashtable
$envMap = @{}
foreach ($line in Get-Content ".\.env") {
  $t = $line.Trim()
  if ($t -eq "" -or $t.StartsWith("#")) { continue }
  $i = $t.IndexOf("=")
  if ($i -lt 1) { continue }
  $envMap[$t.Substring(0, $i).Trim()] = $t.Substring($i + 1).Trim()
}

# ---- 1) env keys จำเป็นต้องครบ ----
$required = @('LINE_CHANNEL_SECRET','LINE_CHANNEL_ACCESS_TOKEN','PUBLIC_URL','DB_SERVER','DB_DATABASE','DB_USER','DB_PASSWORD','REDIS_URL','MEILI_HOST')
$missing = $required | Where-Object { -not $envMap.ContainsKey($_) -or $envMap[$_] -eq "" }
if ($missing) { throw "missing/empty env keys ใน .env: $($missing -join ', ')" }

$pub = $envMap['PUBLIC_URL'].TrimEnd('/')
if ($pub -notmatch '/line-promo-bot$') {
  Write-Host "WARNING: PUBLIC_URL ควรลงท้าย /line-promo-bot (ไม่งั้นรูปบน LINE จะ 404): $pub" -ForegroundColor Yellow
}

# ---- 2) ตรวจ infra ต่อได้ก่อน start (Redis / Meilisearch / DB) ----
function Test-Tcp($hostName, $portNum) {
  try { (Test-NetConnection -ComputerName $hostName -Port $portNum -WarningAction SilentlyContinue).TcpTestSucceeded } catch { $false }
}

$rh = '127.0.0.1'; $rp = 6379
if ($envMap['REDIS_URL'] -match 'redis://([^:/]+):(\d+)') { $rh = $matches[1]; $rp = [int]$matches[2] }
Write-Host "==> check Redis $($rh):$($rp)" -ForegroundColor Cyan
if (-not (Test-Tcp $rh $rp)) { throw "Redis ต่อไม่ได้ที่ $($rh):$($rp) - ติดตั้ง/สตาร์ต Redis service ก่อน (ดู docs/DEPLOY.md)" }

$meili = $envMap['MEILI_HOST'].TrimEnd('/')
Write-Host "==> check Meilisearch $meili" -ForegroundColor Cyan
try { Invoke-WebRequest -Uri "$meili/health" -UseBasicParsing -TimeoutSec 5 | Out-Null }
catch { throw "Meilisearch ต่อไม่ได้ที่ $meili - สตาร์ต meilisearch service ก่อน (ดู docs/DEPLOY.md)" }

$dbHost = $envMap['DB_SERVER']; $dbPort = 1433
if ($envMap.ContainsKey('DB_PORT') -and $envMap['DB_PORT']) { $dbPort = [int]$envMap['DB_PORT'] }
Write-Host "==> check SQL Server $($dbHost):$($dbPort)" -ForegroundColor Cyan
if (-not (Test-Tcp $dbHost $dbPort)) { throw "SQL Server ต่อไม่ได้ที่ $($dbHost):$($dbPort)" }

# ---- 3) build ----
Write-Host "==> npm ci" -ForegroundColor Cyan
npm ci
Write-Host "==> npm run build" -ForegroundColor Cyan
npm run build
if (-not (Test-Path ".\dist\index.js"))  { throw "build failed: dist\index.js not found" }
if (-not (Test-Path ".\dist\worker.js")) { throw "build failed: dist\worker.js not found" }

# ---- 4) pm2 (gateway + worker) ----
Write-Host "==> pm2 start/restart (gateway + worker)" -ForegroundColor Cyan
cmd /c "pm2 restart ip1promo-bot ip1promo-worker >nul 2>&1"
if ($LASTEXITCODE -ne 0) {
  Write-Host "First deploy - starting pm2..." -ForegroundColor Yellow
  cmd /c "pm2 start ecosystem.config.js"
  if ($LASTEXITCODE -ne 0) { throw "pm2 start failed - run: npm install -g pm2" }
}
cmd /c "pm2 save"

# ---- 5) health checks ----
Write-Host "==> health check local /healthz" -ForegroundColor Cyan
$ok = $false
for ($i = 1; $i -le 10; $i++) {
  try {
    $r = Invoke-WebRequest -Uri "http://localhost:3000/healthz" -UseBasicParsing -TimeoutSec 10
    if ($r.StatusCode -eq 200) { Write-Host "OK local /healthz: $($r.Content)" -ForegroundColor Green; $ok = $true; break }
  } catch { }
  Start-Sleep -Seconds 2
}
if (-not $ok) { Write-Host "FAIL: local /healthz ไม่ขึ้น 200 (Redis ดับ?)" -ForegroundColor Red; Write-Host "pm2 logs ip1promo-bot --lines 40" -ForegroundColor Yellow; exit 1 }

Write-Host "==> health check public sub-path ($pub)" -ForegroundColor Cyan
try {
  $rp2 = Invoke-WebRequest -Uri "$pub/healthz" -UseBasicParsing -TimeoutSec 15
  Write-Host "OK public /healthz: $($rp2.StatusCode)" -ForegroundColor Green
} catch {
  Write-Host "WARNING: public $pub/healthz ไม่ผ่าน - เช็ค IIS reverse proxy / sub-path" -ForegroundColor Yellow
}
try {
  Invoke-WebRequest -Uri "$pub/photo/__probe__" -UseBasicParsing -TimeoutSec 15 | Out-Null
  Write-Host "WARNING: /photo/__probe__ ไม่ได้ 404 (ผิดคาด)" -ForegroundColor Yellow
} catch {
  if ($_.Exception.Response -and [int]$_.Exception.Response.StatusCode -eq 404) {
    Write-Host "OK public /photo route reachable ผ่าน sub-path (404 ตามคาด)" -ForegroundColor Green
  } else {
    Write-Host "WARNING: /photo probe ผ่าน proxy ไม่ได้: $($_.Exception.Message)" -ForegroundColor Yellow
  }
}

Write-Host ""
Write-Host "Deploy done (gateway + worker)." -ForegroundColor Green
Write-Host "Webhook URL: $pub/webhook"
Write-Host "ตรวจสถานะ: pm2 list   |   log worker: pm2 logs ip1promo-worker"
