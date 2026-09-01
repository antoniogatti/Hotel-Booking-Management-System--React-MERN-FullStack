$c1 = Resolve-Path '..\exports\chunks\chunk-01-template.json'
$c2 = Resolve-Path '..\exports\chunks\chunk-02-template.json'
$p = Resolve-Path 'infra\Sub-Copy\templates\params.json'
Write-Host "Chunk1: $($c1.ProviderPath)"
Write-Host "Chunk2: $($c2.ProviderPath)"
Write-Host "Params: $($p.ProviderPath)"
az account set --subscription 9b57086c-fdb8-43eb-ad36-a02c7a19ab09

Write-Host "Deploying chunk 1..."
Start-Process az -ArgumentList @('deployment','group','create','--resource-group','PalazzoPintoBnB-Pro','--template-file',$c1.ProviderPath,'--parameters',('@'+$p.ProviderPath),'--mode','Incremental') -NoNewWindow -Wait -PassThru

Write-Host "Deploying chunk 2..."
Start-Process az -ArgumentList @('deployment','group','create','--resource-group','PalazzoPintoBnB-Pro','--template-file',$c2.ProviderPath,'--parameters',('@'+$p.ProviderPath),'--mode','Incremental') -NoNewWindow -Wait -PassThru

Write-Host "Done"
