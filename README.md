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
