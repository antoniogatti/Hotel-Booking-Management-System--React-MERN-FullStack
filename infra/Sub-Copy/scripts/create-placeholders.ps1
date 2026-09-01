<#
Create placeholders in the target subscription/resource-group
Usage: .\create-placeholders.ps1 -SubscriptionId <id> -ResourceGroup <name> -Location <location>
#>
param(
  [string]$SubscriptionId = "9b57086c-fdb8-43eb-ad36-a02c7a19ab09",
  [string]$ResourceGroup = "PalazzoPintoBnB-Pro",
  [string]$Location = "swedencentral"
)

Write-Host "Setting subscription to $SubscriptionId"
az account set --subscription $SubscriptionId

Write-Host "Creating resource group: $ResourceGroup ($Location)"
az group create --name $ResourceGroup --location $Location | ConvertFrom-Json | Out-Null

Write-Host "Creating Virtual Network"
az network vnet create --resource-group $ResourceGroup --name palazzopinto-backend-vnet --address-prefix 10.1.0.0/16 --subnet-name default --subnet-prefix 10.1.0.0/24 --location $Location | ConvertFrom-Json | Out-Null

Write-Host "Registering resource providers if required"
az provider register --namespace Microsoft.KeyVault | Out-Null
az provider register --namespace Microsoft.Network | Out-Null
az provider register --namespace Microsoft.Web | Out-Null
az provider register --namespace Microsoft.OperationalInsights | Out-Null

Write-Host "Creating Key Vault placeholder"
az keyvault create --name palazzopintokv-pro --resource-group $ResourceGroup --location $Location --sku standard | ConvertFrom-Json | Out-Null

Write-Host "Creating App Service Plans"
az appservice plan create --name palazzopinto-api-b1-plan --resource-group $ResourceGroup --sku B1 --is-linux --location $Location | Out-Null
az appservice plan create --name palazzopinto-free-plan --resource-group $ResourceGroup --sku S1 --location $Location | Out-Null

Write-Host "Creating Log Analytics workspace"
az monitor log-analytics workspace create --resource-group $ResourceGroup --workspace-name palazzopinto-logs --location $Location | Out-Null

Write-Host "Creating Application Insights (example)"
az monitor app-insights component create --app palazzopinto-appinsights --location $Location --resource-group $ResourceGroup --application-type web | Out-Null

Write-Host "Placeholders created. Review resources in the portal or with 'az resource list'."
