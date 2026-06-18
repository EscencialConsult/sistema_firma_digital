param(
  [switch]$SkipInstall,
  [switch]$SkipAgent,
  [switch]$SkipStop
)

$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$portal = Join-Path $root "web-portal"
$agent = Join-Path $root "local-agent"
$portalEnv = Join-Path $portal ".env"
$portalEnvExample = Join-Path $portal ".env.example"
$portalOut = Join-Path $root "tmp-portal-out.log"
$portalErr = Join-Path $root "tmp-portal-err.log"
$agentOut = Join-Path $root "tmp-agent-out.log"
$agentErr = Join-Path $root "tmp-agent-err.log"

function Wait-ForUrl($url, $name) {
  for ($i = 0; $i -lt 40; $i++) {
    try {
      Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2 | Out-Null
      Write-Host "$name listo: $url" -ForegroundColor Green
      return
    } catch {
      Start-Sleep -Seconds 1
    }
  }

  throw "$name no respondio en $url. Revisa los logs."
}

function Ensure-Env($target, $example) {
  if (-not (Test-Path -LiteralPath $target)) {
    Copy-Item -LiteralPath $example -Destination $target
    Write-Host "Creado $target desde .env.example"
  }
}

function Ensure-NodeModules($folder) {
  $nodeModules = Join-Path $folder "node_modules"
  if (-not (Test-Path -LiteralPath $nodeModules)) {
    Write-Host "Instalando dependencias en $folder..."
    npm --prefix $folder install
  }
}

if (-not $SkipStop) {
  & (Join-Path $PSScriptRoot "stop-dev.ps1")
}

Ensure-Env $portalEnv $portalEnvExample

if (-not $SkipInstall) {
  Ensure-NodeModules $portal
  if (-not $SkipAgent -and (Test-Path $agent)) {
    Ensure-NodeModules $agent
  }
}

Remove-Item -LiteralPath $portalOut, $portalErr, $agentOut, $agentErr -ErrorAction SilentlyContinue

$npm = (Get-Command npm.cmd -ErrorAction SilentlyContinue)
if (-not $npm) {
  $npm = Get-Command npm
}

# Start local-agent (optional, for PKCS#11 / Windows cert signing)
if (-not $SkipAgent -and (Test-Path (Join-Path $agent "dist/server.js"))) {
  Write-Host "Iniciando local-agent..."
  Start-Process -FilePath $npm.Source `
    -ArgumentList @("run", "start") `
    -WorkingDirectory $agent `
    -RedirectStandardOutput $agentOut `
    -RedirectStandardError $agentErr `
    -WindowStyle Hidden | Out-Null

  Wait-ForUrl "http://127.0.0.1:4001/api/agent/pkcs11/tokens" "local-agent"
}

Write-Host "Iniciando portal..."
Start-Process -FilePath $npm.Source `
  -ArgumentList @("run", "dev", "--", "--host", "127.0.0.1") `
  -WorkingDirectory $portal `
  -RedirectStandardOutput $portalOut `
  -RedirectStandardError $portalErr `
  -WindowStyle Hidden | Out-Null

Wait-ForUrl "http://127.0.0.1:5173" "Portal"

Write-Host ""
Write-Host "App lista." -ForegroundColor Green
Write-Host "Portal:  http://127.0.0.1:5173"
if (-not $SkipAgent -and (Test-Path $agent)) {
  Write-Host "Agent:   http://127.0.0.1:4001"
}
Write-Host "Admin:   admin@example.com / Admin123456"
Write-Host ""
Write-Host "Logs:"
Write-Host "  Portal:  $portalOut"
if (-not $SkipAgent -and (Test-Path $agent)) {
  Write-Host "  Agent:   $agentOut"
}
Write-Host ""
Write-Host "Para verificar: npm run check"
Write-Host "Para apagar:    npm run stop"
