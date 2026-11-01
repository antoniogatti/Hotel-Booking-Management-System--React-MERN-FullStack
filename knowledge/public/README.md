# Palazzo Pinto B&B — Public Knowledge Base

These files are the **single source of truth** for Sofia's guest-facing knowledge.

## Files

| File | Content |
|---|---|
| `01 - Overview.md` | Property summary, quick facts |
| `02 - Rooms.md` | Rooms, prices, amenities |
| `03 - Policies & Conditions.md` | Cancellation, check-in/out, house rules |
| `05 - Reach Us.md` | Address, directions, parking |
| `06 - Recommendations.md` | Local restaurants, places, beaches, road trips |

## Sync workflow

These files are **mirrored from the Obsidian vault** at:
`C:\Users\anton\Documents\Palazzo Pinto B&B\Public\`

When you update room prices or policies in Obsidian, copy the updated file here and push to GitHub.
The n8n sync workflow will detect the change (via GitHub API) and update the MongoDB `property_knowledge` collection automatically.

## n8n sync

- Workflow: **Sofia Knowledge Sync** (scheduled hourly)
- Source: GitHub API — this folder on `main`
- Target: MongoDB collection `property_knowledge`
- Each file → one document with fields: `slug`, `title`, `content`, `updated_at`
