@echo off
setlocal EnableExtensions
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  echo [ERRO] Ambiente .venv nao encontrado.
  echo Execute primeiro: python -m venv .venv ^&^& .venv\Scripts\python -m pip install -r requirements.txt
  exit /b 2
)
".venv\Scripts\python.exe" main.py --daily-auto --sync
exit /b %ERRORLEVEL%
