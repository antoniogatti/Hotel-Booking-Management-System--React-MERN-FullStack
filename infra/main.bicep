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

@description('Name of the Azure Cosmos DB for MongoDB vCore cluster.')
param mongoClusterName string = '${namePrefix}db'

@description('Name of the virtual network used for backend private connectivity.')
param virtualNetworkName string = '${namePrefix}-backend-vnet'

@description('CIDR block for the backend virtual network.')
param virtualNetworkAddressPrefix string = '10.42.0.0/16'

@description('Name of the App Service VNet integration subnet.')
param appServiceIntegrationSubnetName string = '${namePrefix}-appsvc-snet'

@description('CIDR block for the App Service VNet integration subnet.')
param appServiceIntegrationSubnetPrefix string = '10.42.0.0/26'

@description('Name of the private endpoint subnet.')
param privateEndpointSubnetName string = '${namePrefix}-private-endpoints-snet'

@description('CIDR block for the private endpoint subnet.')
param privateEndpointSubnetPrefix string = '10.42.0.64/26'

@description('Private DNS zone name for Azure Cosmos DB for MongoDB vCore.')
param mongoPrivateDnsZoneName string = 'privatelink.mongocluster.cosmos.azure.com'

@description('Public backend URL used for OAuth callbacks and frontend API calls.')
param backendUrl string = 'https://api.palazzopintobnb.com'

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
var appServiceIntegrationSubnetId = resourceId('Microsoft.Network/virtualNetworks/subnets', virtualNetworkName, appServiceIntegrationSubnetName)
var privateEndpointSubnetId = resourceId('Microsoft.Network/virtualNetworks/subnets', virtualNetworkName, privateEndpointSubnetName)

resource mongoCluster 'Microsoft.DocumentDB/mongoClusters@2025-09-01' existing = {
  name: mongoClusterName
}

resource virtualNetwork 'Microsoft.Network/virtualNetworks@2024-01-01' = {
  name: virtualNetworkName
  location: location
  properties: {
    addressSpace: {
      addressPrefixes: [
        virtualNetworkAddressPrefix
      ]
    }
    subnets: [
      {
        name: appServiceIntegrationSubnetName
        properties: {
          addressPrefix: appServiceIntegrationSubnetPrefix
          delegations: [
            {
              name: 'appServiceDelegation'
              properties: {
                serviceName: 'Microsoft.Web/serverFarms'
              }
            }
          ]
        }
      }
      {
        name: privateEndpointSubnetName
        properties: {
          addressPrefix: privateEndpointSubnetPrefix
          privateEndpointNetworkPolicies: 'Disabled'
        }
      }
    ]
  }
  tags: tags
}

resource mongoPrivateDnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: mongoPrivateDnsZoneName
  location: 'global'
  tags: tags
}

resource mongoPrivateDnsZoneLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  parent: mongoPrivateDnsZone
  name: '${virtualNetworkName}-link'
  location: 'global'
  properties: {
    registrationEnabled: false
    virtualNetwork: {
      id: virtualNetwork.id
    }
  }
}

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
    virtualNetworkSubnetId: appServiceIntegrationSubnetId
    vnetRouteAllEnabled: true
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
          value: backendUrl
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
          name: 'WEBSITE_VNET_ROUTE_ALL'
          value: '1'
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

resource mongoPrivateEndpoint 'Microsoft.Network/privateEndpoints@2024-01-01' = {
  name: '${namePrefix}-mongodb-pe'
  location: location
  properties: {
    subnet: {
      id: privateEndpointSubnetId
    }
    privateLinkServiceConnections: [
      {
        name: '${namePrefix}-mongodb-pls'
        properties: {
          privateLinkServiceId: mongoCluster.id
          groupIds: [
            'MongoCluster'
          ]
        }
      }
    ]
  }
  tags: tags
}

resource mongoPrivateEndpointDnsZoneGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2024-01-01' = {
  parent: mongoPrivateEndpoint
  name: 'default'
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'mongo-cluster-dns'
        properties: {
          privateDnsZoneId: mongoPrivateDnsZone.id
        }
      }
    ]
  }
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