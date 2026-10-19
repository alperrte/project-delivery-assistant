param(
    [string]$EnvFile = '.env.prod',
    [switch]$Template
)

# Read-only preflight. Template mode uses random disposable credentials and does
# not read the real production profile. Never print expanded Compose config.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$saved = @{}
function Set-ScopedValue([string]$key, [string]$value) {
    if (-not $saved.ContainsKey($key)) { $saved[$key] = [Environment]::GetEnvironmentVariable($key, 'Process') }
    [Environment]::SetEnvironmentVariable($key, $value, 'Process')
}
try {
    $path = if ($Template) { Join-Path $root '.env.example' } elseif ([IO.Path]::IsPathRooted($EnvFile)) { $EnvFile } else { Join-Path $root $EnvFile }
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw 'Environment file not found.' }
    $values = @{}
    foreach ($line in [IO.File]::ReadAllLines($path)) {
        if ($line -cmatch '^\s*([A-Z][A-Z0-9_]*)=(.*)$') {
            $value = $Matches[2].Trim()
            if ($value.Length -ge 2 -and (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'")))) { $value = $value.Substring(1, $value.Length - 2) }
            $values[$Matches[1]] = $value
        }
    }
    if ($Template) {
        $values.SITE_ADDRESS = 'app.example.test'; $values.WWW_ADDRESS = 'www.example.test'
        $values.SITE_URL = 'https://app.example.test'
        $values.MEDIA_ADDRESS = 'media.example.test'; $values.TURN_ADDRESS = 'turn.example.test'
        $values.LIVEKIT_NODE_IP = '203.0.113.10'
        $values.LIVEKIT_API_KEY = 'preflight_' + [Guid]::NewGuid().ToString('N')
        $bytes = New-Object byte[] 32; $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
        $rng.GetBytes($bytes); $rng.Dispose(); $values.LIVEKIT_API_SECRET = [Convert]::ToBase64String($bytes)
    }
    foreach ($key in @('SITE_ADDRESS', 'WWW_ADDRESS', 'MEDIA_ADDRESS', 'TURN_ADDRESS')) {
        if ($values[$key] -cnotmatch '^(?=.{1,253}$)(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}$') { throw "Missing or invalid hostname: $key" }
    }
    $hosts = @($values.SITE_ADDRESS, $values.WWW_ADDRESS, $values.MEDIA_ADDRESS, $values.TURN_ADDRESS)
    if (@($hosts | ForEach-Object { $_.ToLowerInvariant() } | Select-Object -Unique).Count -ne 4) { throw 'Site, www, media and TURN hostnames must be distinct.' }
    if ($values.SITE_URL -ne ('https://' + $values.SITE_ADDRESS)) { throw 'SITE_URL must be the exact HTTPS site origin without trailing slash.' }
    $ip = $null
    if (-not [Net.IPAddress]::TryParse($values.LIVEKIT_NODE_IP, [ref]$ip) -or $ip.AddressFamily -ne [Net.Sockets.AddressFamily]::InterNetwork) { throw 'LIVEKIT_NODE_IP must be the VPS public IPv4.' }
    if ($values.LIVEKIT_NODE_IP -cne $ip.ToString()) { throw 'LIVEKIT_NODE_IP must use canonical dotted-decimal IPv4 notation.' }
    $octets = $ip.GetAddressBytes()
    $nonPublic = $octets[0] -in @(0, 10, 127) -or $octets[0] -ge 224 `
        -or ($octets[0] -eq 100 -and $octets[1] -ge 64 -and $octets[1] -le 127) `
        -or ($octets[0] -eq 169 -and $octets[1] -eq 254) `
        -or ($octets[0] -eq 172 -and $octets[1] -ge 16 -and $octets[1] -le 31) `
        -or ($octets[0] -eq 192 -and $octets[1] -eq 168) `
        -or ($octets[0] -eq 192 -and $octets[1] -eq 0 -and $octets[2] -in @(0, 2)) `
        -or ($octets[0] -eq 198 -and $octets[1] -in @(18, 19)) `
        -or ($octets[0] -eq 198 -and $octets[1] -eq 51 -and $octets[2] -eq 100) `
        -or ($octets[0] -eq 203 -and $octets[1] -eq 0 -and $octets[2] -eq 113)
    if (-not $Template -and $nonPublic) { throw 'LIVEKIT_NODE_IP is not a usable production public IPv4.' }
    if ($values.LIVEKIT_API_KEY -cnotmatch '^[A-Za-z0-9_-]{1,128}$' -or $values.LIVEKIT_API_SECRET -cnotmatch '^[A-Za-z0-9_+/=-]{32,512}$') { throw 'Production media credentials missing or invalid; no values are displayed.' }
    if ($values.HTTPS_PORT -and $values.HTTPS_PORT -ne '443') { throw 'The TURN/TLS edge must use public TCP 443.' }
    if ($values.HTTP_PORT -and $values.HTTP_PORT -ne '80') { throw 'Public HTTP 80 is required by this certificate/redirect topology.' }
    foreach ($key in $values.Keys) { Set-ScopedValue $key $values[$key] }
    Set-ScopedValue 'ENV_FILE' $path
    $raw = & docker compose --env-file $path -f (Join-Path $root 'docker-compose.prod.yml') -f (Join-Path $root 'docker-compose.meeting.prod.yml') config --format json
    if ($LASTEXITCODE -ne 0) { throw 'Production Compose validation failed.' }
    $config = $raw | ConvertFrom-Json
    # Compose also reads process environment. Validate the EFFECTIVE ports, not
    # only the file values: an inherited HTTPS_PORT must not silently bypass 443.
    $edgePorts = @($config.services.caddy.ports)
    if ($edgePorts.Count -ne 2 -or @($edgePorts | Where-Object { $_.target -eq 443 -and $_.published -eq '443' -and $_.protocol -eq 'tcp' }).Count -ne 1 -or @($edgePorts | Where-Object { $_.target -eq 80 -and $_.published -eq '80' -and $_.protocol -eq 'tcp' }).Count -ne 1 -or @($edgePorts | Where-Object { @('', '0.0.0.0', '::') -notcontains [string]$_.host_ip }).Count) { throw 'Effective edge ports must be public TCP 80 and 443 only; check inherited port overrides.' }
    if ($config.services.frontend.build.args.NEXT_PUBLIC_LIVEKIT_URL -ne ('wss://' + $values.MEDIA_ADDRESS) -or $config.services.frontend.environment.NEXT_PUBLIC_LIVEKIT_URL -ne ('wss://' + $values.MEDIA_ADDRESS)) { throw 'Frontend build/runtime media origins differ.' }
    if ($config.services.backend.environment.LIVEKIT_API_URL -ne ('https://' + $values.MEDIA_ADDRESS)) { throw 'Backend media API must use the validated HTTPS origin.' }
    if ($config.services.backend.environment.LIVEKIT_WS_URL -ne ('wss://' + $values.MEDIA_ADDRESS)) { throw 'Backend signaling must use the validated WSS origin.' }
    if ($config.services.backend.environment.MEETING_MEDIA_ENABLED -cnotmatch '^(true|false)$') { throw 'MEETING_MEDIA_ENABLED must be true or false.' }
    $sfu = $config.services.livekit.environment.LIVEKIT_CONFIG
    if ($sfu -notmatch 'auto_create: false' -or $sfu -notmatch 'enable_remote_unmute: false' -or $sfu -notmatch 'external_tls: true') { throw 'SFU security/TURN preconditions missing.' }
    if (@($config.services.livekit.ports | Where-Object { $_.target -in @(7880, 5349) }).Count) { throw 'Internal media API/TURN plaintext ports must not be published.' }
    if ($config.services.caddy.image -notmatch '@sha256:') { throw 'Meeting edge image must be digest pinned.' }
    if ($Template) { Write-Output 'PASS: production media TEMPLATE contract. No real production readiness or deployment is claimed.' }
    else { Write-Output 'PASS: local production configuration contract. DNS/TLS/firewall/relay/capacity still require live-environment acceptance.' }
} finally {
    foreach ($key in $saved.Keys) { [Environment]::SetEnvironmentVariable($key, $saved[$key], 'Process') }
}
