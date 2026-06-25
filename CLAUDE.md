# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # start dev server (localhost:3000)
npm run build      # production build
npm run lint       # ESLint check
npx tsc --noEmit   # TypeScript type check
npm test           # run tests (Vitest)
npm run test:watch # watch mode

# Database
npx prisma db push              # sync schema to DB (non-interactive, use for dev)
npx prisma generate             # regenerate Prisma client after schema changes
npx tsx prisma/seed.ts          # seed demo restaurant + tables

# Stripe webhook (local testing)
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

## Architecture

**Rezervo** is a B2B SaaS for restaurants. When a customer books a table, a card hold (not a charge) is created via Stripe's `capture_method: "manual"`. If the customer shows up, the restaurant clicks "Prišiel" and the hold is captured (deducted from the bill). If they don't show up, the restaurant clicks "No-show" and the hold is captured (restaurant keeps the money). Cancellations release the hold entirely.

### Payment lifecycle

```
Customer books → PaymentIntent created (HELD, PENDING)
    ↓ customer confirms card
Stripe webhook: amount_capturable_updated → status: CONFIRMED
    ↓ day of reservation
Restaurant: "Prišiel" → capture() → CAPTURED / ARRIVED
Restaurant: "No-show" → capture() → CAPTURED / NO_SHOW
Restaurant: "Zrušiť"  → cancel()  → RELEASED / CANCELLED
```

### Key files

- `src/lib/stripe.ts` — thin wrappers around `createPaymentHold`, `capturePayment`, `cancelPayment`
- `src/lib/prisma.ts` — singleton PrismaClient using `@prisma/adapter-pg` (required by Prisma 7)
- `src/app/book/[slug]/page.tsx` — customer-facing booking page (form → Stripe Elements → success)
- `src/app/dashboard/page.tsx` — restaurant dashboard (list reservations, trigger actions)
- `src/app/api/reservations/create/route.ts` — creates PaymentIntent + Reservation row
- `src/app/api/reservations/[id]/action/route.ts` — handles arrived / noshow / cancel
- `src/app/api/webhooks/stripe/route.ts` — listens for `amount_capturable_updated` and `payment_failed`

### Prisma 7 specifics

Prisma 7 dropped the embedded query engine — `PrismaClient` **requires** a driver adapter. The adapter is `@prisma/adapter-pg` with a `pg` connection pool. Do not remove the adapter from `src/lib/prisma.ts`.

`prisma.config.ts` uses `DIRECT_URL` (port 5432, session mode) for CLI commands like `db push` and `migrate`. The app runtime uses `DATABASE_URL` (port 6543, PgBouncer transaction mode). Both point to Supabase.

The datasource block in `schema.prisma` has **no `url` field** — the URL is set exclusively in `prisma.config.ts`.

### Amounts

All monetary amounts are stored in **haléře** (integer, 100 = 1 Kč). `depositAmount` default is `100000` = 1000 Kč. Divide by 100 before displaying to users.

### Stripe API version

Pinned to `2026-05-27.dahlia` in `src/lib/stripe.ts`. Do not change without updating the type in the Stripe SDK.

## Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PgBouncer pooler URL (app runtime) |
| `DIRECT_URL` | Direct session URL (Prisma CLI only) |
| `STRIPE_SECRET_KEY` | Stripe server-side key (`sk_test_...`) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe client-side key (`pk_test_...`) |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret (`whsec_...`) |
