$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function Fail {
    param([string]$Message)

    if ($script:FrontendTestServer -and -not $script:FrontendTestServer.HasExited) {
        Stop-Process -Id $script:FrontendTestServer.Id -Force -ErrorAction SilentlyContinue
    }

    Write-Host ""
    Write-Host "==================================================" -ForegroundColor Red
    Write-Host "PDA PRE-PUSH CHECK FAILED" -ForegroundColor Red
    Write-Host "==================================================" -ForegroundColor Red
    Write-Host $Message -ForegroundColor Red
    Write-Host ""
    exit 1
}

function Run-Step {
    param(
        [string]$Title,
        [scriptblock]$Command
    )

    Write-Host ""
    Write-Host "==================================================" -ForegroundColor Cyan
    Write-Host $Title -ForegroundColor Cyan
    Write-Host "==================================================" -ForegroundColor Cyan

    & $Command

    if ($LASTEXITCODE -ne 0) {
        Fail "$Title basarisiz oldu."
    }
}

function Wait-Http {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Url,

        [int]$TimeoutSeconds = 90
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)

    do {
        try {
            $response = Invoke-WebRequest `
                -Uri $Url `
                -UseBasicParsing `
                -TimeoutSec 5

            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400) {
                Write-Host "OK: $Url" -ForegroundColor Green
                return
            }
        }
        catch {
            Start-Sleep -Seconds 2
        }
    }
    while ((Get-Date) -lt $deadline)

    Fail "HTTP smoke test timeout: $Url"
}

# ------------------------------------------------------------
# Required files
# ------------------------------------------------------------

if (-not (Test-Path ".env")) {
    Fail "Root .env bulunamadi."
}

if (-not (Test-Path ".env.example")) {
    Fail "Root .env.example bulunamadi."
}

if (-not (Test-Path "backend\pom.xml")) {
    Fail "backend\pom.xml bulunamadi."
}

if (-not (Test-Path "backend\mvnw.cmd")) {
    Fail "backend\mvnw.cmd bulunamadi."
}

if (-not (Test-Path "frontend\package.json")) {
    Fail "frontend\package.json bulunamadi."
}

if (-not (Test-Path "docker-compose.yml")) {
    Fail "docker-compose.yml bulunamadi."
}

# ------------------------------------------------------------
# Load root .env into this process
# ------------------------------------------------------------

Get-Content ".env" | ForEach-Object {
    $line = $_.Trim()

    if ($line -and -not $line.StartsWith("#")) {
        $parts = $line -split "=", 2

        if ($parts.Count -eq 2) {
            $key = $parts[0].Trim()
            $value = $parts[1].Trim()
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
}

# ------------------------------------------------------------
# Git / secret safety
# ------------------------------------------------------------

Run-Step "Git whitespace / conflict check" {
    # Satir sonu (LF/CRLF) uyarilari bu adimi bozmasin; yalnizca bosluk ve conflict hatalari denetlenir.
    git -c core.safecrlf=false diff --check
}

$trackedEnv = git ls-files .env

if ($trackedEnv) {
    Fail ".env Git tarafindan track ediliyor."
}

$stagedFiles = @(git diff --cached --name-only)

$forbiddenPatterns = @(
    '^\.env$',
    '\.pem$',
    '\.key$',
    '\.p12$',
    '\.pfx$',
    '\.jks$'
)

foreach ($file in $stagedFiles) {
    foreach ($pattern in $forbiddenPatterns) {
        if ($file -match $pattern) {
            Fail "Hassas dosya staged durumda: $file"
        }
    }
}

# ------------------------------------------------------------
# Docker
# ------------------------------------------------------------

Run-Step "Docker daemon kontrolu" {
    docker version --format "{{.Server.Version}}" | Out-Null
}

Run-Step "Docker Compose config validation" {
    docker compose config --quiet
}

# ------------------------------------------------------------
# PostgreSQL
# ------------------------------------------------------------

Run-Step "PostgreSQL container baslatiliyor" {
    docker compose up -d postgres
}

$postgresDeadline = (Get-Date).AddSeconds(60)

do {
    $postgresHealth = docker inspect `
        --format "{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}" `
        "$(docker compose ps -q postgres)" 2>$null

    if ($postgresHealth -eq "healthy") {
        Write-Host "PostgreSQL healthy." -ForegroundColor Green
        break
    }

    Start-Sleep -Seconds 2
}
while ((Get-Date) -lt $postgresDeadline)

if ($postgresHealth -ne "healthy") {
    Fail "PostgreSQL healthcheck basarili olmadi."
}

# ------------------------------------------------------------
# Backend
# Host Maven -> PostgreSQL localhost
# ------------------------------------------------------------

$OriginalDbUrl = $env:DB_URL

if ($env:DB_URL) {
    $env:DB_URL = $env:DB_URL -replace "://postgres:", "://localhost:"
}

Push-Location "backend"

# Auth integration tests explicitly exercise disabled-provider cases. Keep real
# local OAuth settings for the later Docker smoke step, but do not let them
# override each test's own provider configuration during Maven verify.
$SavedOAuth = @{}
foreach ($key in @("GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET")) {
    $SavedOAuth[$key] = [Environment]::GetEnvironmentVariable($key, "Process")
    [Environment]::SetEnvironmentVariable($key, "", "Process")
}

# Generic integration tests must not inherit the operator's SMTP delivery setting.
# Mail-specific tests enable their own GreenMail sink through DynamicPropertySource.
$SavedMailEnabled = [Environment]::GetEnvironmentVariable("MAIL_ENABLED", "Process")
[Environment]::SetEnvironmentVariable("MAIL_ENABLED", "false", "Process")

Run-Step "Backend - Maven clean verify" {
    .\mvnw.cmd clean verify
}

Pop-Location

foreach ($key in $SavedOAuth.Keys) {
    [Environment]::SetEnvironmentVariable($key, $SavedOAuth[$key], "Process")
}
[Environment]::SetEnvironmentVariable("MAIL_ENABLED", $SavedMailEnabled, "Process")

$env:DB_URL = $OriginalDbUrl

# ------------------------------------------------------------
# Frontend
# ------------------------------------------------------------

Push-Location "frontend"

if (-not (Test-Path "node_modules")) {
    Run-Step "Frontend - npm ci" {
        npm ci
    }
}
else {
    Write-Host ""
    Write-Host "node_modules mevcut - npm ci atlandi." -ForegroundColor DarkGray
}

Run-Step "Frontend - ESLint" {
    npm run lint
}

Run-Step "Frontend - TypeScript type-check" {
    npx tsc --noEmit
}

Run-Step "Frontend - Next.js production build" {
    npm run build
}

# Bundle budgets: per-route client JS against frontend/bundle-budgets.json. Warning only - it prints the table and flags routes
# above their budget, but never fails the gate (use "npm run check:bundle" for the failing variant).
Write-Host ""
Write-Host "Frontend - bundle size budgets (warn only)" -ForegroundColor Cyan
node scripts/check-bundle-size.mjs --warn
$global:LASTEXITCODE = 0

# Serve the build made above. A pre-existing Next process can hold stale files
# after the build and make browser tests fail with HTTP 500.
$FrontendPort = if ($env:FRONTEND_PORT) { $env:FRONTEND_PORT } else { "3000" }
if (Get-NetTCPConnection -LocalPort $FrontendPort -State Listen -ErrorAction SilentlyContinue) {
    Fail "Frontend port $FrontendPort is in use; stop the existing server before pre-push."
}
$script:FrontendTestServer = Start-Process -FilePath (Get-Command node).Source `
    -ArgumentList @("node_modules/next/dist/bin/next", "start", "--hostname", "localhost", "--port", $FrontendPort) `
    -WorkingDirectory (Get-Location).Path -WindowStyle Hidden -PassThru
Wait-Http -Url "http://localhost:$FrontendPort/tr/ana-sayfa" -TimeoutSeconds 60

# Optional Playwright / E2E.
# This becomes mandatory automatically when package.json contains test:e2e.
$packageJson = Get-Content "package.json" -Raw | ConvertFrom-Json

if ($null -ne $packageJson.scripts -and
    $packageJson.scripts.PSObject.Properties.Name -contains "test:e2e") {

    Run-Step "Frontend - Playwright E2E" {
        npm run test:e2e
    }
}
else {
    Write-Host ""
    Write-Host "test:e2e scripti yok - Playwright simdilik atlandi." -ForegroundColor DarkGray
}

Pop-Location

# ------------------------------------------------------------
# Full Docker build + runtime smoke
# ------------------------------------------------------------

Run-Step "Docker stack build + start" {
    docker compose up -d --build
}

$BackendPort = if ($env:BACKEND_PORT) { $env:BACKEND_PORT } else { "8080" }

Write-Host ""
Write-Host "Backend health bekleniyor..." -ForegroundColor Cyan
Wait-Http -Url "http://localhost:$BackendPort/actuator/health" -TimeoutSeconds 120

Write-Host ""
Write-Host "Frontend bekleniyor..." -ForegroundColor Cyan
Wait-Http -Url "http://localhost:$FrontendPort/tr/ana-sayfa" -TimeoutSeconds 120

if ($script:FrontendTestServer -and -not $script:FrontendTestServer.HasExited) {
    Stop-Process -Id $script:FrontendTestServer.Id -Force -ErrorAction SilentlyContinue
}

# ------------------------------------------------------------
# Final status
# ------------------------------------------------------------

Write-Host ""
Write-Host "Docker services:" -ForegroundColor Cyan
docker compose ps

Write-Host ""
Write-Host "==================================================" -ForegroundColor Green
Write-Host "PDA PRE-PUSH CHECK PASSED" -ForegroundColor Green
Write-Host "Safe to git push." -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
Write-Host ""

exit 0
