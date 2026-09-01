param(
  [string]$ChunksDir = "C:\Users\anton\Documents\repo\exports\chunks",
  [string]$TargetLocation = "swedencentral"
)

if (-not (Test-Path $ChunksDir)) {
  Write-Error "Chunks directory not found: $ChunksDir"
  exit 1
}

$paramKeys = @(
  'vaults_palazzopintokv_name',
  'virtualNetworks_palazzopinto_backend_vnet_name',
  'serverfarms_palazzopinto_api_b1_plan_name',
  'serverfarms_palazzopinto_free_plan_name',
  'workspaces_palazzopinto_logs_name'
)

Get-ChildItem -Path $ChunksDir -Filter "chunk-*-template.json" | Sort-Object Name | ForEach-Object {
  $path = $_.FullName
  Write-Host "Checking $path"
  $tpl = Get-Content $path -Raw | ConvertFrom-Json
  $changed = $false
  $newResources = @()
  foreach ($r in $tpl.resources) {
    $shouldChange = $false
    foreach ($k in $paramKeys) {
      if ($r.name -and ($r.name -like "*${k}*")) { $shouldChange = $true; break }
    }
    if ($shouldChange) {
      Write-Host " - Reconstructing resource (changing location) with name: $($r.name)"
      $hash = @{}
      foreach ($prop in $r.PSObject.Properties) {
        if ($prop.Name -eq 'location') { $hash['location'] = $TargetLocation } else { $hash[$prop.Name] = $prop.Value }
      }
      $newResources += (New-Object PSObject -Property $hash)
      $changed = $true
    } else {
      $newResources += $r
    }
  }
  $tpl.resources = $newResources
  if ($changed) {
    $tpl | ConvertTo-Json -Depth 50 | Out-File -FilePath $path -Encoding UTF8
    Write-Host "Updated $path"
  } else {
    Write-Host "No changes in $path"
  }
}

Write-Host "Done"
