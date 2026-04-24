[CmdletBinding()]
param(
    [switch]$SkipDocker,
    [switch]$SkipInstall,
    [ValidateRange(1, 65535)]
    [int]$ApiPort = 5001,
    [ValidateRange(1, 65535)]
    [int]$WebPort = 3000
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$LocalDir = $PSScriptRoot
$KitDir = Split-Path -Parent $LocalDir
$DevDir = Split-Path -Parent $KitDir
$RootDir = Split-Path -Parent $DevDir
$ApiDir = Join-Path -Path $RootDir -ChildPath "api"
$WebDir = Join-Path -Path $RootDir -ChildPath "web"
$DockerDir = Join-Path -Path $RootDir -ChildPath "docker"
$LogDir = Join-Path -Path $LocalDir -ChildPath "logs"

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "==> $Message"
}

function Write-Info {
    param([string]$Message)
    Write-Host "    $Message"
}

function Get-Tool {
    param([string[]]$Names)

    foreach ($name in $Names) {
        $command = Get-Command -Name $name -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($null -ne $command) {
            return $command
        }
    }

    return $null
}

function Get-ToolVersion {
    param(
        [System.Management.Automation.CommandInfo]$Command,
        [string[]]$Arguments
    )

    try {
        $output = & $Command.Source @Arguments 2>&1 | Select-Object -First 1
        if ($null -eq $output) {
            return "version unavailable"
        }

        return $output.ToString()
    }
    catch {
        return "version check failed: $($_.Exception.Message)"
    }
}

function Assert-FileExists {
    param([string]$Path)

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "Required file not found: $Path"
    }
}

function Copy-EnvIfMissing {
    param(
        [string]$Source,
        [string]$Destination
    )

    Assert-FileExists -Path $Source

    if (Test-Path -LiteralPath $Destination -PathType Leaf) {
        Write-Info "exists: $Destination"
        return
    }

    Copy-Item -LiteralPath $Source -Destination $Destination
    Write-Info "created: $Destination"
}

function Invoke-ExternalCommand {
    param(
        [string]$FilePath,
        [string[]]$Arguments,
        [string]$WorkingDirectory
    )

    Push-Location -LiteralPath $WorkingDirectory
    try {
        & $FilePath @Arguments
        if ($LASTEXITCODE -ne 0) {
            throw "Command failed with exit code ${LASTEXITCODE}: $FilePath $($Arguments -join ' ')"
        }
    }
    finally {
        Pop-Location
    }
}

function Test-DockerDaemon {
    try {
        & docker info *> $null
        return $LASTEXITCODE -eq 0
    }
    catch {
        return $false
    }
}

function Test-DockerCompose {
    try {
        & docker compose version *> $null
        return $LASTEXITCODE -eq 0
    }
    catch {
        return $false
    }
}

function Test-TcpPortOpen {
    param([int]$Port)

    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $result = $client.BeginConnect("127.0.0.1", $Port, $null, $null)
        $connected = $result.AsyncWaitHandle.WaitOne(300, $false)
        if ($connected) {
            $client.EndConnect($result)
        }

        return $connected
    }
    catch {
        return $false
    }
    finally {
        $client.Close()
    }
}

function ConvertTo-EncodedCommand {
    param([string]$Command)
    return [Convert]::ToBase64String([System.Text.Encoding]::Unicode.GetBytes($Command))
}

function ConvertTo-PowerShellLiteral {
    param([string]$Value)
    return "'" + $Value.Replace("'", "''") + "'"
}

function Start-LoggedPowerShellProcess {
    param(
        [string]$Name,
        [string]$Command,
        [string]$StdoutPath,
        [string]$StderrPath,
        [string]$PidPath
    )

    $encodedCommand = ConvertTo-EncodedCommand -Command $Command
    $arguments = @(
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-EncodedCommand",
        $encodedCommand
    )

    $process = Start-Process `
        -FilePath "powershell.exe" `
        -ArgumentList $arguments `
        -RedirectStandardOutput $StdoutPath `
        -RedirectStandardError $StderrPath `
        -WindowStyle Hidden `
        -PassThru

    Set-Content -LiteralPath $PidPath -Value $process.Id
    Write-Info "$Name started with PID $($process.Id)"
    Write-Info "stdout: $StdoutPath"
    Write-Info "stderr: $StderrPath"
}

Write-Step "Checking local prerequisites"
$docker = Get-Tool -Names @("docker")
$pnpm = Get-Tool -Names @("pnpm")
$uv = Get-Tool -Names @("uv")
$python = Get-Tool -Names @("python", "py")

$missing = New-Object System.Collections.Generic.List[string]

if ($null -eq $docker) {
    Write-Host "    [missing] docker"
    if (-not $SkipDocker) {
        $missing.Add("docker")
    }
}
else {
    Write-Host "    [ok] docker - $(Get-ToolVersion -Command $docker -Arguments @("--version"))"
}

if ($null -eq $pnpm) {
    Write-Host "    [missing] pnpm"
    $missing.Add("pnpm")
}
else {
    Write-Host "    [ok] pnpm - $(Get-ToolVersion -Command $pnpm -Arguments @("--version"))"
}

if ($null -eq $uv) {
    Write-Host "    [missing] uv"
    $missing.Add("uv")
}
else {
    Write-Host "    [ok] uv - $(Get-ToolVersion -Command $uv -Arguments @("--version"))"
}

if ($null -eq $python) {
    Write-Host "    [missing] Python"
    $missing.Add("Python")
}
else {
    Write-Host "    [ok] Python - $(Get-ToolVersion -Command $python -Arguments @("--version"))"
}

if ($null -ne $docker -and -not $SkipDocker) {
    if (-not (Test-DockerCompose)) {
        Write-Host "    [missing] docker compose plugin"
        $missing.Add("docker compose plugin")
    }
}

if ($missing.Count -gt 0) {
    Write-Host ""
    Write-Error "Missing required local tools: $($missing -join ', '). Install them and rerun this script. Use -SkipDocker only when middleware is already available."
}

Write-Step "Preparing environment files"
Copy-EnvIfMissing `
    -Source (Join-Path -Path $ApiDir -ChildPath ".env.example") `
    -Destination (Join-Path -Path $ApiDir -ChildPath ".env")
Copy-EnvIfMissing `
    -Source (Join-Path -Path $WebDir -ChildPath ".env.example") `
    -Destination (Join-Path -Path $WebDir -ChildPath ".env.local")
Copy-EnvIfMissing `
    -Source (Join-Path -Path $DockerDir -ChildPath "middleware.env.example") `
    -Destination (Join-Path -Path $DockerDir -ChildPath "middleware.env")

if (-not $SkipInstall) {
    Write-Step "Installing backend dependencies"
    Invoke-ExternalCommand -FilePath "uv" -Arguments @("sync", "--group", "dev") -WorkingDirectory $ApiDir

    Write-Step "Installing frontend workspace dependencies"
    Invoke-ExternalCommand -FilePath "pnpm" -Arguments @("--dir", $RootDir, "install") -WorkingDirectory $RootDir
}
else {
    Write-Step "Skipping dependency installation"
}

if ($SkipDocker) {
    Write-Step "Skipping Docker middleware startup"
}
else {
    Write-Step "Starting Docker middleware"
    if (-not (Test-DockerDaemon)) {
        throw "Docker is installed but the Docker daemon is not reachable. Start Docker Desktop, then rerun this script or use -SkipDocker if middleware is already running."
    }

    Invoke-ExternalCommand `
        -FilePath "docker" `
        -Arguments @("compose", "--env-file", "middleware.env", "-f", "docker-compose.middleware.yaml", "-p", "dify", "up", "-d") `
        -WorkingDirectory $DockerDir
}

Write-Step "Starting API and Web in background"
New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"

if (Test-TcpPortOpen -Port $ApiPort) {
    Write-Warning "Port $ApiPort is already accepting connections. The API process may fail to bind."
}

if (Test-TcpPortOpen -Port $WebPort) {
    Write-Warning "Port $WebPort is already accepting connections. The Web process may fail to bind."
}

$apiDirLiteral = ConvertTo-PowerShellLiteral -Value $ApiDir
$webDirLiteral = ConvertTo-PowerShellLiteral -Value $WebDir
$apiCommand = @"
`$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $apiDirLiteral
`$env:CONSOLE_API_URL = 'http://localhost:$ApiPort'
`$env:SERVICE_API_URL = 'http://localhost:$ApiPort'
`$env:APP_WEB_URL = 'http://localhost:$WebPort'
`$env:FILES_URL = 'http://localhost:$ApiPort'
& uv run flask db upgrade
if (`$LASTEXITCODE -ne 0) { exit `$LASTEXITCODE }
& uv run flask run --host 0.0.0.0 --port=$ApiPort --debug
exit `$LASTEXITCODE
"@

$webCommand = @"
`$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $webDirLiteral
`$env:PORT = '$WebPort'
`$env:NEXT_PUBLIC_API_PREFIX = 'http://localhost:$ApiPort/console/api'
`$env:NEXT_PUBLIC_PUBLIC_API_PREFIX = 'http://localhost:$ApiPort/api'
& pnpm run dev -- --port $WebPort
exit `$LASTEXITCODE
"@

Start-LoggedPowerShellProcess `
    -Name "API" `
    -Command $apiCommand `
    -StdoutPath (Join-Path -Path $LogDir -ChildPath "api-$timestamp.out.log") `
    -StderrPath (Join-Path -Path $LogDir -ChildPath "api-$timestamp.err.log") `
    -PidPath (Join-Path -Path $LocalDir -ChildPath "api.pid")

Start-LoggedPowerShellProcess `
    -Name "Web" `
    -Command $webCommand `
    -StdoutPath (Join-Path -Path $LogDir -ChildPath "web-$timestamp.out.log") `
    -StderrPath (Join-Path -Path $LogDir -ChildPath "web-$timestamp.err.log") `
    -PidPath (Join-Path -Path $LocalDir -ChildPath "web.pid")

Write-Step "Local demo startup requested"
Write-Info "API URL: http://localhost:$ApiPort"
Write-Info "Web URL: http://localhost:$WebPort"
Write-Info "Health check: powershell -ExecutionPolicy Bypass -File `"$LocalDir\healthcheck-local-demo.ps1`" -ApiBaseUrl http://localhost:$ApiPort -WebBaseUrl http://localhost:$WebPort"
Write-Info "Stop processes manually with: Stop-Process -Id (Get-Content `"$LocalDir\api.pid`"), (Get-Content `"$LocalDir\web.pid`")"
