# Palazzo Pinto B&B — Backend Layer

## 1. Purpose
The backend is the system's control plane. It exposes API routes for:
- authentication and user data
- hotel and room CRUD
- booking creation and management
- owner/admin tools
- self check-in
- Booking.com sync and enrichment jobs
- telemetry and traffic insights
- OneNote / Microsoft Graph integrations
- health and monitoring endpoints

## 2. Stack
From `hotel-booking-backend/package.json` the backend uses:
- **Express**
- **TypeScript**
- **MongoDB / Mongoose**
- **JWT authentication**
- **helmet**, **cors**, **compression**, **morgan**, **express-rate-limit**
- **swagger-jsdoc** and **swagger-ui-express**
- **cookie-parser**
- **node-ical** and scheduler scripts for calendar sync

## 3. Startup and runtime
`src/index.ts` is the main entry point.

What it does:
- validates required environment variables
- connects to MongoDB, with retry logic
- can fall back to in-memory Mongo for development when enabled
- initializes telemetry
- starts schedulers after DB connection succeeds
- configures security middleware, logging, compression, and rate limits
- mounts the route modules

## 4. Main route groups
The backend imports and serves these route families:
- `users`
- `auth`
- `my-hotels`
- `hotels`
- `my-bookings`
- `bookings`
- `health`
- `business-insights`
- `contact`
- `self-checkin`
- `booking-com-sync`
- `onenote`
- `scheduler-monitor`
- `mcp`
- `telemetry`
- `traffic-insights`

## 5. Security and platform behaviour
Important backend controls visible in `src/index.ts` and the security assessment:
- Helmet security headers
- HTTPS enforcement in production
- rate limiting on `/api/`
- production proxy trust handling
- structured request logging
- CORS origin handling
- DB connection retries
- telemetry initialization

## 6. Booking and hotel domain
The backend owns the business data model and workflow around:
- hotels / rooms
- bookings
- booking-day status / occupancy style records
- external calendar events
- self check-in submissions
- user roles
- audit logs

## 7. Background jobs and integrations
The backend is not only request/response.
It also runs scheduled or auxiliary jobs such as:
- Booking.com iCal sync
- booking enrichment scheduler
- room seeding and bootstrap scripts
- role setup utilities
- OneNote parsing/sync utilities
- Azure OpenAI booking extraction helpers

## 8. Development and deployment scripts
The backend package includes scripts for:
- development server
- production server
- seeding Palazzo Pinto room data
- Booking.com feed setup and sync
- database bootstrap
- cleanup and repair scripts
- role assignment helpers

## 9. Files worth reading next
- `src/index.ts`
- `src/routes/auth.ts`
- `src/routes/bookings.ts`
- `src/routes/self-checkin.ts`
- `src/routes/booking-com-sync.ts`
- `src/lib/booking-com-ical.ts`
- `src/lib/booking-enrichment-scheduler.ts`
- `src/lib/telemetry.ts`
- `src/swagger.ts`

## 10. Practical takeaway
The backend is the source of truth for business logic, auth, persistence, admin actions, and automated operational jobs.
