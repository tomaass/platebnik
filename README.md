# platebník

**Live: [platebnik.cz](https://platebnik.cz) · try it without signing up: [platebnik.cz/demo](https://platebnik.cz/demo)**

The end of a home party, a garden barbecue, a shared cottage weekend: who had
what, how much is it, and what's your account number? platebník takes out the
awkward counting.

1. The **host** builds a price list and shares one link (or a printed QR poster).
2. **Guests** open it, with no app and no registration, tap what they had and
   get a QR code for the exact amount.
3. They scan it in their banking app and the money goes **straight to the host's
   account**. No payment gateway and no fees. A guest can leave a name and a
   message, and the host marks who has paid.

A board also works for a plain tip with no items, e.g. "we brought our own food,
this is for the grill and the garden".

The UI is in Czech because it's built on
[QR Platba](https://qr-platba.cz/pro-vyvojare/) (SPAYD), the payment QR format
every Czech bank app reads.

## How it's built

- **Next.js (App Router)** on Vercel, **Postgres** (Neon) with **Drizzle ORM**,
  **Auth.js** with magic links and optional Google sign-in.
- **The public board is deliberately light.** It's a server component that loads
  the price list once. Picking items, computing the total and rendering the QR
  code all run in the browser, so nothing goes to the server while a guest is
  choosing. That matters on a phone with one bar of signal in someone's garden.
  The only write is the optional signature.
- **Payment logic is plain, tested functions** in [`src/domain`](src/domain):
  Czech account number → IBAN with checksum validation
  ([`iban.ts`](src/domain/iban.ts)), SPAYD string building
  ([`spayd.ts`](src/domain/spayd.ts)), and prices kept in haléř (integer cents)
  so there's no floating-point money.
- Printable A4 QR poster rendered with `@react-pdf/renderer`, and rate limiting on
  the public write through Upstash Redis.
- Unit tests in Vitest and end-to-end tests in Playwright ([`tests/`](tests)).

The design spec and the implementation plans for each feature are in
[`docs/superpowers`](docs/superpowers) (in Czech). The app was built by directing
coding agents: the first version went from idea to production in 48 hours.

## Run it locally

Needs Node 22+, pnpm and a [Neon](https://neon.tech) Postgres database (the free
tier is enough). The app talks to the database through Neon's serverless driver,
so a plain local Postgres won't connect.

```bash
pnpm install
cp .env.example .env.local   # fill in DATABASE_URL, AUTH_SECRET, EMAIL_SERVER, EMAIL_FROM
node --env-file=.env.local scripts/migrate.mjs   # use the direct (non -pooler) connection string
pnpm dev
```

Optional settings, which the app runs fine without:

| Variable | Without it |
|---|---|
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | magic-link sign-in only |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | rate limiting disabled |
| `POSTHOG_KEY` | no analytics |
| `DEMO_ACCOUNT` | `/demo` pays to a checksum-valid placeholder account |

```bash
pnpm test                 # unit tests
pnpm exec playwright test # end-to-end tests
```
