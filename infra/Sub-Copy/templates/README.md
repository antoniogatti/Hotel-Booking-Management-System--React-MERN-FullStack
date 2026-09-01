Templates
=========

This folder stores the ARM export we captured from `PalazzoPintoBnB` and any derived templates you create for redeployment.

- `../exports/PalazzoPintoBnB-arm-export.json` — original ARM export (review and edit before deploying).

How to prepare parameters
- The export contains many parameters for resource names. Create a `params.json` with values for each parameter before deployment.
- Example params file snippet:
{
  "sites_palazzopinto_web_2603151048_name": { "value": "palazzopinto-web-2603151048" }
}

Limitations
- The ARM export may include provider-specific types that won't deploy to a fresh subscription; read `../scripts/notes.md` for details.
