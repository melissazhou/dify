[CmdletBinding()]
param(
    [string]$ApiBaseUrl = "http://localhost:5001",
    [string]$WebBaseUrl = "http://localhost:3000",
    [string]$WebPath = "/bike-brand",
    [ValidateRange(1, 120)]
    [int]$TimeoutSeconds = 10
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Join-Url {
    param(
        [string]$BaseUrl,
        [string]$Path
    )

    return $BaseUrl.TrimEnd("/") + "/" + $Path.TrimStart("/")
}

function Invoke-HealthRequest {
    param(
        [string]$Name,
        [string]$Url
    )

    try {
        $response = Invoke-WebRequest -Uri $Url -Method Get -TimeoutSec $TimeoutSeconds -UseBasicParsing
        $statusCode = [int]$response.StatusCode
        $ok = $statusCode -ge 200 -and $statusCode -lt 400

        return [PSCustomObject]@{
            Name = $Name
            Url = $Url
            StatusCode = $statusCode
            Ok = $ok
            Detail = "HTTP $statusCode"
        }
    }
    catch {
        $response = $_.Exception.Response
        if ($null -ne $response) {
            $statusCode = [int]$response.StatusCode
            return [PSCustomObject]@{
                Name = $Name
                Url = $Url
                StatusCode = $statusCode
                Ok = $false
                Detail = "HTTP $statusCode"
            }
        }

        return [PSCustomObject]@{
            Name = $Name
            Url = $Url
            StatusCode = $null
            Ok = $false
            Detail = $_.Exception.Message
        }
    }
}

$checks = @(
    @{
        Name = "console ping"
        Url = Join-Url -BaseUrl $ApiBaseUrl -Path "/console/api/ping"
    },
    @{
        Name = "bike solution summary"
        Url = Join-Url -BaseUrl $ApiBaseUrl -Path "/console/api/bike-brand/solution-kit/summary"
    },
    @{
        Name = "bike brand frontend"
        Url = Join-Url -BaseUrl $WebBaseUrl -Path $WebPath
    }
)

$failed = New-Object System.Collections.Generic.List[object]

Write-Host "Local demo health check"
Write-Host "API base: $ApiBaseUrl"
Write-Host "Web base: $WebBaseUrl"
Write-Host "Web path: $WebPath"
Write-Host ""

foreach ($check in $checks) {
    $result = Invoke-HealthRequest -Name $check.Name -Url $check.Url
    if ($result.Ok) {
        Write-Host "[OK]   $($result.Name) - $($result.Detail) - $($result.Url)"
    }
    else {
        Write-Host "[FAIL] $($result.Name) - $($result.Detail) - $($result.Url)"
        $failed.Add($result)
    }
}

if ($failed.Count -gt 0) {
    Write-Host ""
    Write-Host "Health check failed for $($failed.Count) endpoint(s). Check logs under dev/bike_brand_solution_kit/local/logs/."
    exit 1
}

Write-Host ""
Write-Host "All local demo endpoints responded successfully."
