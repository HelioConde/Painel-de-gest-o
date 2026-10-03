[CmdletBinding()]
param(
    [ValidateRange(0, 23)]
    [int]$Hour = 5,
    [ValidateRange(0, 59)]
    [int]$Minute = 0
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$runnerPath = Join-Path $PSScriptRoot 'run-daily-sync.bat'
$taskName = 'Painel de Gestao - Vendas 05h'
$legacyTaskName = 'Primor - Sincronizacao Diaria'

if (-not (Test-Path -LiteralPath $runnerPath)) {
    throw "Executor diário não encontrado: $runnerPath"
}

$userId = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$at = [datetime]::Today.AddHours($Hour).AddMinutes($Minute)
$arguments = '/d /c ""{0}""' -f $runnerPath
$action = New-ScheduledTaskAction -Execute $env:ComSpec -Argument $arguments -WorkingDirectory $projectRoot
$dailyTrigger = New-ScheduledTaskTrigger -Daily -At $at
$principal = New-ScheduledTaskPrincipal -UserId $userId -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -WakeToRun `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit (New-TimeSpan -Hours 4)

if ($legacyTaskName -ne $taskName -and (Get-ScheduledTask -TaskName $legacyTaskName -ErrorAction SilentlyContinue)) {
    Unregister-ScheduledTask -TaskName $legacyTaskName -Confirm:$false
}

Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger $dailyTrigger `
    -Principal $principal `
    -Settings $settings `
    -Description 'Sincronização diária única: Vendas, Tabloide e Perdas do SUPERUS; valida o Supabase e repete apenas a etapa que falhar.' `
    -Force | Select-Object TaskName, State

Get-ScheduledTaskInfo -TaskName $taskName | Select-Object LastRunTime, LastTaskResult, NextRunTime

Write-Host "Tarefa única instalada para todos os dias às $($at.ToString('HH:mm'))."
Write-Host 'Ordem: Vendas, Tabloide, Perdas e verificação final no Supabase.'
