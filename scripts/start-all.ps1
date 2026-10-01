# Spinach OS — Phase 1 Reliability: service health + auto-restart
# start-all.ps1: starts API (:4000), Laya (:8000), frontend (:3000); waits for
# health checks; logs to logs/. Idempotent — already-running services are skipped.
#
# Usage:  powershell -ExecutionPolicy Bypass -File scripts\start-all.ps1

$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
$logDir = Join-Path $root 'logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$stamp = Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'

function Test-Http([string]$url, [int]$expect = 200) {
  try {
    $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 8
    return ($r.StatusCode -eq $expect)
  } catch { return $false }
}

function Start-ServiceIfDown([string]$name, [scriptblock]$health, [scriptblock]$start, [string]$logFile) {
  if (& $health) {
    Write-Host "[ok]      $name already up"
    return
  }
  Write-Host "[start]   $name ..."
  $log = Join-Path $logDir $logFile
  # detached start: survives this script's exit (Start-Process, not &)
  & $start $log
  # wait up to 30s for health
  $ok = $false
  foreach ($i in 1..15) {
    Start-Sleep -Seconds 2
    if (& $health) { $ok = $true; break }
  }
  if ($ok) { Write-Host "[up]      $name healthy ($($i * 2)s)" }
  else     { Write-Host "[FAIL]    $name did not become healthy in 30s — check $log" }
}

# ---- 1. Laya (:8000) — starts fastest, no deps ----
Start-ServiceIfDown 'Laya :8000' `
  { Test-Http 'http://localhost:8000/health' } `
  { param($log) Start-Process -FilePath 'python' -ArgumentList '-m','uvicorn','main:app','--host','0.0.0.0','--port','8000' -WorkingDirectory (Join-Path $root 'laya') -WindowStyle Hidden -RedirectStandardOutput $log -RedirectStandardError ($log + '.err') } `
  'laya-start.log'

# ---- 2. API (:4000) — needs .env (JWT_SECRET etc.) ----
Start-ServiceIfDown 'API :4000' `
  { Test-Http 'http://localhost:4000/health' } `
  { param($log) Start-Process -FilePath 'npx' -ArgumentList 'tsx','src/index.ts' -WorkingDirectory (Join-Path $root 'api') -WindowStyle Hidden -RedirectStandardOutput $log -RedirectStandardError ($log + '.err') } `
  'api-start.log'

# ---- 3. Frontend (:3000) — Next dev ----
Start-ServiceIfDown 'Frontend :3000' `
  { Test-Http 'http://localhost:3000/' } `
  { param($log) Start-Process -FilePath 'npx' -ArgumentList 'next','dev','-p','3000' -WorkingDirectory (Join-Path $root 'frontend/command-center') -WindowStyle Hidden -RedirectStandardOutput $log -RedirectStandardError ($log + '.err') } `
  'frontend-start.log'

# ---- summary ----
Write-Host ''
Write-Host '=== health summary ==='
$services = @(
  @{ n = 'API :4000';        u = 'http://localhost:4000/health' },
  @{ n = 'Laya :8000';       u = 'http://localhost:8000/health' },
  @{ n = 'Frontend :3000';   u = 'http://localhost:3000/' }
)
foreach ($s in $services) {
  if (Test-Http $s.u) { Write-Host "  [ok]   $($s.n)" } else { Write-Host "  [down] $($s.n)" }
}
Write-Host "Logs: $logDir"
