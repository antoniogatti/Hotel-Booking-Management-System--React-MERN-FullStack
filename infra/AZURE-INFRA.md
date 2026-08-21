# Azure Infrastructure Summary

Generated: 2026-08-21

## Subscription

- **Name:** Ant Enterprise
- **Subscription ID:** 927d8895-21e1-452d-a35a-e04253f2c80e
- **Tenant Display Name:** Zoltiva
- **Tenant ID:** f0b2f579-2f09-4daf-839f-abf49b0d8dcc
- **Signed-in user:** info@palazzopintobnb.com

## Resource Groups (selected)

- **PalazzoPintoBnB**
  - ID: /subscriptions/927d8895-21e1-452d-a35a-e04253f2c80e/resourceGroups/PalazzoPintoBnB
  - Location: Italy North (italynorth)
- **n8n**
  - ID: /subscriptions/927d8895-21e1-452d-a35a-e04253f2c80e/resourceGroups/n8n
  - Location: Italy North (italynorth)
- **OpenClaw**
  - ID: /subscriptions/927d8895-21e1-452d-a35a-e04253f2c80e/resourceGroups/OpenClaw
  - Location: Italy North (italynorth)
- **NetworkWatcherRG**
  - ID: /subscriptions/927d8895-21e1-452d-a35a-e04253f2c80e/resourceGroups/NetworkWatcherRG
  - Location: switzerlandnorth

(Other resource groups exist in the subscription; list truncated here.)

## Resources in `PalazzoPintoBnB` (selected)

- `palazzopintodb` — Microsoft.DocumentDB/mongoClusters
  - ID: /subscriptions/927d8895-21e1-452d-a35a-e04253f2c80e/resourceGroups/PalazzoPintoBnB/providers/Microsoft.DocumentDB/mongoClusters/palazzopintodb
  - Location: Norway East (norwayeast)

- `palazzopinto-web-2603151048` — Microsoft.Web/sites (frontend)
  - ID: /subscriptions/927d8895-21e1-452d-a35a-e04253f2c80e/resourceGroups/PalazzoPintoBnB/providers/Microsoft.Web/sites/palazzopinto-web-2603151048
  - Location: Italy North (italynorth)

- `palazzopinto-api-secure` — Microsoft.Web/sites (backend, Linux)
  - ID: /subscriptions/927d8895-21e1-452d-a35a-e04253f2c80e/resourceGroups/PalazzoPintoBnB/providers/Microsoft.Web/sites/palazzopinto-api-secure
  - Location: Italy North (italynorth)

- `palazzopinto-api-b1-plan` — Microsoft.Web/serverFarms (App Service Plan B1)
  - ID: /subscriptions/927d8895-21e1-452d-a35a-e04253f2c80e/resourceGroups/PalazzoPintoBnB/providers/Microsoft.Web/serverFarms/palazzopinto-api-b1-plan
  - Location: Italy North (italynorth)

- `palazzopinto-free-plan` — Microsoft.Web/serverFarms (App Service Plan S1)
  - ID: /subscriptions/927d8895-21e1-452d-a35a-e04253f2c80e/resourceGroups/PalazzoPintoBnB/providers/Microsoft.Web/serverFarms/palazzopinto-free-plan
  - Location: Italy North (italynorth)

- `palazzopinto-appinsights` — Application Insights
  - ID: /subscriptions/927d8895-21e1-452d-a35a-e04253f2c80e/resourceGroups/PalazzoPintoBnB/providers/microsoft.insights/components/palazzopinto-appinsights
  - Location: Italy North (italynorth)

- `palazzopinto-logs` — Log Analytics workspace
  - ID: /subscriptions/927d8895-21e1-452d-a35a-e04253f2c80e/resourceGroups/PalazzoPintoBnB/providers/Microsoft.OperationalInsights/workspaces/palazzopinto-logs

- `palazzopinto-backend-vnet` — Virtual Network
  - ID: /subscriptions/927d8895-21e1-452d-a35a-e04253f2c80e/resourceGroups/PalazzoPintoBnB/providers/Microsoft.Network/virtualNetworks/palazzopinto-backend-vnet

- `palazzopinto-mongodb-pe` — Private Endpoint
  - ID: /subscriptions/927d8895-21e1-452d-a35a-e04253f2c80e/resourceGroups/PalazzoPintoBnB/providers/Microsoft.Network/privateEndpoints/palazzopinto-mongodb-pe

- `palazzopintokv` — Key Vault
  - ID: /subscriptions/927d8895-21e1-452d-a35a-e04253f2c80e/resourceGroups/PalazzoPintoBnB/providers/Microsoft.KeyVault/vaults/palazzopintokv

- `prd-open-ai-pp-01` — Azure OpenAI (Cognitive Services)
  - ID: /subscriptions/927d8895-21e1-452d-a35a-e04253f2c80e/resourceGroups/PalazzoPintoBnB/providers/Microsoft.CognitiveServices/accounts/prd-open-ai-pp-01

(This list is a selection — run the commands below to get the full export.)

## Commands used / how to reproduce

The following commands were used to collect the above information (run after authenticating with the Azure CLI):

```
az account show --output json
az group list --output json
az resource list --resource-group PalazzoPintoBnB --output json
```

## Azure CLI installed here

- Azure CLI was installed on this machine using `winget` (Microsoft.AzureCLI). Version found: 2.89.1
- Installed binary path (example): `C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd`

## Authentication notes

- You can sign in interactively using the Azure CLI (device code flow):

```
az login --use-device-code
```

- Or use the default `az login` which opens a browser prompt.

After login, re-run the commands in the "Commands used" section to refresh values.

## Next steps / suggestions

- If you want, I can:
  - Persist more detailed exports (full `az resource list` JSON) under `infra/`.
  - Add ARM/Bicep exports for the resource group (export template).
  - Update this file to include exact VM/app settings, connection strings, or Key Vault secret names (requires appropriate permissions).

-- End of summary --
