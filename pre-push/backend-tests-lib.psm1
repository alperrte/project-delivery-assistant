Set-StrictMode -Version Latest

function Get-BackendTestCatalog {
    param([string]$Root, [hashtable]$Manifest)
    $sources = @{}
    foreach ($file in Get-ChildItem -LiteralPath (Join-Path $Root 'backend/src/test/java') -Recurse -File -Filter '*.java') {
        $text = [regex]::Replace([IO.File]::ReadAllText($file.FullName), '(?s)/\*.*?\*/', '')
        $package = [regex]::Match($text, '(?m)^\s*package\s+([\w.]+)\s*;').Groups[1].Value
        $name = $file.BaseName
        if (-not $package -or $text -notmatch ('\bclass\s+' + [regex]::Escape($name) + '\b')) { continue }
        $fqcn = "$package.$name"
        if ($sources.ContainsKey($fqcn)) { throw "Duplicate test class: $fqcn" }
        $sources[$fqcn] = [pscustomobject]@{
            Name = $fqcn; SimpleName = $name; Text = $text; File = $file.FullName
            Abstract = ($text -match ('\babstract\s+class\s+' + [regex]::Escape($name) + '\b'))
            HasTests = ($text -match '@(?:org\.junit\.[\w.]+\.)?(?:Test|ParameterizedTest|RepeatedTest|TestFactory|TestTemplate)\b')
        }
    }
    # Include concrete classes inheriting JUnit methods. Scan reachable test helpers
    # for Docker use as well (base classes and @Import test configurations).
    $items = @()
    foreach ($source in $sources.Values) {
        if ($source.Abstract) { continue }
        $visited = @{}; $pending = [Collections.Generic.Stack[string]]::new(); $pending.Push($source.Name)
        $hasTests = $false; $docker = $false
        while ($pending.Count -gt 0) {
            $current = $pending.Pop()
            if ($visited.ContainsKey($current)) { continue }
            $visited[$current] = $true; $dependency = $sources[$current]
            if ($dependency.HasTests) { $hasTests = $true }
            if ($dependency.Text -match 'org\.testcontainers|@Testcontainers\b|DockerClientFactory|PostgreSQLContainer|GenericContainer') { $docker = $true }
            foreach ($candidate in $sources.Values) {
                if (-not $visited.ContainsKey($candidate.Name) -and $dependency.Text -match ('\b' + [regex]::Escape($candidate.SimpleName) + '\b')) { $pending.Push($candidate.Name) }
            }
        }
        if (-not $hasTests) {
            if ($source.SimpleName -match '^(Test.+|.+Tests?|.+TestCase)$' -and $Manifest.SupportClasses -notcontains $source.Name) {
                throw "Unclassified test-shaped class (check inherited/composed annotations): $($source.Name)"
            }
            continue
        }
        $owners = @($Manifest.Modules | Where-Object { $source.Name.StartsWith("com.pda.$_.", [StringComparison]::Ordinal) })
        if ($owners.Count -ne 1) { throw "Test needs exactly one service owner: $($source.Name)" }
        if ($source.SimpleName -notmatch '^(Test.+|.+Tests?|.+TestCase)$') { throw "JUnit class outside default Surefire names: $($source.Name)" }
        $items += [pscustomobject]@{ Name=$source.Name; Service="$($owners[0])-service"; Docker=$docker; File=$source.File }
    }
    $names = @($items.Name)
    foreach ($reference in @($Manifest.Baseline) + @($Manifest.ExpectedSkips) + @($Manifest.Related.Values | ForEach-Object { $_ })) {
        if ($names -notcontains $reference) { throw "Stale manifest test reference: $reference" }
    }
    foreach ($key in $Manifest.Related.Keys) {
        if (@($Manifest.Modules | ForEach-Object { "$_-service" }) -notcontains $key) { throw "Unknown related service: $key" }
    }
    if ($items.Count -eq 0) { throw 'No backend tests discovered.' }
    return @($items | Sort-Object Name)
}

function Get-BackendTestSelection {
    param([object[]]$Catalog, [hashtable]$Manifest, [string[]]$Service, [switch]$All)
    $services = @($Service | ForEach-Object { $_ -split ',' } | ForEach-Object { $_.Trim().ToLowerInvariant() } | Where-Object { $_ } | Sort-Object -Unique)
    if ($All -and $services.Count -gt 0) { throw 'Use either -All or -Service.' }
    if (-not $All -and $services.Count -eq 0) { throw 'Select at least one service or -All.' }
    foreach ($item in $services) {
        if (@($Manifest.Modules | ForEach-Object { "$_-service" }) -notcontains $item) { throw "Unknown service: $item" }
        if (@($Catalog | Where-Object Service -eq $item).Count -eq 0) { throw "Service has no tests: $item" }
    }
    # A shared module change can affect any consumer. Explicitly expand, never
    # present a small package-only run as sufficient for these scopes.
    $expanded = @($services | Where-Object { $Manifest.RequireAll -contains $_ }).Count -gt 0
    $effectiveAll = [bool]($All -or $expanded)
    $own = @($Catalog | Where-Object { $effectiveAll -or $services -contains $_.Service } | ForEach-Object Name)
    $related = @($services | ForEach-Object { if ($Manifest.Related.ContainsKey($_)) { $Manifest.Related[$_] } } | Sort-Object -Unique)
    $names = @(@($own) + @($related) + @($Manifest.Baseline) | Sort-Object -Unique)
    $selected = @($Catalog | Where-Object { $names -contains $_.Name })
    if ($selected.Count -eq 0) { throw 'Selected scope contains zero tests.' }
    return [pscustomobject]@{
        Services=$services; All=$effectiveAll; Expanded=$expanded; Tests=$selected
        Own=$own; Related=@($related | Where-Object { $own -notcontains $_ })
        Baseline=@($Manifest.Baseline | Where-Object { $own -notcontains $_ -and $related -notcontains $_ })
        NeedsDocker=(@($selected | Where-Object { $_.Docker -and $Manifest.ExpectedSkips -notcontains $_.Name }).Count -gt 0)
    }
}

function Read-BackendTestReports {
    param([string]$Directory, [string]$RunId, [string[]]$ExpectedClasses, [string[]]$ExpectedSkips)
    if ($RunId -notmatch '^[a-zA-Z0-9-]+$') { throw 'Invalid report run ID.' }
    $files = @(Get-ChildItem -LiteralPath $Directory -File -Filter "TEST-*-$RunId.xml" -ErrorAction SilentlyContinue)
    if ($files.Count -eq 0) { throw 'No reports for this run. Old reports cannot establish success.' }
    $totals = @{Tests=0;Failures=0;Errors=0;Skipped=0;ExpectedSkipped=0}; $seen=@{}; $rows=@()
    foreach ($file in $files) {
        $class = $file.BaseName.Substring(5)
        $class = $class.Substring(0, $class.Length - $RunId.Length - 1)
        $owner = ($class -split '\$')[0]
        if ($ExpectedClasses -notcontains $owner) { throw "Unexpected report class: $class" }
        $settings = [Xml.XmlReaderSettings]::new(); $settings.DtdProcessing=[Xml.DtdProcessing]::Prohibit; $settings.XmlResolver=$null
        $reader=[Xml.XmlReader]::Create($file.FullName, $settings)
        try { $document=[Xml.XmlDocument]::new(); $document.XmlResolver=$null; $document.Load($reader) } finally { $reader.Dispose() }
        $suite=$document.DocumentElement
        # PowerShell's XML adapter maps a 'name' attribute onto .Name; use the
        # underlying XML node property instead of mistaking it for the tag name.
        if ($suite.PSBase.LocalName -ne 'testsuite') { throw "Invalid report: $($file.Name)" }
        $row=[ordered]@{Class=$class}
        foreach ($field in @('Tests','Failures','Errors','Skipped')) {
            $number=0
            if (-not [int]::TryParse($suite.GetAttribute($field.ToLowerInvariant()), [ref]$number) -or $number -lt 0) { throw "Invalid $field count in $($file.Name)" }
            $row[$field]=$number; $totals[$field]+=$number
        }
        if ($row.Skipped -gt 0) {
            if ($ExpectedSkips -notcontains $owner) { throw "Unexpected skipped tests: $class ($($row.Skipped))" }
            $totals.ExpectedSkipped += $row.Skipped
        }
        $seen[$owner]=$true; $rows += [pscustomobject]$row
    }
    $missing=@($ExpectedClasses | Where-Object { -not $seen.ContainsKey($_) })
    if ($missing.Count -gt 0) { throw "Selected classes missing reports: $($missing -join ', ')" }
    if (($totals.Tests-$totals.Skipped) -le 0) { throw 'Zero executed tests; a skipped run is not a pass.' }
    return [pscustomobject]@{Tests=$totals.Tests;Failures=$totals.Failures;Errors=$totals.Errors;Skipped=$totals.Skipped;ExpectedSkipped=$totals.ExpectedSkipped;Classes=$rows;Files=$files}
}

function New-BackendTestEnvironment {
    param([Collections.Specialized.StringDictionary]$Environment, [string]$RunDirectory, [string]$JavaHome, [string]$DockerHost)
    # Allow only operating-system/runtime essentials; do not inherit application
    # credentials, Spring overrides or JVM/Maven command injection variables.
    $Environment.Clear()
    foreach ($key in @('SystemRoot','WINDIR','ComSpec','PATH','PATHEXT','TEMP','TMP','USERPROFILE','HOMEDRIVE','HOMEPATH','APPDATA','LOCALAPPDATA','ProgramFiles','ProgramFiles(x86)','ProgramData','ALLUSERSPROFILE','NUMBER_OF_PROCESSORS','PROCESSOR_ARCHITECTURE','OS')) {
        $value=[Environment]::GetEnvironmentVariable($key, 'Process')
        if ($null -ne $value) { $Environment[$key]=$value }
    }
    $defaults=@{
        JAVA_HOME=$JavaHome; APP_ENV='dev'; DB_URL='jdbc:postgresql://127.0.0.1:1/pda_test'; DB_USERNAME='pda_test'; DB_PASSWORD='test-only'
        FRONTEND_URL='http://localhost:3000'; MAIL_ENABLED='false'; SMTP_HOST='127.0.0.1'; SMTP_PORT='1'; SMTP_AUTH='false'; SMTP_SSL='false'; SMTP_STARTTLS='false'
        MEETING_MEDIA_ENABLED='false'; ORGANIZATION_MEDIA_STORAGE_PATH=(Join-Path $RunDirectory 'media'); RETENTION_CRON='-'
    }
    foreach($key in $defaults.Keys) { $Environment[$key]=$defaults[$key] }
    if ($DockerHost) { $Environment['DOCKER_HOST']=$DockerHost }
}

Export-ModuleMember -Function Get-BackendTestCatalog,Get-BackendTestSelection,Read-BackendTestReports,New-BackendTestEnvironment
