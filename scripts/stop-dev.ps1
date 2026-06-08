$ErrorActionPreference = "Stop"

$rootText = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

$processes = Get-CimInstance Win32_Process -Filter "name = 'node.exe'" |
  Where-Object {
    $_.CommandLine -and
    $_.CommandLine.Contains($rootText) -and
    ($_.CommandLine.Contains("web-backend") -or $_.CommandLine.Contains("web-portal"))
  }

if (-not $processes) {
  Write-Host "No hay procesos Node de la app para detener."
  exit 0
}

foreach ($process in $processes) {
  Write-Host "Deteniendo proceso $($process.ProcessId)..."
  Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
}

Write-Host "Procesos de la app detenidos."
