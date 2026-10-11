<#
.SYNOPSIS
  Backs up the PDA database (pg_dump custom format) and the organization media volume from the running Docker Compose stack.

.DESCRIPTION
  Writes two files into -OutDir (default .local/backups, which Git ignores):
    pda-db-<timestamp>.dump        PostgreSQL custom-format dump (restore with ops/restore.ps1 or pg_restore)
    pda-media-<timestamp>.tar.gz   Contents of the organization media volume (logos and covers)
  The database alone is NOT a full backup: organization images live on the media volume, the database only references them.
  Project logos, banners, profile photos and task attachments are stored in the database and are inside the dump.

  Nothing is deleted or modified in the running stack. Secrets are read from .env and never printed.
  Keep copies OUTSIDE this machine (another disk or storage): a backup next to the data does not survive losing the machine.

.EXAMPLE
  .\ops\backup.ps1
  .\ops\backup.ps1 -OutDir D:\pda-backups -KeepLast 14
#>
param(
    [string]$OutDir = ".local/backups",
    [int]$KeepLast = 14
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function Read-EnvValue([string]$Name, [string]$Default) {
    if (Test-Path ".env") {
        foreach ($line in Get-Content ".env") {
            $trimmed = $line.Trim()
            if ($trimmed -and -not $trimmed.StartsWith("#")) {
                $parts = $trimmed -split "=", 2
                if ($parts.Count -eq 2 -and $parts[0].Trim() -eq $Name -and $parts[1].Trim()) { return $parts[1].Trim() }
            }
        }
    }
    return $Default
}

$dbName = Read-EnvValue "DB_NAME" "pda"
$dbUser = Read-EnvValue "DB_USERNAME" "pda"
$dbPort = Read-EnvValue "DB_PORT" "5436"
$mediaPath = Read-EnvValue "ORGANIZATION_MEDIA_STORAGE_PATH" "/app/organization-media"

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$dbFile = Join-Path $OutDir "pda-db-$stamp.dump"
$mediaFile = Join-Path $OutDir "pda-media-$stamp.tar.gz"

$postgres = docker compose ps -q postgres
if (-not $postgres) { throw "The postgres container is not running (docker compose up -d postgres)." }

Write-Host "Dumping database '$dbName' ..." -ForegroundColor Cyan
# Binary-safe: write inside the container and copy out with docker cp; a PowerShell pipeline would re-encode the dump.
docker compose exec -T postgres pg_dump -U $dbUser -d $dbName -p $dbPort -Fc -f /tmp/pda-backup.dump
if ($LASTEXITCODE -ne 0) { throw "pg_dump failed." }
docker cp "${postgres}:/tmp/pda-backup.dump" $dbFile
docker compose exec -T postgres rm -f /tmp/pda-backup.dump | Out-Null
if (-not (Test-Path $dbFile) -or (Get-Item $dbFile).Length -eq 0) { throw "The database dump is missing or empty." }

$backend = docker compose ps -q backend
if ($backend) {
    Write-Host "Archiving organization media from $mediaPath ..." -ForegroundColor Cyan
    docker compose exec -T backend tar -czf /tmp/pda-media.tgz -C $mediaPath .
    if ($LASTEXITCODE -ne 0) { throw "Media archive failed." }
    docker cp "${backend}:/tmp/pda-media.tgz" $mediaFile
    docker compose exec -T backend rm -f /tmp/pda-media.tgz | Out-Null
} else {
    Write-Warning "The backend container is not running: the media volume was NOT backed up (database only)."
}

# Retention of local copies: keep the newest -KeepLast of each kind.
foreach ($pattern in @("pda-db-*.dump", "pda-media-*.tar.gz")) {
    Get-ChildItem $OutDir -Filter $pattern | Sort-Object LastWriteTime -Descending | Select-Object -Skip $KeepLast | Remove-Item -Force
}

Write-Host "Backup finished:" -ForegroundColor Green
Get-Item $dbFile, $mediaFile -ErrorAction SilentlyContinue | ForEach-Object { "{0}  {1:N0} KB" -f $_.FullName, ($_.Length / 1KB) }
