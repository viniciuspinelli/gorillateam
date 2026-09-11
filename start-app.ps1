$ErrorActionPreference = 'SilentlyContinue'
$pid = (Get-NetTCPConnection -LocalPort 3010 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique)
if ($pid) { taskkill /F /PID $pid | Out-Null }
Start-Sleep -Seconds 2
$env:PORT = '3010'
$env:SESSION_SECRET = 'local-dev-secret-change-in-prod'
$env:NODE_ENV = 'development'
$env:DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/postgres'
node app.js
