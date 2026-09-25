# Spinach OS — Phase 1: verify-profiles.ps1
# Checks every agent profile in the live Hermes runtime against the repo's
# hermes-profiles/ source of truth: SOUL.md present, spinach-os skill bundle
# present (the t_b3b75be0 crash-loop cause), no drift between repo and live.
#
# Usage:  powershell -ExecutionPolicy Bypass -File scripts\verify-profiles.ps1
# Fix mode:  powershell -ExecutionPolicy Bypass -File scripts\verify-profiles.ps1 -Fix

param([switch]$Fix)

$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
$hermes = Join-Path $env:LOCALAPPDATA 'hermes'
$profiles = @('ceo','cto','orchestrator','designer','engineer','social','seo_specialist','research','sales','ads_manager')

$fail = 0; $fixed = 0
foreach ($p in $profiles) {
  $live = Join-Path $hermes "profiles\$p"
  $repo = Join-Path $root "hermes-profiles\$p"

  # 1. profile dir exists in the live runtime
  if (-not (Test-Path $live)) { Write-Host "[FAIL] $p — profile dir missing in Hermes runtime"; $fail++; continue }

  # 2. SOUL.md present (live + repo)
  if (-not (Test-Path (Join-Path $live 'SOUL.md'))) { Write-Host "[FAIL] $p — SOUL.md missing in live profile"; $fail++; continue }
  if (-not (Test-Path (Join-Path $repo 'SOUL.md'))) { Write-Host "[FAIL] $p — SOUL.md missing in repo export (re-run scripts/export-profiles.js)"; $fail++; continue }

  # 3. spinach-os skill bundle present (the t_b3b75be0 crash-loop cause)
  $bundle = Join-Path $live 'skills\spinach-os'
  if (-not (Test-Path $bundle)) {
    if ($Fix) {
      $srcBundle = Join-Path $hermes 'skills\spinach-os'
      if (Test-Path $srcBundle) {
        New-Item -ItemType Directory -Force -Path (Join-Path $live 'skills') | Out-Null
        Copy-Item -Path $srcBundle -Destination $bundle -Recurse -Force
        Write-Host "[FIXED]  $p — spinach-os bundle copied from default profile"
        $fixed++
      } else { Write-Host "[FAIL] $p — spinach-os bundle missing everywhere (default profile too)"; $fail++; continue }
    } else { Write-Host "[DRIFT] $p — spinach-os bundle MISSING (run with -Fix to copy)"; $fail++; continue }
  }

  # 4. pinned skills resolve: any spinach-* skill the runtime may pin must exist in the bundle
  $bundleSkills = Get-ChildItem -Path $bundle -Directory -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Name
  if (-not ($bundleSkills -contains 'spinach-cto-agent')) { Write-Host "[FAIL] $p — spinach-cto-agent missing from bundle"; $fail++; continue }

  # 5. drift: repo SOUL.md differs from live?
  $liveSoul = (Get-FileHash (Join-Path $live 'SOUL.md')).Hash
  $repoSoul = (Get-FileHash (Join-Path $repo 'SOUL.md')).Hash
  if ($liveSoul -ne $repoSoul) { Write-Host "[DRIFT] $p — SOUL.md differs repo↔live (re-export or re-apply)"; $fail++; continue }

  Write-Host "[ok]     $p"
}

Write-Host ''
if ($fail -eq 0) { Write-Host "=== ALL 10 PROFILES CLEAN ===" }
else { Write-Host "=== $fail issue(s) found, $fixed fixed — re-run to confirm ===" }
