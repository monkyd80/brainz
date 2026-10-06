param(
    [Parameter(Mandatory=$true)][string]$PgBin,
    [string]$DbHost = '127.0.0.1',
    [string]$DbUser = 'postgres',
    [string]$DbName = 'company_manager',
    [string]$OutputFile = (Join-Path $PWD 'company_manager.dump')
)
$ErrorActionPreference = 'Stop'
$dumpExe = Join-Path $PgBin 'pg_dump.exe'
if (-not (Test-Path -LiteralPath $dumpExe)) { throw "pg_dump.exe not found: $dumpExe" }
if (Test-Path -LiteralPath $OutputFile) { throw "Backup already exists: $OutputFile. Choose another path." }
$partial = "$OutputFile.partial"
if (Test-Path -LiteralPath $partial) { throw "Partial backup already exists: $partial" }
& $dumpExe --version
& $dumpExe -h $DbHost -U $DbUser -d $DbName -Fc -f $partial
if ($LASTEXITCODE -ne 0) {
    Remove-Item -LiteralPath $partial -ErrorAction SilentlyContinue
    throw 'Backup failed.'
}
Move-Item -LiteralPath $partial -Destination $OutputFile
Write-Output "Backup complete: $OutputFile"
