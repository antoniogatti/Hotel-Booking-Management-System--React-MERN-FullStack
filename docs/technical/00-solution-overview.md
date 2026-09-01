# Palazzo Pinto B&B — Solution Overview

## 1. What this solution is
Palazzo Pinto B&B is a full-stack hotel booking platform built on a MERN-style stack:
- **Frontend:** React + TypeScript + Vite
- **Backend:** Express + TypeScript + MongoDB + Mongoose
- **Hosting/ops:** Azure App Service, Azure Cosmos DB for MongoDB vCore, Key Vault, Application Insights, Log Analytics, VNet/private endpoint setup

The repository also contains supporting flows for:
- booking management
- owner/admin dashboards
- self check-in
- Booking.com iCal sync
- telemetry and traffic insights
- OneNote / Microsoft Graph integrations
- scheduler monitoring

## 2. Layer map
### Frontend layer
The frontend is the user-facing web application. It handles:
- hotel search and room landing pages
- booking and checkout journeys
- public policy pages
- admin and owner views
- telemetry for public page views

### Backend layer
The backend exposes the API and owns:
- authentication and session validation
- hotel, booking, and user routes
- booking management and admin operations
- schedulers and synchronization jobs
- telemetry, analytics, and integrations

### Azure / infrastructure layer
Azure provides the production runtime and security controls:
- App Service for backend hosting
- MongoDB vCore / Cosmos DB for data
- Key Vault for secrets
- managed identity and role assignments
- private endpoint and VNet integration
- Application Insights + Log Analytics

## 3. Main runtime paths
### Public guest flow
1. Guest lands on the frontend.
2. Search and room detail pages fetch data from the backend.
3. Guest books, checks out, or submits a self check-in.
4. Backend persists the booking and emits the relevant side effects.

### Owner/admin flow
1. User signs in.
2. Frontend stores the session state and validates it against the backend.
3. Protected pages unlock owner/admin functions.
4. Backend enforces role checks on sensitive routes.

### Operations flow
1. Azure hosts the backend and supporting services.
2. Backend schedulers run Booking.com sync and enrichment jobs.
3. Telemetry and logs are pushed to Application Insights / Log Analytics.

## 4. Recommended reading path
If you want to understand the solution quickly, read in this order:
1. frontend layer doc
2. backend layer doc
3. Azure/deployment doc

## 5. Scope caveat
This set documents the current implementation as inspected in the repository and checked-in infra docs. It is intentionally practical and implementation-oriented.
