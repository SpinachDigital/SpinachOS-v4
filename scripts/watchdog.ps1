# Spinach OS — Phase 1 Reliability: watchdog health-check
# watchdog.ps1: checks all three services; restarts any that are down.
# Designed to run every 5 min from Windows Scheduled Task (see README.md).
# Silent when everything is healthy — only logs/writes when it acts.
#
# Usage:  powershell -ExecutionPolicy Bypass -File scripts\watchdog.ps1

$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
$logDir = Join-Path $root 'logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$stamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'

function Test-Http([string]$url) {
  try {
    $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 8
    return ($r.StatusCode -eq 200)
  } catch { return $false }
}

function Restart-IfDown([string]$name, [string]$url, [scriptblock]$start, [string]$logFile) {
  if (Test-Http $url) { return }  # healthy — silent
  Write-Host "[$stamp] $name DOWN — restarting"
  $log = Join-Path $logDir $logFile
  & $start $log
  $ok = $false
  foreach ($i in 1..15) {
    Start-Sleep -Seconds 2
    if (Test-Http $url) { $ok = $true; break }
  }
  if ($ok) { Write-Host "[$stamp] $name RECOVERED ($($i * 2)s)" }
  else     { Write-Host "[$stamp] $name STILL DOWN after restart — check $log" }
}

Restart-IfDown 'Laya :8000' 'http://localhost:8000/health' `
  { param($log) Start-Process -FilePath 'python' -ArgumentList '-m','uvicorn','main:app','--host','0.0.0.0','--port','8000' -WorkingDirectory (Join-Path $root 'laya') -WindowStyle Hidden -RedirectStandardOutput $log -RedirectStandardError ($log + '.err') } `
  'laya-watchdog.log'

Restart-IfDown 'API :4000' 'http://localhost:4000/health' `
  { param($log) Start-Process -FilePath 'npx' -ArgumentList 'tsx','src/index.ts' -WorkingDirectory (Join-Path $root 'api') -WindowStyle Hidden -RedirectStandardOutput $log -RedirectStandardError ($log + '.err') } `
  'api-watchdog.log'

Restart-IfDown 'Frontend :3000' 'http://localhost:3000/' `
  { param($log) Start-Process -FilePath 'npx' -ArgumentList 'next','dev','-p','3000' -WorkingDirectory (Join-Path $root 'frontend/command-center') -WindowStyle Hidden -RedirectStandardOutput $log -RedirectStandardError ($log + '.err') } `
  'frontend-watchdog.log'
