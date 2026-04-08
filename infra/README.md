# Azure Infra

This folder contains the first-pass Azure change set for the low-cost security remediation path.

Included artifacts:
- `main.bicep`: shared production infrastructure for the backend security baseline
- `main.parameters.example.json`: example parameter file to copy and adapt for the target resource group
- `main.parameters.production.json`: production-ready parameter file for `PalazzoPintoBnB`
- `azure-rollout.production.ps1`: exact Azure CLI rollout commands for infra deployment, secret setup, backend deployment, and frontend cutover prep
- `role-assignments.production.example.json`: example persisted-role assignment manifest for admin and hotel-owner users
- `apply-user-roles.production.ps1`: batch runner that applies persisted roles using `npm run set-user-role`

What this Bicep deploys:
- Linux App Service Plan `B1` for the backend API
- Linux App Service for the backend API with HTTPS-only, TLS 1.2, managed identity, and Key Vault-backed settings
- Regional VNet integration for the backend App Service with route-all enabled
- Dedicated private endpoint subnet and private DNS zone link for MongoDB vCore
- Private Endpoint from the backend VNet to the Azure Cosmos DB for MongoDB vCore cluster
- Key Vault with RBAC enabled and purge protection enabled
- Log Analytics workspace
- Application Insights connected to the workspace
- Role assignment so the backend managed identity can read Key Vault secrets

What it intentionally does not deploy yet:
- Frontend hosting target implementation
- DNS or custom domains
- Front Door or WAF
- Alert rules and dashboards

Cutover note:
- The template provisions the private network path for the secure backend App Service.
- The production rollout script validates the secure backend over the database-backed `/api/rooms` route and then disables Mongo cluster public network access.
- This keeps the Mongo cluster move to Private Link explicit and testable, instead of embedding a fragile full-cluster overwrite into the Bicep template.

Frontend target status:
- The selected frontend target is Azure Static Web Apps Standard.
- The current `main.bicep` remains backend-focused so backend hardening can be deployed independently before frontend cutover.
- Keep `https://palazzopinto-web-2603151048.azurewebsites.net` in `frontendAdditionalOrigins` during transition if the existing Azure App Service frontend still needs to authenticate against the backend.

Suggested deployment workflow:

1. Copy `main.parameters.example.json` to an environment-specific file.
2. Create the Key Vault secrets first, or update the parameter file with the final secret URIs.
3. Run a what-if against the target resource group before any deployment.
4. Apply the deployment only after confirming naming and secret references.
5. Assign explicit persisted admin and hotel-owner roles in Mongo before final auth validation.

Azure-assisted auto-discovery in `azure-rollout.production.ps1`:
- Reads subscription and tenant from the active Azure context
- Reads resource group location from Azure
- Discovers the legacy API and frontend App Service names from the live resource group
- Reads the legacy frontend default hostname from Azure and uses it as the transition frontend origin
- Reads `MS_ENTRA_CLIENT_ID` and `CLOUDINARY_CLOUD_NAME` from the legacy backend App Service if not provided via environment variables

Still required as secret inputs at execution time:
- `PALAZZOPINTO_MONGODB_CONNECTION_STRING`
- `PALAZZOPINTO_JWT_SECRET_KEY`
- `PALAZZOPINTO_CLOUDINARY_API_KEY`
- `PALAZZOPINTO_CLOUDINARY_API_SECRET`
- `PALAZZOPINTO_MS_ENTRA_CLIENT_SECRET`

Role assignment example:

```powershell
$env:MONGODB_CONNECTION_STRING="<production-connection-string>"
infra/apply-user-roles.production.ps1
```

Suggested commands:

```powershell
az deployment group what-if \
  --resource-group PalazzoPintoBnB \
  --template-file infra/main.bicep \
  --parameters @infra/main.parameters.production.json
```

```powershell
az deployment group create \
  --resource-group PalazzoPintoBnB \
  --template-file infra/main.bicep \
  --parameters @infra/main.parameters.production.json
```

Notes:
- `azd` guidance could not be generated end-to-end in this environment because the Azure Developer CLI is not installed.
- This is why the change set is prepared as plain Bicep plus review documentation.