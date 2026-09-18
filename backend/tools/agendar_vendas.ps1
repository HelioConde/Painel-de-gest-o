$ErrorActionPreference = 'Stop'
$backendRoot = Split-Path -Parent $PSScriptRoot
$pythonPath = Join-Path $backendRoot '.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $pythonPath)) { throw 'Python do projeto nao encontrado.' }
$userId = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$action = New-ScheduledTaskAction -Execute $pythonPath -Argument 'main.py --daily-auto --sync' -WorkingDirectory $backendRoot
$trigger = New-ScheduledTaskTrigger -Daily -At '05:00'
$principal = New-ScheduledTaskPrincipal -UserId $userId -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -WakeToRun -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 4)
Register-ScheduledTask -TaskName 'Painel de Gestao - Vendas 05h' -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description 'Coleta nova SUPERUS: vendas diarias, mensais e eventos, com sincronizacao no Supabase. Todos os dias as 05:00 (horario local de Brasilia). Requer usuario conectado.' -Force | Select-Object TaskName, State
Get-ScheduledTaskInfo -TaskName 'Painel de Gestao - Vendas 05h' | Select-Object NextRunTime, LastTaskResult
