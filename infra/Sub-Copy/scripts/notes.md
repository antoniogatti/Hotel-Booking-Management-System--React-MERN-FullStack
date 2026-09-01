Manual steps & unsupported items
=================================

The ARM export omits or cannot safely redeploy the following items. These must be handled manually during recreation:

- Key Vault secrets/keys/certificates: use `az keyvault secret backup` / restore or re-create secrets in target Key Vault. Secrets backups are sensitive — do not commit to git.
- Cosmos DB / Mongo clusters: data must be migrated using mongodump/mongorestore or Azure Data Migration Service.
- Private Endpoints and network interfaces: recreate in the target subscription and re-link to services. Private endpoint NICs are subscription-scoped.
- Private DNS zone virtual network links: create in target and link with new VNets.
- App Service sub-resources: backups, functions, extensions, site containers may not export — reconfigure or redeploy from source code/CI.
- Certificates (Microsoft.Web/certificates): export PFX if available and re-upload to Key Vault or reissue.
- Application Insights pricingPlans and some diagnostics settings may be omitted — reconfigure after deployment.

Order of operations (recommended)
1. Create networking, Key Vault, Log Analytics workspace, App Service Plans in target.
2. Deploy stateless services (Web Apps, App Insights) using ARM or CI/CD.
3. Migrate databases and restore data.
4. Create private endpoints, DNS links, and reconfigure networking.
5. Restore secrets and certificates into target Key Vault.
6. Update app settings/connection strings to point to new resources.

Security note
- Keep Key Vault backups and DB dumps encrypted and out of the repo. Use secure storage (Azure Storage with SAS, or secure local storage) and delete copies when done.
