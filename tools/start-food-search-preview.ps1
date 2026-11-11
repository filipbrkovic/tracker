param([int]$Port = 3191)
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$workerDir = Join-Path $repo 'cloudflare/food-search'
$tokenFile = Join-Path $workerDir '.dev.vars'
$wrangler = Join-Path $workerDir 'node_modules/wrangler/bin/wrangler.js'
if (!(Test-Path -LiteralPath $wrangler) -or !(Test-Path -LiteralPath $tokenFile)) {
    throw 'Install the Worker dependencies and create .dev.vars as described in cloudflare/food-search/README.md first.'
}
$tokenLine = [IO.File]::ReadAllLines($tokenFile) | Where-Object { $_ -match '^SEARCH_TOKEN=' } | Select-Object -First 1
$searchToken = ($tokenLine -split '=', 2)[1]
if (!$searchToken -or $searchToken.Length -lt 16) { throw 'SEARCH_TOKEN is missing or too short.' }
$goCommand = Get-Command go -ErrorAction SilentlyContinue
$goExe = if ($goCommand) { $goCommand.Source } else { Join-Path $env:USERPROFILE '.codex/tools/localcal/go/bin/go.exe' }
if (!(Test-Path -LiteralPath $goExe)) { throw 'Install Go 1.26.3 or newer first.' }
$nodeExe = (Get-Command node).Source
$testData = Join-Path $env:TEMP 'localcal-food-search-test'
New-Item -ItemType Directory -Path $testData -Force | Out-Null
$names = @('PORT','DATA_DIR','STATIC_DIR','FOOD_SEARCH_WORKER_URL','FOOD_SEARCH_WORKER_TOKEN','WRANGLER_SEND_METRICS')
$previous = @{}
foreach ($name in $names) { $previous[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
$ownedWorker = $null
try {
    $env:WRANGLER_SEND_METRICS = 'false'
    $probe = [Net.Sockets.TcpClient]::new()
    try { $probe.Connect('127.0.0.1',8787); $workerRunning = $true } catch { $workerRunning = $false } finally { $probe.Dispose() }
    if (!$workerRunning) {
        $ownedWorker = Start-Process -FilePath $nodeExe -ArgumentList @(('"'+$wrangler+'"'),'dev','--ip','127.0.0.1','--port','8787') -WorkingDirectory $workerDir -WindowStyle Hidden -RedirectStandardOutput (Join-Path $testData 'worker.out.log') -RedirectStandardError (Join-Path $testData 'worker.err.log') -PassThru
    }
    $env:PORT = [string]$Port
    $env:DATA_DIR = $testData
    $env:STATIC_DIR = $repo
    $env:FOOD_SEARCH_WORKER_URL = 'http://127.0.0.1:8787/search'
    $env:FOOD_SEARCH_WORKER_TOKEN = $searchToken
    Write-Host "Food search preview: http://localhost:$Port/"
    Write-Host "Separate test database: $testData"
    Write-Host 'Leave this terminal open. Ctrl+C stops the app. The existing preview is unchanged.'
    Push-Location $repo
    try { & $goExe run ./cmd/server } finally { Pop-Location }
} finally {
    foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name,$previous[$name],'Process') }
    if ($ownedWorker -and !$ownedWorker.HasExited) { Stop-Process -Id $ownedWorker.Id }
}
