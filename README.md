# MCQuest

MCQ practice for IGCSE, AS, A2, IB, and AP — built around the questions
you got wrong, with the gamification you didn't know you needed.

Strategic context: [`../STRATEGIC-PLAN.md`](../STRATEGIC-PLAN.md).

## Stack

- **Next.js 16** App Router · TypeScript · React 19 · Tailwind 4
- **Prisma 7** with the pg adapter, against Postgres (Supabase in prod)
- **NextAuth v5** (JWT sessions, role-aware, step-up MFA hooks)
- **Stripe** for web payments · IAP for App Store + Play Store later
- **Cloudflare R2** for question images, graphs, and avatars
- **Resend** for transactional email
- **Capacitor 8** for iOS + Android wrappers
- **Sentry** for error tracking
- **Upstash Redis** for rate-limit counters

Same family as the [School-Core](https://github.com/VantageTech-Apps/School-Core)
production stack, so patterns transfer 1:1.

## Getting started

```bash
cp .env.example .env.local
# fill in DATABASE_URL, AUTH_SECRET, ENCRYPTION_KEY at minimum
npm install
npm run db:push      # apply Prisma schema to your dev DB
npm run dev
```

Visit http://localhost:3000.

## Project layout

```
prisma/
  schema.prisma         # all data models, with extensive inline docs
  prisma.config.ts      # Prisma config for the CLI
src/
  app/                  # Next.js App Router (routes + RSC)
    api/auth/[...nextauth]/route.ts
    page.tsx
    layout.tsx
  lib/
    auth.ts             # NextAuth v5 setup, role-aware JWT
    prisma.ts           # singleton PrismaClient with pg adapter
    utils.ts            # cn() class-name helper
    questions/types.ts  # polymorphic ContentBlock for stems + options
  proxy.ts              # middleware logic (re-exported by middleware.ts)
  middleware.ts         # Next.js entrypoint
scripts/
  scan-secrets.sh       # pre-commit fast secret check
.husky/
  pre-commit            # runs secret scan + lint-staged
```

## Roles

| Role | Reach |
|---|---|
| `SUPER_ADMIN` | Platform owner. Everything. |
| `ADMIN` | Reviews / publishes / curates content. Can moderate. |
| `CONTRIBUTOR` | Drafts questions, edits their own bank, sees earnings (Phase 3). |
| `STUDENT` | The product. Practices, earns XP, climbs leagues. |

Sign-up is closed by default. Bootstrap accounts via the
`SIGN_IN_ALLOWED_EMAILS` / `SIGN_IN_ALLOWED_DOMAINS` env vars.

## Content authoring

Questions, options, and explanations are stored as polymorphic
**ContentBlock** JSON — see [`src/lib/questions/types.ts`](src/lib/questions/types.ts).
Each block is one of:

- `text` — prose
- `math` — LaTeX rendered via KaTeX
- `image` — raster image (PNG/JPEG/WebP) on R2
- `graph` — image semantically tagged as a graph (often SVG)
- `mixed` — vertical stack of other blocks (e.g. labelled image)

This is the data model that lets us render MCQs where the **answer
choices themselves are graphs**, which no competitor handles natively.

## Roadmap

Phased delivery from [`../STRATEGIC-PLAN.md`](../STRATEGIC-PLAN.md):

1. **Foundations** (current) — schema, auth, payments scaffold
2. **Practice engine** — MCQ flow, wrong-only retry, exam mode, image-option rendering
3. **Gamification core** — XP, streak, badges, leagues
4. **Mobile** — Capacitor wrap, App Store / Play Store
5. **Content authoring** — question editor + bulk import + contributor onboarding (read-only)
6. **Beta + content seeding** — 10–20 contributors, ~3,000 questions across 4 subjects
7. **Public launch** — Stripe live, App Store submission, marketing site
