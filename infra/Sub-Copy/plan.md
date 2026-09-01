Migration Plan (Sub-Copy)
=========================

1. Exports & Inventory
- infra/PalazzoPintoBnB-source-resources.json (already present)
- Run `az group export --name PalazzoPintoBnB` -> save to `exports/PalazzoPintoBnB-arm-export.json`
- List Key Vault secrets -> save to `exports/palazzopintokv-secrets.json`

2. Backups
- Create `backups/` and store:
  - DB dump: `backups/palazzopintodb.archive` (mongodump)
  - Key Vault secret backups (do not commit)
  - Certificates (PFX) if exportable

3. Target placeholders
- Create networking (VNet), Key Vault, Log Analytics, App Service Plans in `PalazzoPintoBnB-Pro`.

4. Recreate services
- Deploy App Service + settings, App Insights, Cognitive Services (recreate), Log Analytics

5. Data migration
- Restore DB, validate connectivity

6. Private endpoints & DNS
- Recreate private DNS zones and links, create private endpoints and test

7. Cutover & validation
- Switch DNS, monitor metrics, keep source intact until verified

Files to add here as we go:
- `exports/PalazzoPintoBnB-arm-export.json`
- `exports/palazzopintokv-secrets.json`
- `backups/` (DB, secrets)
- `scripts/` (export.sh, restore-db.sh, create-placeholders.ps1)

Next action (choose):
- A: Run ARM export and Key Vault secret list now.
- B: Create target placeholders now (network + Key Vault + App Plans).
- C: Prepare DB dump instructions (I will need connection string or permission to read from Key Vault).
