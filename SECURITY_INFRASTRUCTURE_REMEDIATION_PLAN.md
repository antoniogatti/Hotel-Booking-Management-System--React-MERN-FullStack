# Security And Infrastructure Remediation Plan

Date: 2026-04-07

Scope:
- Confirm a low-cost remediation path for the current Palazzo Pinto solution
- Keep Azure monthly spend under approximately EUR 50 where possible
- Exclude Azure Front Door and any later edge-architecture phases for now
- Focus on current application, API, identity, App Service, monitoring, secrets, and database exposure

Non-goals for this plan:
- No Azure Front Door
- No WAF rollout in this phase
- No phase 5 or later architecture expansion

## 1. Current State Summary

Current Azure footprint in resource group `PalazzoPintoBnB`:
- Frontend App Service: `palazzopinto-web-2603151048`
- Backend App Service: `palazzopinto-api-2603151048`
- Shared App Service Plan: `palazzopinto-free-plan` on `F1`
- Mongo database resource: `palazzopintodb` (`Microsoft.DocumentDB/mongoClusters`)

Current security posture issues observed:
- Both App Services are public and do not enforce HTTPS only
- Both App Services allow all inbound access, including SCM endpoints
- App Service Authentication / Easy Auth is disabled
- Backend secrets are stored directly in App Service settings
- Mongo cluster has `publicNetworkAccess` enabled and no private endpoint
- No resource group Azure Policy assignments are in place
- No Key Vault resource exists in the resource group
- No Application Insights resource exists in the resource group
- Browser auth currently relies on URL token passing and `localStorage`

## 2. Target State For This Remediation

This remediation targets the following architecture without Front Door:

- Frontend remains on a low-cost static hosting option or current frontend host if preferred
- Backend runs on Azure App Service Linux `B1`
- Backend uses Microsoft Entra ID for admin access protection
- Backend also enforces application-level admin role checks
- Backend secrets move to Azure Key Vault
- Backend App Service uses system-assigned managed identity
- Application Insights is enabled with conservative ingestion
- Public guest API remains available for booking and search
- Admin API is protected at both identity and application layers
- Database remains on the current Mongo cluster temporarily, but with tighter operational controls

Definition of double protection for admin API in this plan:
- First layer: identity gate for admin routes using Microsoft Entra ID
- Second layer: backend authorization and role enforcement inside Express

## 3. Cost Guardrail

Estimated monthly budget target:
- Backend Linux App Service `B1`: about EUR 11-12 per month
- Key Vault standard usage: approximately EUR 0-2 per month for this scale
- Application Insights light usage: approximately EUR 2-8 per month depending on ingestion
- Current Mongo free tier: EUR 0 if retained
- Frontend hosting: keep low-cost or outside Azure where possible

Expected total range for this phase:
- Approximately EUR 15-30 per month in Azure for the core secured backend path

Budget assumptions:
- No Front Door
- No WAF
- No private endpoint rollout in this phase unless budget is explicitly relaxed
- Low to moderate telemetry volume

## 4. Phase 0: Decisions Required Before Implementation

Purpose:
- Confirm hard requirements before any code or Azure changes

Deliverables:
- Approved target scope
- Confirmed authentication model
- Confirmed hosting and budget boundaries

Decisions to confirm:
- Whether the EUR 50 cap is Azure-only or total hosting cost
- Whether the frontend should remain outside Azure for cost efficiency
- Whether all admin users will use Microsoft Entra ID accounts under your control
- Whether hotel owners and platform admins should remain distinct roles
- Whether the admin API can be logically separated from guest/public API routes
- Whether secure cookie-based browser auth is acceptable as the target model
- Whether public business insights endpoints can be removed entirely

Exit criteria:
- All key questions in section 10 answered

## 4A. Confirmed Decisions

The following decisions are confirmed for this remediation path:
- Total hosting budget can go up to approximately EUR 60 per month
- Frontend should remain in Azure
- Admin access should be Microsoft Entra ID only
- Browser authentication should move to secure cookie-based handling
- Public business insights endpoints should be removed
- Analytics access should be platform-admin only via Entra-backed admin access
- Admin routes can be logically separated from guest/public routes
- The current Mongo free tier is acceptable as a temporary production compromise
- Production posture should prefer the secure option over convenience
- A concrete implementation backlog is required before execution

Consequences of these decisions:
- The target budget can support a secure Azure-only path without Front Door
- The frontend target should now be an Azure-native hosting option
- Admin design can assume Entra-only access and stricter backend admin enforcement

## 5. Phase 1: Immediate Application Security Remediation

Priority: Critical

Objective:
- Fix the highest-risk application issues without waiting for infrastructure migration

Planned changes:

### 5.1 Authentication And Session Handling
- Remove token passing via OAuth redirect query parameters
- Stop storing auth tokens in `localStorage`
- Move browser authentication to `httpOnly`, `Secure`, `SameSite` cookies
- Add OAuth `state` validation for Microsoft sign-in
- Shorten token lifetime for privileged access
- Define whether refresh token rotation or short server session is required

### 5.2 Authorization Hardening
- Restrict admin-only routes to `admin` role, not merely authenticated users
- Review all hotel-owner and admin routes for explicit ownership and role checks
- Remove any role assignment logic based purely on hardcoded email conventions
- Replace email-derived admin access with explicit role management

### 5.3 API Exposure Reduction
- Remove or protect public business insight endpoints
- Protect Swagger or disable it in production
- Tighten CORS to exact allowlisted origins only
- Review payment-related endpoints for replay and idempotency improvements

### 5.4 Input And Upload Security
- Add strict MIME validation for uploaded files
- Validate file signatures where possible
- Add date-range constraints and other defensive input validation on booking flows

### 5.5 Logging And Privacy
- Remove sensitive request body and identifier logging from production code paths
- Replace ad hoc console logging with structured logging strategy
- Redact PII and secrets from logs

Exit criteria:
- No tokens in URLs
- No `localStorage` session token reliance for browser auth
- Public business insight endpoints removed or protected
- CORS restricted to exact production origins
- Upload validation in place
- Swagger no longer public in production

## 6. Phase 2: Azure Infrastructure Hardening Without Front Door

Priority: Critical

Objective:
- Improve Azure-side security posture while staying within budget

Planned changes:

### 6.1 App Service Plan And Runtime
- Move backend from current free shared setup to Linux App Service `B1`
- Move frontend to an Azure-native low-cost hosting target
- Preferred target: Azure Static Web Apps Standard for frontend static hosting
- Fallback target: Linux App Service `B1` for frontend if Static Web Apps is not preferred
- Confirm runtime and deployment model on Linux App Service

### 6.2 Secure Transport And Exposure
- Enforce `httpsOnly` on backend and frontend apps
- Review and reduce public exposure where possible
- Lock down SCM/Kudu exposure if operationally feasible
- Remove unnecessary direct `azurewebsites.net` dependency over time

### 6.3 Managed Identity And Secrets
- Enable system-assigned managed identity on the backend App Service
- Create Azure Key Vault
- Move secrets out of raw app settings and into Key Vault references
- Remove direct storage of JWT, DB, Stripe, Cloudinary, and Entra secrets from app settings where feasible

### 6.4 Monitoring And Alerting
- Create Application Insights and connect backend telemetry
- Configure low-cost ingestion and retention settings
- Add alert rules for:
  - HTTP 5xx spikes
  - HTTP 401 and 403 anomalies
  - Login failure spikes
  - Payment and booking failures
  - Excessive rate-limit responses

### 6.5 Governance
- Add baseline Azure Policy assignments or at minimum document required settings
- Enforce HTTPS-only and approved TLS minimums where possible

Exit criteria:
- Backend moved to Linux `B1`
- Managed identity enabled
- Key Vault created and used
- Application Insights enabled
- HTTPS enforced

## 7. Phase 3: Admin API Double Protection

Priority: Critical

Objective:
- Protect admin operations with both identity and application-level controls

Target model:

### 7.1 Identity Gate
- Admin users authenticate through Microsoft Entra ID
- Backend validates identity and only permits approved admin principals to access admin functions
- Guest routes remain separate from admin routes in access behavior
- Admin access assumption: no non-Entra admin identities are required

### 7.2 Application Authorization Gate
- Backend continues to enforce admin role checks on each admin route
- Role lookup is controlled from persisted user roles, not inferred by email convention
- Role enforcement remains active even after Entra authentication succeeds

### 7.3 Administrative Surface Separation
- Public API routes remain accessible for guest booking/search operations
- Admin routes are grouped and documented separately
- Review whether hotel owner routes and platform admin routes should have stricter separation
- Current confirmed direction: analytics and platform administration are admin-only concerns

### 7.4 Session And Browser Model
- Browser admin sessions use secure cookies
- Token/session renewal policy is defined explicitly
- Session invalidation and logout behavior are verified

Exit criteria:
- Admin API access requires Entra-authenticated admin users
- Backend role checks enforced on all admin endpoints
- Email-based role escalation removed

## 8. Phase 4: Database And Data Protection Stabilization

Priority: High

Objective:
- Reduce operational risk around the database without forcing higher-cost network architecture immediately

Planned changes:

### 8.1 Credential And Access Hygiene
- Rotate Mongo credentials used by the application
- Minimize who can access the database connection string
- Ensure the connection string is only retrieved from Key Vault references

### 8.2 Exposure Review
- Keep current public access only as a temporary budget trade-off if necessary
- Document current risk acceptance for public network access
- Reassess private endpoint feasibility later if budget increases

### 8.3 Backups And Restore
- Verify restore expectations and acceptable recovery window
- Document restore process and owner responsibilities

### 8.4 Auditability
- Add audit logging for sensitive mutations:
  - booking creation and deletion
  - room/hotel updates
  - admin configuration changes
  - user role changes

Exit criteria:
- DB credential rotation completed
- Key Vault-backed secret access in place
- Audit trail requirements defined and partially implemented

## 9. Suggested Implementation Order

Recommended execution order:

1. Confirm decisions in phase 0
2. Fix token handling, CORS, public insight routes, Swagger, and upload validation
3. Enforce HTTPS on existing App Services immediately
4. Move backend to Linux `B1`
5. Add managed identity and Key Vault
6. Add Application Insights and alerts
7. Implement Entra-backed admin protection and backend role hardening
8. Rotate DB secrets and document database risk posture

## 10. Key Questions To Confirm Before Implementation

These questions should be answered before work starts.

### Budget And Hosting
- Is the EUR 50 monthly cap Azure-only, or total hosting cost including frontend?
- Can the frontend stay on Vercel or another low-cost static host?
- Do you want to keep the frontend App Service at all, or remove it from Azure later?

### Identity And Admin Access
- Will all admins use Microsoft Entra ID identities you control?
- Do you want hotel owners and platform admins separated more strictly?
- Does any third party need admin access outside your Entra tenant?

### Application Security
- Are you comfortable moving fully to secure cookie-based browser auth?
- Can public business insights endpoints be removed entirely?
- Do you want Swagger disabled in production or protected behind admin authentication?

### API Design
- Can we logically separate admin endpoints from public endpoints now?
- Should hotel-owner APIs remain separate from admin APIs in authorization rules?
- Do you want all analytics endpoints to become admin-only, or should hotel owners retain a scoped subset?

### Database And Operations
- Is the current Mongo free tier temporary or expected to remain in production for some time?
- Do you need audit logging for compliance or operational dispute resolution?
- What level of backup and restore readiness do you expect?

### Operations And Rollout
- Do you want changes applied in one release or in phased production rollouts?
- Do you want infrastructure-as-code created as part of this remediation before any portal/manual changes?

## 11. Deliverables For Review And Confirmation

Once the questions are answered, the next deliverables should be:

1. Implementation backlog
- Detailed task list by file, route, and Azure setting

2. Infrastructure change set
- Azure resources to create, modify, or retire
- Estimated monthly spend per resource

3. Security change set
- Auth/session redesign
- Route protection updates
- Logging and observability updates

4. Acceptance checklist
- Security validation scenarios
- Rollback plan
- Production verification checklist

Confirmed next deliverable:
- A concrete implementation backlog has been requested and should be used as the next review artifact

## 12. Approval Boundary

This plan intentionally excludes:
- Azure Front Door
- WAF rollout
- Private endpoint enforcement that would significantly alter the budget
- Any phase beyond the low-cost remediation path agreed for this review

This document is a review draft and should be approved before implementation.

## 13. Remaining Open Items

The following items still require one explicit implementation decision:
- Whether frontend should move to Azure Static Web Apps Standard or remain on App Service in Azure
- Whether Swagger should be fully disabled in production or only enabled in controlled non-production environments
- Whether infrastructure changes should be delivered as IaC first or executed manually first and codified immediately after