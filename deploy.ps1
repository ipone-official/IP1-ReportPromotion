# Deploy IP1 Promo Report bot (Windows Server + IIS + PM2)
# First time: npm install -g pm2 pm2-windows-startup && pm2-startup install
# After pull: .\deploy.ps1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "==> npm ci" -ForegroundColor Cyan
npm ci

Write-Host "==> npm run build" -ForegroundColor Cyan
npm run build

if (-not (Test-Path ".\dist\index.js")) {
  throw "build failed: dist\index.js not found"
}

if (-not (Test-Path ".\.env")) {
  Write-Host "WARNING: .env not found - copy from .env.example and fill in secrets" -ForegroundColor Yellow
}

Write-Host "==> pm2 start/restart" -ForegroundColor Cyan
# Use cmd.exe so pm2.ps1 does not throw under $ErrorActionPreference Stop
cmd /c "pm2 restart ip1promo-bot >nul 2>&1"
if ($LASTEXITCODE -ne 0) {
  Write-Host "First deploy - starting pm2..." -ForegroundColor Yellow
  cmd /c "pm2 start ecosystem.config.js"
  if ($LASTEXITCODE -ne 0) {
    throw "pm2 start failed - run: npm install -g pm2"
  }
}
cmd /c "pm2 save"

Write-Host "==> health check localhost:3000" -ForegroundColor Cyan
Start-Sleep -Seconds 2
try {
  $r = Invoke-WebRequest -Uri "http://localhost:3000/" -UseBasicParsing -TimeoutSec 10
  Write-Host "OK $($r.StatusCode): $($r.Content)" -ForegroundColor Green
} catch {
  Write-Host "FAIL: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "Check: pm2 logs ip1promo-bot --lines 30" -ForegroundColor Yellow
  exit 1
}

Write-Host ""
Write-Host "Deploy done." -ForegroundColor Green
Write-Host "LINE Webhook URL: https://portal.ip-one.com/line-promo-bot/webhook"
Write-Host "PUBLIC_URL (.env): https://portal.ip-one.com/line-promo-bot"
Write-Host "Logs: pm2 logs ip1promo-bot"
