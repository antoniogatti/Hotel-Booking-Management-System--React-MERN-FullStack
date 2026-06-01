# MCP Agent Playbook (Palazzo Pinto)

This document is copy-paste ready for your agent setup.

## 1) Purpose
Use MCP with two clear booking operations:
- `availability.check`: check room availability for dates and guests.
- `bookings.verify`: fetch and verify booking details when you have `bookingId` or `bookingRef`.

## 2) Base URL and Endpoints
Base URL:
- `https://api.palazzopintobnb.com/mcp`

Endpoints:
- `GET /mcp` -> tool discovery
- `POST /mcp/auth` -> returns JWT token
- `POST /mcp/execute` -> executes one tool

## 3) Authentication Contract
Request:

```json
{
  "client_id": "YOUR_CLIENT_ID",
  "client_secret": "YOUR_CLIENT_SECRET",
  "tenant": "YOUR_TENANT_ID"
}
```

Response:

```json
{
  "token": "JWT_TOKEN",
  "expiresIn": 43200
}
```

Use token in header:
- `Authorization: Bearer <JWT_TOKEN>`

## 4) Tool Discovery Contract
`GET /mcp` response includes tools such as:
- `health`
- `rooms.search`
- `availability.check`
- `bookings.verify`

Note:
- `bookings.createTest` is development-only helper, not for production teaching flows.

## 5) Tool Definitions

### A) availability.check
Use when user asks:
- "Is it available from X to Y for N people?"

Request envelope:

```json
{
  "tool": "availability.check",
  "params": {
    "checkIn": "2026-07-13",
    "checkOut": "2026-07-16",
    "adultCount": 2,
    "childCount": 0
  }
}
```

Required params:
- `checkIn`
- `checkOut`

Optional params:
- `adultCount` (default 1)
- `childCount` (default 0)


Response shape:

```json
{
  "available": [
    {
      "_id": "...",
      "name": "...",
      "city": "...",
      "country": "..."
    }
  ],
  "unavailable": [
    {
      "hotel": { "_id": "...", "name": "..." },
      "conflict": {
        "_id": "...",
        "reservationNumber": "...",
        "status": "pending"
      }
    }
  ],
  "requested": {
    "checkIn": "2026-07-13T00:00:00.000Z",
    "checkOut": "2026-07-16T00:00:00.000Z",
    "adults": 2,
    "children": 0
  },
  "totalAvailable": 1
}
```

### B) bookings.verify
Use when user asks:
- "Check this booking"
- "I have booking id/ref, show details"

Request envelope:

```json
{
  "tool": "bookings.verify",
  "params": {
    "bookingId": "OPTIONAL_BOOKING_ID",
    "bookingRef": "OPTIONAL_BOOKING_REF",
    "checkAvailability": true,
    "includePayments": true
  }
}
```

Rules:
- At least one of `bookingId` or `bookingRef` is required.

Response shape:

```json
{
  "verified": true,
  "booking": {
    "_id": "...",
    "reservationNumber": "...",
    "status": "pending",
    "checkIn": "2026-07-13T00:00:00.000Z",
    "checkOut": "2026-07-16T00:00:00.000Z"
  },
  "paymentStatus": null,
  "conflicts": [],
  "notes": []
}
```

Common error cases:
- `400` -> missing `bookingId`/`bookingRef`
- `404` -> booking not found

## 6) Agent Routing Logic (Decision Policy)
Use this exact policy:
1. If user asks availability by date/guests -> call `availability.check`.
2. If user gives booking id/ref and asks details/status -> call `bookings.verify`.
3. If tool name is unclear -> call discovery (`GET /mcp`) first.
4. If auth fails (401) -> refresh token.
5. If booking is not found (404) -> ask user to confirm booking id/ref.
6. If no availability -> propose alternative dates or lower constraints.

## 7) Validation Rules Before Calls
For `availability.check`:
- `checkIn` and `checkOut` must be valid ISO dates.
- `checkOut` must be strictly greater than `checkIn`.
- `adultCount` >= 1.
- `childCount` >= 0.

For `bookings.verify`:
- Ensure at least one between `bookingId` and `bookingRef` is present.

## 8) PowerShell Quick Commands

### 8.1 Get token
```powershell
$r = Invoke-RestMethod -Uri https://api.palazzopintobnb.com/mcp/auth -Method Post -Body (@{
  client_id = $env:MCP_CLIENT_ID
  client_secret = $env:MCP_CLIENT_SECRET
  tenant = $env:MCP_TENANT_ID
} | ConvertTo-Json) -ContentType "application/json"

$token = $r.token
```

### 8.2 Check availability (13-16 Jul 2026, 2 adults)
```powershell
Invoke-RestMethod -Uri https://api.palazzopintobnb.com/mcp/execute -Method Post -Headers @{
  Authorization = "Bearer $token"
} -Body (@{
  tool = "availability.check"
  params = @{
    checkIn = "2026-07-13"
    checkOut = "2026-07-16"
    adultCount = 2
    childCount = 0
  }
} | ConvertTo-Json -Depth 5) -ContentType "application/json"
```

### 8.3 Verify booking by id
```powershell
Invoke-RestMethod -Uri https://api.palazzopintobnb.com/mcp/execute -Method Post -Headers @{
  Authorization = "Bearer $token"
} -Body (@{
  tool = "bookings.verify"
  params = @{
    bookingId = "PUT_BOOKING_ID_HERE"
    checkAvailability = $true
    includePayments = $true
  }
} | ConvertTo-Json -Depth 5) -ContentType "application/json"
```

### 8.4 Verify booking by reference
```powershell
Invoke-RestMethod -Uri https://api.palazzopintobnb.com/mcp/execute -Method Post -Headers @{
  Authorization = "Bearer $token"
} -Body (@{
  tool = "bookings.verify"
  params = @{
    bookingRef = "PUT_BOOKING_REF_HERE"
    checkAvailability = $true
    includePayments = $true
  }
} | ConvertTo-Json -Depth 5) -ContentType "application/json"
```

## 9) Copy-Paste Prompt for Your Agent

```text
You are a booking operations agent for Palazzo Pinto using MCP.

Always authenticate first with POST /mcp/auth and use Bearer token for /mcp/execute.

Routing rules:
- For date + pax availability questions, call tool "availability.check".
- For booking details/status with bookingId or bookingRef, call tool "bookings.verify".

Input checks:
- checkIn/checkOut must be valid dates.
- checkOut > checkIn.
- adultCount >= 1.
- For bookings.verify, require bookingId or bookingRef.

Error handling:
- On 401, refresh token and retry once.
- On 404 booking not found, ask user to confirm bookingId/ref.
- On zero availability, provide alternatives (new dates or constraints).

Response format to user:
1) Short summary
2) Structured result
3) Recommended next action
```

## 10) Security and Ops Notes
- Do not hardcode secrets in prompts or code.
- Keep `client_secret` in secure env vars only.
- Treat JWT as sensitive.
- Use `GET /mcp` discovery if tool set changes.
- Development-only helpers must never be used in production flows.
