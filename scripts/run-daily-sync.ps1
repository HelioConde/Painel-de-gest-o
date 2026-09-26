[CmdletBinding()]
param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$PythonArguments
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$backendRoot = Join-Path $projectRoot 'backend'
$pythonPath = Join-Path $backendRoot '.venv\Scripts\python.exe'

if (-not (Test-Path -LiteralPath $pythonPath)) {
    throw "Python do projeto não encontrado: $pythonPath"
}

Push-Location $backendRoot
try {
    & $pythonPath 'main.py' '--daily-sync' @PythonArguments
    exit $LASTEXITCODE
}
finally {
    Pop-Location
}
