# Security Assessment — Hotel-Booking-Management-System (React + MERN)

Date: 2026-08-23  
Assessor: Jim Hernes (static review + dependency audit)

## 1) Scope & Method

This assessment covers:
- Backend code (`hotel-booking-backend/src/**`)
- Frontend code (`hotel-booking-frontend/src/**`)
- Dependency vulnerability posture (`npm audit --omit=dev` on FE/BE)
- Azure infrastructure docs/IaC (`infra/AZURE-INFRA.md`, `infra/main.bicep`, `infra/azure-rollout.production.ps1`, `infra/README.md`)

Method used:
- Static code inspection of auth/session, route protection, input validation, upload handling, and infra settings.
- Dependency audit from local `npm audit` output.
- Infra posture inferred from checked-in IaC/docs (not a live Azure security-center scan).

---

## 2) Executive Summary

**Overall status: functional and partially hardened, but with important security improvements still recommended before calling it fully robust.**

### Current posture in one line
You already have good foundations (helmet, CORS allowlist, role middleware, Key Vault references, managed identity, private endpoint path), but there are **high-priority auth/session and dependency risks** to close.

### Risk snapshot
- **Critical:** 0 found in current static pass
- **High:** 5
- **Medium:** 6
- **Low:** 3

---

## 3) What is already good (keep this)

1. **Backend transport/security baseline is present**
   - `httpsOnly: true`, `minTlsVersion: '1.2'`, `ftpsState: 'Disabled'` in `infra/main.bicep`.
2. **Secrets are Key Vault-referenced in app settings**
   - `@Microsoft.KeyVault(SecretUri=...)` pattern used for JWT, DB, Cloudinary, Entra secrets.
3. **Managed identity + KV role assignment implemented**
   - Backend MSI + `Key Vault Secrets User` role assignment in Bicep.
4. **CORS allowlist strategy implemented**
   - Dynamic allowlist with explicit origin matching in backend `index.ts`.
5. **OAuth state validation implemented**
   - Microsoft callback validates `oauth_state` cookie before token exchange.
6. **Upload validation is stronger than average**
   - MIME allowlist + magic-byte signature checks in `my-hotels.ts` and `self-checkin.ts`.
7. **Rate limiting present on sensitive public forms**
   - Contact and self-checkin routes use dedicated limiters.

---

## 4) High-priority findings

## H1 — Session token in URL + localStorage token model (high)
**Evidence**
- Backend appends token to redirect query params (`/auth/callback`): `hotel-booking-backend/src/routes/auth.ts` (`token` in redirect payload).
- Frontend reads `token` from URL and stores it in localStorage: `hotel-booking-frontend/src/pages/AuthCallback.tsx`, `src/api-client.ts`, `src/lib/api-client.ts`.

**Why it matters**
- URL token can leak through browser history, logs, referrers, analytics tools, and copied links.
- localStorage token is reachable by injected JS if XSS happens.

**Recommendation**
- Move fully to server-set session cookie (`HttpOnly`, `Secure`, `SameSite`) and remove token from URL entirely.
- Remove `localStorage.session_id` auth path and Bearer injection from FE interceptor.
- Keep FE auth state via `/api/auth/validate-token` + cookie-based session only.

---

## H2 — Service auth endpoints mint admin JWTs with static shared secret and no throttling (high)
**Evidence**
- `/api/auth/service` returns admin JWT valid 12h when `client_id/client_secret` match (`auth.ts`).
- `/api/mcp/auth` similar static credential exchange, returns 12h token (`mcp.ts`).

**Why it matters**
- Brute-force/credential-stuffing surface on high-privilege token mint endpoints.
- Static long-lived shared secret model increases blast radius if secret leaks.

**Recommendation**
- Add strict rate limits + temporary lockout on failed attempts for both endpoints.
- Reduce token TTL for service tokens (e.g., 15–60 min) and support rotation/jti revocation.
- Prefer signed client assertions or managed identity-based trust where possible.
- Restrict these routes by trusted network/source when feasible.

---

## H3 — Dependency vulnerability backlog is significant (high)
**Evidence (local audit)**
- **Backend**: 29 total vulnerabilities (13 high, 15 moderate, 1 low).
- **Frontend**: 9 total vulnerabilities (8 high, 1 moderate).
- High-impact packages include `axios`, `react-router-dom/react-router`, `express`, `express-rate-limit`, `mongoose`, `js-cookie`.

**Why it matters**
- Known CVEs include SSRF/open redirect/prototype pollution/DoS vectors depending on runtime paths.

**Recommendation**
- Run controlled upgrade wave (branch + CI + regression tests) for:
  - FE: `axios`, `react-router-dom`, `js-cookie`
  - BE: `express`, `express-rate-limit`, `mongoose`, plus transitive chain
- Re-run `npm audit` until high severity is eliminated or explicitly risk-accepted.

---

## H4 — Key Vault network ACL currently open in IaC (high)
**Evidence**
- In `infra/main.bicep`: Key Vault `publicNetworkAccess: 'Enabled'` + `networkAcls.defaultAction: 'Allow'`.

**Why it matters**
- Secrets store remains internet-reachable at network layer.

**Recommendation**
- Tighten KV network access (private endpoint or selected networks, `defaultAction: Deny`) while validating deployment/runtime dependencies.

---

## H5 — Backend public network exposure remains enabled in IaC (high)
**Evidence**
- In `infra/main.bicep`: backend site `publicNetworkAccess: 'Enabled'`.

**Why it matters**
- Increases direct attack surface (expected for public API, but should be intentionally constrained).

**Recommendation**
- If API must stay public, enforce additional hardening: strict endpoint minimization, threat protection, robust monitoring/alerts, and explicit deny-by-default controls elsewhere.

---

## 5) Medium findings

## M1 — Production CORS fallback includes legacy/non-canonical origins
- `index.ts` includes fallback origins including legacy `azurewebsites.net` and Vercel hostname.
- Recommendation: keep only canonical production origins after migration window ends.

## M2 — Swagger exposure controlled by env switch may be re-enabled accidentally
- `swaggerEnabled = !isProduction || ENABLE_SWAGGER === 'true'`.
- Recommendation: hard-disable in prod by default, expose only behind admin auth in non-public contexts.

## M3 — Dev/admin convenience flags are powerful if env is mis-set
- Role forcing in non-production path (`FORCE_LOCAL_ADMIN_ROLE`, local defaults).
- Recommendation: assert fail-fast if such flags are ever enabled in production.

## M4 — Contact/self-checkin logging may include PII in operational logs
- Route logging includes IP/user-agent and warning payloads.
- Recommendation: enforce structured redaction and retention policy for privacy compliance.

## M5 — Security docs contain detailed subscription/tenant/resource identifiers
- `infra/AZURE-INFRA.md` includes subscription ID, tenant ID, resource IDs.
- Recommendation: keep infra inventory in private/internal docs only, or redact IDs in repo.

## M6 — Route protection consistency should be continuously verified
- Some routes are intentionally public; others are protected at router-level middleware.
- Recommendation: add automated route-security tests to prevent accidental exposure during refactors.

---

## 6) Low findings / hygiene

1. Add explicit dependency update cadence (monthly patch window + quarterly minor update window).
2. Add `npm audit` gating threshold in CI (e.g., fail on high/critical in prod deps).
3. Add a security regression checklist to PR template (auth/session, CORS, uploads, logging).

---

## 7) Prioritized remediation plan

## Phase A (this week)
1. Remove token-in-URL callback behavior.
2. Remove FE localStorage bearer-token auth path; rely on secure cookies.
3. Add strict rate limits to `/api/auth/service` and `/api/mcp/auth`.
4. Start dependency patch wave for FE high-risk libs (`axios`, router stack, `js-cookie`).

## Phase B (next 1–2 weeks)
1. Patch BE high-risk libs (`express`, `express-rate-limit`, `mongoose`, relevant transitives).
2. Lock down Key Vault network ACL from `Allow` to restricted model.
3. Remove legacy CORS origins post-cutover.
4. Hard-disable Swagger in production public surface.

## Phase C (next 2–4 weeks)
1. Add route-security automated tests (public vs protected route matrix).
2. Add SIEM/alerts for auth-service endpoint abuse patterns.
3. Finalize privacy/log redaction policy and retention controls.

---

## 8) Final verdict

**Not “all KO” yet — but very close to a strong posture with focused work.**

Your platform already has solid security building blocks and a credible Azure hardening direction. The biggest gap is **session/token handling** plus **dependency backlog**. If we execute Phase A + B, security posture improves materially without large architecture disruption.

---

## 9) Suggested next deliverable

I can produce a follow-up **implementation patch plan** (file-by-file, command-by-command) to execute the top 4 high findings with minimal production risk and rollback notes.