@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0backend-tests.ps1" %*
exit /b %errorlevel%
