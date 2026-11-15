# Azure infrastructure

`existing.production.bicep` and `existing.production.parameters.json` reference
selected resources in `PalazzoPintoBnB-Pro` without creating or changing them.
They provide resource IDs for reuse in other Bicep modules. This is a
reference-only inventory, not a complete export or a template for recreating or
enforcing the configuration of these resources.

The backend and most resources are in Sweden Central; the Application Insights
components and Azure OpenAI are in Italy North. The database is a Cosmos DB
MongoDB account, not a MongoDB vCore cluster. The backend uses
`palazzopinto-appinsights-pro`.

Validate and preview the references:

```powershell
az deployment group validate --resource-group PalazzoPintoBnB-Pro --template-file infra\existing.production.bicep --parameters infra\existing.production.parameters.json
az deployment group what-if --resource-group PalazzoPintoBnB-Pro --template-file infra\existing.production.bicep --parameters infra\existing.production.parameters.json
```

`existing` declarations and ID outputs alone do not prove a resource exists;
verify IDs in Azure before relying on them. No infrastructure deployment is
needed to deploy application code. The old provisioning template and parameters
were removed, and `azure-rollout.production.ps1` is disabled because they do
not describe the existing production environment. Historical planning and
security documents may refer to those retired files.

The [production workflow](../.github/workflows/deploy-production.yml) deploys
application code to the existing App Services.
