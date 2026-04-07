# Security Implementation Backlog

Date: 2026-04-07

Purpose:
- Convert the approved remediation direction into an execution-ready backlog
- Cover phases 1 to 4 only
- Exclude Azure Front Door, WAF, and any later architecture phases

Status:
- Review draft
- No implementation executed from this backlog yet

## 1. Target Delivery Outcome

Target production posture after this backlog:
- Frontend hosted in Azure
- Backend hosted on Azure App Service Linux `B1`
- Admin access protected by Microsoft Entra ID only
- Browser auth uses secure cookies instead of `localStorage` session tokens
- Public business insight endpoints removed
- Admin analytics available only to platform admins
- Secrets stored in Azure Key Vault and accessed through managed identity
- Application Insights enabled with low-cost telemetry settings
- Mongo free tier retained temporarily with rotated credentials and documented risk acceptance

## 2. Recommended Azure Target Topology

Preferred topology:
- Frontend: Azure Static Web Apps Standard
- Backend: Azure App Service Linux `B1`
- Secrets: Azure Key Vault Standard
- Monitoring: Azure Application Insights
- Database: existing `palazzopintodb` free Mongo cluster

Fallback topology if frontend migration is deferred:
- Frontend: Azure App Service Linux `B1`
- Backend: Azure App Service Linux `B1`
- Secrets: Azure Key Vault Standard
- Monitoring: Azure Application Insights

Recommendation:
- Prefer Azure Static Web Apps Standard for the frontend to keep Azure-only hosting while reducing cost and operational surface

## 3. Workstreams

### Workstream A: Authentication And Session Security

Goal:
- Replace insecure browser token handling with a secure, Entra-compatible session model

Repo tasks:
- Update [hotel-booking-backend/src/routes/auth.ts](c:/Users/anton/Documents/repo/Github/Hotel-Booking-Management-System--React-MERN-FullStack/hotel-booking-backend/src/routes/auth.ts)
  - remove token propagation through query string redirects
  - validate OAuth `state`
  - issue secure session cookies instead of returning browser-stored tokens
  - shorten privileged token lifetime or move to session-backed cookie approach
- Update [hotel-booking-backend/src/middleware/auth.ts](c:/Users/anton/Documents/repo/Github/Hotel-Booking-Management-System--React-MERN-FullStack/hotel-booking-backend/src/middleware/auth.ts)
  - standardize on secure cookie reading
  - ensure role/user identity extraction is explicit and safe
- Update [hotel-booking-frontend/src/pages/AuthCallback.tsx](c:/Users/anton/Documents/repo/Github/Hotel-Booking-Management-System--React-MERN-FullStack/hotel-booking-frontend/src/pages/AuthCallback.tsx)
  - remove `localStorage` token persistence
  - support server-issued session completion flow
- Update [hotel-booking-frontend/src/api-client.ts](c:/Users/anton/Documents/repo/Github/Hotel-Booking-Management-System--React-MERN-FullStack/hotel-booking-frontend/src/api-client.ts)
  - remove `session_id` storage in `localStorage`
  - use credentialed requests consistently
- Update [hotel-booking-frontend/src/lib/api-client.ts](c:/Users/anton/Documents/repo/Github/Hotel-Booking-Management-System--React-MERN-FullStack/hotel-booking-frontend/src/lib/api-client.ts)
  - align API behavior with secure cookie auth
- Update [hotel-booking-frontend/src/contexts/AppContext.tsx](c:/Users/anton/Documents/repo/Github/Hotel-Booking-Management-System--React-MERN-FullStack/hotel-booking-frontend/src/contexts/AppContext.tsx)
  - remove reliance on local browser token storage
  - fetch session/user state from backend safely

Acceptance criteria:
- No auth tokens in browser URL
- No auth tokens in `localStorage`
- Browser auth relies on secure cookies only
- OAuth callback validates `state`

### Workstream B: Authorization And Admin Surface Separation

Goal:
- Ensure admin functions are Entra-only and backend-admin-only

Repo tasks:
- Update [hotel-booking-backend/src/lib/user-role.ts](c:/Users/anton/Documents/repo/Github/Hotel-Booking-Management-System--React-MERN-FullStack/hotel-booking-backend/src/lib/user-role.ts)
  - remove hardcoded email-based admin elevation logic
  - define explicit persisted role model
- Update [hotel-booking-backend/src/middleware/requireRole.ts](c:/Users/anton/Documents/repo/Github/Hotel-Booking-Management-System--React-MERN-FullStack/hotel-booking-backend/src/middleware/requireRole.ts)
  - keep role enforcement explicit and reusable
- Introduce dedicated admin routing structure
  - split guest/public routes from admin routes
  - create a clear admin route namespace if not already present
- Update [hotel-booking-backend/src/routes/business-insights.ts](c:/Users/anton/Documents/repo/Github/Hotel-Booking-Management-System--React-MERN-FullStack/hotel-booking-backend/src/routes/business-insights.ts)
  - remove `/dashboard/public`
  - remove `/forecast/public`
  - remove `/system-stats/public`
  - restrict remaining analytics endpoints to admin-only
- Review admin-sensitive routes in:
  - [hotel-booking-backend/src/routes/bookings.ts](c:/Users/anton/Documents/repo/Github/Hotel-Booking-Management-System--React-MERN-FullStack/hotel-booking-backend/src/routes/bookings.ts)
  - [hotel-booking-backend/src/routes/my-hotels.ts](c:/Users/anton/Documents/repo/Github/Hotel-Booking-Management-System--React-MERN-FullStack/hotel-booking-backend/src/routes/my-hotels.ts)
  - [hotel-booking-backend/src/routes/booking-com-sync.ts](c:/Users/anton/Documents/repo/Github/Hotel-Booking-Management-System--React-MERN-FullStack/hotel-booking-backend/src/routes/booking-com-sync.ts)
  - confirm role and ownership checks remain correct after admin separation

Acceptance criteria:
- No admin capability granted from email convention alone
- Business insights available only to platform admins
- Admin routes are logically separated from public/guest routes

### Workstream C: Public API Exposure Reduction

Goal:
- Reduce unnecessary attack surface in production

Repo tasks:
- Update [hotel-booking-backend/src/index.ts](c:/Users/anton/Documents/repo/Github/Hotel-Booking-Management-System--React-MERN-FullStack/hotel-booking-backend/src/index.ts)
  - remove wildcard CORS acceptance for `netlify.app` and `vercel.app`
  - enforce exact origin allowlist only
  - disable or conditionally disable Swagger in production
  - review general and payment rate limits
- Update [hotel-booking-backend/src/routes/hotels.ts](c:/Users/anton/Documents/repo/Github/Hotel-Booking-Management-System--React-MERN-FullStack/hotel-booking-backend/src/routes/hotels.ts)
  - add sensible date window validation
  - remove legacy direct-payment endpoints and keep booking-request flow only

Acceptance criteria:
- Production CORS is exact-match only
- Swagger is not publicly exposed in production
- Legacy payment endpoints are removed from the production API surface

### Workstream D: Upload Validation And Secure Logging

Goal:
- Prevent unsafe uploads and reduce sensitive log exposure

Repo tasks:
- Update [hotel-booking-backend/src/routes/my-hotels.ts](c:/Users/anton/Documents/repo/Github/Hotel-Booking-Management-System--React-MERN-FullStack/hotel-booking-backend/src/routes/my-hotels.ts)
  - validate allowed file types explicitly
  - validate file headers where practical
  - reject unsupported types
  - remove request body logging in production
- Review other production log paths in:
  - [hotel-booking-backend/src/index.ts](c:/Users/anton/Documents/repo/Github/Hotel-Booking-Management-System--React-MERN-FullStack/hotel-booking-backend/src/index.ts)
  - [hotel-booking-backend/src/routes/auth.ts](c:/Users/anton/Documents/repo/Github/Hotel-Booking-Management-System--React-MERN-FullStack/hotel-booking-backend/src/routes/auth.ts)
  - [hotel-booking-backend/src/routes/booking-com-sync.ts](c:/Users/anton/Documents/repo/Github/Hotel-Booking-Management-System--React-MERN-FullStack/hotel-booking-backend/src/routes/booking-com-sync.ts)
- Introduce structured logging strategy for production-safe logging

Acceptance criteria:
- Upload endpoints accept only approved file formats
- Sensitive request data is not logged in production

### Workstream E: Azure Platform Hardening

Goal:
- Improve cloud-side security posture without Front Door

Azure tasks:

#### E1. Backend Hosting Migration
- Create Linux App Service Plan `B1` for backend
- Deploy backend to Linux App Service
- Validate runtime, startup, and environment parity

#### E2. Frontend Azure Hosting
- Preferred: create Azure Static Web Apps Standard resource and deploy Vite frontend build output
- Fallback: create Linux App Service `B1` frontend host and deploy static build output
- Configure production domain and API base URL appropriately

#### E3. Transport Security
- Enable `httpsOnly` on all production web apps
- Review direct `azurewebsites.net` exposure and reduce dependency over time
- Restrict SCM exposure if operationally acceptable

#### E4. Key Vault And Managed Identity
- Create Azure Key Vault
- Enable backend system-assigned managed identity
- Grant backend identity only the secret read permissions required
- Move app secrets to Key Vault references

#### E5. Monitoring
- Create Application Insights
- Connect backend telemetry
- Configure low-cost sampling and retention policy
- Add alert rules for:
  - 5xx spikes
  - 401/403 anomalies
  - excessive 429 responses
  - auth failures
  - booking/payment failures

#### E6. Governance
- Add baseline Azure Policy assignments if possible
- At minimum document and enforce manual standards for HTTPS, TLS, secrets, and identity usage

Acceptance criteria:
- Backend on Linux `B1`
- Frontend hosted in Azure in approved target
- HTTPS enforced
- Managed identity enabled on backend
- Key Vault references in use
- Application Insights and alerts active

### Workstream F: Database Risk Stabilization

Goal:
- Keep the free-tier database temporarily while reducing operational and credential risk

Azure tasks:
- Rotate Mongo application credentials
- Ensure only application identity path retrieves the connection secret via Key Vault reference
- Document explicit risk acceptance for temporary public network exposure
- Review restore readiness and backup expectations

Repo tasks:
- Add audit logging for:
  - booking creation and deletion
  - hotel updates
  - booking-com sync configuration changes
  - role changes

Acceptance criteria:
- Database credentials rotated
- DB secret retrieved through Key Vault reference path
- Audit logging backlog implemented or approved with delivery sequence

## 4. Suggested Sprint Sequence

### Sprint 1
- Authentication/session hardening
- CORS hardening
- Remove public business insights endpoints
- Disable Swagger in production
- Upload validation and log cleanup

### Sprint 2
- Admin route separation
- Explicit persisted admin role model
- Entra-only admin protection completion
- Payment idempotency and booking validation hardening

### Sprint 3
- Backend migration to Linux `B1`
- Frontend Azure hosting target decision and deployment
- HTTPS enforcement
- Managed identity and Key Vault rollout

### Sprint 4
- Application Insights and alerting
- DB credential rotation
- Audit trail implementation
- Final production validation and hardening review

## 5. Remaining Open Decisions

These items still need one explicit decision before implementation starts:

1. Frontend Azure target
- Preferred recommendation: Azure Static Web Apps Standard
- Fallback: Linux App Service `B1`

2. Swagger production posture
- Most secure option: disabled in production
- Alternate secure option: enabled only in controlled non-production environments

3. Change delivery model
- Infrastructure as code first
- Or manual secure rollout first followed immediately by IaC codification

## 6. Review Checklist

Review and confirm the following before implementation:

1. Approve frontend target: Static Web Apps Standard or App Service Linux `B1`
2. Approve Swagger to be disabled in production
3. Approve removal of public business insight endpoints
4. Approve secure cookie auth as the browser standard
5. Approve Entra-only admin access model
6. Approve backend Linux `B1` migration
7. Approve Key Vault and Application Insights creation
8. Accept temporary public network exposure on the free Mongo tier until a later budget phase

Once these are confirmed, this backlog can be converted into an execution plan with file-by-file implementation steps and Azure change scripts or IaC.