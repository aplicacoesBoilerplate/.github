param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectKey,

  [string]$TokenVariable = 'SONARQUBE_TOKEN',

  [string]$ServerUrl = 'http://localhost:9000'
)

$ErrorActionPreference = 'Stop'
$server = $ServerUrl.TrimEnd('/')
$token = [Environment]::GetEnvironmentVariable($TokenVariable, 'Process')
if ([string]::IsNullOrEmpty($token)) {
  $token = [Environment]::GetEnvironmentVariable($TokenVariable, 'User')
}
if ([string]::IsNullOrEmpty($token)) {
  throw "User Token unavailable in environment variable: $TokenVariable"
}

$headers = @{ Authorization = "Bearer $token" }
$projectQuery = [uri]::EscapeDataString($ProjectKey)
$projects = Invoke-RestMethod "$server/api/projects/search?projects=$projectQuery" -Headers $headers
if (-not ($projects.components | Where-Object key -eq $ProjectKey)) {
  throw "Project not visible to this User Token: $ProjectKey"
}

$manifestPath = Join-Path $PSScriptRoot '../config/quality-profiles/p-pascal.json'
$specifications = (Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json).profiles
if (-not $specifications) {
  throw "No quality profiles defined in $manifestPath"
}

foreach ($spec in $specifications) {
  $profiles = (Invoke-RestMethod "$server/api/qualityprofiles/search" -Headers $headers).profiles
  $parent = $profiles | Where-Object { $_.language -eq $spec.Language -and $_.name -eq $spec.Parent }
  if (-not $parent) {
    throw "Parent profile $($spec.Parent) unavailable for language $($spec.Language)"
  }

  $profile = $profiles | Where-Object { $_.language -eq $spec.Language -and $_.name -eq $spec.Name }
  if (-not $profile) {
    Invoke-RestMethod "$server/api/qualityprofiles/create" -Method Post -Headers $headers -Body @{
      language = $spec.Language
      name = $spec.Name
    } | Out-Null
    Invoke-RestMethod "$server/api/qualityprofiles/change_parent" -Method Post -Headers $headers -Body @{
      language = $spec.Language
      qualityProfile = $spec.Name
      parentQualityProfile = $spec.Parent
    } | Out-Null
    $profiles = (Invoke-RestMethod "$server/api/qualityprofiles/search" -Headers $headers).profiles
    $profile = $profiles | Where-Object { $_.language -eq $spec.Language -and $_.name -eq $spec.Name }
  }
  if ($profile.parentKey -ne $parent.key) {
    throw "Existing profile $($spec.Name) does not inherit from $($spec.Parent)"
  }

  $ruleKey = [uri]::EscapeDataString($spec.Rule)
  $ruleResponse = Invoke-RestMethod "$server/api/rules/show?key=$ruleKey&actives=true" -Headers $headers
  $defaultIgnore = ($ruleResponse.rule.params | Where-Object key -eq 'ignore').defaultValue
  if ([string]::IsNullOrEmpty($defaultIgnore)) {
    throw "Default ignore parameter unavailable for rule $($spec.Rule)"
  }
  $desiredIgnore = "$defaultIgnore,$($spec.AcceptedCatchName)"
  $active = $ruleResponse.actives | Where-Object qProfile -eq $profile.key
  $currentIgnore = ($active.params | Where-Object key -eq 'ignore').value
  if ($currentIgnore -ne $desiredIgnore) {
    if ($currentIgnore -and $currentIgnore -ne $defaultIgnore) {
      throw "Existing S7718 override differs in profile $($spec.Name); review it before changing"
    }
    Invoke-RestMethod "$server/api/qualityprofiles/activate_rule" -Method Post -Headers $headers -Body @{
      key = $profile.key
      rule = $spec.Rule
      params = "ignore=$desiredIgnore"
    } | Out-Null
  }

  $projectProfiles = (Invoke-RestMethod "$server/api/qualityprofiles/search?project=$projectQuery" -Headers $headers).profiles
  $assigned = $projectProfiles | Where-Object { $_.language -eq $spec.Language -and $_.key -eq $profile.key }
  if (-not $assigned) {
    Invoke-RestMethod "$server/api/qualityprofiles/add_project" -Method Post -Headers $headers -Body @{
      language = $spec.Language
      project = $ProjectKey
      qualityProfile = $spec.Name
    } | Out-Null
  }
  Write-Output "$($spec.Language): $($spec.Name) assigned to $ProjectKey"
}
