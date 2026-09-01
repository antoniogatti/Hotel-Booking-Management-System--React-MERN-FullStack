Sub-Copy
========

Purpose
- Workspace for recreating resources from `PalazzoPintoBnB` into the `PalazzoPintoBnB-Pro` resource group on the Ant Pro subscription.

How we will use this folder
- Store exports, backups and migration artifacts (ARM/Bicep exports, JSON lists, DB dumps, KeyVault secret backups).
- Keep the migration plan, step scripts, and runbook snippets.

Structure
- `plan.md` — migration checklist and steps.
- `exports/` — ARM exports and resource lists.
- `backups/` — DB dumps and Key Vault backups (sensitive; keep access-limited).
- `scripts/` — helper CLI scripts for moves, export and restore.

Security note
- Do NOT commit any sensitive backups (Key Vault secret backups, DB dumps) to the git repository. Keep them locally encrypted or in a secure storage account.
