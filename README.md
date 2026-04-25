# Event Ticket App - Local Setup

## Prerequisites

- Node.js `>= 20.19.0`
- npm `>= 10`
- Docker + Docker Compose
- Git

## 1. Clone project

```powershell
git clone https://github.com/taltech-vanemarendajaks/team6.git
cd event-ticket-app
```

## 2. Install dependencies

```powershell
npm ci
```

If needed:

```powershell
npm install
```

## 3. Create `.env` file

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/event_ticket_app?schema=public"
STRIPE_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_STRIPE_PUBLIC_KEY="pk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GOOGLE_REDIRECT_URI="http://localhost:3000/api/auth/google/callback"
```

## 4. Start PostgreSQL (Docker)

```powershell
docker compose up -d
docker compose ps
```

## 5. Prisma setup

Generate client:

```powershell
npx prisma generate
```

Run migrations:

```powershell
npx prisma migrate dev
```

Format schema (after editing schema.prisma):

```powershell
npx prisma format
```

Optional seed:

```powershell
npx prisma db seed
```

## 6. Run app in dev mode

```powershell
npm run dev
```

Open `http://localhost:3000`

## 7. Automated tests (Vitest)

This project uses **Vitest** for both unit and integration tests.

Test commands:

```powershell
npm run test
npm run test:integration
npm run test:watch
npm run test:coverage
```

Test files are in `tests/`:

- `tests/unit/services` - service-layer unit tests
- `tests/unit/lib` - helper/utility unit tests
- `tests/unit/api` - API helper and critical route handler unit tests
- `tests/integration` - DB-backed integration tests for:
  - auth/users/session
  - events/venues/ticket allocation
  - order/payment fulfillment flows

Integration test prerequisites:

- PostgreSQL must be running
- `DATABASE_URL` must be set (usually via `.env`)

Vitest config is in `vitest.config.ts` and includes all `tests/**/*.test.ts`.
Environment variables are loaded from `.env` in `tests/setup-env.ts`.
