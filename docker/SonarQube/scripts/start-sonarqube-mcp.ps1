param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectPath,

  [string]$UserTokenVariable = 'SONARQUBE_TOKEN',

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

$serverUrl = [Environment]::GetEnvironmentVariable('SQB_URL', 'Process')
if ([string]::IsNullOrEmpty($serverUrl)) {
  $serverUrl = [Environment]::GetEnvironmentVariable('SQB_URL', 'User')
}
if ([string]::IsNullOrEmpty($serverUrl)) {
  throw 'SQB_URL is not available'
}
[Environment]::SetEnvironmentVariable('SONARQUBE_URL', $serverUrl, 'Process')

$gitBash = 'C:\Program Files\Git\bin\bash.exe'
if (-not (Test-Path -LiteralPath $gitBash -PathType Leaf)) {
  throw "Git Bash executable does not exist: $gitBash"
}

$launcher = Join-Path $PSScriptRoot 'start-sonarqube-mcp.sh'
$mode = if ($Check) { '--check' } else { '--run' }
& $gitBash $launcher $ProjectPath $mode
exit $LASTEXITCODE
