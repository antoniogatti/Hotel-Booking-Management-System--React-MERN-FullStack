targetScope = 'resourceGroup'

@description('Azure region for all resources.')
param location string = resourceGroup().location

@description('Prefix used for resource names.')
param namePrefix string = 'palazzopinto'

@description('Name of the Linux App Service plan for the backend API.')
param backendPlanName string = '${namePrefix}-api-b1-plan'

@description('Name of the backend App Service.')
param backendAppName string = '${namePrefix}-api-secure'

@description('Name of the Key Vault.')
param keyVaultName string = '${namePrefix}kv'

@description('Name of the Log Analytics workspace.')
param logAnalyticsWorkspaceName string = '${namePrefix}-logs'

@description('Name of the Application Insights component.')
param applicationInsightsName string = '${namePrefix}-appi'

@description('Primary frontend origin allowed to call the backend API.')
param frontendUrl string

@description('Additional allowed frontend origins, comma-joined into FRONTEND_URLS.')
param frontendAdditionalOrigins array = []

@description('Microsoft Entra tenant ID used by the backend OAuth flow.')
param entraTenantId string

@description('Key Vault secret URI for MONGODB_CONNECTION_STRING.')
param mongoConnectionStringSecretUri string

@description('Key Vault secret URI for JWT_SECRET_KEY.')
param jwtSecretKeySecretUri string

@description('Key Vault secret URI for CLOUDINARY_CLOUD_NAME.')
param cloudinaryCloudNameSecretUri string

@description('Key Vault secret URI for CLOUDINARY_API_KEY.')
param cloudinaryApiKeySecretUri string

@description('Key Vault secret URI for CLOUDINARY_API_SECRET.')
param cloudinaryApiSecretSecretUri string

@description('Key Vault secret URI for MS_ENTRA_CLIENT_ID.')
param entraClientIdSecretUri string

@description('Key Vault secret URI for MS_ENTRA_CLIENT_SECRET.')
param entraClientSecretSecretUri string

@description('Optional extra backend app settings.')
param backendExtraAppSettings array = []

@description('Optional tags applied to all resources.')
param tags object = {}

var keyVaultSecretsUserRoleId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6')

resource backendPlan 'Microsoft.Web/serverfarms@2024-04-01' = {
  name: backendPlanName
  location: location
  kind: 'linux'
  sku: {
    name: 'B1'
    tier: 'Basic'
    capacity: 1
  }
  properties: {
    reserved: true
  }
  tags: tags
}

resource logAnalyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: logAnalyticsWorkspaceName
  location: location
  properties: {
    retentionInDays: 30
    features: {
      searchVersion: 1
      enableLogAccessUsingOnlyResourcePermissions: true
    }
  }
  sku: {
    name: 'PerGB2018'
  }
  tags: tags
}

resource applicationInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: applicationInsightsName
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalyticsWorkspace.id
    IngestionMode: 'LogAnalytics'
    DisableIpMasking: false
  }
  tags: tags
}

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: keyVaultName
  location: location
  properties: {
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
    enablePurgeProtection: true
    enabledForDeployment: false
    enabledForDiskEncryption: false
    enabledForTemplateDeployment: false
    publicNetworkAccess: 'Enabled'
    softDeleteRetentionInDays: 90
    sku: {
      family: 'A'
      name: 'standard'
    }
    networkAcls: {
      bypass: 'AzureServices'
      defaultAction: 'Allow'
    }
  }
  tags: tags
}

resource backendSite 'Microsoft.Web/sites@2024-04-01' = {
  name: backendAppName
  location: location
  kind: 'app,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: backendPlan.id
    httpsOnly: true
    publicNetworkAccess: 'Enabled'
    siteConfig: {
      linuxFxVersion: 'NODE|20-lts'
      minTlsVersion: '1.2'
      ftpsState: 'Disabled'
      alwaysOn: true
      http20Enabled: true
      healthCheckPath: '/api/health'
      appSettings: concat([
        {
          name: 'NODE_ENV'
          value: 'production'
        }
        {
          name: 'BACKEND_URL'
          value: 'https://${backendSite.properties.defaultHostName}'
        }
        {
          name: 'FRONTEND_URL'
          value: frontendUrl
        }
        {
          name: 'FRONTEND_URLS'
          value: join(frontendAdditionalOrigins, ',')
        }
        {
          name: 'MS_ENTRA_TENANT_ID'
          value: entraTenantId
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: applicationInsights.properties.ConnectionString
        }
        {
          name: 'APPINSIGHTS_PROFILERFEATURE_VERSION'
          value: 'disabled'
        }
        {
          name: 'APPINSIGHTS_SNAPSHOTFEATURE_VERSION'
          value: 'disabled'
        }
        {
          name: 'MONGODB_CONNECTION_STRING'
          value: '@Microsoft.KeyVault(SecretUri=${mongoConnectionStringSecretUri})'
        }
        {
          name: 'JWT_SECRET_KEY'
          value: '@Microsoft.KeyVault(SecretUri=${jwtSecretKeySecretUri})'
        }
        {
          name: 'CLOUDINARY_CLOUD_NAME'
          value: '@Microsoft.KeyVault(SecretUri=${cloudinaryCloudNameSecretUri})'
        }
        {
          name: 'CLOUDINARY_API_KEY'
          value: '@Microsoft.KeyVault(SecretUri=${cloudinaryApiKeySecretUri})'
        }
        {
          name: 'CLOUDINARY_API_SECRET'
          value: '@Microsoft.KeyVault(SecretUri=${cloudinaryApiSecretSecretUri})'
        }
        {
          name: 'MS_ENTRA_CLIENT_ID'
          value: '@Microsoft.KeyVault(SecretUri=${entraClientIdSecretUri})'
        }
        {
          name: 'MS_ENTRA_CLIENT_SECRET'
          value: '@Microsoft.KeyVault(SecretUri=${entraClientSecretSecretUri})'
        }
      ], backendExtraAppSettings)
    }
  }
  tags: union(tags, {
    workload: 'hotel-booking-backend'
    securityBaseline: 'phase-1-4'
  })
}

resource backendAppInsightsExtension 'Microsoft.Web/sites/siteextensions@2024-04-01' = {
  name: 'ApplicationInsightsAgent'
  parent: backendSite
}

resource backendKeyVaultSecretsUser 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, backendSite.name, 'key-vault-secrets-user')
  scope: keyVault
  properties: {
    roleDefinitionId: keyVaultSecretsUserRoleId
    principalId: backendSite.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

output backendDefaultHostname string = backendSite.properties.defaultHostName
output backendPrincipalId string = backendSite.identity.principalId
output keyVaultUri string = keyVault.properties.vaultUri
output applicationInsightsConnectionString string = applicationInsights.properties.ConnectionString