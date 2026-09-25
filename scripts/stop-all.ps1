# Spinach OS — Phase 1 Reliability: clean shutdown
# stop-all.ps1: finds the listeners on :4000/:8000/:3000 and stops their
# processes. Use before git operations that touch running files, or for restarts.
#
# Usage:  powershell -ExecutionPolicy Bypass -File scripts\stop-all.ps1

$ports = @(
  @{ n = 'API :4000';      p = 4000 },
  @{ n = 'Laya :8000';     p = 8000 },
  @{ n = 'Frontend :3000'; p = 3000 }
)

foreach ($s in $ports) {
  $conns = Get-NetTCPConnection -LocalPort $s.p -State Listen -ErrorAction SilentlyContinue
  if (-not $conns) { Write-Host "[down]    $($s.n) — not running"; continue }
  $pids = $conns | Select-Object -ExpandProperty OwningProcess -Unique
  foreach ($procId in $pids) {
    try {
      $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
      if ($proc) {
        Stop-Process -Id $procId -Force -ErrorAction Stop
        Write-Host "[stopped] $($s.n) (pid $procId — $($proc.ProcessName))"
      }
    } catch { Write-Host "[error]   could not stop pid $procId : $($_.Exception.Message)" }
  }
}

Write-Host ''
Write-Host '=== post-shutdown check ==='
foreach ($s in $ports) {
  $still = Get-NetTCPConnection -LocalPort $s.p -State Listen -ErrorAction SilentlyContinue
  if ($still) { Write-Host "  [still up] $($s.n)" } else { Write-Host "  [down]     $($s.n)" }
}
