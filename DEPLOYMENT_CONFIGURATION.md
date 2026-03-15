# Deployment Configuration (Development + Production)

This project now supports two explicit environment profiles:
- Local development for testing on your machine
- Production deployment for Azure Web App

## 1) Local Development

### Backend
1. Copy `hotel-booking-backend/.env.development.example` to `hotel-booking-backend/.env.development`.
2. Fill all values.
3. Run backend with the development profile:

```bash
cd hotel-booking-backend
npm run dev:local
```

### Frontend
1. Copy `hotel-booking-frontend/.env.development.example` to `hotel-booking-frontend/.env.development`.
2. Adjust values if needed.
3. Run frontend locally:

```bash
cd hotel-booking-frontend
npm run dev
```

## 2) Production Deployment (Azure Web App)

Current apps:
- Backend: `palazzopinto-api-2603151048`
- Frontend: `palazzopinto-web-2603151048`
- Shared plan: `palazzopinto-free-plan` (`F1`)
- Resource group: `PalazzoPintoBnB`

### Backend production settings
Set app settings on the backend web app:

```bash
az webapp config appsettings set \
  --resource-group PalazzoPintoBnB \
  --name palazzopinto-api-2603151048 \
  --settings \
  NODE_ENV=production \
  MONGODB_CONNECTION_STRING="<your-prod-connection-string>" \
  JWT_SECRET_KEY="<your-jwt-secret>" \
  FRONTEND_URL="https://palazzopinto-web-2603151048.azurewebsites.net" \
  FRONTEND_URLS="https://palazzopinto-web-2603151048.azurewebsites.net" \
  BACKEND_URL="https://palazzopinto-api-2603151048.azurewebsites.net" \
  MS_ENTRA_CLIENT_ID="<entra-client-id>" \
  MS_ENTRA_CLIENT_SECRET="<entra-client-secret>" \
  MS_ENTRA_TENANT_ID="<tenant-id-or-common>" \
  CLOUDINARY_CLOUD_NAME="<cloud-name>" \
  CLOUDINARY_API_KEY="<cloud-key>" \
  CLOUDINARY_API_SECRET="<cloud-secret>" \
  STRIPE_API_KEY="<stripe-secret-key>"
```

### Frontend production settings
For Vite frontend, `VITE_*` variables are build-time values. Build with `.env.production` and deploy built assets.

1. Copy `hotel-booking-frontend/.env.production.example` to `hotel-booking-frontend/.env.production`.
2. Set `VITE_API_BASE_URL` to your backend app URL.
3. Build:

```bash
cd hotel-booking-frontend
npm run build:prod
```

### Backend start command on Azure
Ensure startup command points to compiled entrypoint:

```bash
node dist/hotel-booking-backend/src/index.js
```

## 3) OAuth Redirects Checklist

In Microsoft Entra app registration:
- Add backend callback URL:
  - `https://palazzopinto-api-2603151048.azurewebsites.net/api/auth/callback/microsoft`
- Keep local callback for testing if needed:
  - `http://localhost:5000/api/auth/callback/microsoft`

## 4) Notes

- Never commit real `.env` files with secrets.
- Use `FRONTEND_URLS` if you add preview/custom domains.
- Local fallback behavior in frontend now expects `VITE_API_BASE_URL` for production builds.

## 5) CI/CD Pipeline (GitHub -> Azure Web App)

Automatic deployment on each push to `main` is configured in:

- `.github/workflows/deploy-main.yml`

### Required GitHub Secrets

Add these in repository settings -> Secrets and variables -> Actions:

- `AZURE_WEBAPP_PUBLISH_PROFILE_BACKEND`
- `AZURE_WEBAPP_PUBLISH_PROFILE_FRONTEND`

### How to get publish profiles

Run these commands and copy the XML output into the corresponding GitHub secret:

```bash
az webapp deployment list-publishing-profiles \
  --resource-group PalazzoPintoBnB \
  --name palazzopinto-api-2603151048

az webapp deployment list-publishing-profiles \
  --resource-group PalazzoPintoBnB \
  --name palazzopinto-web-2603151048
```

### Pipeline behavior

- Trigger: push on `main` (and manual `workflow_dispatch`)
- Backend job: install, build, deploy `hotel-booking-backend`
- Frontend job: install, build (`build:prod`), deploy `hotel-booking-frontend`
