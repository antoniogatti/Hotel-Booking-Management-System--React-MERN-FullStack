<#
Deploy ARM export to target subscription/resource-group.
Important: the ARM export may include types that cannot be deployed or need manual adjustments (KeyVault secrets, private endpoints, database data).

Usage example:
.\deploy-arm-export.ps1 -SubscriptionId <id> -ResourceGroup PalazzoPintoBnB-Pro -TemplatePath ..\exports\PalazzoPintoBnB-arm-export.json
#>
param(
  [string]$SubscriptionId = "9b57086c-fdb8-43eb-ad36-a02c7a19ab09",
  [string]$ResourceGroup = "PalazzoPintoBnB-Pro",
  [string]$TemplatePath = "..\exports\PalazzoPintoBnB-arm-export.json",
  [string]$Location = "swedencentral"
)

Write-Host "Setting subscription to $SubscriptionId"
az account set --subscription $SubscriptionId

if (-not (Test-Path $TemplatePath)) {
  Write-Error "Template file not found: $TemplatePath"
  exit 1
}

Write-Host "Review the template at $TemplatePath and update parameter defaults before deploying."
Write-Host "You can provide parameter overrides using --parameters @params.json or --parameters name=value"

# Example deployment command (review params.json then run):
# az deployment group create --resource-group $ResourceGroup --template-file $TemplatePath --parameters @..\templates\params.json --mode Incremental

Write-Host "Deployment command prepared. Review params at ..\templates\params.json before running the commented az deployment command."
