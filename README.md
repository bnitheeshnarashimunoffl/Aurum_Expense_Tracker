# Aurum

> **Live Demo:** The app is currently deployed on Vercel. However, since it is locked behind a login screen and the link is not yet ready for public use, I have attached screenshots below to showcase the interface and features.

A personal & business finance tracker, built as an installable phone-first PWA
for tracking college income and expenses — allowance, freelance/business
income, and day-to-day spending — in one place, split by personal vs.
business, with budgets, receipts, and shareable PDF reports.

## Screenshots

*Since the live app is currently restricted, here are some photos demonstrating the interface:*

<details>
<summary>Click to view screenshots</summary>

![Dashboard](./public/screenshots/dashboard.png)
![Activity](./public/screenshots/activity.png)
![Add Transaction](./public/screenshots/add_transaction.png)
![Budgets](./public/screenshots/budgets.png)
![Settings](./public/screenshots/settings.png)

</details>

## Features

- **Dashboard** — a swipeable balance dial with two pages: this month's net
  (with a ring showing budget usage) and all-time net (with a ring showing
  lifetime spend vs. income). Filter everything by scope (All / Personal /
  Business) and period (Week / Month), see income/expense breakdowns as donut
  charts, and get a warning chip for any category over its budget.
- **Add transaction** — a bottom sheet for logging income or expenses: tap a
  quick-add preset to prefill amount + category, pick from a parent/child
  category tree, set date and payment mode (cash/UPI/card), add notes, attach
  a receipt photo (compressed client-side before upload), and optionally save
  the entry as a new preset.
- **Activity** — full transaction history, filterable by type, scope,
  category, and date range, grouped by day.
- **Budgets** — set a monthly limit per expense category and track spend
  against it with a progress bar.
- **Presets** — manage saved quick-add shortcuts for recurring transactions
  (e.g. allowance, a retainer), with use-count and last-used tracking.
- **Categories** — custom name, color, and personal/business flag per
  category, with archive/restore instead of hard delete.
- **Export & Share** — generate a PDF report (week, month, or custom range;
  income/expense/both; personal/business/all) with receipt photos embedded,
  and share it via the OS share sheet on mobile or download it on desktop.
  Also supports a one-tap CSV export of every transaction.
- **Installable PWA** — add to your iPhone home screen for a full-screen,
  app-like experience, with offline caching of previously loaded data.

## Tech stack

| Layer            | Choice                                                |
| ----------------- | ------------------------------------------------------ |
| UI                | React 18 + TypeScript, Vite                            |
| Styling           | Tailwind CSS (dark neumorphic + glass design system)    |
| Animation         | Framer Motion                                           |
| Charts            | Recharts                                                |
| Routing           | React Router v6                                         |
| Backend           | Supabase (Postgres, Auth, Storage) — no custom server   |
| PDF export        | html2pdf.js                                             |
| PWA               | vite-plugin-pwa (Workbox)                               |

There is no backend server — the client talks to Supabase directly, secured
entirely by Postgres Row Level Security.

## Data model

Four tables, each owned by `user_id` and protected by RLS so a user can only
ever see their own rows:

- **`categories`** — income/expense categories, optionally nested one level
  (e.g. `Business` → `Recurring Retainer`), with a color and a
  personal/business flag. A Postgres trigger auto-seeds a default set the
  moment a new user signs up.
- **`quick_add_presets`** — saved shortcuts (label, amount, category) for fast
  logging of recurring transactions.
- **`transactions`** — the core ledger: amount, type, category, date, payment
  mode, notes, optional preset reference, optional receipt image path.
- **`budgets`** — one monthly limit per expense category.

Receipt photos live in a private `receipts` storage bucket, one folder per
user, accessed only via short-lived signed URLs.

## Getting started

```bash
npm install
cp .env.local.example .env.local   # fill in your Supabase project URL + anon key
npm run dev
```

Open `http://localhost:5173`. You'll need a Supabase project with the schema
from `supabase/schema.sql` applied and a `receipts` storage bucket created —
**see [SETUP.md](./SETUP.md) for the full, step-by-step walkthrough**
(Supabase project creation, running the schema, storage bucket setup, and
deploying to Vercel), written for someone who's never used either service.

### Scripts

| Command           | Purpose                                          |
| ------------------ | ------------------------------------------------- |
| `npm run dev`      | Start the Vite dev server                        |
| `npm run build`    | Type-check, then build for production            |
| `npm run preview`  | Preview the production build locally             |
| `npm run lint`     | Type-check only (`tsc --noEmit`)                 |
| `npm run icons`    | Regenerate PWA/app icons from `public/icon-source.svg` |

## Project structure

```
src/
  routes/          # One component per screen (Dashboard, Budgets, Settings, ...)
  components/       # Reusable UI (sheets, charts, dial, nav, etc.)
  hooks/            # Data-fetching hooks per table (transactions, categories, ...)
  context/          # Auth session context
  lib/              # Supabase client, formatting, CSV/PDF/image utilities, cross-hook sync
  reports/          # The printable PDF report layout
supabase/
  schema.sql        # Full DB schema, RLS policies, and the new-user seed trigger
```

## Deployment

Deploys as a static site to Vercel (or any static host) — see
[SETUP.md](./SETUP.md) for the full deployment and home-screen-install guide.
