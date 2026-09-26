[CmdletBinding()]
param(
    [ValidateRange(0, 23)]
    [int]$Hour = 6,
    [ValidateRange(0, 59)]
    [int]$Minute = 30
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$backendRoot = Join-Path $projectRoot 'backend'
$pythonPath = Join-Path $backendRoot '.venv\Scripts\python.exe'
$taskName = 'Primor - Sincronizacao Diaria'

if (-not (Test-Path -LiteralPath $pythonPath)) {
    throw "Python do projeto não encontrado: $pythonPath"
}

$userId = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$at = [datetime]::Today.AddHours($Hour).AddMinutes($Minute)
$action = New-ScheduledTaskAction -Execute $pythonPath -Argument 'main.py --daily-sync' -WorkingDirectory $backendRoot
$dailyTrigger = New-ScheduledTaskTrigger -Daily -At $at
$startupTrigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId $userId -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -WakeToRun `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -MultipleInstances IgnoreNew `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 15) `
    -ExecutionTimeLimit (New-TimeSpan -Hours 4)

Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger @($dailyTrigger, $startupTrigger) `
    -Principal $principal `
    -Settings $settings `
    -Description 'Sincroniza Vendas e Perdas do SUPERUS ao Supabase. Requer sessão Windows conectada para a automação do SUPERUS.' `
    -Force | Select-Object TaskName, State

Get-ScheduledTaskInfo -TaskName $taskName | Select-Object LastRunTime, LastTaskResult, NextRunTime

Write-Host "Tarefa instalada para $($at.ToString('HH:mm')) e no início do Windows."
Write-Host 'Para evitar duas automações simultâneas, desative a tarefa legada "Painel de Gestao - Vendas 05h" após validar esta nova rotina.'
