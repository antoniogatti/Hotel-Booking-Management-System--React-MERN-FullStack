# Palazzo Pinto BnB Go-Live Plan

## Objective

Move production traffic from Azure default hostnames to the Palazzo Pinto custom domain with controlled risk and a clear rollback path.

Target public hostnames:

- Frontend primary: `https://www.palazzopintobnb.com`
- Frontend secondary: `https://palazzopintobnb.com`
- Backend API: `https://api.palazzopintobnb.com`

Current Azure hostnames kept during transition:

- Frontend legacy: `https://palazzopinto-web-2603151048.azurewebsites.net`
- Backend legacy: `https://palazzopinto-api-secure.azurewebsites.net`

## Why This Shape

- Keeps frontend and API on separate hostnames, which matches the current application structure.
- Avoids path-based reverse proxy changes before go-live.
- Keeps the backend callback URL stable and explicit for Microsoft Entra.
- Allows staged migration while legacy Azure hostnames remain available.

## Current Technical Constraints

The following behaviors are already implemented and drive the cutover plan:

- Production CORS is exact-origin based and depends on `FRONTEND_URL` and `FRONTEND_URLS`.
- Microsoft OAuth callback URL is built from `BACKEND_URL`.
- Frontend API calls use `VITE_API_BASE_URL` at build time.
- The backend private database path does not depend on the public hostname.
- Some infra and operational docs still hard-code `azurewebsites.net` hostnames and must be updated to avoid regressions on later deployments.

## Primary Risks

1. Microsoft sign-in fails because the new callback URL is not present in the Entra app registration.
2. Browser requests fail because the backend CORS allowlist is not updated for the custom frontend origin.
3. Frontend keeps calling the old API hostname because the app was not rebuilt with the new `VITE_API_BASE_URL`.
4. Later infra or manual rollout scripts silently restore Azure default hostnames.
5. Cookies or redirect flows behave differently across apex and `www` if canonical hostnames are not chosen up front.

## Go-Live Strategy

Use a staged cutover, not a big-bang switch.

- Validate the custom domains in Azure first.
- Keep legacy Azure hostnames active during transition.
- Update app settings and auth configuration before switching public DNS.
- Rebuild and deploy the frontend against the new API hostname.
- Cut DNS only after smoke tests pass on the custom domains.
- Remove legacy origins only after several days of stable traffic.

## Phase 0: Decisions And Freeze

Complete these decisions before making changes:

1. Confirm canonical frontend hostname.
   Recommended: `palazzopintobnb.com` as primary, `www.palazzopintobnb.com` as alias or redirect.
2. Confirm canonical backend hostname.
   Recommended: `api.palazzopintobnb.com`.
3. Freeze production changes during the cutover window.
4. Lower DNS TTL values at the registrar or DNS provider to `300` seconds at least 24 hours before the final switch.

## Phase 1: Prepare Azure Custom Domains

### Frontend

Target platform: Azure Static Web Apps Standard.

Actions:

1. Add `www.palazzopintobnb.com` as a custom domain to the Static Web App.
2. Validate ownership using the Azure-provided TXT flow.
3. Add `palazzopintobnb.com` as the apex custom domain.
4. Complete apex validation using the record type supported by your DNS provider.
5. Wait for Azure managed certificates to be issued and active.

Notes:

- For zero-downtime migration, validate ownership first with TXT, then switch traffic.
- If the DNS provider does not support apex ALIAS or equivalent flattening cleanly, make `www` the primary public frontend and redirect the apex.

### Backend API

Target platform: Azure App Service.

Actions:

1. Add `api.palazzopintobnb.com` as a custom domain on the backend App Service.
2. Add the recommended TXT verification record.
3. Add the CNAME record pointing `api` to the backend App Service default hostname.
4. Enable the managed certificate for `api.palazzopintobnb.com`.
5. Verify HTTPS is active before using the hostname in auth or app settings.

## Phase 2: Prepare Application Configuration

Update backend production app settings to the transition-safe values below.

### Backend App Settings

Set:

- `BACKEND_URL=https://api.palazzopintobnb.com`
- `FRONTEND_URL=https://www.palazzopintobnb.com`
- `FRONTEND_URLS=https://www.palazzopintobnb.com,https://palazzopintobnb.com,https://palazzopinto-web-2603151048.azurewebsites.net`

Guidance:

- Keep the legacy frontend hostname in `FRONTEND_URLS` during migration.
- Use a single canonical `FRONTEND_URL` for redirect generation.
- Do not remove the legacy Azure hostname until the new frontend has been live and stable for several days.

### Frontend Build-Time Settings

Set production build configuration to:

- `VITE_API_BASE_URL=https://api.palazzopintobnb.com`

Actions:

1. Update the production environment file or deployment pipeline input.
2. Rebuild the frontend.
3. Deploy the rebuilt assets to the Static Web App.

## Phase 3: Update Microsoft Entra Authentication

The backend callback URL is built from `BACKEND_URL`, so the Entra app registration must be updated before users authenticate through the new hostname.

Required redirect URIs:

- New production callback: `https://api.palazzopintobnb.com/api/auth/callback/microsoft`
- Temporary legacy callback: `https://palazzopinto-api-secure.azurewebsites.net/api/auth/callback/microsoft`
- Local development callback if still needed: `http://localhost:5000/api/auth/callback/microsoft`

Actions:

1. Add the new API callback URL.
2. Keep the legacy Azure callback during transition.
3. Verify the app registration owners are correct.
4. After cutover stabilizes, remove unused production redirect URIs.

## Phase 4: Update Infrastructure And Operational Artifacts

These repository files still carry Azure default hostname assumptions and should be updated before or during cutover:

- `infra/main.parameters.production.json`
- `infra/main.bicep`
- `infra/manual-secure-cutover.ps1`
- `infra/azure-rollout.production.ps1`
- `DEPLOYMENT_CONFIGURATION.md`

Required changes:

1. Replace hard-coded production frontend URL values with the custom domain.
2. Replace hard-coded production backend URL values with the API custom domain.
3. Preserve transition-safe additional origins where needed.
4. Ensure future rollouts do not reset `BACKEND_URL`, `FRONTEND_URL`, or `FRONTEND_URLS` back to `azurewebsites.net` values.

## Phase 5: Pre-Cutover Validation

Before switching DNS, validate the new hostnames directly.

### Backend Validation

1. `https://api.palazzopintobnb.com/api/health`
2. Public room listing endpoint
3. Auth validation endpoint
4. CORS preflight from the frontend custom domain
5. Microsoft sign-in start and callback completion

### Frontend Validation

1. Home page renders over HTTPS.
2. Search works.
3. Hotel detail pages work.
4. Contact form works.
5. Email/password sign-in works.
6. Microsoft sign-in works.
7. Session survives page refresh.
8. Logout works.
9. Owner/admin routes still work.

### Data And Network Validation

1. Backend still connects to Mongo over the existing private path.
2. Booking, room, and analytics endpoints behave normally.
3. No unexpected 401, 403, 500, or CORS errors appear in browser or server logs.

## Phase 6: DNS Cutover

Perform the switch only after Phases 1 to 5 are complete.

### DNS Record Model

Use the Azure-provided values captured during custom-domain setup.

Expected pattern:

- `api` -> CNAME to backend App Service default hostname
- `www` -> CNAME to Static Web App default hostname
- apex -> ALIAS, ANAME, or equivalent to Static Web App target as supported by the DNS provider

Actions:

1. Publish the final frontend DNS records.
2. Publish the final API DNS record.
3. Wait for propagation.
4. Validate certificate issuance again after public resolution updates.
5. Run the smoke test suite immediately after the switch.

## Phase 7: Stabilization Window

For at least 3 to 7 days after cutover:

1. Keep legacy Azure hostnames online.
2. Keep the legacy frontend hostname in `FRONTEND_URLS`.
3. Keep the legacy Azure backend callback in Entra.
4. Monitor App Service logs, Static Web App logs, browser errors, and auth failures.
5. Track contact form, booking flow, and sign-in success rate.

## Phase 8: Cleanup

After the stabilization period and only if no issues remain:

1. Remove `https://palazzopinto-web-2603151048.azurewebsites.net` from `FRONTEND_URLS`.
2. Remove the legacy Azure callback URL from the Entra app registration.
3. Update docs so the custom domains are the canonical production URLs.
4. Decide whether old Azure default hostnames should remain reachable or be treated as non-canonical fallback endpoints.

## Rollback Plan

If cutover fails, roll back in this order:

1. Restore frontend DNS to the previous live endpoint.
2. Restore API DNS to the previous live endpoint if it was switched.
3. Reset backend app settings:
   - `BACKEND_URL=https://palazzopinto-api-secure.azurewebsites.net`
   - `FRONTEND_URL=https://palazzopinto-web-2603151048.azurewebsites.net`
   - `FRONTEND_URLS=https://palazzopinto-web-2603151048.azurewebsites.net`
4. Redeploy the previous frontend build if the live frontend was rebuilt with the new API URL.
5. Keep both Entra redirect URIs in place until the incident is resolved.

Rollback trigger examples:

- Microsoft sign-in broken for production users
- widespread CORS errors
- booking or contact submission failures
- invalid session persistence after login
- certificate or HTTPS validation failures

## Execution Checklist

### Preparation

- [ ] Confirm canonical frontend hostname.
- [ ] Confirm canonical API hostname.
- [ ] Lower DNS TTL.
- [ ] Freeze production changes during cutover.

### Azure Domain Readiness

- [ ] Frontend custom domain validated.
- [ ] Frontend managed certificate active.
- [ ] API custom domain validated.
- [ ] API managed certificate active.

### App Configuration

- [ ] Backend `BACKEND_URL` set to `https://api.palazzopintobnb.com`.
- [ ] Backend `FRONTEND_URL` set to canonical frontend origin.
- [ ] Backend `FRONTEND_URLS` includes both new and legacy frontend origins.
- [ ] Frontend rebuilt with `VITE_API_BASE_URL=https://api.palazzopintobnb.com`.

### Authentication

- [ ] Entra redirect URI added for `https://api.palazzopintobnb.com/api/auth/callback/microsoft`.
- [ ] Legacy Azure callback retained during transition.

### Validation

- [ ] Frontend smoke tests pass.
- [ ] API smoke tests pass.
- [ ] Microsoft sign-in passes end to end.
- [ ] Cookie session survives refresh.
- [ ] Booking and contact flows pass.

### Cutover

- [ ] DNS switched.
- [ ] Public HTTPS verified.
- [ ] Post-cutover smoke tests pass.

### Stabilization And Cleanup

- [ ] Monitor logs for 3 to 7 days.
- [ ] Remove legacy frontend origin from `FRONTEND_URLS`.
- [ ] Remove legacy Azure Entra callback.
- [ ] Update remaining docs and scripts.

## Recommended Next Repo Changes

The next repo task should be to update infra and operational files so the custom-domain configuration becomes the default production configuration instead of a manual one-off change.

Priority order:

1. `infra/main.parameters.production.json`
2. `infra/manual-secure-cutover.ps1`
3. `DEPLOYMENT_CONFIGURATION.md`
4. `infra/azure-rollout.production.ps1`
5. `infra/main.bicep`
