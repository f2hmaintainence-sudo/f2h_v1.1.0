# ──────────────────────────────────────────────
# Stage 1: deps  — install all dependencies
# ──────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json* yarn.lock* ./
RUN npm install --frozen-lockfile

# ──────────────────────────────────────────────
# Stage 2: development — hot-reload dev server
# ──────────────────────────────────────────────
FROM node:20-alpine AS development
WORKDIR /app

# Copy installed node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Source is mounted via docker-compose volume at runtime (hot-reload)
EXPOSE 3000
ENV NODE_ENV=development

CMD ["npm", "run", "dev"]

# ──────────────────────────────────────────────
# Stage 3: builder — compile the production build
# ──────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production
RUN npm run build

# ──────────────────────────────────────────────
# Stage 4: production — lean final image
# ──────────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app

ENV NODE_ENV=production

# Only copy what next start needs
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

CMD ["node", "server.js"]
