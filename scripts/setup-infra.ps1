# ============================================================================
#  setup-infra.ps1  -- prepare in-project Redis + Meilisearch binaries
#  (no Docker, no separately-installed Windows service) managed by PM2 via
#  ecosystem.config.js.
#
#  NOTE: kept ASCII-only on purpose. Windows PowerShell 5.1 reads unBOM'd .ps1
#  files with the system ANSI codepage; non-ASCII comments can break parsing.
#
#  Run once per machine:
#      powershell -ExecutionPolicy Bypass -File .\scripts\setup-infra.ps1
#      # force re-download over existing files:
#      powershell -ExecutionPolicy Bypass -File .\scripts\setup-infra.ps1 -Force
#
#  Produces:
#      bin\meilisearch.exe
#      bin\redis\redis-server.exe (+ redis-cli.exe, etc.)   [redis.conf untouched]
#      data\  , data\meili\
# ============================================================================
[CmdletBinding()]
param(
    # re-download even if the file already exists
    [switch]$Force,
    # Redis Windows build version (tporadowski)
    [string]$RedisVersion = '5.0.14.1'
)

$ErrorActionPreference = 'Stop'
$ProgressPreference    = 'SilentlyContinue'   # speeds up Invoke-WebRequest on Win PowerShell
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

# ---- main paths: resolved from the project root (parent of scripts\) ----
$Root     = Split-Path -Parent $PSScriptRoot          # ...\IP1-ReportPromotion-master
$BinDir   = Join-Path $Root 'bin'
$RedisDir = Join-Path $BinDir 'redis'
$DataDir  = Join-Path $Root 'data'
$MeiliDb  = Join-Path $DataDir 'meili'
$MeiliExe = Join-Path $BinDir 'meilisearch.exe'

$MeiliUrl = 'https://github.com/meilisearch/meilisearch/releases/latest/download/meilisearch-windows-amd64.exe'
$RedisUrl = "https://github.com/tporadowski/redis/releases/download/v$RedisVersion/Redis-x64-$RedisVersion.zip"

function Write-Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-OK($msg)   { Write-Host "    [OK] $msg"   -ForegroundColor Green }
function Write-Skip($msg) { Write-Host "    [skip] $msg" -ForegroundColor DarkGray }

# ---- 0) create folders ----
Write-Step 'Create folders: bin/ , data/ , data/meili/'
foreach ($d in @($BinDir, $RedisDir, $DataDir, $MeiliDb)) {
    if (-not (Test-Path $d)) { New-Item -ItemType Directory -Force -Path $d | Out-Null }
}
Write-OK "bin  = $BinDir"
Write-OK "data = $DataDir  (meili db = $MeiliDb)"

# ---- 1) Meilisearch (single exe) ----
Write-Step 'Download Meilisearch -> bin\meilisearch.exe'
if ((Test-Path $MeiliExe) -and -not $Force) {
    Write-Skip "already exists: $MeiliExe  (use -Force to re-download)"
} else {
    Write-Host "    from $MeiliUrl"
    Invoke-WebRequest -Uri $MeiliUrl -OutFile $MeiliExe -UseBasicParsing
    Write-OK ("meilisearch.exe = {0:N1} MB" -f ((Get-Item $MeiliExe).Length / 1MB))
}

# ---- 2) Redis (zip -> extract -> copy only .exe/.dll into bin\redis\) ----
Write-Step "Download Redis (Windows $RedisVersion) -> bin\redis\"
$RedisServer = Join-Path $RedisDir 'redis-server.exe'
if ((Test-Path $RedisServer) -and -not $Force) {
    Write-Skip "already exists: $RedisServer  (use -Force to re-download)"
} else {
    $tmpZip = Join-Path $env:TEMP ("redis-{0}.zip" -f $RedisVersion)
    $tmpDir = Join-Path $env:TEMP ("redis-extract-{0}" -f $RedisVersion)
    Write-Host "    from $RedisUrl"
    Invoke-WebRequest -Uri $RedisUrl -OutFile $tmpZip -UseBasicParsing
    if (Test-Path $tmpDir) { Remove-Item $tmpDir -Recurse -Force }
    Expand-Archive -Path $tmpZip -DestinationPath $tmpDir -Force

    # copy only binaries (.exe/.dll) into bin\redis\ -- do NOT overwrite our redis.conf
    Get-ChildItem -Path $tmpDir -Recurse -Include *.exe, *.dll |
        Copy-Item -Destination $RedisDir -Force
    Remove-Item $tmpZip -Force
    Remove-Item $tmpDir -Recurse -Force

    if (-not (Test-Path $RedisServer)) { throw "redis-server.exe not found after extract -- check URL/version" }
    Write-OK ("redis-server.exe = {0:N1} MB" -f ((Get-Item $RedisServer).Length / 1MB))
    Get-ChildItem $RedisDir -Filter *.exe | ForEach-Object { Write-OK "  + $($_.Name)" }
}

# ---- 3) summary ----
Write-Step 'Done -- verifying files'
function Show-Check($path) {
    $tag = if (Test-Path $path) { 'OK ' } else { 'MISSING' }   # no ternary -- PowerShell 5.1 safe
    Write-Host ("    {0}  {1}" -f $tag, $path)
}
Show-Check $MeiliExe
Show-Check $RedisServer
Show-Check $MeiliDb
Write-Host "`nNext:  pm2 start ecosystem.config.js   (or test manually -- see README/DEPLOY)" -ForegroundColor Yellow
