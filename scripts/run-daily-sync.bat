@echo off
setlocal EnableExtensions
echo [%date% %time%] Sincronizacao diaria: Vendas, Tabloide e Perdas.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0run-daily-sync.ps1" %*
set "exitCode=%ERRORLEVEL%"
echo [%date% %time%] Sincronizacao diaria finalizada com codigo %exitCode%.
exit /b %exitCode%
