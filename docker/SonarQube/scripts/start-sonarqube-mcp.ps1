param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectPath,

  [Parameter(Mandatory = $true)]
  [string]$UserTokenVariable,

  [switch]$Check
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $ProjectPath -PathType Container)) {
  throw "Project directory does not exist: $ProjectPath"
}

$token = [Environment]::GetEnvironmentVariable($UserTokenVariable, 'Process')
if ([string]::IsNullOrEmpty($token)) {
  $token = [Environment]::GetEnvironmentVariable($UserTokenVariable, 'User')
}
if ([string]::IsNullOrEmpty($token)) {
  throw "User token variable is not available: $UserTokenVariable"
}

[Environment]::SetEnvironmentVariable($UserTokenVariable, $token, 'Process')

$gitBash = 'C:\Program Files\Git\bin\bash.exe'
if (-not (Test-Path -LiteralPath $gitBash -PathType Leaf)) {
  throw "Git Bash executable does not exist: $gitBash"
}

$launcher = Join-Path $PSScriptRoot 'start-sonarqube-mcp.sh'
$mode = if ($Check) { '--check' } else { '--run' }
& $gitBash $launcher $ProjectPath $mode
exit $LASTEXITCODE
