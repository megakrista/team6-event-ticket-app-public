# Build stage
FROM node:24-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Copy Prisma files (needed for postinstall prisma generate)
COPY prisma ./prisma
COPY prisma.config.ts ./

# Accept build arguments
ARG NEXT_PUBLIC_STRIPE_PUBLIC_KEY

# Set dummy environment variables for build
ENV DATABASE_URL="postgresql://dummy:dummy@dummy:5432/dummy"
ENV STRIPE_SECRET_KEY="sk_test_dummy_key_for_build_only"
ENV STRIPE_WEBHOOK_SECRET="whsec_dummy_secret_for_build_only"
ENV GOOGLE_CLIENT_ID="dummy-client-id.apps.googleusercontent.com"
ENV GOOGLE_CLIENT_SECRET="dummy-client-secret"
ENV GOOGLE_REDIRECT_URI="http://localhost:3000/api/auth/google/callback"
ENV NEXT_PUBLIC_STRIPE_PUBLIC_KEY=${NEXT_PUBLIC_STRIPE_PUBLIC_KEY}

# Install dependencies (runs prisma generate in postinstall)
RUN npm ci

# Copy application files
COPY . .

# Build Next.js application
RUN npm run build

# Production stage
FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files from builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma

# Set correct permissions
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]