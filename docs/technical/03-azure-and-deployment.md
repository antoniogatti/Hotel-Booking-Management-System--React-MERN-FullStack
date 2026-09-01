# Palazzo Pinto B&B — Azure and Deployment Layer

## 1. Purpose
This layer explains how the solution is hosted and secured in Azure.

It covers:
- app hosting
- database hosting
- secrets management
- network isolation
- observability
- deployment workflow

## 2. Current Azure shape
From `infra/AZURE-INFRA.md`, the selected resource group contains:
- **Azure App Service** for the frontend
- **Azure App Service** for the backend API
- **Azure Cosmos DB for MongoDB vCore** / Mongo cluster
- **Azure Key Vault**
- **Virtual Network**
- **Private Endpoint** for the database path
- **Application Insights**
- **Log Analytics workspace**
- **App Service Plan** resources

## 3. Hosting model
### Backend
The backend is deployed to Azure App Service and runs with:
- HTTPS-only
- TLS 1.2
- managed identity
- Key Vault-backed settings
- VNet integration

### Frontend
The repo docs indicate the chosen frontend target is **Azure Static Web Apps Standard** during transition, while the current infra notes also reference the frontend App Service in the existing environment.

That means the solution is in a migration/transition posture rather than a single fixed hosting pattern.

## 4. Security posture
The infrastructure docs show a production hardening direction built around:
- Key Vault for secrets
- managed identity access to secrets
- private networking for the database path
- explicit backend validation before cutover
- logging and monitoring via Application Insights and Log Analytics

## 5. Deployment workflow
The checked-in infra docs suggest a deliberate rollout path:
1. prepare or update parameter files
2. create or verify secrets in Key Vault
3. run a `what-if` deployment check
4. deploy the Bicep template to the target resource group
5. apply persisted user roles in Mongo
6. validate the secure backend path
7. cut over the frontend once the backend is confirmed

## 6. IaC artifacts to know
Useful files in `infra/`:
- `main.bicep`
- `main.parameters.example.json`
- `main.parameters.production.json`
- `azure-rollout.production.ps1`
- `apply-user-roles.production.ps1`
- `manual-secure-cutover.ps1`
- `role-assignments.production.json`
- `README.md`
- `AZURE-INFRA.md`
- `AZURE_CHANGE_SET.md`

## 7. What the infrastructure doc implies
The architecture is not just "host the app somewhere". It is built to support:
- production API hardening
- safe secret handling
- operational logs and metrics
- explicit rollout/cutover steps
- network-level protection for data services

## 8. Practical takeaway
If you are documenting or operating the solution, think of Azure as the layer that turns the codebase into a controlled production service: isolated, observable, and deployable with a repeatable path.
