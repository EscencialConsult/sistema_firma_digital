param(
  [Parameter(Mandatory = $true)][string]$InputPath,
  [Parameter(Mandatory = $true)][string]$OutputPath,
  [Parameter(Mandatory = $true)][string]$Thumbprint
)

Add-Type -AssemblyName System.Security

$normalizedThumbprint = $Thumbprint -replace '\s', ''
$cert = Get-ChildItem -Path "Cert:\CurrentUser\My\$normalizedThumbprint" -ErrorAction SilentlyContinue
if (-not $cert) {
  $cert = Get-ChildItem -Path "Cert:\LocalMachine\My\$normalizedThumbprint" -ErrorAction SilentlyContinue
}
if (-not $cert) {
  throw "No se encontro el certificado $normalizedThumbprint en el almacen de Windows."
}
if (-not $cert.HasPrivateKey) {
  throw "El certificado $normalizedThumbprint no tiene clave privada disponible."
}

$contentBytes = [System.IO.File]::ReadAllBytes($InputPath)
$contentInfo = New-Object System.Security.Cryptography.Pkcs.ContentInfo -ArgumentList @(,$contentBytes)
$signedCms = New-Object System.Security.Cryptography.Pkcs.SignedCms -ArgumentList $contentInfo, $true
$cmsSigner = New-Object System.Security.Cryptography.Pkcs.CmsSigner -ArgumentList ([System.Security.Cryptography.Pkcs.SubjectIdentifierType]::IssuerAndSerialNumber), $cert
$cmsSigner.IncludeOption = [System.Security.Cryptography.X509Certificates.X509IncludeOption]::ExcludeRoot

$signedCms.ComputeSignature($cmsSigner, $false)
[System.IO.File]::WriteAllBytes($OutputPath, $signedCms.Encode())
