# Azure Change Set

Date: 2026-04-07

Scope:
- Prepare the Azure-side changes for phases 1 to 4 of the approved remediation plan
- Exclude Front Door, WAF, private endpoints, and later cost-heavy phases

## 1. Intended Resource Changes

Create:
- Linux App Service Plan `B1` for the backend
- Secure backend App Service with system-assigned managed identity
- Key Vault Standard with RBAC enabled and purge protection enabled
- Log Analytics workspace
- Application Insights

Update or migrate:
- Move backend runtime to the new Linux `B1` host
- Enable HTTPS-only on production web apps
- Move backend secrets from App Service settings into Key Vault references
- Restrict production CORS to exact Azure frontend origins only

Selected frontend target:
- Azure Static Web Apps Standard

## 2. Existing Resource Impact

Current resource group baseline already observed:
- Existing frontend App Service remains in place until frontend target is finalized
- Existing backend App Service remains in place until API cutover is ready
- Existing free Mongo cluster remains in place for now

Recommended migration strategy:
- Create new backend secure resources alongside the current backend
- Validate the application on the new backend host
- Cut traffic and configuration over only after backend validation completes
- Clean up obsolete App Service resources after successful cutover

## 3. Required Secrets In Key Vault

The backend currently needs these values available at startup:
- `MONGODB_CONNECTION_STRING`
- `JWT_SECRET_KEY`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `MS_ENTRA_CLIENT_ID`
- `MS_ENTRA_CLIENT_SECRET`

These are represented in `main.bicep` as Key Vault secret URI parameters so the App Service consumes references rather than raw values.

## 4. Manual Azure Changes Still Required

These items are not fully solved by the Bicep foundation alone:

1. Create or import the Key Vault secrets before backend deployment.
2. Configure the final production frontend origin in the parameter file.
	- Keep `https://palazzopinto-web-2603151048.azurewebsites.net` as a temporary additional allowed origin while the existing frontend App Service remains in use.
3. Re-point the frontend `VITE_API_BASE_URL` to the new backend hostname during cutover.
4. Deploy the frontend to Azure Static Web Apps Standard and validate auth/cookie behavior against the backend.
5. Disable or limit SCM exposure on the production App Services after the deployment flow is finalized.
6. Add Application Insights alert rules for 5xx, auth failures, and booking request failures.

## 5. Proposed Execution Order

1. Create Key Vault, Log Analytics, Application Insights, and the Linux `B1` backend host via Bicep.
2. Publish the backend build to the new backend App Service.
3. Populate Key Vault secrets and verify managed identity access.
4. Assign explicit persisted user roles for platform admins and hotel owners.
5. Validate Microsoft sign-in, secure cookie auth, booking flow, and admin-only analytics on the new backend.
6. Point Azure Static Web Apps Standard to the new backend.
7. Enable HTTPS-only and remove old insecure configuration paths from the legacy hosts.
8. Apply alerting and operational checks.

## 6. Review Notes

Applied IaC rules and constraints:
- Bicep files are placed under `infra/`
- Key Vault purge protection remains enabled
- App Service deployment includes a site extension resource as required by the retrieved IaC rules
- Managed identity is used for Key Vault secret access
- Backend secrets are referenced from Key Vault, not embedded directly in the template

Blocked automation note:
- The `azd` MCP tool could not be used in this environment because Azure Developer CLI is not installed here.
- The resulting change set is still deployment-ready through `az deployment group what-if` and `az deployment group create`.

Prepared rollout artifacts:
- `infra/main.parameters.production.json`
- `infra/azure-rollout.production.ps1`
- `infra/role-assignments.production.example.json`
- `infra/apply-user-roles.production.ps1`