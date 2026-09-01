param(
  [string]$SubscriptionId = "9b57086c-fdb8-43eb-ad36-a02c7a19ab09",
  [string]$ResourceGroup = "PalazzoPintoBnB-Pro",
  [string]$ChunksPath = "..\exports\chunks",
  [string]$ParamsFile = "..\templates\params.json"
)

Write-Host "Setting subscription to $SubscriptionId"
az account set --subscription $SubscriptionId

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

$resolvedChunksPath = Join-Path $scriptRoot $ChunksPath
# prefer params-pro.json when present
$preferredParams = Join-Path $scriptRoot '..\templates\params-pro.json'
if (Test-Path $preferredParams) {
  $resolvedParamsPath = (Resolve-Path $preferredParams).ProviderPath
  Write-Host "Using params file: $resolvedParamsPath"
} else {
  $resolvedParamsPath = Join-Path $scriptRoot $ParamsFile
}

if (-not (Test-Path $resolvedChunksPath)) {
  # try repo-level exports/chunks as fallback
  $repoRoot = Resolve-Path (Join-Path $scriptRoot '..\..')
  $alt = Join-Path $repoRoot 'exports\chunks'
  if (Test-Path $alt) {
    Write-Host "Using alternate chunks path: $alt"
    $resolvedChunksPath = $alt
  } else {
    Write-Error "Chunks path not found: $resolvedChunksPath"
    exit 1
  }
}

$chunks = Get-ChildItem -Path $ChunksPath -Filter "chunk-*-template.json" | Sort-Object Name
$chunks = Get-ChildItem -Path $resolvedChunksPath -Filter "chunk-*-template.json" | Sort-Object Name

foreach ($c in $chunks) {
  Write-Host "Deploying chunk: $($c.Name)"
  $fullTemplate = $c.FullName
  if (-not (Test-Path $resolvedParamsPath)) {
    Write-Error "Parameters file not found: $resolvedParamsPath"
    exit 1
  }
  $fullParams = (Resolve-Path $resolvedParamsPath).ProviderPath
  $atParams = "@" + $fullParams
  $args = @('deployment','group','create','--resource-group',$ResourceGroup,'--template-file',$fullTemplate,'--parameters',$atParams,'--mode','Incremental')
  $proc = Start-Process -FilePath az -ArgumentList $args -NoNewWindow -Wait -PassThru
  if ($proc.ExitCode -ne 0) {
    Write-Error "Deployment failed for $($c.Name) with exit code $($proc.ExitCode). Stopping."
    exit $proc.ExitCode
  }
}

Write-Host "All chunks deployed. Review outputs and check for any failed resources."
