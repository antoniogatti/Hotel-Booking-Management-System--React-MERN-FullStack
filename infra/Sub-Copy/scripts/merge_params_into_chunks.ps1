param(
  [string]$ParamsFile = "..\templates\params-pro.json",
  [string]$ChunksDir = "..\..\..\exports\chunks"
)

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$resolvedParams = Join-Path $scriptRoot $ParamsFile
if (-not (Test-Path $resolvedParams)) {
  Write-Host "Preferred params file not found: $resolvedParams. Falling back to params.json"
  $resolvedParams = Join-Path $scriptRoot "..\templates\params.json"
  if (-not (Test-Path $resolvedParams)) {
    Write-Error "No params file found at expected locations."
    exit 1
  }
}

$resolvedChunks = $null
if ([System.IO.Path]::IsPathRooted($ChunksDir)) {
  $resolvedChunks = $ChunksDir
} else {
  $resolvedChunks = Join-Path $scriptRoot $ChunksDir
}

if (-not (Test-Path $resolvedChunks)) {
  # try repo-level exports/chunks
   $repoRoot = Resolve-Path (Join-Path $scriptRoot "..\..\..")
   $repoRootPath = $repoRoot.ProviderPath
   $alt = Join-Path $repoRootPath 'exports\chunks'
  if (Test-Path $alt) {
    $resolvedChunks = $alt
    Write-Host "Using alternate chunks path: $resolvedChunks"
  } else {
    Write-Error "Chunks directory not found: $resolvedChunks"
    exit 1
  }
}

$paramsJson = Get-Content $resolvedParams -Raw | ConvertFrom-Json
$paramValues = @{}
foreach ($p in $paramsJson.parameters.PSObject.Properties) {
  $paramValues[$p.Name] = $p.Value.value
}

Write-Host "Injecting parameter default values into chunk templates from: $resolvedParams"

$chunks = Get-ChildItem -Path $resolvedChunks -Filter "chunk-*-template.json" | Sort-Object Name
foreach ($c in $chunks) {
  Write-Host "Processing $($c.Name)"
  $tpl = Get-Content $c.FullName -Raw | ConvertFrom-Json
  if (-not $tpl.parameters) { $tpl.parameters = @{} }
  foreach ($k in $paramValues.Keys) {
    # determine existing type if present
    $existingType = 'String'
    if ($tpl.parameters.PSObject.Properties.Name -contains $k) {
      try { $existingType = $tpl.parameters.$k.type } catch { $existingType = 'String' }
    }
    # replace or add parameter entry with defaultValue
    $tpl.parameters.$k = @{ type = $existingType; defaultValue = $paramValues[$k] }
  }
  # write back
  $tpl | ConvertTo-Json -Depth 50 | Out-File -FilePath $c.FullName -Encoding UTF8
  Write-Host "Updated $($c.Name)"
}

Write-Host "All chunks updated with default parameter values."
