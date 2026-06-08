param(
  [switch]$SkipInstall,
  [switch]$SkipStop
)

$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$backend = Join-Path $root "web-backend"
$portal = Join-Path $root "web-portal"
$backendEnv = Join-Path $backend ".env"
$portalEnv = Join-Path $portal ".env"
$backendEnvExample = Join-Path $backend ".env.example"
$portalEnvExample = Join-Path $portal ".env.example"
$backendOut = Join-Path $root "tmp-backend-out.log"
$backendErr = Join-Path $root "tmp-backend-err.log"
$portalOut = Join-Path $root "tmp-portal-out.log"
$portalErr = Join-Path $root "tmp-portal-err.log"

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

Ensure-Env $backendEnv $backendEnvExample
Ensure-Env $portalEnv $portalEnvExample

if (-not $SkipInstall) {
  Ensure-NodeModules $backend
  Ensure-NodeModules $portal
}

Write-Host "Levantando PostgreSQL..."
docker compose -f (Join-Path $root "docker-compose.yml") up -d postgres

Write-Host "Ejecutando migraciones y seed..."
npm --prefix $backend run db:migrate
npm --prefix $backend run db:seed

Remove-Item -LiteralPath $backendOut, $backendErr, $portalOut, $portalErr -ErrorAction SilentlyContinue

$npm = (Get-Command npm.cmd -ErrorAction SilentlyContinue)
if (-not $npm) {
  $npm = Get-Command npm
}

Write-Host "Iniciando backend..."
Start-Process -FilePath $npm.Source `
  -ArgumentList @("run", "dev") `
  -WorkingDirectory $backend `
  -RedirectStandardOutput $backendOut `
  -RedirectStandardError $backendErr `
  -WindowStyle Hidden | Out-Null

Wait-ForUrl "http://127.0.0.1:4000/health" "Backend"

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
Write-Host "Backend: http://127.0.0.1:4000"
Write-Host "Admin:   admin@example.com / Admin123456"
Write-Host ""
Write-Host "Logs:"
Write-Host "  Backend: $backendOut"
Write-Host "  Portal:  $portalOut"
Write-Host ""
Write-Host "Para verificar: npm run check"
Write-Host "Para apagar:    npm run stop"
