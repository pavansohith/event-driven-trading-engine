# Multi-stage Dockerfile for Execution Service
# Uses Node 20 Alpine for smaller image size

# Stage 1: Dependencies
FROM node:20-alpine AS deps

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Set working directory
WORKDIR /app

# Copy workspace configuration files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy package.json files for workspace resolution
COPY packages/typescript-config/package.json ./packages/typescript-config/
COPY apps/execution/package.json ./apps/execution/

# Install dependencies
RUN pnpm install --frozen-lockfile --prod=false

# Stage 2: Builder
FROM node:20-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/apps ./apps

# Copy source code and config
# packages/typescript-config: needed for TypeScript config extends
COPY packages/typescript-config ./packages/typescript-config
# apps/execution: the main service (all source files, tsconfig, prisma, etc.)
COPY apps/execution ./apps/execution
# Root workspace files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Build the execution service (generates Prisma client and compiles TypeScript)
WORKDIR /app/apps/execution
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
RUN pnpm run build

# Stage 3: Runner
FROM node:20-alpine AS runner

WORKDIR /app

# Install pnpm for runtime (needed for workspace resolution)
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace config
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/pnpm-lock.yaml ./

# Copy package.json files for workspace resolution
COPY --from=builder /app/apps/execution/package.json ./apps/execution/

# Copy Prisma schema (needed for Prisma client generation)
COPY --from=builder /app/apps/execution/prisma ./apps/execution/prisma

# Copy built execution service
COPY --from=builder /app/apps/execution/dist ./apps/execution/dist

# Install dependencies (including devDependencies temporarily for Prisma generation)
RUN pnpm install --frozen-lockfile --prod=false

# Generate Prisma client in runner stage
WORKDIR /app/apps/execution
RUN pnpm exec prisma generate

# Reinstall with only production dependencies to reduce image size
WORKDIR /app
RUN pnpm install --frozen-lockfile --prod

# Set working directory to execution service
WORKDIR /app/apps/execution

# Run the service
CMD ["node", "dist/index.js"]
