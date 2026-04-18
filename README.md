# 🚀 Real-Time Trading Platform (Binance Testnet)

A full-stack, event-driven trading platform built as part of the **Numatix Fullstack Developer Assignment**.  
This project demonstrates **distributed backend architecture**, **real-time data streaming**, and a **modern trading UI** using Binance Testnet.

> ⚠️ **Testnet only** — No real funds involved. For evaluation & learning purposes.

---

## 🧠 Key Highlights

- ⚡ Event-driven microservices architecture  
- 🔁 Redis pub/sub command & event bus  
- 📡 Real-time WebSocket updates  
- 📊 Trading charts with `lightweight-charts`  
- 🔐 JWT authentication + encrypted API keys  
- 🧩 Turborepo monorepo setup  
- 🐳 Dockerized backend services  
- ☁️ Deployed on Render (backend) & Vercel (frontend)

---

## 🏗️ Architecture Overview

The system is split into independent services:

- **Frontend** – Next.js trading UI  
- **API Gateway** – Auth + order intake  
- **Execution Service** – Executes orders on Binance Testnet  
- **Events Service** – Fan-out order updates via WebSocket  
- **Redis** – Message bus  
- **PostgreSQL** – Persistent store (via Prisma)

### 🔄 Event-Driven Flow

┌─────────────────┐ HTTP ┌─────────────────┐
│ Frontend │──────────────▶│ API Gateway │
│ (Next.js) │ │ (Express) │
└────────┬────────┘ └────────┬────────┘
│ │
│ WebSocket │ Publish
│ Order Updates │ Order Command
│ ▼
┌────────┴────────┐ Subscribe ┌─────────────────┐
│ Events │◀───────────────│ Redis │
│ Service │ │ (Pub/Sub Bus) │
│ (WebSocket) │───────────────▶│ │
└─────────────────┘ Order Events └────────┬────────┘
│
│ Subscribe
▼
┌─────────────────┐
│ Execution │
│ Service │
│ (Worker) │
│ │
│ → Binance │
│ Testnet API │
└────────┬────────┘
│
▼
┌─────────────────┐
│ PostgreSQL │
│ (via Prisma) │
│ │
│ • Users │
│ • Orders │
│ • Order Events │
└─────────────────┘


### 🎯 Why this Architecture?

- **Separation of Concerns** – API Gateway never executes trades directly.  
- **Event-driven design** – Redis decouples services and enables async execution.  
- **Scalability** – Execution workers and WebSocket services scale independently.  
- **Fault isolation** – One service failing won't crash the entire system.  
- **Real-time updates** – WebSocket ensures immediate UI feedback.

---

## 🗂️ Monorepo Structure

```
.
├── apps/
│   ├── api/                    # API Gateway (Express + JWT)
│   │   ├── Dockerfile          # Docker configuration for Render deployment
│   │   ├── src/                # TypeScript source files
│   │   │   ├── index.ts        # Express server entry point
│   │   │   ├── lib/
│   │   │   │   └── prisma.ts   # Prisma client singleton
│   │   │   ├── routes/         # API routes (auth, trading)
│   │   │   ├── middleware/     # Auth & rate limiting
│   │   │   ├── schemas/        # Zod validation schemas
│   │   │   └── utils/          # Utility functions (crypto)
│   │   ├── prisma/
│   │   │   └── schema.prisma   # Prisma schema (User, OrderCommand, OrderEvent)
│   │   ├── dist/               # Compiled JavaScript output
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── execution/              # Order execution worker (Background Worker)
│   │   ├── Dockerfile          # Docker configuration for Render deployment
│   │   ├── src/                # TypeScript source files
│   │   │   ├── index.ts        # Redis subscriber entry point
│   │   │   ├── lib/
│   │   │   │   └── prisma.ts   # Prisma client singleton
│   │   │   ├── binance.ts      # Binance API integration
│   │   │   └── crypto.ts        # Encryption utilities
│   │   ├── prisma/
│   │   │   └── schema.prisma   # Prisma schema
│   │   ├── dist/               # Compiled JavaScript output
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── events/                 # WebSocket event broadcaster
│   │   ├── Dockerfile          # Docker configuration for Render deployment
│   │   ├── src/                # TypeScript source files
│   │   │   ├── index.ts        # WebSocket server entry point
│   │   │   └── lib/
│   │   │       └── prisma.ts   # Prisma client singleton
│   │   ├── prisma/
│   │   │   └── schema.prisma   # Prisma schema
│   │   ├── dist/               # Compiled JavaScript output
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── web/                    # Next.js frontend
│       ├── app/                # Next.js App Router
│       │   ├── layout.tsx
│       │   ├── page.tsx        # Home page
│       │   ├── login/          # Login page
│       │   ├── signup/         # Signup page
│       │   └── trade/          # Trading pages
│       ├── components/         # React components
│       │   ├── Header.tsx
│       │   ├── Sidebar.tsx
│       │   ├── OrderPanel.tsx
│       │   ├── TradingChart.tsx
│       │   └── ...
│       ├── hooks/              # Custom React hooks
│       │   ├── useAuth.ts
│       │   ├── useWebSocket.ts
│       │   └── ...
│       ├── lib/                # Client-side utilities
│       │   ├── api.ts          # Axios instance with API_URL
│       │   ├── auth.ts         # Authentication functions
│       │   ├── trading.ts      # Trading API functions
│       │   └── websocket.ts    # WebSocket utilities
│       ├── public/             # Static assets
│       ├── .env.example        # Environment variables template
│       ├── package.json
│       ├── next.config.js
│       ├── tsconfig.json
│       └── vercel.json         # Vercel deployment config
│
├── packages/                   # Shared packages
│   ├── typescript-config/      # Shared TypeScript configurations
│   │   ├── base.json
│   │   ├── nextjs.json
│   │   └── react-library.json
│   └── eslint-config/         # Shared ESLint configurations
│       ├── base.js
│       ├── next.js
│       └── react-internal.js
│
├── scripts/
│   └── postinstall.js          # Postinstall hook (no-op after refactor)
│
├── package.json                # Root package.json (workspace config)
├── pnpm-workspace.yaml         # pnpm workspace configuration
├── pnpm-lock.yaml              # pnpm lockfile
├── turbo.json                  # Turborepo configuration
├── render.yaml                 # Render deployment configuration
├── docker-compose.yml          # Local development Docker setup
├── DEPLOYMENT.md               # Deployment guide for Render
└── README.md                   # This file
```

### 📝 Key Changes from Initial Structure

- **Each service has its own Prisma setup** – No shared `packages/db` package
- **Each service has its own Dockerfile** – Independent deployment on Render
- **Frontend has `.env.example`** – Documents required environment variables
- **Shared packages** – `typescript-config` and `eslint-config` for code consistency


Each backend service:
- Has its **own Prisma schema**
- Maintains a **Prisma singleton per service**
- Connects to the same `DATABASE_URL`

---

## 🧰 Tech Stack

### Backend
- **Node.js** + **TypeScript**
- **Express.js** – API Gateway
- **Redis** (ioredis) – Message bus
- **Prisma ORM** + **PostgreSQL** – Database layer
- **JWT authentication** – Stateless sessions
- **bcrypt** – Password hashing
- **Node crypto** – API key encryption
- **Binance Testnet API** – Trading execution

### Frontend
- **Next.js 14** (App Router)
- **TypeScript** – Type safety
- **Tailwind CSS** – Styling
- **lightweight-charts** – Trading charts
- **Native WebSocket** – Real-time updates
- **React Icons** – Iconography
- **Framer Motion** – Animations

### Tooling & Infrastructure
- **Turborepo** + **pnpm** – Monorepo management
- **Docker** – Containerization
- **Render** – Backend hosting
- **Vercel** – Frontend hosting
- **GitHub Actions** – CI/CD (optional)

---

## 🔐 Authentication & Security

Authentication Flow:

User login → JWT tokens generated

Tokens stored in HTTP-only cookies

API Gateway validates tokens

Refresh token rotation for security


**Security Features:**
- **JWT access & refresh tokens** in HTTP-only cookies
- **Passwords hashed** with bcrypt (12 rounds)
- **Binance API keys**:
  - Encrypted using AES-256-GCM before storage
  - Decrypted only in Execution service
  - Never logged or exposed
- **Protected API routes** & WebSocket handshake validation
- **CORS configuration** – Restricted origins
- **Rate limiting** – Per endpoint/user

---

## 🔁 Order Lifecycle

User places order from UI
↓

API Gateway validates JWT & input
↓

API publishes command → Redis
↓

Execution Service (subscriber):
• Fetches user's encrypted keys
• Decrypts keys in memory
• Calls Binance Testnet API
↓

Execution publishes result → Redis
↓

Events Service pushes update via WebSocket
↓

Frontend updates UI in real-time


**Order States:** `PENDING` → `FILLED` / `REJECTED` / `CANCELLED`

---

## 🗃️ Database Models

### Core Models:

```prisma
model User {
  id            String    @id @default(uuid())
  email         String    @unique
  passwordHash  String
  firstName     String
  lastName      String
  binanceApiKey String    @db.Text  // Encrypted
  binanceSecret String    @db.Text  // Encrypted
  orders        OrderCommand[]
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

model OrderCommand {
  id          String    @id @default(uuid())
  userId      String
  user        User      @relation(fields: [userId], references: [id])
  symbol      String    // e.g., "BTCUSDT"
  side        String    // "BUY" or "SELL"
  quantity    Float
  price       Float?
  orderType   String    // "MARKET" or "LIMIT"
  status      String    @default("PENDING")
  createdAt   DateTime  @default(now())
  orderEvents OrderEvent[]
}

model OrderEvent {
  id              String    @id @default(uuid())
  orderCommandId  String
  orderCommand    OrderCommand @relation(fields: [orderCommandId], references: [id])
  eventType       String    // "EXECUTED", "REJECTED", "PARTIALLY_FILLED"
  binanceOrderId  String?
  executedPrice   Float?
  executedQty     Float?
  commission      Float?
  commissionAsset String?
  timestamp       DateTime  @default(now())
}

Database Usage:

Order history – Track all user transactions

Position calculation – Real-time P&L

Auditing – Compliance and debugging

User management – Authentication state

📊 Frontend Features
🎨 UI/UX Features:
🔐 Login/Register – Modern dark theme with trading aesthetics

📈 Real-time BTC Chart – Multiple timeframes (1m, 5m, 1h, 1d, 1w)

💹 Live Price Ticker – Animated market data stream

🛒 Buy/Sell Orders – Market & limit orders

📜 Orders & Positions Table – Real-time updates

📡 WebSocket Connection – Live order execution updates

🌗 Dark/Light Mode – Theme switching

📱 Responsive Design – Mobile-first approach

⚡ Instant Feedback – Order confirmation animations

Technical Features:
Server-side Rendering – Fast initial load

Client-side State – React Context for user data

WebSocket Reconnection – Automatic reconnection logic

Error Boundaries – Graceful error handling

Loading States – Skeleton screens during async ops

# Database
DATABASE_URL="postgresql://user:password@host:5432/dbname"

# Redis
REDIS_URL="redis://localhost:6379"

# JWT Secrets (64-bit+ recommended)
JWT_ACCESS_SECRET="your-access-secret-here"
JWT_REFRESH_SECRET="your-refresh-secret-here"

# Encryption
ENCRYPTION_SECRET="32-byte-encryption-key-for-aes-256"

# Binance
BINANCE_BASE_URL="https://testnet.binance.vision"

# Service URLs (for inter-service communication)
API_GATEWAY_URL="http://localhost:4000"
EVENTS_SERVICE_URL="http://localhost:5000"
EXECUTION_SERVICE_URL="http://localhost:6000"

# API Endpoints
NEXT_PUBLIC_API_URL="http://localhost:4000"
NEXT_PUBLIC_WS_URL="ws://localhost:5000/ws"

# App Configuration
NEXT_PUBLIC_APP_NAME="TradePro"
NEXT_PUBLIC_DEFAULT_SYMBOL="BTCUSDT"

🐳 Local Development
Prerequisites:
Node.js 18+

Docker & Docker Compose

pnpm 8+

Redis 7+

PostgreSQL 15+

# Clone repository
git clone <repository-url>
cd trading-platform

# Install dependencies
pnpm install

# Start development
pnpm dev

# Start all services
docker-compose up --build

# Services available at:
# - Frontend: http://localhost:3000
# - API Gateway: http://localhost:4000
# - Events WS: ws://localhost:5000/ws
# - PostgreSQL: localhost:5432
# - Redis: localhost:6379

# 1. Start Redis & PostgreSQL
# 2. Set up environment variables
# 3. Run database migrations
pnpm db:push  # For each service

# 4. Start services in order:
pnpm --filter api dev        # Port 4000
pnpm --filter events dev     # Port 5000
pnpm --filter execution dev  # Port 6000
pnpm --filter web dev        # Port 3000

# Automatic deployment from main branch
vercel --prod

# Environment variables in Vercel dashboard:
# NEXT_PUBLIC_API_URL = https://api.yourdomain.com
# NEXT_PUBLIC_WS_URL = wss://events.yourdomain.com/ws

# Render Blueprint (render.yaml)
services:
  - type: web
    name: api-gateway
    env: node
    buildCommand: cd apps/api && pnpm install && pnpm build
    startCommand: cd apps/api && pnpm start
    envVars:
      - key: DATABASE_URL
        sync: false
      - key: REDIS_URL
        sync: false

  - type: web
    name: events-service
    env: node
    buildCommand: cd apps/events && pnpm install && pnpm build
    startCommand: cd apps/events && pnpm start

  - type: worker
    name: execution-service
    env: node
    buildCommand: cd apps/execution && pnpm install && pnpm build
    startCommand: cd apps/execution && pnpm start

    Database & Redis:
PostgreSQL: Render PostgreSQL or AWS RDS

Redis: Redis Cloud or Upstash

Connection: All services use environment variables for connections

 Demo & Live Deployment
Live Links:
🌐 Frontend: https://fullstack-assignment-numatix-tillu0.vercel.app/login

🔗 API Gateway: https://fullstack-assignment-numatix-tillu002-2.onrender.com

📡 WebSocket: wss://events-service.onrender.com/ws

Demo Credentials (Testnet):
text
Email: demo@trader.com
Password: Demo@123
Video Demo:
https://img.youtube.com/vi/VIDEO_ID/0.jpg

