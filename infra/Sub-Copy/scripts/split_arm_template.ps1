param(
  [string]$TemplatePath = "..\exports\PalazzoPintoBnB-arm-export.json",
  [int]$MaxPerFile = 700,
  [string]$OutDir = "..\exports\chunks"
)

if (-not (Test-Path $TemplatePath)) {
  Write-Error "Template not found: $TemplatePath"
  exit 1
}

New-Item -ItemType Directory -Path $OutDir -Force | Out-Null

$json = Get-Content $TemplatePath -Raw | ConvertFrom-Json
$resources = $json.resources
$total = $resources.Count
Write-Host "Template has $total resources; splitting into chunks of $MaxPerFile..."

$idx = 1
for ($i = 0; $i -lt $total; $i += $MaxPerFile) {
  $chunk = $resources[$i..([math]::Min($i + $MaxPerFile - 1, $total - 1))]
  $new = [ordered]@{
    '$schema' = $json.'$schema'
    'contentVersion' = $json.contentVersion
    'parameters' = $json.parameters
    'resources' = $chunk
  }
  $outPath = Join-Path $OutDir ("chunk-{0:00}-template.json" -f $idx)
  $new | ConvertTo-Json -Depth 10 | Out-File -FilePath $outPath -Encoding UTF8
  Write-Host "Wrote $outPath ($($chunk.Count) resources)"
  $idx++
}

Write-Host "Created $($idx - 1) chunk files in $OutDir"
