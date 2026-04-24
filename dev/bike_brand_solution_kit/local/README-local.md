# Bike Brand Local Demo

These scripts start the Dify middleware, API, and Web services needed to
exercise the bike brand solution kit locally on Windows PowerShell.

They do not write real API keys. If an environment file is missing, the startup
script copies the checked-in example file:

- `api/.env.example` -> `api/.env`
- `web/.env.example` -> `web/.env.local`
- `docker/middleware.env.example` -> `docker/middleware.env`

Review those generated files before using non-demo credentials.

## Prerequisites

- Windows PowerShell 5.1 or newer.
- Docker Desktop with the Docker Compose plugin.
- Python available as `python` or `py`.
- `uv` for backend dependency management.
- Node.js matching the repository `engines.node` range.
- `pnpm` matching the repository `packageManager` version.

Install examples:

```powershell
winget install --id Docker.DockerDesktop -e
winget install --id Python.Python.3.12 -e
winget install --id astral-sh.uv -e
corepack enable
corepack prepare pnpm@10.33.0 --activate
```

If `corepack` is not available, install a current Node.js release first.

## Start

From the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File .\dev\bike_brand_solution_kit\local\start-local-demo.ps1
```

If the full Dify API dependency sync is blocked by Python package download
timeouts, use the local mock stack. It reuses
`api/services/bike_brand_solution_kit_service.py`, exposes the same bike brand
console endpoints, and serves the standalone demo page at `/bike-brand-demo`:

```powershell
powershell -ExecutionPolicy Bypass -File .\dev\bike_brand_solution_kit\local\start-local-mock-demo.ps1 -ApiPort 5001 -WebPort 3100
```

The default ports are:

- API: `http://localhost:5001`
- Web: `http://localhost:3000`

Useful options:

```powershell
# Middleware is already running.
powershell -ExecutionPolicy Bypass -File .\dev\bike_brand_solution_kit\local\start-local-demo.ps1 -SkipDocker

# Dependencies are already installed.
powershell -ExecutionPolicy Bypass -File .\dev\bike_brand_solution_kit\local\start-local-demo.ps1 -SkipInstall

# Custom ports.
powershell -ExecutionPolicy Bypass -File .\dev\bike_brand_solution_kit\local\start-local-demo.ps1 -ApiPort 5101 -WebPort 3100
```

Logs are written to `dev/bike_brand_solution_kit/local/logs/`. Process IDs are
written to `api.pid` and `web.pid` in the same local directory.

Stop the background services:

```powershell
Stop-Process -Id (Get-Content .\dev\bike_brand_solution_kit\local\api.pid)
Stop-Process -Id (Get-Content .\dev\bike_brand_solution_kit\local\web.pid)
```

## Health Check

After startup has had time to finish migrations and compile the frontend, run:

```powershell
powershell -ExecutionPolicy Bypass -File .\dev\bike_brand_solution_kit\local\healthcheck-local-demo.ps1
```

For custom ports:

```powershell
powershell -ExecutionPolicy Bypass -File .\dev\bike_brand_solution_kit\local\healthcheck-local-demo.ps1 -ApiBaseUrl http://localhost:5101 -WebBaseUrl http://localhost:3100
```

For the mock stack:

```powershell
powershell -ExecutionPolicy Bypass -File .\dev\bike_brand_solution_kit\local\healthcheck-local-demo.ps1 -ApiBaseUrl http://localhost:5001 -WebBaseUrl http://localhost:3100 -WebPath /bike-brand-demo
```

The health check validates:

- `GET /console/api/ping`
- `GET /console/api/bike-brand/solution-kit/summary`
- the configured frontend path, `/bike-brand` for the full stack or
  `/bike-brand-demo` for the mock stack

## Common Issues

### Docker is installed but middleware does not start

Start Docker Desktop and rerun the script. If another local middleware stack is
already running, use `-SkipDocker`.

### A port is already in use

Use `-ApiPort` or `-WebPort` to choose another port. The script warns before
starting if the requested port is already accepting connections.

### Frontend cannot reach the API

When using custom ports, start the Web service through this script so it can set
`NEXT_PUBLIC_API_PREFIX` and `NEXT_PUBLIC_PUBLIC_API_PREFIX` for the spawned
process.

### Health check fails immediately after startup

Wait for backend migrations and Next.js compilation to finish, then rerun the
health check. Check `local/logs/api-*.err.log` and `local/logs/web-*.err.log`
for startup failures.

### Missing `uv` or `pnpm`

The startup script prints missing tools and stops instead of failing silently.
Install the missing tool, open a new PowerShell session so `PATH` is refreshed,
and rerun the script.
