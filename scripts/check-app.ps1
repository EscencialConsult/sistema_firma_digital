$ErrorActionPreference = "Stop"

$backendUrl = "http://127.0.0.1:4000"
$frontendUrl = "http://127.0.0.1:5173"
$adminEmail = "admin@example.com"
$adminPassword = "Admin123456"

function Write-Ok($message) {
  Write-Host "[OK] $message" -ForegroundColor Green
}

function Write-Warn($message) {
  Write-Host "[WARN] $message" -ForegroundColor Yellow
}

function Test-Http($name, $scriptBlock) {
  try {
    $result = & $scriptBlock
    Write-Ok $name
    return $result
  } catch {
    Write-Warn "$name fallo: $($_.Exception.Message)"
    return $null
  }
}

Test-Http "Frontend responde en $frontendUrl" {
  Invoke-WebRequest -Uri $frontendUrl -UseBasicParsing -TimeoutSec 5 | Out-Null
}

Test-Http "Backend health responde en $backendUrl/health" {
  Invoke-RestMethod -Method Get "$backendUrl/health" -TimeoutSec 5 | Out-Null
}

$login = Test-Http "Login admin funciona" {
  Invoke-RestMethod -Method Post "$backendUrl/api/auth/login" `
    -ContentType "application/json" `
    -Body (@{ email = $adminEmail; password = $adminPassword } | ConvertTo-Json) `
    -TimeoutSec 10
}

if ($login -and $login.accessToken) {
  $headers = @{ Authorization = "Bearer $($login.accessToken)" }

  Test-Http "Perfil autenticado responde" {
    Invoke-RestMethod -Method Get "$backendUrl/api/users/me" -Headers $headers -TimeoutSec 10 | Out-Null
  }

  $documents = Test-Http "Repositorio de documentos responde" {
    Invoke-RestMethod -Method Get "$backendUrl/api/documents" -Headers $headers -TimeoutSec 10
  }

  if ($documents -and $documents.data) {
    Write-Ok "Documentos disponibles: $($documents.data.Count)"
  }

  $tokens = Test-Http "Deteccion de certificados/tokens responde" {
    Invoke-RestMethod -Method Get "$backendUrl/api/documents/pkcs11/tokens" -Headers $headers -TimeoutSec 20
  }

  if ($tokens -and $tokens.data -and $tokens.data.tokens) {
    $usable = @($tokens.data.tokens | Where-Object { -not $_.error })
    if ($usable.Count -gt 0) {
      Write-Ok "Tokens/certificados utilizables detectados: $($usable.Count)"
    } else {
      Write-Warn "La API responde, pero no encontro tokens/certificados utilizables."
    }
  }
}

Write-Host ""
Write-Host "URLs:"
Write-Host "  Portal:  $frontendUrl"
Write-Host "  Backend: $backendUrl"
Write-Host "  Admin:   $adminEmail / $adminPassword"
