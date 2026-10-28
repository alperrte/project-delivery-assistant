$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$repo=Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Import-Module (Join-Path $repo 'pre-push/backend-tests-lib.psm1') -Force
$manifest=Import-PowerShellDataFile (Join-Path $repo 'pre-push/backend-test-suites.psd1')
$checks=0
function Assert-True($Condition,[string]$Message) { if(-not $Condition){throw $Message}; $script:checks++ }
function Assert-Throws([scriptblock]$Action,[string]$Message) { $thrown=$false;try{& $Action | Out-Null}catch{$thrown=$true};Assert-True $thrown $Message }
# Test fixtures are isolated under the workspace and removed without following links.
$fixture=Join-Path $repo ('backend/target/runner-selftest-'+[Guid]::NewGuid().ToString('N'))
$null=New-Item -ItemType Directory -Path $fixture -Force
try {
    # Exercise the real entry point with no arguments from pre-push/, matching
    # normal usage. Redirected input must reach the menu guard, not selection.
    $entryInfo=[Diagnostics.ProcessStartInfo]::new()
    $entryInfo.FileName=Join-Path $PSHOME 'powershell.exe'
    $entryInfo.Arguments='-NoProfile -ExecutionPolicy Bypass -File "'+(Join-Path $repo 'pre-push/backend-tests.ps1')+'"'
    $entryInfo.WorkingDirectory=Join-Path $repo 'pre-push'
    $entryInfo.UseShellExecute=$false; $entryInfo.CreateNoWindow=$true
    $entryInfo.RedirectStandardInput=$true; $entryInfo.RedirectStandardOutput=$true; $entryInfo.RedirectStandardError=$true
    $entryProcess=[Diagnostics.Process]::Start($entryInfo)
    try {
        $entryProcess.StandardInput.Close()
        $entryOutput=$entryProcess.StandardOutput.ReadToEndAsync()
        $entryError=$entryProcess.StandardError.ReadToEndAsync()
        if(-not $entryProcess.WaitForExit(30000)){throw 'No-argument entry point did not terminate'}
        Assert-True ($entryProcess.ExitCode -eq 1) 'Redirected no-argument invocation unexpectedly passed'
        Assert-True ($entryOutput.Result -match 'Etkilesimsiz kullanimda -Service veya -All belirtin\.') 'No-argument invocation skipped menu entry'
        Assert-True ($entryOutput.Result -notmatch 'Select at least one service') 'Null Service mistaken for an explicit selection'
    }
    finally { if(-not $entryProcess.HasExited){$entryProcess.Kill()};$entryProcess.Dispose() }
    $catalog=@(Get-BackendTestCatalog -Root $repo -Manifest $manifest)
    Assert-True ($catalog.Count -gt 0) 'Empty real catalog'
    Assert-True (@($catalog.Name | Sort-Object -Unique).Count -eq $catalog.Count) 'Duplicate catalog class'
    Assert-True (@($catalog | Where-Object Name -like '*TaskTestBase').Count -eq 0) 'Abstract test base included'
    $all=Get-BackendTestSelection -Catalog $catalog -Manifest $manifest -All
    Assert-True ($all.Tests.Count -eq $catalog.Count) 'All misses classes'
    $meeting=Get-BackendTestSelection -Catalog $catalog -Manifest $manifest -Service meeting-service
    foreach($name in @('com.pda.notification.MeetingHttpSecurityTest','com.pda.auth.infrastructure.config.MeetingProxyRateLimitTest','com.pda.migration.MeetingV56MigrationTest')+$manifest.Baseline){Assert-True ($meeting.Tests.Name -contains $name) "Missing meeting boundary: $name"}
    Assert-True ($meeting.NeedsDocker) 'Meeting Docker not detected'
    Assert-True ($meeting.Tests.Count -lt $catalog.Count) 'Meeting unexpectedly runs all backend'
    $combined=Get-BackendTestSelection -Catalog $catalog -Manifest $manifest -Service 'task-service,meeting-service','task-service'
    Assert-True (@($combined.Tests.Name | Sort-Object -Unique).Count -eq $combined.Tests.Count) 'Combined scope duplicates tests'
    Assert-True ((Get-BackendTestSelection -Catalog $catalog -Manifest $manifest -Service shared-service).All) 'Shared scope not expanded'
    Assert-Throws {Get-BackendTestSelection -Catalog $catalog -Manifest $manifest -Service missing-service} 'Unknown service accepted'
    Assert-Throws {Get-BackendTestSelection -Catalog $catalog -Manifest $manifest} 'Empty service accepted'
    Assert-Throws {Get-BackendTestSelection -Catalog $catalog -Manifest $manifest -Service task-service -All} 'All with Service accepted'

    $javaDir=Join-Path $fixture 'backend/src/test/java/com/pda/task'
    $null=New-Item -ItemType Directory -Path $javaDir -Force
    $small=@{Modules=@('task');Baseline=@();Related=@{};ExpectedSkips=@();SupportClasses=@();RequireAll=@()}
    Set-Content -LiteralPath (Join-Path $javaDir 'NewCaseTest.java') -Value 'package com.pda.task; class NewCaseTest { @Test void works() {} }'
    $new=@(Get-BackendTestCatalog -Root $fixture -Manifest $small)
    Assert-True ($new.Count -eq 1 -and $new[0].Service -eq 'task-service') 'New test not auto-discovered'
    Set-Content -LiteralPath (Join-Path $javaDir 'DockerBase.java') -Value 'package com.pda.task; @Testcontainers abstract class DockerBase { @Test void inherited() {} }'
    Set-Content -LiteralPath (Join-Path $javaDir 'InheritedTest.java') -Value 'package com.pda.task; class InheritedTest extends DockerBase {}'
    $inherited=@(Get-BackendTestCatalog -Root $fixture -Manifest $small | Where-Object Name -like '*InheritedTest')
    Assert-True ($inherited.Count -eq 1 -and $inherited[0].Docker) 'Inherited tests/Docker missed'
    $small.Related=@{'task-service'=@('com.pda.task.DeletedTest')}
    Assert-Throws {Get-BackendTestCatalog -Root $fixture -Manifest $small} 'Stale related reference accepted'
    $small.Related=@{}
    Set-Content -LiteralPath (Join-Path $javaDir 'ComposedTest.java') -Value 'package com.pda.task; class ComposedTest { @CustomTest void works() {} }'
    Assert-Throws {Get-BackendTestCatalog -Root $fixture -Manifest $small} 'Unknown composed test silently omitted'

    $reportDir=Join-Path $fixture 'reports';$null=New-Item -ItemType Directory -Path $reportDir
    $class='com.pda.task.NewCaseTest';$report=Join-Path $reportDir "TEST-$class-current.xml"
    Set-Content -LiteralPath (Join-Path $reportDir "TEST-$class-old.xml") -Value '<testsuite tests="999" failures="0" errors="0" skipped="0"/>'
    Assert-Throws {Read-BackendTestReports -Directory $reportDir -RunId current -ExpectedClasses @($class)} 'Old report accepted'
    Set-Content -LiteralPath $report -Value '<testsuite name="com.pda.task.NewCaseTest(current)" tests="2" failures="0" errors="0" skipped="0"/>'
    $summary=Read-BackendTestReports -Directory $reportDir -RunId current -ExpectedClasses @($class)
    Assert-True ($summary.Tests -eq 2 -and $summary.Files.Count -eq 1) 'Stale reports counted'
    Assert-Throws {Read-BackendTestReports -Directory $reportDir -RunId current -ExpectedClasses @($class,'com.pda.task.MissingTest')} 'Missing report accepted'
    Set-Content -LiteralPath $report -Value '<testsuite tests="2" failures="1" errors="0" skipped="0"/>'
    Assert-True ((Read-BackendTestReports -Directory $reportDir -RunId current -ExpectedClasses @($class)).Failures -eq 1) 'Failure count lost'
    Set-Content -LiteralPath $report -Value '<testsuite tests="2" failures="0" errors="0" skipped="1"/>'
    Assert-Throws {Read-BackendTestReports -Directory $reportDir -RunId current -ExpectedClasses @($class)} 'Unexpected skip accepted'
    Set-Content -LiteralPath $report -Value '<testsuite tests="2" failures="0" errors="0" skipped="2"/>'
    Assert-Throws {Read-BackendTestReports -Directory $reportDir -RunId current -ExpectedClasses @($class) -ExpectedSkips @($class)} 'All-skipped run accepted'
    Set-Content -LiteralPath $report -Value '<!DOCTYPE testsuite [<!ENTITY x "not allowed">]><testsuite tests="2" failures="0" errors="0" skipped="0"/>'
    Assert-Throws {Read-BackendTestReports -Directory $reportDir -RunId current -ExpectedClasses @($class)} 'DTD accepted'
    Set-Content -LiteralPath $report -Value '<testsuite tests="-1" failures="0" errors="0" skipped="0"/>'
    Assert-Throws {Read-BackendTestReports -Directory $reportDir -RunId current -ExpectedClasses @($class)} 'Negative count accepted'
    Set-Content -LiteralPath $report -Value '<testsuite name="com.pda.task.NewCaseTest(current)" tests="2" failures="0" errors="0" skipped="0"/>'
    $optional='com.pda.meeting.media.LiveKitRealSmokeTest'
    $optionalFile=Join-Path $reportDir "TEST-$optional-current.xml"
    Set-Content -LiteralPath $optionalFile -Value '<testsuite name="optional(current)" tests="1" failures="0" errors="0" skipped="1"/>'
    $withOptional=Read-BackendTestReports -Directory $reportDir -RunId current -ExpectedClasses @($class,$optional) -ExpectedSkips @($optional)
    Assert-True ($withOptional.Tests -eq 3 -and $withOptional.Skipped -eq 1 -and $withOptional.ExpectedSkipped -eq 1) 'Expected optional skip not distinguished'
    Assert-Throws {Read-BackendTestReports -Directory $reportDir -RunId current -ExpectedClasses @($class)} 'Unexpected extra report accepted'

    $environment=[Collections.Specialized.StringDictionary]::new()
    $environment['SPRING_DATASOURCE_URL']='must-not-survive';$environment['MAVEN_OPTS']='must-not-survive';$environment['LIVEKIT_API_SECRET']='must-not-survive'
    New-BackendTestEnvironment -Environment $environment -RunDirectory $fixture -JavaHome 'C:\test-jdk'
    foreach($key in @('SPRING_DATASOURCE_URL','MAVEN_OPTS','LIVEKIT_API_SECRET','JAVA_TOOL_OPTIONS')){Assert-True (-not $environment.ContainsKey($key)) "Unsafe inherited variable: $key"}
    Assert-True ($environment['DB_URL'] -eq 'jdbc:postgresql://127.0.0.1:1/pda_test') 'Unsafe DB fallback'
    Assert-True ($environment['MAIL_ENABLED'] -eq 'false') 'Mail not isolated'
    Assert-True ($environment['JAVA_HOME'] -eq 'C:\test-jdk') 'Java home not passed'
    Write-Host "PASS: $checks runner checks (no Maven, Docker or application tests)."
}
finally {
    $resolved=[IO.Path]::GetFullPath($fixture)
    $allowed=[IO.Path]::GetFullPath((Join-Path $repo 'backend/target'))+[IO.Path]::DirectorySeparatorChar
    if(-not $resolved.StartsWith($allowed,[StringComparison]::OrdinalIgnoreCase)){throw 'Unsafe fixture cleanup path'}
    Remove-Item -LiteralPath $resolved -Recurse -Force
}
