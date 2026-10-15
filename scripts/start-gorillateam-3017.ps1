$ErrorActionPreference = 'Stop'

# Inicia o Gorilla.Team em segundo plano (sem janela) na porta 3017.
# Chamado na inicialização do Windows pelo atalho gorillateam-3017-start.cmd
# da pasta Inicializar; também pode ser executado manualmente.

$port = 3017
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

$existingListener = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($existingListener) {
  Write-Host "A porta $port ja esta em uso. Nenhuma nova instancia sera iniciada."
  exit 0
}

# Mesmo ambiente do GymDiet (3016): mesmo banco e mesma pasta de imagens.
# SESSION_SECRET e o restante vêm do .env (fora do Git; dotenv não sobrescreve as daqui).
$env:PORT = "$port"
$env:NODE_ENV = 'development'
$env:DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/postgres'
$env:STORAGE_PROVIDER = 'local'
$env:LOCAL_STORAGE_PATH = 'D:\gymdietimages'
$env:LOCAL_STORAGE_PUBLIC_BASE_PATH = '/media'
$env:MAX_EXERCISE_IMAGE_SIZE_BYTES = '10485760'

$logDir = Join-Path $repoRoot 'logs'
New-Item -ItemType Directory -Force $logDir | Out-Null
$outLog = Join-Path $logDir "gorillateam-$port.log"
$errLog = Join-Path $logDir "gorillateam-$port.err.log"

Start-Process -FilePath $nodePath -ArgumentList 'app.js' -WorkingDirectory $repoRoot `
  -WindowStyle Hidden -RedirectStandardOutput $outLog -RedirectStandardError $errLog

Write-Host "Gorilla.Team iniciado em segundo plano: http://localhost:$port (logs em $logDir)"
