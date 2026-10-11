<#
.SYNOPSIS
  Switches between the two environment profiles: .env.dev (local development) and .env.prod (production).

.DESCRIPTION
  The real values live in the profile files .env.dev and .env.prod (both ignored by Git). `.env` is only the ACTIVE COPY that
  docker-compose.yml, pre-push and ops/backup.ps1 read; this script writes it from a profile and marks its first line
  (`# PDA-ACTIVE-PROFILE=<name>`). Edit the profile files, not `.env`: a hand-edited `.env` is refused (-Force backs it up to
  .env.bak first) so a change is never lost silently.

  Production is normally started with its own file, which does not need the switch:
    docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
  Do NOT run the development compose (docker compose up) or pre-push while the prod profile is active: APP_ENV=prod makes
  cookies Secure, which breaks the login on http://localhost.

.EXAMPLE
  .\ops\env.ps1 status
  .\ops\env.ps1 use dev
  .\ops\env.ps1 use prod
#>
param(
    [Parameter(Position = 0)][ValidateSet("status", "use")][string]$Command = "status",
    [Parameter(Position = 1)][ValidateSet("dev", "prod")][string]$ProfileName,
    [switch]$Force
)

$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)

$markerPrefix = "# PDA-ACTIVE-PROFILE="
$utf8 = New-Object System.Text.UTF8Encoding($false)

function Read-Text([string]$Path) { return [System.IO.File]::ReadAllText((Resolve-Path $Path), $utf8) }

# Returns @{ Profile = <name or $null>; Body = <text after the marker line> } for the current .env, or $null when it does not exist.
function Read-Active {
    if (-not (Test-Path ".env")) { return $null }
    $text = Read-Text ".env"
    $newline = $text.IndexOf("`n")
    $first = if ($newline -ge 0) { $text.Substring(0, $newline).TrimEnd("`r") } else { $text }
    if ($first.StartsWith($markerPrefix)) {
        $body = if ($newline -ge 0) { $text.Substring($newline + 1) } else { "" }
        return @{ Profile = $first.Substring($markerPrefix.Length).Trim(); Body = $body }
    }
    return @{ Profile = $null; Body = $text }
}

# Same text, ignoring line-ending style, so a CRLF checkout does not read as a change.
function Same-Text([string]$a, [string]$b) { return ($a -replace "`r`n", "`n") -ceq ($b -replace "`r`n", "`n") }

$active = Read-Active

if ($Command -eq "status") {
    if (-not $active) { Write-Host "No .env yet. Run: .\ops\env.ps1 use dev" -ForegroundColor Yellow; return }
    if (-not $active.Profile) { Write-Host ".env has no profile marker (not written by this script)." -ForegroundColor Yellow; return }
    $file = ".env.$($active.Profile)"
    if (-not (Test-Path $file)) { Write-Host "Active profile: $($active.Profile)  ($file is missing)" -ForegroundColor Yellow; return }
    if (Same-Text $active.Body (Read-Text $file)) { Write-Host "Active profile: $($active.Profile)  (.env matches $file)" -ForegroundColor Green }
    else { Write-Host "Active profile: $($active.Profile)  (.env was edited by hand and differs from $file)" -ForegroundColor Yellow }
    return
}

if (-not $ProfileName) { throw "Name a profile: .\ops\env.ps1 use dev|prod" }
$source = ".env.$ProfileName"
if (-not (Test-Path $source)) { throw "$source not found." }
$content = Read-Text $source

if ($active) {
    $recorded = if ($active.Profile) { ".env.$($active.Profile)" } else { $null }
    $inSync = $recorded -and (Test-Path $recorded) -and (Same-Text $active.Body (Read-Text $recorded))
    if (-not $inSync -and -not $Force) {
        throw ".env differs from its profile file (edited by hand, or written by something else). Move the change into .env.dev / .env.prod, or run again with -Force to back .env up to .env.bak and continue."
    }
    if (-not $inSync) {
        Copy-Item ".env" ".env.bak" -Force
        Write-Host "Backed up the current .env to .env.bak" -ForegroundColor Yellow
    }
}

$eol = if ($content.Contains("`r`n")) { "`r`n" } else { "`n" }
[System.IO.File]::WriteAllText((Join-Path (Get-Location) ".env"), "$markerPrefix$ProfileName$eol$content", $utf8)
Write-Host "Active profile: $ProfileName  (.env written from $source)" -ForegroundColor Green

if ($ProfileName -eq "prod") {
    Write-Host "Production is started with: docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build" -ForegroundColor Cyan
    Write-Host "Do not run the development compose or pre-push while prod is active (APP_ENV=prod breaks the http://localhost login)." -ForegroundColor Yellow
}
else {
    Write-Host "Restart anything that already read .env (docker compose up -d, the backend) to pick up the change." -ForegroundColor Cyan
}
