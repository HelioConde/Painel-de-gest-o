@echo off
setlocal EnableExtensions
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0run-daily-sync.ps1" %*
exit /b %ERRORLEVEL%
