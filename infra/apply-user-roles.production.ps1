$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$BackendRoot = Join-Path $RepoRoot "hotel-booking-backend"
$AssignmentsPath = Join-Path $PSScriptRoot "role-assignments.production.json"

if (-not (Test-Path $AssignmentsPath)) {
  throw "Missing role assignment file: $AssignmentsPath."
}

$MongoConnectionString = [Environment]::GetEnvironmentVariable("MONGODB_CONNECTION_STRING")
if (-not $MongoConnectionString) {
  throw "Set MONGODB_CONNECTION_STRING in the current shell before running this script."
}

$assignments = Get-Content $AssignmentsPath | ConvertFrom-Json

Push-Location $BackendRoot
foreach ($assignment in $assignments) {
  if (-not $assignment.email -or -not $assignment.role) {
    throw "Each role assignment must include email and role."
  }

  npm run set-user-role -- $assignment.email $assignment.role
}
Pop-Location