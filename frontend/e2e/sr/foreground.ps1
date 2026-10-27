# TEST-ONLY, read-only: prints "yes" when the window in front belongs to a Chromium from the Playwright browser folder, otherwise "no".
Add-Type @"
using System; using System.Runtime.InteropServices;
public class Foreground {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
}
"@
$owner = [uint32]0
[void][Foreground]::GetWindowThreadProcessId([Foreground]::GetForegroundWindow(), [ref]$owner)
$process = Get-Process -Id $owner -ErrorAction SilentlyContinue
if ($null -ne $process -and $process.ProcessName -match '^(chrome|chromium)$' -and $process.Path -match 'ms-playwright') { "yes" } else { "no" }
