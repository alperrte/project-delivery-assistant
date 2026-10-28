[CmdletBinding()]
param(
    [string[]]$Service = @(),
    [switch]$All,
    [switch]$List,
    [switch]$DryRun,
    [string]$JavaHome,
    [ValidateSet(1,2)]
    [int]$Forks = 2
)

$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$root=Split-Path -Parent $PSScriptRoot
Import-Module (Join-Path $PSScriptRoot 'backend-tests-lib.psm1') -Force

function Invoke-CheckedGit {
    param([string[]]$GitArguments)
    $output=@(& git -C $root @GitArguments)
    if ($LASTEXITCODE -ne 0) { throw 'Git safety check could not complete.' }
    return $output
}

try {
    $manifest=Import-PowerShellDataFile (Join-Path $PSScriptRoot 'backend-test-suites.psd1')
    $catalog=@(Get-BackendTestCatalog -Root $root -Manifest $manifest)
    $services=@($manifest.Modules | ForEach-Object { "$_-service" })
    Write-Host "`nPDA - Backend Testleri ($($catalog.Count) sinif)" -ForegroundColor Cyan
    if ($List) {
        foreach ($name in $services) {
            $own=@($catalog | Where-Object Service -eq $name).Count
            $scope=Get-BackendTestSelection -Catalog $catalog -Manifest $manifest -Service $name
            Write-Host ('{0,-24} kendi: {1,3} | toplam: {2,3}{3}' -f $name,$own,$scope.Tests.Count,$(if($scope.Expanded){' | tum backend'}else{''}))
        }
        exit 0
    }
    if (-not $All -and @($Service).Count -eq 0) {
        if ([Console]::IsInputRedirected) { throw 'Etkilesimsiz kullanimda -Service veya -All belirtin.' }
        for ($index=0; $index -lt $services.Count; $index++) {
            $count=@($catalog | Where-Object Service -eq $services[$index]).Count
            Write-Host ('{0,2}  {1,-24} ({2} sinif)' -f ($index+1),$services[$index],$count)
        }
        Write-Host ' A  Tum backend'
        Write-Host ' 0  Cikis'
        $answer=Read-Host 'Servis secimi (ornek: 1,3)'
        if ($answer.Trim() -eq '0') { exit 0 }
        if ($answer.Trim() -ieq 'A') { $All=$true }
        else {
            $Service=@(foreach ($token in ($answer -split ',')) {
                $number=0
                if (-not [int]::TryParse($token.Trim(),[ref]$number) -or $number -lt 1 -or $number -gt $services.Count) { throw 'Gecersiz menu secimi.' }
                $services[$number-1]
            })
        }
    }
    $selection=Get-BackendTestSelection -Catalog $catalog -Manifest $manifest -Service $Service -All:$All
    if ($selection.Expanded) { Write-Host 'Ortak altyapi/migration secimi: kapsam tum backend olarak genisletildi.' -ForegroundColor Yellow }
    Write-Host "`nKapsam: $(if($selection.All){'TUM BACKEND'}else{$selection.Services -join ', '})"
    Write-Host "Kendi: $($selection.Own.Count) | Ek iliskili: $($selection.Related.Count) | Ek ortak: $($selection.Baseline.Count)"
    foreach ($test in $selection.Tests) {
        $kind=if($selection.Own -contains $test.Name){'servis'}elseif($selection.Related -contains $test.Name){'iliskili'}else{'ortak'}
        Write-Host "  [$kind] $($test.Name)"
    }
    Write-Host "Toplam $($selection.Tests.Count) sinif; Docker gerekli: $($selection.NeedsDocker)"
    Write-Host "Paralel JVM: $Forks (her JVM icinde testler sirali)"
    Write-Host 'Bu sonuc yalniz secilen backend kapsamidir. Frontend ve tam yayin kapisi dahil degildir.' -ForegroundColor Yellow
    if ($DryRun) {
        Write-Host 'DRY RUN: test, derleme veya Docker calistirilmadi; dosya yazilmadi.' -ForegroundColor Cyan
        exit 0
    }

    # Git safety remains part of the scoped branch check. Never print file contents.
    $null=Invoke-CheckedGit -GitArguments @('-c','core.safecrlf=false','diff','--check')
    $null=Invoke-CheckedGit -GitArguments @('-c','core.safecrlf=false','diff','--cached','--check')
    $tracked=@(Invoke-CheckedGit -GitArguments @('ls-files','--','.env','.env.dev','.env.prod'))
    if ($tracked.Count -gt 0) { throw 'Gercek ENV profili Git tarafindan takip ediliyor.' }
    foreach ($file in @(Invoke-CheckedGit -GitArguments @('diff','--cached','--name-only'))) {
        if ($file -match '(^|/)\.env($|\.(?!example$).+)|\.(pem|key|p12|pfx|jks)$') { throw "Hassas dosya staged durumda: $file" }
    }
    if (-not $JavaHome) {
        $candidates=@()
        if ($env:JAVA_HOME) { $candidates += $env:JAVA_HOME }
        $localToolchains=Join-Path $root '.local/toolchains'
        if (Test-Path -LiteralPath $localToolchains) { $candidates += @(Get-ChildItem -LiteralPath $localToolchains -Directory | Sort-Object Name -Descending | ForEach-Object FullName) }
        $javaCommand=Get-Command java.exe -ErrorAction SilentlyContinue
        if ($javaCommand) { $candidates += Split-Path -Parent (Split-Path -Parent $javaCommand.Source) }
        foreach ($candidate in $candidates) {
            $metadataPath=Join-Path $candidate 'release'
            if ((Test-Path -LiteralPath $metadataPath) -and (Test-Path -LiteralPath (Join-Path $candidate 'bin/javac.exe')) -and [IO.File]::ReadAllText($metadataPath) -match '(?m)^JAVA_VERSION="25(?:[.\-+\"]|$)') { $JavaHome=$candidate; break }
        }
        if (-not $JavaHome) { throw 'JDK 25 bulunamadi. -JavaHome ile JDK dizinini verin.' }
    }
    $JavaHome=[IO.Path]::GetFullPath($JavaHome)
    $java=Join-Path $JavaHome 'bin/java.exe'
    if (-not (Test-Path -LiteralPath $java) -or -not (Test-Path -LiteralPath (Join-Path $JavaHome 'bin/javac.exe'))) { throw 'Gecerli JDK dizini gerekli: -JavaHome <JDK25>.' }
    # release is toolchain metadata, not application configuration or credentials.
    $releaseFile=Join-Path $JavaHome 'release'
    if (-not (Test-Path -LiteralPath $releaseFile) -or [IO.File]::ReadAllText($releaseFile) -notmatch '(?m)^JAVA_VERSION="25(?:[.\-+\"]|$)') { throw 'Bu proje JDK 25 gerektirir. -JavaHome <JDK25> ile tekrar calistirin.' }
    $dockerHost=''
    if ($selection.NeedsDocker) {
        if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw 'Secilen entegrasyon testleri icin yerel Docker gerekli.' }
        if ($env:DOCKER_HOST) { $dockerHost=$env:DOCKER_HOST }
        else {
            $dockerHost=(& docker context inspect --format '{{.Endpoints.docker.Host}}' | Out-String).Trim()
            if ($LASTEXITCODE -ne 0) { throw 'Yerel Docker context dogrulanamadi.' }
        }
        if ($dockerHost -notmatch '^(npipe:|unix:)') { throw 'Testler icin yalniz yerel Docker endpoint kullanilabilir.' }
        & docker --host $dockerHost version --format '{{.Server.Version}}' | Out-Null
        if ($LASTEXITCODE -ne 0) { throw 'Docker daemon erisilemiyor; entegrasyon testlerini atlayarak basari verilemez.' }
    }
    $backend=Join-Path $root 'backend'
    $runId=(Get-Date -Format 'yyyyMMdd-HHmmss')+'-'+[Guid]::NewGuid().ToString('N').Substring(0,12)
    $runDirectory=Join-Path $backend "target/scoped-test-results/$runId"
    $null=New-Item -ItemType Directory -Path $runDirectory -Force
    $mavenArguments=@('-B','-ntp','test','-DfailIfNoTests=true','-Dsurefire.failIfNoSpecifiedTests=true',"-Dsurefire.reportNameSuffix=$runId", "-Dpda.test.forks=$Forks", "-Dpda.test.runId=$runId")
    if (-not $selection.All) { $mavenArguments += '-Dtest='+($selection.Tests.Name -join ',') }
    $wrapper=Join-Path $backend 'mvnw.cmd'
    $mavenLog=Join-Path $runDirectory 'maven.log'
    $command='""'+$wrapper+'" '+(($mavenArguments | ForEach-Object {'"'+$_+'"'}) -join ' ')+' > "'+$mavenLog+'" 2>&1"'
    if ($command.Length -gt 8000) { throw 'Test secimi Windows komut satiri sinirini asiyor; -All kullanin.' }
    $head=@(Invoke-CheckedGit -GitArguments @('rev-parse','HEAD')) -join ''
    $dirty=@(Invoke-CheckedGit -GitArguments @('status','--porcelain')).Count -gt 0
    $metadata=[ordered]@{RunId=$runId;StartedUtc=[DateTime]::UtcNow.ToString('o');Commit=$head;WorkingTreeDirty=$dirty;Forks=$Forks;AllBackend=$selection.All;Services=$selection.Services;Own=$selection.Own;Related=$selection.Related;Baseline=$selection.Baseline;SelectedClasses=@($selection.Tests.Name)}
    $metadata | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $runDirectory 'scope.json') -Encoding UTF8
    $startInfo=[Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName=$env:ComSpec; $startInfo.Arguments='/d /s /c '+$command
    $startInfo.WorkingDirectory=$backend; $startInfo.UseShellExecute=$false; $startInfo.CreateNoWindow=$true
    New-BackendTestEnvironment -Environment $startInfo.EnvironmentVariables -RunDirectory $runDirectory -JavaHome $JavaHome -DockerHost $dockerHost
    Write-Host "`nBaslatiliyor: Maven test (clean yok). Rapor: $runDirectory" -ForegroundColor Cyan
    $clock=[Diagnostics.Stopwatch]::StartNew()
    [IO.File]::WriteAllText($mavenLog,'')
    $logStream=[IO.File]::Open($mavenLog,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::ReadWrite)
    $logReader=[IO.StreamReader]::new($logStream,[Text.Encoding]::UTF8)
    $process=[Diagnostics.Process]::Start($startInfo)
    try {
        while (-not $process.HasExited) {
            $text=$logReader.ReadToEnd()
            if ($text) { Write-Host -NoNewline $text }
            $null=$process.WaitForExit(100)
        }
        $text=$logReader.ReadToEnd()
        if ($text) { Write-Host -NoNewline $text }
        $mavenExit=$process.ExitCode
    }
    finally {
        if (-not $process.HasExited) { & "$env:SystemRoot\System32\taskkill.exe" /PID $process.Id /T /F | Out-Null }
        $process.Dispose()
        $logReader.Dispose()
    }
    $clock.Stop()
    $summary=[ordered]@{RunId=$runId;MavenExit=$mavenExit;Seconds=[Math]::Round($clock.Elapsed.TotalSeconds,2);Passed=$false}
    try {
        $reports=Read-BackendTestReports -Directory (Join-Path $backend 'target/surefire-reports') -RunId $runId -ExpectedClasses $selection.Tests.Name -ExpectedSkips $manifest.ExpectedSkips
        foreach ($field in @('Tests','Failures','Errors','Skipped','ExpectedSkipped','Classes')) { $summary[$field]=$reports.$field }
        foreach ($file in $reports.Files) { Copy-Item -LiteralPath $file.FullName -Destination $runDirectory }
        $summary.Passed=($mavenExit -eq 0 -and $reports.Failures -eq 0 -and $reports.Errors -eq 0)
    }
    catch { $summary['ReportError']=$_.Exception.Message }
    $summary | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $runDirectory 'result.json') -Encoding UTF8
    Write-Host "`nSure: $($summary.Seconds) saniye | Maven exit: $mavenExit"
    if ($summary.Contains('Tests')) { Write-Host "Test: $($summary.Tests) | Hata: $($summary.Failures + $summary.Errors) | Atlanan: $($summary.Skipped) (beklenen: $($summary.ExpectedSkipped))" }
    Write-Host "Rapor: $runDirectory"
    if (-not $summary.Passed) { if ($summary.Contains('ReportError')) { Write-Host $summary.ReportError -ForegroundColor Red }; throw 'Backend kontrolu basarisiz. result.json dosyasini inceleyin.' }
    Write-Host 'PDA BACKEND SELECTED CHECK PASSED' -ForegroundColor Green
    exit 0
}
catch {
    Write-Host "`nPDA BACKEND CHECK FAILED: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
