# Dagmar B&B — Full-Stack System

A complete booking and management system for **Dagmar Bed & Breakfast** in Ribe, Denmark.

## Architecture

```
DagmarBB/
├── apps/
│   ├── web/       → React + Vite + Tailwind → GitHub Pages
│   ├── api/       → Fastify + Prisma + PostgreSQL → Render.com
│   └── mobile/    → Expo React Native (iOS + Android)
└── packages/
    └── shared/    → TypeScript types + API client (shared across apps)
```

## Quick Start

### Prerequisites
- Node.js 20+
- pnpm 9+
- PostgreSQL 16

### 1. Install dependencies
```bash
pnpm install
```

### 2. Set up the API
```bash
cp apps/api/.env.example apps/api/.env
# Edit apps/api/.env with your database URL and secrets
pnpm db:migrate
pnpm db:seed
```

### 3. Run development servers
```bash
# API (port 3001)
pnpm dev:api

# Web (port 5173)
pnpm dev:web

# Mobile
pnpm dev:mobile
```

## Default credentials (after seeding)
- **Admin**: admin@dagmarbb.dk / admin123
- **Cleaner**: cleaning@dagmarbb.dk / cleaner123

## Themes

Five themes are available via the floating 🎨 button (web) or Settings tab (mobile):
- Half-Timbered Warmth (default)
- Cathedral Stone
- Nordic Farmhouse
- Amber Evening
- River Mist

## Production Deployment

### Web (GitHub Pages)
1. Add secret `VITE_API_URL` in GitHub repository settings
2. Push to `main` → GitHub Actions builds and deploys automatically
3. Set DNS CNAME `dagmarbb.dk` → `<username>.github.io`

### API (Render.com)
1. Create a new Web Service on Render.com pointing to this repo
2. Set root directory to `apps/api`
3. Build command: `pnpm install && pnpm db:deploy && pnpm build:api`
4. Start command: `node dist/server.js`
5. Add environment variables from `.env.example`
6. Add secret `RENDER_DEPLOY_HOOK_URL` to GitHub for auto-deploy

### Database
Use Render.com's managed PostgreSQL (free tier available).
Set `DATABASE_URL` in your Render.com environment variables.

## API Documentation
Swagger UI available at `/docs` when the API is running.

## Payment Integration
- **MobilePay/Vipps ePayment**: Set `MOBILEPAY_CLIENT_ID`, `MOBILEPAY_CLIENT_SECRET`, `MOBILEPAY_MERCHANT_SERIAL_NUMBER`
- **Flatpay**: Set `FLATPAY_API_KEY`, `FLATPAY_WEBHOOK_SECRET`

Both providers fall back to sandbox mode when credentials are not set.

## Email (Resend)
Set `RESEND_API_KEY` and `RESEND_FROM` to enable booking confirmation emails.
Get a free API key at [resend.com](https://resend.com).
