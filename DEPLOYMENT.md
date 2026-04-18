# Deployment Guide for Render

This guide covers deploying all backend services (API, Events, Execution) on Render.

## Prerequisites

- Render account
- PostgreSQL database on Render
- Redis instance on Render (for Redis URL)

## Service Configuration

### 1. API Service (Web Service)

**Service Type:** Web Service

**Configuration:**
- **Root Directory:** `.` (repository root)
- **Dockerfile Path:** `apps/api/Dockerfile`
- **Environment:** Node
- **Port:** 4000 (auto-assigned by Render)

**Environment Variables:**
```
DATABASE_URL=<your-postgresql-connection-string>
REDIS_URL=<your-redis-connection-string>
JWT_ACCESS_SECRET=<your-jwt-secret>
JWT_REFRESH_SECRET=<your-refresh-secret>
ENCRYPTION_SECRET=<your-encryption-secret>
FRONTEND_URL=https://fullstack-assignment-numatix-tillu0.vercel.app
# Or for multiple origins: FRONTEND_URL=https://domain1.com,https://domain2.com
NODE_ENV=production
PORT=4000
```

**Important:** Set `FRONTEND_URL` to your Vercel frontend URL (e.g., `https://fullstack-assignment-numatix-tillu0.vercel.app`) to allow CORS requests.

**Health Check:** `GET /health`

---

### 2. Events Service (Web Service)

**Service Type:** Web Service

**Configuration:**
- **Root Directory:** `.` (repository root)
- **Dockerfile Path:** `apps/events/Dockerfile`
- **Environment:** Node
- **Port:** 5000 (auto-assigned by Render)

**Environment Variables:**
```
DATABASE_URL=<your-postgresql-connection-string>
REDIS_URL=<your-redis-connection-string>
JWT_SECRET=<your-jwt-secret>
# OR use JWT_ACCESS_SECRET if you prefer
JWT_ACCESS_SECRET=<your-jwt-secret>
FRONTEND_URL=https://fullstack-assignment-numatix-tillu0.vercel.app
# Or for multiple origins: FRONTEND_URL=https://domain1.com,https://domain2.com
NODE_ENV=production
PORT=5000
```

**Important:** Set `FRONTEND_URL` to your Vercel frontend URL to allow WebSocket connections from the frontend.

**Health Check:** `GET /health`

**Important:** This service exposes a WebSocket server. After deployment, update your frontend's `NEXT_PUBLIC_WS_URL` to point to this service's URL (e.g., `wss://events-service.onrender.com`).

---

### 3. Execution Service (Background Worker)

**Service Type:** Background Worker

**Configuration:**
- **Root Directory:** `.` (repository root)
- **Dockerfile Path:** `apps/execution/Dockerfile`
- **Environment:** Node

**Environment Variables:**
```
DATABASE_URL=<your-postgresql-connection-string>
REDIS_URL=<your-redis-connection-string>
BINANCE_TESTNET_URL=https://testnet.binance.vision
ENCRYPTION_SECRET=<your-encryption-secret>
NODE_ENV=production
```

**Important:** 
- This is a **Background Worker**, not a Web Service
- It does NOT expose an HTTP port
- It subscribes to Redis for order commands and processes them

---

## Step-by-Step Deployment Instructions

### Deploy Events Service

1. **Create New Web Service** on Render
2. **Connect your repository**
3. **Configure the service:**
   - **Name:** `trading-events` (or your preferred name)
   - **Root Directory:** `.` (dot - repository root)
   - **Dockerfile Path:** `apps/events/Dockerfile`
   - **Environment:** Node
   - **Region:** Choose your preferred region
4. **Add Environment Variables** (see above)
5. **Deploy**

### Deploy Execution Service

1. **Create New Background Worker** on Render
2. **Connect your repository**
3. **Configure the service:**
   - **Name:** `trading-execution` (or your preferred name)
   - **Root Directory:** `.` (dot - repository root)
   - **Dockerfile Path:** `apps/execution/Dockerfile`
   - **Environment:** Node
   - **Region:** Choose your preferred region
4. **Add Environment Variables** (see above)
5. **Deploy**

---

## Important Notes

### Root Directory
- **Always use `.` (dot)** for Root Directory
- This is because the Dockerfiles need access to:
  - Root `package.json`
  - `pnpm-workspace.yaml`
  - `pnpm-lock.yaml`
  - `packages/typescript-config/`

### Dockerfile Path
- **Events Service:** `apps/events/Dockerfile`
- **Execution Service:** `apps/execution/Dockerfile`
- **API Service:** `apps/api/Dockerfile`

### Database Migrations
Run migrations after deploying:
```bash
# For each service, run migrations
cd apps/api && pnpm run migrate
cd apps/events && pnpm run migrate
cd apps/execution && pnpm run migrate
```

Or use Render's **Pre-Deploy Command** (optional):
- **Pre-Deploy Command:** `cd apps/events && pnpm exec prisma migrate deploy`

### Service URLs
After deployment, you'll get URLs like:
- API: `https://api-service.onrender.com`
- Events: `https://events-service.onrender.com` (WebSocket: `wss://events-service.onrender.com`)

Update your frontend `.env`:
```
NEXT_PUBLIC_API_URL=https://api-service.onrender.com
NEXT_PUBLIC_WS_URL=wss://events-service.onrender.com
```

---

## Troubleshooting

### Build Fails
- Ensure Root Directory is `.` (not `apps/events` or `apps/execution`)
- Ensure Dockerfile Path is correct
- Check that all required files exist in the repository

### Runtime Errors
- Verify all environment variables are set
- Check service logs in Render dashboard
- Ensure database and Redis are accessible from Render

### Prisma Client Errors
- The Dockerfiles automatically generate Prisma Client during build
- If you see Prisma errors, check that `DATABASE_URL` is set (even a dummy URL works for generation)

---

## Quick Reference

| Service | Type | Root Dir | Dockerfile | Port |
|---------|------|----------|------------|------|
| API | Web Service | `.` | `apps/api/Dockerfile` | 4000 |
| Events | Web Service | `.` | `apps/events/Dockerfile` | 5000 |
| Execution | Background Worker | `.` | `apps/execution/Dockerfile` | N/A |

