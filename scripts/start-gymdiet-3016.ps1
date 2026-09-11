$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$nodePath = 'C:\Program Files\nodejs\node.exe'

if (-not (Test-Path $nodePath)) {
  $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
  if ($nodeCmd -and $nodeCmd.Source) {
    $nodePath = $nodeCmd.Source
  } else {
    throw 'Node.js nao encontrado.'
  }
}

$existingListener = Get-NetTCPConnection -LocalPort 3016 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($existingListener) {
  Write-Host 'A porta 3016 ja esta em uso. Nenhuma nova instancia sera iniciada.'
  exit 0
}

$env:PORT = '3016'
$env:SESSION_SECRET = 'local-dev-secret-change-in-prod'
$env:NODE_ENV = 'development'
$env:DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/postgres'
$env:STORAGE_PROVIDER = 'local'
$env:LOCAL_STORAGE_PATH = 'D:\gymdietimages'
$env:LOCAL_STORAGE_PUBLIC_BASE_PATH = '/media'
$env:MAX_EXERCISE_IMAGE_SIZE_BYTES = '10485760'

Set-Location $repoRoot
Write-Host "Iniciando GymDiet em http://localhost:$env:PORT" -ForegroundColor Green
Write-Host 'Mantenha esta janela aberta para a aplicacao permanecer online.' -ForegroundColor Green

& $nodePath 'app.js'
