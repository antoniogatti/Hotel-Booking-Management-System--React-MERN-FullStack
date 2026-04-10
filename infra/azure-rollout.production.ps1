$ErrorActionPreference = "Stop"

function Get-RequiredValue {
  param(
    [string]$Value,
    [string]$EnvironmentName,
    [string]$Label
  )

  if ($Value) {
    return $Value
  }

  $fromEnv = [Environment]::GetEnvironmentVariable($EnvironmentName)
  if ($fromEnv) {
    return $fromEnv
  }

  throw "Missing required value for $Label. Set parameter or environment variable $EnvironmentName."
}

function Get-AzContextValue {
  param(
    [string]$Query
  )

  $result = az account show --query $Query -o tsv
  if (-not $result) {
    throw "Unable to resolve Azure account value for query '$Query'. Run 'az login' first."
  }

  return $result.Trim()
}

function Get-OptionalValue {
  param(
    [string]$EnvironmentName
  )

  $value = [Environment]::GetEnvironmentVariable($EnvironmentName)
  if ($value) {
    return $value.Trim()
  }

  return $null
}

function Get-JsonPropertyValue {
  param(
    [object]$Object,
    [string]$PropertyPath
  )

  $current = $Object
  foreach ($segment in $PropertyPath.Split('.')) {
    if ($null -eq $current) {
      return $null
    }

    $current = $current.$segment
  }

  return $current
}

function Get-ParameterValue {
  param(
    [object]$ParameterFile,
    [string]$ParameterName
  )

  return Get-JsonPropertyValue -Object $ParameterFile -PropertyPath "parameters.$ParameterName.value"
}

function Get-LegacyWebAppName {
  param(
    [string]$ResourceGroup,
    [string]$SuffixPattern,
    [string]$ExcludeName
  )

  $apps = az resource list --resource-group $ResourceGroup --resource-type "Microsoft.Web/sites" -o json | ConvertFrom-Json
  $name = $apps |
    Where-Object { $_.name -like "*$SuffixPattern*" -and $_.name -ne $ExcludeName } |
    Sort-Object name |
    Select-Object -ExpandProperty name -First 1

  if (-not $name) {
    throw "Unable to resolve legacy web app matching '$SuffixPattern' in resource group '$ResourceGroup'."
  }

  return $name.Trim()
}

function Get-WebAppDefaultHostname {
  param(
    [string]$ResourceGroup,
    [string]$WebAppName
  )

  $hostname = az webapp show --resource-group $ResourceGroup --name $WebAppName --query defaultHostName -o tsv
  if (-not $hostname) {
    throw "Unable to resolve default hostname for web app '$WebAppName'."
  }

  return $hostname.Trim()
}

function Get-WebAppAppSettingValue {
  param(
    [string]$ResourceGroup,
    [string]$WebAppName,
    [string]$SettingName
  )

  $value = az webapp config appsettings list --resource-group $ResourceGroup --name $WebAppName --query "[?name=='$SettingName'].value | [0]" -o tsv
  if (-not $value) {
    return $null
  }

  return $value.Trim()
}

$ResourceGroup = "PalazzoPintoBnB"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$ParameterFilePath = Join-Path $PSScriptRoot "main.parameters.production.json"
$ParameterFile = Get-Content $ParameterFilePath | ConvertFrom-Json

$NamePrefix = Get-ParameterValue -ParameterFile $ParameterFile -ParameterName "namePrefix"
$BackendAppName = Get-ParameterValue -ParameterFile $ParameterFile -ParameterName "backendAppName"
$KeyVaultName = Get-ParameterValue -ParameterFile $ParameterFile -ParameterName "keyVaultName"
$MongoClusterName = Get-ParameterValue -ParameterFile $ParameterFile -ParameterName "mongoClusterName"
$ConfiguredBackendUrl = Get-ParameterValue -ParameterFile $ParameterFile -ParameterName "backendUrl"
$ConfiguredFrontendUrl = Get-ParameterValue -ParameterFile $ParameterFile -ParameterName "frontendUrl"
$ConfiguredFrontendAdditionalOrigins = @(Get-ParameterValue -ParameterFile $ParameterFile -ParameterName "frontendAdditionalOrigins")

$Location = az group show --name $ResourceGroup --query location -o tsv
if (-not $Location) {
  throw "Unable to resolve location for resource group '$ResourceGroup'."
}

$Location = $Location.Trim()
$LegacyBackendAppName = Get-LegacyWebAppName -ResourceGroup $ResourceGroup -SuffixPattern "-api-" -ExcludeName $BackendAppName
$LegacyFrontendAppName = Get-LegacyWebAppName -ResourceGroup $ResourceGroup -SuffixPattern "-web-" -ExcludeName ""
$LegacyFrontendHostname = Get-WebAppDefaultHostname -ResourceGroup $ResourceGroup -WebAppName $LegacyFrontendAppName
$LegacyFrontendUrl = "https://$LegacyFrontendHostname"
$StaticWebAppName = if ($NamePrefix) { "$NamePrefix-web-swa" } else { "palazzopinto-web-swa" }
$DeploymentName = if ($NamePrefix) { "$NamePrefix-secure-backend" } else { "palazzopinto-secure-backend" }

$BackendRoot = Join-Path $RepoRoot "hotel-booking-backend"
$ArtifactDir = Join-Path $PSScriptRoot "artifacts"
$BackendZip = Join-Path $ArtifactDir "backend.zip"

$SubscriptionId = Get-AzContextValue "id"
$TenantId = Get-AzContextValue "tenantId"
$MongoConnectionString = Get-RequiredValue -Value $null -EnvironmentName "PALAZZOPINTO_MONGODB_CONNECTION_STRING" -Label "MongoDB connection string"
$JwtSecretKey = Get-RequiredValue -Value $null -EnvironmentName "PALAZZOPINTO_JWT_SECRET_KEY" -Label "JWT secret key"
$CloudinaryCloudName = Get-OptionalValue -EnvironmentName "PALAZZOPINTO_CLOUDINARY_CLOUD_NAME"
$CloudinaryCloudName = if ($CloudinaryCloudName) { $CloudinaryCloudName } else { Get-WebAppAppSettingValue -ResourceGroup $ResourceGroup -WebAppName $LegacyBackendAppName -SettingName "CLOUDINARY_CLOUD_NAME" }
if (-not $CloudinaryCloudName) {
  throw "Missing required value for Cloudinary cloud name. Set PALAZZOPINTO_CLOUDINARY_CLOUD_NAME or configure CLOUDINARY_CLOUD_NAME on the legacy backend app."
}
$CloudinaryApiKey = Get-RequiredValue -Value $null -EnvironmentName "PALAZZOPINTO_CLOUDINARY_API_KEY" -Label "Cloudinary API key"
$CloudinaryApiSecret = Get-RequiredValue -Value $null -EnvironmentName "PALAZZOPINTO_CLOUDINARY_API_SECRET" -Label "Cloudinary API secret"
$EntraClientId = Get-OptionalValue -EnvironmentName "PALAZZOPINTO_MS_ENTRA_CLIENT_ID"
$EntraClientId = if ($EntraClientId) { $EntraClientId } else { Get-WebAppAppSettingValue -ResourceGroup $ResourceGroup -WebAppName $LegacyBackendAppName -SettingName "MS_ENTRA_CLIENT_ID" }
if (-not $EntraClientId) {
  throw "Missing required value for Microsoft Entra client ID. Set PALAZZOPINTO_MS_ENTRA_CLIENT_ID or configure MS_ENTRA_CLIENT_ID on the legacy backend app."
}
$EntraClientSecret = Get-RequiredValue -Value $null -EnvironmentName "PALAZZOPINTO_MS_ENTRA_CLIENT_SECRET" -Label "Microsoft Entra client secret"

$AllowedFrontendOrigins = @($ConfiguredFrontendAdditionalOrigins | Where-Object { $_ })
if ($ConfiguredFrontendUrl -and $AllowedFrontendOrigins -notcontains $ConfiguredFrontendUrl) {
  $AllowedFrontendOrigins += $ConfiguredFrontendUrl
}
if ($AllowedFrontendOrigins -notcontains $LegacyFrontendUrl) {
  $AllowedFrontendOrigins += $LegacyFrontendUrl
}
$AllowedFrontendOriginsValue = $AllowedFrontendOrigins -join ","

az account set --subscription $SubscriptionId
az group show --name $ResourceGroup --output table

# Lock existing live App Services to HTTPS immediately during transition.
az webapp update --resource-group $ResourceGroup --name $LegacyBackendAppName --set httpsOnly=true
az webapp update --resource-group $ResourceGroup --name $LegacyFrontendAppName --set httpsOnly=true

# Preview and deploy the secure backend infrastructure.
az deployment group what-if --name "$DeploymentName-whatif" --resource-group $ResourceGroup --template-file (Join-Path $PSScriptRoot "main.bicep") --parameters ("@" + $ParameterFilePath) --parameters location=$Location frontendUrl=$LegacyFrontendUrl entraTenantId=$TenantId
az deployment group create --name $DeploymentName --resource-group $ResourceGroup --template-file (Join-Path $PSScriptRoot "main.bicep") --parameters ("@" + $ParameterFilePath) --parameters location=$Location frontendUrl=$LegacyFrontendUrl entraTenantId=$TenantId

# Create or update Key Vault secrets used by the secure backend.
az keyvault secret set --vault-name $KeyVaultName --name mongodb-connection-string --value $MongoConnectionString --output none
az keyvault secret set --vault-name $KeyVaultName --name jwt-secret-key --value $JwtSecretKey --output none
az keyvault secret set --vault-name $KeyVaultName --name cloudinary-cloud-name --value $CloudinaryCloudName --output none
az keyvault secret set --vault-name $KeyVaultName --name cloudinary-api-key --value $CloudinaryApiKey --output none
az keyvault secret set --vault-name $KeyVaultName --name cloudinary-api-secret --value $CloudinaryApiSecret --output none
az keyvault secret set --vault-name $KeyVaultName --name ms-entra-client-id --value $EntraClientId --output none
az keyvault secret set --vault-name $KeyVaultName --name ms-entra-client-secret --value $EntraClientSecret --output none

# Configure build/deployment behavior for zip deployment.
az webapp config appsettings set --resource-group $ResourceGroup --name $BackendAppName --settings SCM_DO_BUILD_DURING_DEPLOYMENT=true ENABLE_ORYX_BUILD=true --output none
az webapp config set --resource-group $ResourceGroup --name $BackendAppName --startup-file "npm start"

# Build and package the backend.
New-Item -ItemType Directory -Path $ArtifactDir -Force | Out-Null
if (Test-Path $BackendZip) {
  Remove-Item $BackendZip -Force
}

Push-Location $BackendRoot
npm ci
npm run build
Compress-Archive -Path package.json, package-lock.json, dist -DestinationPath $BackendZip -Force
Pop-Location

# Deploy the backend application package.
az webapp deploy --resource-group $ResourceGroup --name $BackendAppName --src-path $BackendZip --type zip --restart true

$BackendHostname = az webapp show --resource-group $ResourceGroup --name $BackendAppName --query defaultHostName -o tsv
$BackendValidationUrl = "https://$BackendHostname"

# Validate the secure backend while public access is still available on the cluster.
$HealthUrl = "$BackendValidationUrl/api/health"
$RoomsUrl = "$BackendValidationUrl/api/rooms"
Invoke-WebRequest -Uri $HealthUrl -UseBasicParsing | Out-Null
Invoke-WebRequest -Uri $RoomsUrl -UseBasicParsing | Out-Null

# Disable public network access on the Mongo vCore cluster after the secure backend has proven DB connectivity.
$MongoClusterResourceId = az resource show --resource-group $ResourceGroup --resource-type "Microsoft.DocumentDB/mongoClusters" --name $MongoClusterName --query id -o tsv
if (-not $MongoClusterResourceId) {
  throw "Unable to resolve resource ID for mongo cluster '$MongoClusterName'."
}

$MongoClusterPatchBody = @{
  properties = @{
    publicNetworkAccess = 'Disabled'
  }
} | ConvertTo-Json -Depth 5 -Compress

az rest --method patch --uri "https://management.azure.com$MongoClusterResourceId?api-version=2025-09-01" --body $MongoClusterPatchBody --output none

# Verify the backend still works after forcing database access through Private Link only.
Invoke-WebRequest -Uri $RoomsUrl -UseBasicParsing | Out-Null

# Create the Azure Static Web App resource for frontend cutover.
az staticwebapp create --name $StaticWebAppName --resource-group $ResourceGroup --location $Location --sku Standard
az staticwebapp appsettings set --name $StaticWebAppName --resource-group $ResourceGroup --setting-names VITE_API_BASE_URL=$ConfiguredBackendUrl

$StaticWebAppHostname = az staticwebapp show --name $StaticWebAppName --resource-group $ResourceGroup --query defaultHostname -o tsv
$StaticWebAppUrl = "https://$StaticWebAppHostname"

# Switch the secure backend primary frontend origin to the Static Web App while allowing the current App Service frontend during transition.
az webapp config appsettings set --resource-group $ResourceGroup --name $BackendAppName --settings BACKEND_URL=$ConfiguredBackendUrl FRONTEND_URL=$ConfiguredFrontendUrl FRONTEND_URLS=$AllowedFrontendOriginsValue --output none

# Show the values needed for final frontend deployment and verification.
Write-Host "Secure backend validation URL: $BackendValidationUrl"
Write-Host "Secure backend public URL: $ConfiguredBackendUrl"
Write-Host "Static Web App URL: $StaticWebAppUrl"
Write-Host "Next step: assign explicit persisted roles before final admin testing, for example:"
Write-Host "  cd hotel-booking-backend"
Write-Host "  `$env:MONGODB_CONNECTION_STRING=`"PRODUCTION_CONNECTION_STRING`""
Write-Host "  ..\infra\apply-user-roles.production.ps1"
Write-Host "Next step: deploy hotel-booking-frontend/dist to the Static Web App using your preferred workflow (GitHub Actions or SWA CLI)."