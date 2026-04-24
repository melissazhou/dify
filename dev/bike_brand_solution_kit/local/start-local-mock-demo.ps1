[CmdletBinding()]
param(
    [ValidateRange(1, 65535)]
    [int]$ApiPort = 5001,
    [ValidateRange(1, 65535)]
    [int]$WebPort = 3100,
    [switch]$SkipInstall
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$LocalDir = $PSScriptRoot
$KitDir = Split-Path -Parent $LocalDir
$DevDir = Split-Path -Parent $KitDir
$RootDir = Split-Path -Parent $DevDir
$WebDir = Join-Path -Path $RootDir -ChildPath "web"
$ApiScript = Join-Path -Path $LocalDir -ChildPath "mock_console_api.py"
$LogDir = Join-Path -Path $LocalDir -ChildPath "logs"

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "==> $Message"
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

    $process = Start-Process `
        -FilePath "powershell.exe" `
        -ArgumentList @(
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-EncodedCommand",
            (ConvertTo-EncodedCommand -Command $Command)
        ) `
        -RedirectStandardOutput $StdoutPath `
        -RedirectStandardError $StderrPath `
        -WindowStyle Hidden `
        -PassThru

    Set-Content -LiteralPath $PidPath -Value $process.Id
    Write-Host "    $Name PID: $($process.Id)"
    Write-Host "    stdout: $StdoutPath"
    Write-Host "    stderr: $StderrPath"
}

if (Test-TcpPortOpen -Port $ApiPort) {
    throw "API port $ApiPort is already in use."
}

if (Test-TcpPortOpen -Port $WebPort) {
    throw "Web port $WebPort is already in use."
}

if (-not $SkipInstall) {
    Write-Step "Ensuring frontend dependencies are linked"
    Push-Location -LiteralPath $RootDir
    try {
        pnpm install --frozen-lockfile=false --offline --ignore-scripts
        if ($LASTEXITCODE -ne 0) {
            throw "pnpm install failed with exit code $LASTEXITCODE"
        }
    }
    finally {
        Pop-Location
    }
}

Write-Step "Starting mock API and Next.js demo"
New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"

$rootDirLiteral = ConvertTo-PowerShellLiteral -Value $RootDir
$webDirLiteral = ConvertTo-PowerShellLiteral -Value $WebDir
$apiScriptLiteral = ConvertTo-PowerShellLiteral -Value $ApiScript

$apiCommand = @"
`$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $rootDirLiteral
& python $apiScriptLiteral --port $ApiPort
exit `$LASTEXITCODE
"@

$webCommand = @"
`$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $webDirLiteral
`$env:PORT = '$WebPort'
`$env:NEXT_PUBLIC_API_PREFIX = 'http://localhost:$ApiPort/console/api'
`$env:NEXT_PUBLIC_PUBLIC_API_PREFIX = 'http://localhost:$ApiPort/api'
`$env:NEXT_PUBLIC_MARKETPLACE_API_PREFIX = 'http://localhost:$ApiPort/marketplace/api'
& pnpm run dev -- --port $WebPort
exit `$LASTEXITCODE
"@

Start-LoggedPowerShellProcess `
    -Name "Mock API" `
    -Command $apiCommand `
    -StdoutPath (Join-Path -Path $LogDir -ChildPath "mock-api-$timestamp.out.log") `
    -StderrPath (Join-Path -Path $LogDir -ChildPath "mock-api-$timestamp.err.log") `
    -PidPath (Join-Path -Path $LocalDir -ChildPath "mock-api.pid")

Start-LoggedPowerShellProcess `
    -Name "Web" `
    -Command $webCommand `
    -StdoutPath (Join-Path -Path $LogDir -ChildPath "mock-web-$timestamp.out.log") `
    -StderrPath (Join-Path -Path $LogDir -ChildPath "mock-web-$timestamp.err.log") `
    -PidPath (Join-Path -Path $LocalDir -ChildPath "mock-web.pid")

Write-Step "Local mock demo startup requested"
Write-Host "    API URL: http://localhost:$ApiPort"
Write-Host "    Web URL: http://localhost:$WebPort/bike-brand-demo"
Write-Host "    Health check: powershell -ExecutionPolicy Bypass -File `"$LocalDir\healthcheck-local-demo.ps1`" -ApiBaseUrl http://localhost:$ApiPort -WebBaseUrl http://localhost:$WebPort -WebPath /bike-brand-demo"
