# Multi-stage Dockerfile for API Gateway
# Uses Node 20 Alpine for smaller image size

# Stage 1: Dependencies
FROM node:20-alpine AS deps

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Install build dependencies for native modules (bcrypt, etc.)
# These are needed to compile native Node.js modules
RUN apk add --no-cache python3 make g++

# Set working directory
WORKDIR /app

# Copy workspace configuration files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy package.json files for workspace resolution
COPY packages/typescript-config/package.json ./packages/typescript-config/
COPY apps/api/package.json ./apps/api/

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

# Copy source code and config files
# packages/typescript-config: needed for TypeScript config extends
COPY packages/typescript-config ./packages/typescript-config
# apps/api: the main service (all source files, tsconfig, prisma, etc.)
COPY apps/api ./apps/api
# Root workspace files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Build the API service (generates Prisma client and compiles TypeScript)
WORKDIR /app/apps/api
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
RUN pnpm run build

# Stage 3: Runner
FROM node:20-alpine AS runner

# Install build dependencies for native modules (bcrypt needs to be compiled)
# These are needed even for production install if native modules need rebuilding
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Install pnpm for runtime (needed for workspace resolution)
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace config files
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/pnpm-lock.yaml ./

# Copy package.json files for workspace resolution
COPY --from=builder /app/apps/api/package.json ./apps/api/

# Copy Prisma schema (needed for Prisma client generation)
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma

# Copy built API service
COPY --from=builder /app/apps/api/dist ./apps/api/dist

# Install dependencies (including devDependencies temporarily for Prisma generation)
# Native modules like bcrypt will be compiled during install
RUN pnpm install --frozen-lockfile --prod=false

# Generate Prisma client in runner stage
WORKDIR /app/apps/api
RUN pnpm exec prisma generate

# Reinstall with only production dependencies to reduce image size
WORKDIR /app
RUN pnpm install --frozen-lockfile --prod

# Expose port (configurable via PORT env var)
EXPOSE 4000

# Set working directory to API service
WORKDIR /app/apps/api

# Run the service
CMD ["node", "dist/index.js"]
