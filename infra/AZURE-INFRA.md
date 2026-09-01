# Azure Infrastructure Summary

Generated: 2026-09-01

## Subscription

- **Subscription name:** Ant Pro
- **Subscription ID:** 9b57086c-fdb8-43eb-ad36-a02c7a19ab09
- **Portal:** [Ant Pro](https://portal.azure.com/#blade/HubsExtension/ResourceMenuBlade/id/%2Fsubscriptions%2F9b57086c-fdb8-43eb-ad36-a02c7a19ab09)
- **Directory / Tenant Display Name:** Zoltiva (palazzopintobnb.com)
- **Tenant ID / Parent management group:** f0b2f579-2f09-4daf-839f-abf49b0d8dcc
- **Signed-in user:** info@palazzopintobnb.com
- **My role:** Owner
- **Offer:** MSDN
- **Offer ID:** MS-AZR-0059P
- **Current billing period:** Loading...
- **Currency:** USD
- **Status:** Active
- **Location:** Sweden Central
- **Deployments:** No deployments
- **Secure Score:** Not available

## Previous subscription: Ant Enterprise (disabled)

- **Name:** Ant Enterprise
- **Subscription ID:** 927d8895-21e1-452d-a35a-e04253f2c80e
- **Status:** Disabled — limited capabilities
- **Technical challenge:** The Ant Enterprise subscription is currently disabled which restricts management operations. While resource metadata may remain visible in some portals, common management actions (deployments, resource modifications, Key Vault access, certificate or secret rotations, and some management API calls) can fail or be denied. This prevents exporting complete resource lists or performing in-place fixes from this subscription until it is re-enabled.
- **Suggested next steps:** Contact the subscription billing/administration team to re-enable the subscription or transfer resources; use the active `Ant Pro` subscription (above) for management and fresh exports where possible.

## Resource Groups (selected)

-- **PalazzoPintoBnB**
  - ID: /subscriptions/9b57086c-fdb8-43eb-ad36-a02c7a19ab09/resourceGroups/PalazzoPintoBnB
  - Location: Italy North (italynorth)
- **NetworkWatcherRG**
  - ID: /subscriptions/9b57086c-fdb8-43eb-ad36-a02c7a19ab09/resourceGroups/NetworkWatcherRG
  - Location: switzerlandnorth

(Other resource groups exist in the subscription; list truncated here.)

## Resource Groups (selected)

### PalazzoPintoBnB
  - ID: /subscriptions/9b57086c-fdb8-43eb-ad36-a02c7a19ab09/resourceGroups/PalazzoPintoBnB
  - Location: Italy North (italynorth)
  - Resources (selected):
    - `palazzopintodb` — Microsoft.DocumentDB/mongoClusters
      - ID: /subscriptions/9b57086c-fdb8-43eb-ad36-a02c7a19ab09/resourceGroups/PalazzoPintoBnB/providers/Microsoft.DocumentDB/mongoClusters/palazzopintodb
      - Location: Norway East (norwayeast)
    - `palazzopinto-web-2603151048` — Microsoft.Web/sites (frontend)
      - ID: /subscriptions/9b57086c-fdb8-43eb-ad36-a02c7a19ab09/resourceGroups/PalazzoPintoBnB/providers/Microsoft.Web/sites/palazzopinto-web-2603151048
      - Location: Italy North (italynorth)
    - `palazzopinto-api-secure` — Microsoft.Web/sites (backend, Linux)
      - ID: /subscriptions/9b57086c-fdb8-43eb-ad36-a02c7a19ab09/resourceGroups/PalazzoPintoBnB/providers/Microsoft.Web/sites/palazzopinto-api-secure
      - Location: Italy North (italynorth)
    - `palazzopinto-api-b1-plan` — Microsoft.Web/serverFarms (App Service Plan B1)
      - ID: /subscriptions/9b57086c-fdb8-43eb-ad36-a02c7a19ab09/resourceGroups/PalazzoPintoBnB/providers/Microsoft.Web/serverFarms/palazzopinto-api-b1-plan
      - Location: Italy North (italynorth)
    - `palazzopinto-free-plan` — Microsoft.Web/serverFarms (App Service Plan S1)
      - ID: /subscriptions/9b57086c-fdb8-43eb-ad36-a02c7a19ab09/resourceGroups/PalazzoPintoBnB/providers/Microsoft.Web/serverFarms/palazzopinto-free-plan
      - Location: Italy North (italynorth)
    - `palazzopinto-appinsights` — Application Insights
      - ID: /subscriptions/9b57086c-fdb8-43eb-ad36-a02c7a19ab09/resourceGroups/PalazzoPintoBnB/providers/microsoft.insights/components/palazzopinto-appinsights
      - Location: Italy North (italynorth)
    - `palazzopinto-logs` — Log Analytics workspace
      - ID: /subscriptions/9b57086c-fdb8-43eb-ad36-a02c7a19ab09/resourceGroups/PalazzoPintoBnB/providers/Microsoft.OperationalInsights/workspaces/palazzopinto-logs
    - `palazzopinto-backend-vnet` — Virtual Network
      - ID: /subscriptions/9b57086c-fdb8-43eb-ad36-a02c7a19ab09/resourceGroups/PalazzoPintoBnB/providers/Microsoft.Network/virtualNetworks/palazzopinto-backend-vnet
    - `palazzopinto-mongodb-pe` — Private Endpoint
      - ID: /subscriptions/9b57086c-fdb8-43eb-ad36-a02c7a19ab09/resourceGroups/PalazzoPintoBnB/providers/Microsoft.Network/privateEndpoints/palazzopinto-mongodb-pe
    - `palazzopintokv` — Key Vault
      - ID: /subscriptions/9b57086c-fdb8-43eb-ad36-a02c7a19ab09/resourceGroups/PalazzoPintoBnB/providers/Microsoft.KeyVault/vaults/palazzopintokv
    - `prd-open-ai-pp-01` — Azure OpenAI (Cognitive Services)
      - ID: /subscriptions/9b57086c-fdb8-43eb-ad36-a02c7a19ab09/resourceGroups/PalazzoPintoBnB/providers/Microsoft.CognitiveServices/accounts/prd-open-ai-pp-01

### PalazzoPintoBnB-Pro
  - ID: /subscriptions/9b57086c-fdb8-43eb-ad36-a02c7a19ab09/resourceGroups/PalazzoPintoBnB-Pro
  - Location: Sweden Central
  - Deployments: No deployments
  - Resources: (not listed here — run `az resource list --resource-group PalazzoPintoBnB-Pro` to export)
### NetworkWatcherRG
  - ID: /subscriptions/9b57086c-fdb8-43eb-ad36-a02c7a19ab09/resourceGroups/NetworkWatcherRG
  - Location: switzerlandnorth

(Other resource groups exist in the subscription; list truncated here.)

(This list is a selection — run the commands below to get the full export.)

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
