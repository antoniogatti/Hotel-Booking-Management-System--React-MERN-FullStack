targetScope = 'resourceGroup'

@description('Names of the existing production resources in this resource group.')
param names object

resource backendPlan 'Microsoft.Web/serverfarms@2024-04-01' existing = {
  name: names.backendPlan
}

resource backend 'Microsoft.Web/sites@2024-04-01' existing = {
  name: names.backend
}

resource frontend 'Microsoft.Web/sites@2024-04-01' existing = {
  name: names.frontend
}

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: names.keyVault
}

resource workspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' existing = {
  name: names.workspace
}

resource backendInsights 'Microsoft.Insights/components@2020-02-02' existing = {
  name: names.backendInsights
}

resource otherInsights 'Microsoft.Insights/components@2020-02-02' existing = {
  name: names.otherInsights
}

resource mongoAccount 'Microsoft.DocumentDB/databaseAccounts@2024-05-15' existing = {
  name: names.mongoAccount
}

resource vnet 'Microsoft.Network/virtualNetworks@2024-01-01' existing = {
  name: names.vnet
}

resource appServiceSubnet 'Microsoft.Network/virtualNetworks/subnets@2024-01-01' existing = {
  parent: vnet
  name: names.appServiceSubnet
}

resource privateEndpointSubnet 'Microsoft.Network/virtualNetworks/subnets@2024-01-01' existing = {
  parent: vnet
  name: names.privateEndpointSubnet
}

resource privateEndpoint 'Microsoft.Network/privateEndpoints@2024-01-01' existing = {
  name: names.privateEndpoint
}

resource mongoDnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' existing = {
  name: names.mongoDnsZone
}

resource mongoDnsLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' existing = {
  parent: mongoDnsZone
  name: names.mongoDnsLink
}

resource mongoClusterDnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' existing = {
  name: names.mongoClusterDnsZone
}

resource n8nPlan 'Microsoft.Web/serverfarms@2024-04-01' existing = {
  name: names.n8nPlan
}

resource n8n 'Microsoft.Web/sites@2024-04-01' existing = {
  name: names.n8n
}

resource n8nStorage 'Microsoft.Storage/storageAccounts@2023-05-01' existing = {
  name: names.n8nStorage
}

resource openAi 'Microsoft.CognitiveServices/accounts@2023-05-01' existing = {
  name: names.openAi
}

output resourceIds object = {
  backendPlan: backendPlan.id
  backend: backend.id
  frontend: frontend.id
  keyVault: keyVault.id
  workspace: workspace.id
  backendInsights: backendInsights.id
  otherInsights: otherInsights.id
  mongoAccount: mongoAccount.id
  vnet: vnet.id
  appServiceSubnet: appServiceSubnet.id
  privateEndpointSubnet: privateEndpointSubnet.id
  privateEndpoint: privateEndpoint.id
  mongoDnsZone: mongoDnsZone.id
  mongoDnsLink: mongoDnsLink.id
  mongoClusterDnsZone: mongoClusterDnsZone.id
  n8nPlan: n8nPlan.id
  n8n: n8n.id
  n8nStorage: n8nStorage.id
  openAi: openAi.id
}
