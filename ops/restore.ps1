<#
.SYNOPSIS
  Restores a PDA database dump made by ops/backup.ps1 into a SCRATCH database, to prove the backup is usable.

.DESCRIPTION
  By default the dump is restored into a new database named 'pda_restore_check' on the running postgres container, a few
  checks run (table count, Flyway history, row counts) and the scratch database is dropped again. The live database is
  never touched. This is the "restore drill" that must succeed before a backup is trusted.

  To restore into the LIVE database (disaster recovery) pass -Target <name> and -ConfirmOverwrite. That replaces the
  contents of that database; stop the backend first (docker compose stop backend).

  Media: put pda-media-*.tar.gz back into the media volume with
    docker compose cp <file> backend:/tmp/media.tgz
    docker compose exec backend tar -xzf /tmp/media.tgz -C /app/organization-media

.EXAMPLE
  .\ops\restore.ps1 -DumpFile .local\backups\pda-db-20261011-120000.dump
  .\ops\restore.ps1 -DumpFile .local\backups\pda-db-20261011-120000.dump -Target pda -ConfirmOverwrite
#>
param(
    [Parameter(Mandatory = $true)][string]$DumpFile,
    [string]$Target = "pda_restore_check",
    [switch]$ConfirmOverwrite
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

if (-not (Test-Path $DumpFile)) { throw "Dump file not found: $DumpFile" }
$dbName = Read-EnvValue "DB_NAME" "pda"
$dbUser = Read-EnvValue "DB_USERNAME" "pda"
$dbPort = Read-EnvValue "DB_PORT" "5436"
$scratch = $Target -ne $dbName
if (-not $scratch -and -not $ConfirmOverwrite) {
    throw "'$Target' is the live database. Pass -ConfirmOverwrite only for a deliberate disaster recovery."
}
if ($Target -notmatch '^[A-Za-z0-9_]+$') { throw "Target must contain only letters, digits and underscores." }

$postgres = docker compose ps -q postgres
if (-not $postgres) { throw "The postgres container is not running (docker compose up -d postgres)." }

docker cp $DumpFile "${postgres}:/tmp/pda-restore.dump"
try {
    if ($scratch) {
        docker compose exec -T postgres psql -U $dbUser -d postgres -p $dbPort -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS $Target" -c "CREATE DATABASE $Target"
        if ($LASTEXITCODE -ne 0) { throw "Could not create the scratch database." }
        docker compose exec -T postgres pg_restore -U $dbUser -d $Target -p $dbPort --no-owner --exit-on-error /tmp/pda-restore.dump
    } else {
        docker compose exec -T postgres pg_restore -U $dbUser -d $Target -p $dbPort --clean --if-exists --no-owner --exit-on-error /tmp/pda-restore.dump
    }
    if ($LASTEXITCODE -ne 0) { throw "pg_restore failed." }

    Write-Host "Restore finished. Checks on '$Target':" -ForegroundColor Cyan
    docker compose exec -T postgres psql -U $dbUser -d $Target -p $dbPort -At -c "SELECT 'tables', count(*) FROM information_schema.tables WHERE table_schema='public'" -c "SELECT 'flyway migrations', count(*) FROM flyway_schema_history WHERE success" -c "SELECT 'users', count(*) FROM users"
}
finally {
    docker compose exec -T postgres rm -f /tmp/pda-restore.dump | Out-Null
    if ($scratch) {
        docker compose exec -T postgres psql -U $dbUser -d postgres -p $dbPort -c "DROP DATABASE IF EXISTS $Target" | Out-Null
        Write-Host "Scratch database '$Target' dropped." -ForegroundColor DarkGray
    }
}
