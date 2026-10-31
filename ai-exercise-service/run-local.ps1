$ErrorActionPreference = 'Stop'

$python = Join-Path $PSScriptRoot '.venv\Scripts\python.exe'
$model = Join-Path $PSScriptRoot 'models\pose_landmarker_lite.task'
$backendEnv = Join-Path $PSScriptRoot '..\backend\.env'
$experimentalLine = Get-Content $backendEnv | Where-Object { $_ -match '^AI_EXPERIMENTAL_EVALUATION=' } | Select-Object -Last 1
$experimental = if ($experimentalLine) { ($experimentalLine -split '=', 2)[1].Trim().Trim('"', "'") } else { 'false' }
$experimentalEnabled = $experimental -eq 'true'

$health = $null
try { $health = Invoke-RestMethod 'http://127.0.0.1:8001/health' -TimeoutSec 2 } catch { }
if ($health -and ($health.PSObject.Properties.Name -contains 'ready')) {
    if (-not $health.ready) { throw 'AI service is already running on port 8001, but its model is not ready.' }
    if (-not ($health.PSObject.Properties.Name -contains 'experimentalEvaluationEnabled') -or $health.experimentalEvaluationEnabled -ne $experimentalEnabled) {
        throw 'AI service on port 8001 is stale or has a different experimental mode. Restart that AI service process, then run this launcher again.'
    }
    if ($health.experimentalRuleVersion -ne 'technique-experimental-4') {
        throw 'AI service on port 8001 has an older experimental rule version. Restart that AI service process.'
    }
    Write-Host 'AI service is already running on http://127.0.0.1:8001 (ready=true).'
    exit 0
}

$listener = Get-NetTCPConnection -LocalPort 8001 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($listener) { throw "Port 8001 is already in use by process $($listener.OwningProcess)." }

if (-not (Test-Path $python)) { throw 'Python environment is missing. Install requirements.txt first.' }
if (-not (Test-Path $model)) { throw 'Pose Landmarker model is missing.' }
if (-not (Test-Path $backendEnv)) { throw 'backend/.env is missing.' }

$keyLine = Get-Content $backendEnv | Where-Object { $_ -match '^AI_SERVICE_KEY=' } | Select-Object -Last 1
$key = if ($keyLine) { ($keyLine -split '=', 2)[1].Trim().Trim('"', "'") } else { '' }
if (-not $key) { throw 'AI_SERVICE_KEY is missing in backend/.env.' }

$env:AI_SERVICE_KEY = $key
$env:EXPERIMENTAL_EVALUATION_ENABLED = if ($experimentalEnabled) { 'true' } else { 'false' }
$env:MPLCONFIGDIR = Join-Path $PSScriptRoot '.venv\mplconfig'
New-Item -ItemType Directory -Force $env:MPLCONFIGDIR | Out-Null
Set-Location $PSScriptRoot
& $python -m uvicorn main:app --host 127.0.0.1 --port 8001
exit $LASTEXITCODE
