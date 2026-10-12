<#
.SYNOPSIS
  Copies the production backups made by ops/backup.sh from the server to a local disk (the off-server copy).

.DESCRIPTION
  Lists the backup files in -RemoteDir on the server and downloads only the ones that are not in -Destination yet, so it is
  safe to run any number of times (nothing is overwritten and nothing is deleted on either side). It uses the SSH key of the
  current Windows user and never asks for a password: if the key is not accepted the run fails instead of hanging.
  Run it by hand or from Windows Task Scheduler. Old copies in -Destination are kept until you delete them.

.EXAMPLE
  .\ops\pull-backups.ps1
  .\ops\pull-backups.ps1 -Destination E:\pda-backups
#>
param(
    [string]$Destination = "F:\Sunucu-Yedek",
    [string]$Server = "deploy@187.7.75.176",
    [string]$RemoteDir = "/var/backups/pda"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $Destination)) {
    Write-Error "Destination not found: $Destination (is the disk connected?)"
    exit 1
}

$sshOptions = @("-o", "BatchMode=yes", "-o", "ConnectTimeout=15")

$remoteNames = & ssh @sshOptions $Server "ls -1 $RemoteDir"
if ($LASTEXITCODE -ne 0) {
    Write-Error "Could not list $RemoteDir on $Server."
    exit 1
}

# Case-sensitive match: the tr-TR culture mishandles the letter I in case-insensitive patterns.
$backupFile = '^pda-(db|media)-\d{8}-\d{6}\.(dump|tar\.gz)$'
$names = @($remoteNames | ForEach-Object { $_.Trim() } | Where-Object { $_ -cmatch $backupFile })
if ($names.Count -eq 0) {
    Write-Error "No backup files found in $RemoteDir on $Server."
    exit 1
}

$downloaded = 0
Push-Location -LiteralPath $Destination
try {
    foreach ($name in $names) {
        if (Test-Path -LiteralPath $name) { continue }
        # Downloads under a temporary name first, so an interrupted copy never looks like a finished backup.
        $partial = "$name.part"
        & scp @sshOptions "${Server}:$RemoteDir/$name" $partial
        if ($LASTEXITCODE -ne 0) {
            Remove-Item -LiteralPath $partial -Force -ErrorAction SilentlyContinue
            Write-Error "Download failed: $name"
            exit 1
        }
        Move-Item -LiteralPath $partial -Destination $name
        $downloaded++
    }
}
finally {
    Pop-Location
}

Write-Host "Backups on the server: $($names.Count); newly downloaded: $downloaded; destination: $Destination"
