# Hotel Booking Backend - .env.development Documentation

This document captures the exact contents of the .env.development file as of the current release. Use this for reference, backup, or redeployment.

---

```
# Backend - Development (local)
NODE_ENV=development
PORT=5000

# Database
MONGODB_CONNECTION_STRING=REDACTED

# Security
JWT_SECRET_KEY=6OqLG97ftuaq85gdOm5FhbuWecTIELPMd8zeAQFZ37FODb2/j4QCqGVXWNBdgAC38+JnZHq02WHJqKcdSHVZQJODqPbJwTaEj/f2cWGS1gCWL2wuZvnLZN1QCs1OHfoPo8cyZCruRWlh317MfX3iWqiQ4AD347jawIAkmwkxx1MWEbv5AdNyz9ycP+bnbcgXstUhuYmwvjEWCzYh36JXg1rKkEHIEVR9qm+VT7RPNlJqM8BDzDYr5iitHpUEJ7RZvh+BsXl5ACEAOP05PKr69XMmqgH0n8JvlDDbbDjd9pu4UUGdzbaDmM/2YPVKspKa8fDQex8OaLG4E9YVPwrrnIb/FR6nXUTJ8D7KxINzHUiDZYTxPP1TFKmc0S/k/BWEmYURsbPg8qtMKKwx2Uil0brTr+zqzKY+322cYiU5gtHcxrId5e2l1Cl2sAd9Z5EQdn8ZtHPv29qBLTiwhBKF9uz2aYVbDi8LbGI6yWYd81CyLS6bwQYOPJwloZecu4HHV1OHYz46CoJmRHFritEFaTrkDZKd+42/qw/1pqalif3vTmhXL2hj3UVlDUxmnwFVuIpxUniGs4nUB0AstQxHRYIOTVWPfeHpKWncc8HR/AgmiBbRVFahfN7VLJ4DOrcmzL9SVSemd74bv07xAVses5jeSzeCe/Fr9js6ohREuoE=

# CORS / URLs
FRONTEND_URL=http://localhost:5174
FRONTEND_URLS=http://localhost:5174,http://localhost:5173
BACKEND_URL=http://localhost:5000

# Microsoft Entra ID OAuth
MS_ENTRA_CLIENT_ID=b1b3eed8-b0cb-4147-97a5-36f917823b  55c
MS_ENTRA_CLIENT_SECRET=REDACTED
MS_ENTRA_TENANT_ID=f0b2f579-2f09-4daf-839f-abf49b0d8dcc
MS_BOOKINGS_EXCEL_DRIVE_ID=b!HZMag8kxokWp-r32DQT1ubXBmaxGQ8xGmtgYolH3FJT36HDtdXgKTLHQskTAjzAZ
MS_BOOKINGS_EXCEL_ITEM_ID=01VYPQFC6OTMJCPZTN5VFIGVV5HG6NOBWX
MS_BOOKINGS_EXCEL_SHEET_NAME=Ricavi

# Azure OpenAI booking extraction
AZURE_OPENAI_ENDPOINT=https://prd-open-ai-pp-01.openai.azure.com/
AZURE_OPENAI_API_KEY=REDACTED
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-5-mini
AZURE_OPENAI_API_VERSION=2024-12-01-preview

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Stripe
STRIPE_API_KEY=your_stripe_secret_key_here

SINGLE_PROPERTY_MODE=true
BOOKING_COM_SYNC_ENABLED=false
```

---

**Note:**
- This file contains sensitive credentials. Store securely and do not share publicly.
- For redeployment, copy these values into your .env.development file.
