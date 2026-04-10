$ErrorActionPreference = 'Stop'

$resourceGroup = 'PalazzoPintoBnB'
$legacyApp = 'palazzopinto-api-2603151048'
$secureApp = 'palazzopinto-api-secure'
$clusterName = 'palazzopintodb'
$secureBackendUrl = 'https://api.palazzopintobnb.com'
$frontendUrl = 'https://www.palazzopintobnb.com'
$frontendAdditionalOrigins = 'https://www.palazzopintobnb.com,https://palazzopintobnb.com,https://palazzopinto-web-2603151048.azurewebsites.net'
$backendProjectPath = Join-Path (Split-Path $PSScriptRoot -Parent) 'hotel-booking-backend'

function Get-AppSettingValue {
  param(
    [array]$Settings,
    [string]$Name
  )

  return (($Settings | Where-Object { $_.name -eq $Name } | Select-Object -First 1).value)
}

function Invoke-AzCli {
  param(
    [string[]]$Arguments
  )

  & az @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Azure CLI command failed: az $($Arguments -join ' ')"
  }
}

$legacySettings = az webapp config appsettings list --resource-group $resourceGroup --name $legacyApp -o json | ConvertFrom-Json

$mongo = Get-AppSettingValue -Settings $legacySettings -Name 'MONGODB_CONNECTION_STRING'
$jwt = Get-AppSettingValue -Settings $legacySettings -Name 'JWT_SECRET_KEY'
$cloudName = Get-AppSettingValue -Settings $legacySettings -Name 'CLOUDINARY_CLOUD_NAME'
$cloudKey = Get-AppSettingValue -Settings $legacySettings -Name 'CLOUDINARY_API_KEY'
$cloudSecret = Get-AppSettingValue -Settings $legacySettings -Name 'CLOUDINARY_API_SECRET'
$entraClientId = Get-AppSettingValue -Settings $legacySettings -Name 'MS_ENTRA_CLIENT_ID'
$entraClientSecret = Get-AppSettingValue -Settings $legacySettings -Name 'MS_ENTRA_CLIENT_SECRET'

if (
  -not $mongo -or
  -not $jwt -or
  -not $cloudName -or
  -not $cloudKey -or
  -not $cloudSecret -or
  -not $entraClientId -or
  -not $entraClientSecret
) {
  throw 'Missing one or more required legacy app settings.'
}

$appSettingsUri = "https://management.azure.com/subscriptions/927d8895-21e1-452d-a35a-e04253f2c80e/resourceGroups/$resourceGroup/providers/Microsoft.Web/sites/$secureApp/config/appsettings?api-version=2024-04-01"
$appSettingsPayload = @{
  properties = @{
    NODE_ENV = 'production'
    BACKEND_URL = $secureBackendUrl
    FRONTEND_URL = $frontendUrl
    FRONTEND_URLS = $frontendAdditionalOrigins
    MS_ENTRA_TENANT_ID = 'f0b2f579-2f09-4daf-839f-abf49b0d8dcc'
    APPLICATIONINSIGHTS_CONNECTION_STRING = 'InstrumentationKey=65022624-8a59-4e39-a0ba-1308b674f162;IngestionEndpoint=https://italynorth-0.in.applicationinsights.azure.com/;LiveEndpoint=https://italynorth.livediagnostics.monitor.azure.com/;ApplicationId=85d21d13-22b9-40b5-907c-8d86c9d7cff2'
    WEBSITE_VNET_ROUTE_ALL = '1'
    APPINSIGHTS_PROFILERFEATURE_VERSION = 'disabled'
    APPINSIGHTS_SNAPSHOTFEATURE_VERSION = 'disabled'
    ENABLE_SWAGGER = 'false'
    BOOKING_COM_SYNC_ENABLED = 'true'
    BOOKING_COM_SYNC_RUN_ON_STARTUP = 'true'
    CONTACT_MAIL_SENDER = 'info@palazzopintobnb.com'
    CONTACT_MAIL_INBOX = 'info@palazzopintobnb.com'
    CONTACT_MAIL_SUBJECT_PREFIX = '[PalazzoPinto][ContactForm]'
    CONTACT_MAIL_CONFIRMATION_SUBJECT = 'Message Sent - Confirmation'
    SCM_DO_BUILD_DURING_DEPLOYMENT = 'false'
    ENABLE_ORYX_BUILD = 'false'
    MONGODB_CONNECTION_STRING = [string]$mongo
    JWT_SECRET_KEY = [string]$jwt
    CLOUDINARY_CLOUD_NAME = [string]$cloudName
    CLOUDINARY_API_KEY = [string]$cloudKey
    CLOUDINARY_API_SECRET = [string]$cloudSecret
    MS_ENTRA_CLIENT_ID = [string]$entraClientId
    MS_ENTRA_CLIENT_SECRET = [string]$entraClientSecret
  }
} | ConvertTo-Json -Depth 4 -Compress

$tempBodyPath = Join-Path $env:TEMP ('palazzopinto-appsettings-' + [guid]::NewGuid().ToString() + '.json')
Set-Content -Path $tempBodyPath -Value $appSettingsPayload -Encoding UTF8

try {
  Invoke-AzCli -Arguments @('rest', '--method', 'put', '--uri', $appSettingsUri, '--headers', 'Content-Type=application/json', '--body', ('@' + $tempBodyPath), '--output', 'none')
}
finally {
  if (Test-Path $tempBodyPath) {
    Remove-Item $tempBodyPath -Force
  }
}
Invoke-AzCli -Arguments @('webapp', 'config', 'set', '--resource-group', $resourceGroup, '--name', $secureApp, '--startup-file', 'npm start', '--output', 'none')

  $backendZip = Join-Path $PSScriptRoot 'artifacts\backend-runtime.zip'

  Push-Location $backendProjectPath
  try {
    if (-not (Test-Path 'node_modules')) {
      npm ci
      if ($LASTEXITCODE -ne 0) {
        throw 'npm ci failed.'
      }
    }

    npm run build
    if ($LASTEXITCODE -ne 0) {
      throw 'npm run build failed.'
    }

    if (Test-Path $backendZip) {
      Remove-Item $backendZip -Force
    }

    & tar.exe -a -cf $backendZip package.json package-lock.json dist node_modules
    if ($LASTEXITCODE -ne 0) {
      throw 'tar packaging failed.'
    }
  }
  finally {
    Pop-Location
  }

Invoke-AzCli -Arguments @('webapp', 'deploy', '--resource-group', $resourceGroup, '--name', $secureApp, '--src-path', $backendZip, '--type', 'zip', '--restart', 'true')
Invoke-AzCli -Arguments @('webapp', 'restart', '--resource-group', $resourceGroup, '--name', $secureApp, '--output', 'none')

$healthStatus = (Invoke-WebRequest -Uri "$secureBackendUrl/api/health" -UseBasicParsing).StatusCode
$roomsStatus = (Invoke-WebRequest -Uri "$secureBackendUrl/api/rooms" -UseBasicParsing).StatusCode

$clusterId = az resource show --resource-group $resourceGroup --resource-type 'Microsoft.DocumentDB/mongoClusters' --name $clusterName --query id -o tsv
if (-not $clusterId) {
  throw 'Mongo cluster resource ID not found.'
}

Invoke-AzCli -Arguments @('resource', 'update', '--ids', $clusterId, '--api-version', '2025-09-01', '--set', 'properties.publicNetworkAccess=Disabled', '--output', 'none')

$roomsStatusAfterCutover = (Invoke-WebRequest -Uri "$secureBackendUrl/api/rooms" -UseBasicParsing).StatusCode
$publicNetworkAccess = az resource show --resource-group $resourceGroup --resource-type 'Microsoft.DocumentDB/mongoClusters' --name $clusterName --query properties.publicNetworkAccess -o tsv

Write-Host "Health status: $healthStatus"
Write-Host "Rooms status before cutover: $roomsStatus"
Write-Host "Rooms status after cutover: $roomsStatusAfterCutover"
Write-Host "Mongo publicNetworkAccess: $publicNetworkAccess"