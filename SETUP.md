# Aurum — Setup & Deployment Guide

This walks you through everything needed to get Aurum running locally and deployed,
assuming you've never used Supabase or Vercel before. Follow it in order.

## 1. Create your Supabase project

1. Go to [supabase.com](https://supabase.com) and sign up (free tier is enough).
2. Click **New project**. Pick any name (e.g. "aurum"), set a database password
   (save it somewhere — you likely won't need it again, but keep it), pick the
   region closest to you, and click **Create new project**. Wait ~2 minutes for
   it to provision.
3. Once it's ready, go to **Project Settings** (gear icon, bottom of the left
   sidebar) → **Data API**. You'll need two values from this page:
   - **Project URL** — looks like `https://xxxxxxxxxxxx.supabase.co`
   - **anon public** key (under **Project API keys**) — a long string starting
     with `eyJ...`
4. In this project's root folder, copy the example env file and fill in those
   two values:
   ```bash
   cp .env.local.example .env.local
   ```
   Open `.env.local` and set:
   ```
   VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```
   **Never commit `.env.local`.** It's already listed in `.gitignore` — double
   check with `git check-ignore .env.local` (it should print the filename back,
   confirming git will skip it).

## 2. Create the tables

1. In the Supabase dashboard, open **SQL Editor** (left sidebar) → **New query**.
2. Open `supabase/schema.sql` from this repo, copy its entire contents, paste
   into the SQL editor, and click **Run**.
3. This single file creates everything in the right order — `categories` →
   `quick_add_presets` → `transactions` → `budgets` — enables Row Level Security
   on all four, adds the storage policy for receipts (bucket created in the next
   step), and installs the auto-seed trigger for new signups.
4. Confirm it worked: go to **Table Editor** (left sidebar) — you should see all
   four tables listed.

## 3. Create the storage bucket

1. In the Supabase dashboard, go to **Storage** (left sidebar) → **New bucket**.
2. Name it exactly `receipts` (lowercase, matches the code and the SQL policy).
3. Leave it **Private** — do not toggle "Public bucket" on. Click **Create bucket**.
4. The storage RLS policy for this bucket ("Users manage own receipts") is
   already part of `supabase/schema.sql` from step 2 — you don't need to add it
   separately, as long as you ran that file after creating the bucket. If you
   ran the SQL *before* creating the bucket, the policy still applies correctly
   once the bucket exists (policies reference the bucket by name, not by ID).

## 4. Row Level Security — what's on, and why

Every table (`categories`, `quick_add_presets`, `transactions`, `budgets`) and
the `receipts` bucket in `storage.objects` has RLS enabled, using the same rule
everywhere: **a row is only visible/writable to the user who owns it**
(`auth.uid() = user_id`, or for storage, the first path segment matching your
user id).

This is a single-user personal app today, so RLS isn't protecting you from
other *people* using the app right now — it's protecting you from your anon key
ever being able to read or write someone else's data if this app is ever shared
or made multi-user later, or if the key leaks (e.g. committed by accident,
visible in browser devtools — anon keys are always public-ish by design).

**There is nowhere in this app that RLS should be disabled.** A personal finance
tracker has no public-read tables — every table holds private financial data.
If you ever add a new table, enable RLS on it with the same policy pattern
before using it.

## 5. Auto-seed: default categories on first login

`supabase/schema.sql` installs a Postgres trigger (`on_auth_user_created`) that
fires automatically the moment a new row is created in `auth.users` — i.e. the
instant someone signs up. It inserts the default categories (Allowance,
Business → Recurring Retainer / One-time Project, Gifts, and the six expense
categories) for that user. You don't need to run or trigger anything manually —
just sign up in the app (see step 9) and check **Table Editor → categories** to
confirm rows appeared for your new user.

## 6. Run it locally

From this project's root folder:

```bash
npm install
npm run dev
```

Open the URL it prints (usually `http://localhost:5173`). You should land on
the login screen. If the page is blank or you see console errors mentioning
`VITE_SUPABASE_URL`, double-check `.env.local` exists and both values are
filled in, then restart `npm run dev` (env vars are only read at server start).

To confirm the production build works before deploying:

```bash
npm run build
npm run preview
```

## 7. Deploy to Vercel

1. Push this repo to GitHub (create a new repo on github.com, then from this
   folder: `git remote add origin <your-repo-url>`, `git push -u origin main`
   — adjust branch name if yours differs).
2. Go to [vercel.com](https://vercel.com), sign up/log in, click **Add New… →
   Project**, and import the GitHub repo you just pushed.
3. Vercel auto-detects Vite — leave the build command (`npm run build`) and
   output directory (`dist`) as detected.
4. Before deploying, go to **Environment Variables** in the import screen (or
   later via **Project Settings → Environment Variables**) and add the same two
   values from your `.env.local`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Click **Deploy**. After a minute or two you'll get a live URL like
   `https://your-project.vercel.app`.

If you'd rather skip GitHub: install the Vercel CLI (`npm i -g vercel`), run
`vercel` from this folder, and follow the prompts — it'll ask for the same env
vars on first deploy.

## 8. Add to Home Screen on iPhone

1. On your iPhone, open **Safari** specifically (iOS only allows PWA install
   from Safari — Chrome/other browsers on iOS can't do this).
2. Go to your Vercel URL.
3. Tap the **Share** icon (square with an arrow) in Safari's toolbar.
4. Scroll down and tap **Add to Home Screen**.
5. Confirm the icon shown is the graphite/brass ring icon (not a generic globe
   or Safari icon) — if it looks wrong, force-quit Safari and reload the page
   once before adding, so it re-fetches the manifest and icons.
6. Tap **Add**. Aurum now launches full-screen from your home screen like a
   native app.

## 9. Post-deploy checklist

Run through this once on the real deployed URL to confirm everything works
end-to-end:

- [ ] Sign up with your real email/password (Settings → you'll get a
      confirmation email if email confirmation is on by default — check your
      inbox and confirm before signing in)
- [ ] Sign in, and check **Supabase → Table Editor → categories** — confirm the
      12 default categories were seeded for your user
- [ ] Add one **income** transaction (e.g. tap Allowance-style manual entry)
- [ ] Add one **expense** transaction
- [ ] Create one quick-add preset (Manage Presets, or "Save as preset" while
      adding a transaction) and confirm it appears as a chip next time you open
      Add Transaction
- [ ] Attach one test receipt photo to a transaction, then reopen that
      transaction and confirm the photo displays (this round-trips through the
      `receipts` bucket and signed URLs — if it fails, recheck step 3)
- [ ] Go to **Export & Share**, generate one PDF report, confirm the receipt
      photo you just attached renders inside the PDF, and confirm the iOS share
      sheet opens (on desktop browsers without file-sharing support, it should
      fall back to a plain download instead)
- [ ] Delete the test transactions and preset you just created so your real
      data starts clean

---

## 10. Chronicle (to-dos, notes, voice)

Chronicle is the sixth Meridian module. It needs three things beyond the base
setup: its tables, a storage bucket, and — for voice transcription only — a
Groq API key held server-side in a Supabase Edge Function.

Everything except transcription works without the Groq key. Recordings still
save and play; they just arrive with an empty transcript you can type yourself.

### 10.1 Storage bucket

1. **Storage → New bucket**, name it exactly `chronicle`, leave it **Private**.
2. Order doesn't matter. The SQL below adds this bucket's access policy, and that
   policy names the bucket as a string (`bucket_id = 'chronicle'`) rather than
   pointing at a row — so running the SQL first is fine, and the policy simply
   starts applying once the bucket exists. Same as `receipts` in step 3.

This one bucket holds both voice audio (`<your-user-id>/audio/…`) and images
embedded in notes (`<your-user-id>/images/…`). The user-id prefix is what the
policy keys off, so it is load-bearing, not just tidy.

### 10.2 Tables

**SQL Editor → New query**, paste all of `supabase/chronicle_schema.sql`, Run.
It creates `chronicle_tags`, `chronicle_notes`, `chronicle_todos`,
`chronicle_voice`, `chronicle_item_tags`, `chronicle_todo_links` and
`chronicle_secret_pin`, turns on RLS for every one of them, installs the
cleanup triggers, and adds the storage policy for the bucket above.

### 10.3 Voice transcription (Groq Whisper)

The key must never reach the browser — this is a PWA, so anything in the
frontend bundle is public. The client uploads audio to Storage and calls an Edge
Function; the function is the only thing that talks to Groq.

1. **Get a key:** sign in at [console.groq.com](https://console.groq.com) →
   **API Keys** → **Create API Key**. Copy it immediately; it is shown once.
2. **Install the Supabase CLI** if you don't have it:
   ```bash
   npm install -g supabase
   supabase login
   supabase link --project-ref <your-project-ref>
   ```
   (`<your-project-ref>` is the `xxxxxxxx` in your `https://xxxxxxxx.supabase.co` URL.)
3. **Set the key as a project secret** — deployed Edge Functions do *not* read
   `.env.local`:
   ```bash
   supabase secrets set GROQ_API_KEY=your_key_here
   ```
   Or in the dashboard: **Edge Functions → Secrets → Add new secret**, name
   `GROQ_API_KEY`.
4. **Deploy the function:**
   ```bash
   supabase functions deploy transcribe-voice
   ```

The model is `whisper-large-v3-turbo`. On Groq's free tier that is 20 requests
per minute, 2,000 per day, and 7,200 seconds of audio per hour — far more than
personal use needs, and the limits reset rather than being a one-time credit
pool.

**If you skip this step**, transcription fails cleanly: the recording is saved
and playable, the entry shows "Transcription failed" with the reason
(`GROQ_API_KEY is not set on this Supabase project`), and there is a Retry
button that works once the secret exists. Audio is never lost to a transcription
failure — that is the one thing the table is shaped to make impossible.

`GROQ_API_KEY` is also listed in `.env.local.example`, deliberately without a
`VITE_` prefix so Vite cannot expose it to the browser. That copy is only used
if you run `supabase functions serve` locally.

### 10.4 Secret Notes

There is no button for it. Type your Secret Notes PIN into Chronicle's search
field and the section opens.

To set one the first time, type **`secret`** into the search field — that word
opens the setup screen, and only while no PIN exists. After that it is an
ordinary search term again.

This PIN is Chronicle's own; it is not the PIN Kindle, Vigil or Virtus use.
Leaving the section, navigating away, or backgrounding the app re-locks it, and
nothing about being unlocked is ever stored.

Be clear-eyed about what it is: the PIN **hides** the section, it does not
encrypt it. Row Level Security scopes those notes to your account, so anyone
already signed in as you could reach them another way. It is a closed door, not
a safe.

### 10.5 Check it worked

- [ ] Open **Chronicle** from the launcher (the quill icon)
- [ ] Add a to-do, give it a due date and a repeat, tick it off, and confirm the
      next occurrence appears while the completed one stays in **Completed**
- [ ] Write a note with a heading and a checklist, close it, reopen it, and
      confirm the checkboxes are still checkboxes
- [ ] Record a voice memo and confirm it appears immediately and plays back,
      then that a transcript arrives a few seconds later (or a clear failure
      with a Retry button, if you skipped 10.3)
- [ ] Search for a word that only appears inside a note body, and confirm the
      note comes back with the match highlighted
- [ ] Type `secret` into the search field, set a PIN, add a private note, lock
      it, then confirm that note appears in neither the Notes list nor search

---

## 11. Notifications (push), the dashboard, and walkthroughs

Three platform-wide additions. Only the notifications need setup — the dashboard
and the walkthroughs work as soon as the tables in 11.1 exist.

Notifications fire **from the server**, on a schedule, so they arrive on time
with Meridian completely closed. There is no client-side timer anywhere in this:
`setTimeout` dies with the tab, and iOS has no Background Sync at all.

Work through 11.1 → 11.6 in order.

### 11.1 Tables

**SQL Editor → New query**, paste all of `supabase/notifications_schema.sql`, Run.

It creates `meridian_push_subscriptions`, `meridian_notification_settings`,
`meridian_notification_log` and `meridian_walkthroughs`, turns RLS on for every
one of them, and installs the log-pruning function.

### 11.2 Generate the VAPID keys

```bash
npm run vapid
```

This writes `VITE_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and a placeholder
`VAPID_SUBJECT` into `.env.local`. It deliberately does **not** print the private
key — only the public one.

Then open `.env.local` and change `VAPID_SUBJECT` to a real address you own:

```
VAPID_SUBJECT=mailto:your-real-email@example.com
```

Confirm the file is ignored by git (it should print the filename back):

```bash
git check-ignore .env.local
```

### 11.3 Push the secrets to Supabase

Edge Functions do **not** read `.env.local`. Four secrets have to exist on the
project. `CRON_SECRET` is any random string you invent — it is what stops
someone who finds the function URL from making it send.

Git Bash / macOS / Linux:

```bash
supabase secrets set VAPID_PUBLIC_KEY="$(grep '^VITE_VAPID_PUBLIC_KEY=' .env.local | cut -d= -f2-)"
supabase secrets set VAPID_PRIVATE_KEY="$(grep '^VAPID_PRIVATE_KEY=' .env.local | cut -d= -f2-)"
supabase secrets set VAPID_SUBJECT="$(grep '^VAPID_SUBJECT=' .env.local | cut -d= -f2-)"
supabase secrets set CRON_SECRET="pick-a-long-random-string"
```

PowerShell:

```powershell
supabase secrets set VAPID_PUBLIC_KEY="$((Select-String '^VITE_VAPID_PUBLIC_KEY=' .env.local).Line -replace '^VITE_VAPID_PUBLIC_KEY=','')"
supabase secrets set VAPID_PRIVATE_KEY="$((Select-String '^VAPID_PRIVATE_KEY=' .env.local).Line -replace '^VAPID_PRIVATE_KEY=','')"
supabase secrets set VAPID_SUBJECT="$((Select-String '^VAPID_SUBJECT=' .env.local).Line -replace '^VAPID_SUBJECT=','')"
supabase secrets set CRON_SECRET="pick-a-long-random-string"
```

Note the deliberate name change: the client variable is `VITE_VAPID_PUBLIC_KEY`
(so Vite exposes it to the browser, which is how Web Push works), while the
server secret is `VAPID_PUBLIC_KEY` with no prefix. Same value, two names.

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are injected
into Edge Functions by Supabase automatically. Do not set them yourself — the CLI
rejects secret names beginning with `SUPABASE_`.

Check what landed:

```bash
supabase secrets list
```

### 11.4 Deploy the two functions

```bash
supabase functions deploy push-dispatch --no-verify-jwt
supabase functions deploy push-test
```

`--no-verify-jwt` on the first one is required: pg_cron has no user session to
present. That function is gated on the `x-cron-secret` header instead.
`push-test` is the opposite — it runs under the caller's own JWT and can only
ever reach that user's own devices, so it keeps JWT verification on.

### 11.5 Schedule the cron

1. Open `supabase/notifications_cron.sql`.
2. Replace `<PROJECT_REF>` with the `xxxxxxxx` from your
   `https://xxxxxxxx.supabase.co` URL, and `<CRON_SECRET>` with the exact string
   you used in 11.3.
3. Paste the whole file into **SQL Editor → New query** and Run.

It enables `pg_cron` and `pg_net`, schedules `push-dispatch` every minute, and
schedules a weekly prune of the notification log.

Every minute rather than every hour, because Loom's reminder is "30 minutes
before the class starts" and a class can start at any minute. It cannot
double-send: every notification is claimed against a unique key in
`meridian_notification_log` before it goes out, so a second attempt within the
same window finds the slot already taken.

Verify:

```sql
select jobname, schedule, active from cron.job;
select status, return_message, start_time from cron.job_run_details order by start_time desc limit 10;
select status_code, content from net._http_response order by id desc limit 10;
```

A healthy minute answers `200` with something like
`{"checked":1,"sent":0,"skipped":0,"pruned":0,"errors":[]}`. **`sent: 0` is the
correct answer on most minutes** — nothing is due then.

### 11.6 Add the public key to your deployment

In **Vercel → Project Settings → Environment Variables**, add:

```
VITE_VAPID_PUBLIC_KEY = <the public key printed by npm run vapid>
```

alongside the existing `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, then
redeploy. Without it the deployed app cannot subscribe at all — the Notifications
screen says exactly that rather than failing quietly.

### 11.7 Turning them on, and the iPhone catch

**On iPhone and iPad, Web Push only works for a PWA installed on the Home
Screen. It does not work in a Safari tab — the APIs are simply absent there, and
nothing errors.** That is the single most likely reason for "notifications don't
work", so the app detects the situation and explains it instead of failing
silently.

1. Open the deployed URL in **Safari** (not Chrome — iOS only allows PWA install
   from Safari).
2. Share → **Add to Home Screen** → Add. (Step 8 of this guide.)
3. Open Meridian **from the new Home Screen icon**.
4. Tap the gear at the top right of the launcher → turn on **Notifications on
   this device**, and accept the iOS permission prompt.
5. Tap **Send a test notification**. One should arrive within a couple of
   seconds. That single notification proves the entire chain: subscription
   stored, VAPID keys valid and matched, function deployed, service worker awake.

Android (Chrome, Firefox, Edge, Samsung Internet, Opera) needs no install — step
4 onward works in an ordinary tab.

Push also needs a real service worker, which only exists in a **built** app. In
`npm run dev` there is none, so notifications cannot be tested there. Use
`npm run build && npm run preview`, or the deployed site.

### 11.8 What actually gets sent

All times are your local time, taken from the timezone your device reports each
time you save a setting.

| Module | When | Sent only if |
| --- | --- | --- |
| **Aurum** | never | no notifications at all, by design |
| **Kindle** | every hour on the hour, 6am–11pm | silent midnight–6am |
| **Vigil** | 8am, 10am, 12pm, 2pm, 4pm, 6pm, 8pm, 10pm | **nothing at all once the 5 hours are done** |
| **Loom** | 30 minutes before each class | a class is actually scheduled then |
| **Virtus** | 6pm | no session started, and the day is not marked rest |
| **Chronicle** | 10am, 2pm, 6pm, 10pm | there are incomplete to-dos due today |

Each toggle is respected **server-side** — turning Kindle off means the
notification is never sent, not sent and then hidden.

The hours in that table are staggered by a few minutes rather than all landing
on `:00` — Vigil at `:03`, Virtus at `:06`, Chronicle at `:09`. At 6pm all four
of those modules can come due at once, and four notifications arriving together
is how someone learns to swipe them away and then turn the feature off. Kindle
keeps `:00`, because "every hour, on the hour" is what it is.

Vigil's checks are also bounded to 8am–10pm rather than running literally every
two hours around the clock. A 2am "you have not studied today" would fire every
single night, immediately after the day rolls over, and would be the naggiest
notification in the app. Change `VIGIL_HOURS` at the top of
`supabase/functions/push-dispatch/index.ts` if you want it wider.

Two more things worth knowing:

- **Loom reminders read the Supabase mirror, not IndexedDB.** Loom is
  offline-first and its source of truth is on your phone; the server can only see
  what has synced. A timetable edited offline and never reconnected produces no
  reminders until it syncs. Opening Loom — or just the launcher — while online is
  enough.
- **Secret Notes are never touched by any of this.** The dispatcher queries
  `chronicle_todos` and nothing else in Chronicle, and no walkthrough mentions
  that the section exists.

### 11.9 Walkthroughs

Nothing to configure. Meridian's own introduction runs on first login; each
module's runs the first time that module is opened. Completion is stored per
module in `meridian_walkthroughs`, so it follows the account across devices, and
mirrored into `localStorage` so it neither flashes on launch nor breaks when Loom
is opened with no connection.

Replay any of them from **gear → Walkthroughs**. "Show" runs it once now;
"Forget" clears the record so it triggers again on its own.

### 11.10 Check it worked

- [ ] The launcher shows six icons in two rows of three, then four summary cards
- [ ] Swipe the **Aurum** card sideways — it flips between this month and all
      time, and finishing the swipe does *not* open Aurum
- [ ] The **Kindle** card's eight cells match today's colours in Kindle's own grid
- [ ] Start Vigil's timer, come back to the launcher — the **Vigil** card counts
      up live
- [ ] The **Loom** card shows your next class; turn airplane mode on, reload, and
      confirm it still does
- [ ] Scrolling the launcher vertically works even when the drag starts on the
      Aurum card
- [ ] gear → master toggle on → **Send a test notification** arrives, and tapping
      it opens Meridian
- [ ] Turn one module's toggle off and confirm the column flipped in
      **Table Editor → meridian_notification_settings**
- [ ] gear → Walkthroughs → **Show** on Kindle: it opens Kindle and spotlights
      the grid
- [ ] At the top of an hour with Kindle's toggle on, the water reminder arrives
      and opens Kindle when tapped

### 11.11 If a notification does not arrive

In order, because each step rules out the ones below it:

1. **Is it iOS in a Safari tab?** Nothing will ever arrive. See 11.7.
2. **Does the test notification work?** If yes, the chain is fine and what you
   are seeing is a trigger's condition (nothing due, target already met, rest day
   logged) rather than a fault.
3. **Is the cron running?**
   `select status, return_message, start_time from cron.job_run_details order by start_time desc limit 5;`
4. **What did the function answer?**
   `select status_code, content from net._http_response order by id desc limit 5;`
   A `403` means `CRON_SECRET` in the SQL does not match the project secret. A
   `500` naming a variable means that secret is missing.
5. **Is there a subscription at all?** Check
   **Table Editor → meridian_push_subscriptions** for a row. If one vanished, the
   push service reported it dead and it was cleaned up — turn the master toggle
   off and on again on that device.
6. **Is the timezone right?** **Table Editor → meridian_notification_settings**,
   `timezone` column. It is rewritten every time you save a setting.

---

# 12. Going public — bring-your-own-Supabase

This is the section that changed everything else. Read it before touching
anything in `supabase/`.

## 12.1 What the architecture actually is

Meridian now talks to **two** Supabase projects.

| | Auth project (yours) | Data project (theirs) |
| --- | --- | --- |
| Set by | `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` at build time | Pasted by the user into the setup walkthrough, stored in their browser |
| Holds | `auth.users`, `meridian_push_subscriptions`, `meridian_notification_settings`, `meridian_notification_log`, `meridian_walkthroughs` | Every table of all six modules, plus both storage buckets |
| Client | `src/lib/supabase.ts` → `supabase` / `authClient` | `src/lib/dataClient.ts` → `db` |

Sign-up, sign-in, sessions and password reset all still run through **your**
project, unchanged, which is what makes the user count in your dashboard real.
Auth rows are tiny; other people signing up will not exhaust the free tier.

Everything a user actually writes goes to a project they created, on their own
free tier, and never touches yours.

### Why there is a second sign-in

Every RLS policy in the schema is `auth.uid() = user_id`. `auth.uid()` comes out
of the JWT Postgres was handed, and a JWT is only trusted by the project that
signed it — yours means nothing to theirs. So after the user pastes their
credentials, Meridian creates and signs in to a **second account inside their own
project**, and it is that account's uid that owns their rows.

The password for that second account is **derived, never stored**: SHA-256 over
the Meridian user id and the project ref (`derivePassword` in
`src/lib/dataClient.ts`). That is what makes a second device work — paste the same
two values and the same password falls out — with nothing secret written down.

## 12.2 Your own account is exempt

`VITE_OWNER_EMAIL` is how. An account whose email matches it skips the setup flow
entirely, and its data client **is** the auth client — the same object. Nothing
about your day-to-day use changes and none of your existing data moves.

**You must set this in two places, or the deployed app will ask you, the
developer, to paste in Supabase credentials:**

1. `.env.local` — already added for you, using the address on this machine.
   **Check it is the address you actually sign in to Meridian with.**
2. Vercel → your project → Settings → Environment Variables → add
   `VITE_OWNER_EMAIL` with the same value, for Production, Preview and
   Development → Redeploy.

`VITE_OWNER_USER_ID` (Authentication → Users → click yourself → User UID) works
as an alternative if you would rather not put an address in the bundle. Either is
enough; neither is a secret, because the match is against an email Supabase Auth
issued and nobody else can claim.

## 12.3 Run the migration on your own project

Once, in **your** project's SQL editor: `supabase/public_release_migration.sql`.

It does exactly two things, and touches no existing row:

* adds `meridian_notification_settings.external_data`, which the push dispatcher
  now **filters on** — accounts marked true are excluded from dispatch entirely
  (see 12.5);
* drops the `on_auth_user_created` trigger, so a stranger signing up no longer
  writes eleven pointless Aurum category rows into your database. Your own
  categories were seeded when you first signed up and are untouched — the trigger
  only ever ran on INSERT.

That trigger is no longer installed in the user's project either. `user_setup.sql`
now drops it rather than creating it — see 12.9 for why, and for what the setup
script does and does not put in a new account.

## 12.4 What the user does — and what they never do

`supabase/user_setup.sql` is the whole of it. The app **shows them that file** —
`src/setup/SetupFlow.tsx` imports it with `?raw`, so there is one copy and it can
never drift from the schema — with a copy button.

Six screens, all of them clicking and pasting in a browser:

1. why their data is theirs, and that the credentials live on that device only
2. create a free Supabase project
3. copy the script → SQL Editor → New query → paste → Run
4. Authentication → Sign In / Providers → Email → **Confirm email off** → Save
5. Project Settings → API Keys → copy the Project URL and the anon/public key
6. paste both, press Test Connection

**No terminal, no clone, no editor, no install, at any point.** If you ever
change the schema, change `supabase/user_setup.sql` and the app shows the new
version automatically.

### The confirm-email step, and its safety net

Step 4 exists because Meridian creates that second account in their project, and
a project with "Confirm email" on will not let it sign in until an email nobody
will ever open is answered.

People skip steps. So the setup script also installs
`public.meridian_confirm_signup(text)`, and the client calls it if sign-up comes
back without a session. It only ever touches an account created in the **last
fifteen minutes** that has **never been confirmed**, so it cannot be used to take
over an existing one. Belt and braces: if that function is blocked for any
reason, the toggle in step 4 is what makes it work.

### One connection per account, per device

The saved credentials carry the Meridian user id that saved them. A phone gets
handed around; without that, signing out and letting somebody else sign in would
leave their session pointed at the first person's database. A connection that
does not match the signed-in account is treated as no connection at all, and the
new person is sent to set up their own.

## 12.5 Notifications: off for everyone but you

**Shared instances get no push notifications at all.** Not degraded ones — none.

`meridian_notification_settings.external_data` marks accounts whose module data
the dispatcher cannot read, which is everyone but you, and `push-dispatch` now
filters them out in its opening query:

```sql
.eq('enabled', true)
.eq('external_data', false)
```

### Why not the degraded version

An earlier revision did try to send those accounts a stripped-down set: the water
reminder without the day's total, the study check-in without the hours, the gym
question without knowing whether the gym had already happened — and Loom's class
reminders and Chronicle's due-today list not sent at all, because those two *are*
their data.

That was the wrong call. Every one of those notifications exists to say something
specific about your day; without the specifics they become the generic
"Reminder!" the whole copy file was written to avoid. Three visibly stupider
reminders plus two silent absences reads as a broken app. A clearly-labelled
"not available yet" reads as a considered one.

### What those users see

The notifications section in Settings stays — a missing section reads as a bug —
and shows one panel instead of six switches:

> **Not available for shared instances yet**
> Reminders have to read your data to be worth sending — how much water you have
> logged, which class is next, what is due today. Your data is in your own
> Supabase project, and the server that would send them cannot reach into it.

Deliberately not "coming soon" or "under development", neither of which is a date
anyone has promised.

`enablePush()` also refuses outright for a non-owner account
(`src/lib/push.ts`). That is the backstop that matters most: a browser permission
prompt is a promise, a denied one can only be undone in OS settings, and asking
for it to power something that does nothing is the worst version of this. The
Settings screen never offers the path; the guard makes it impossible.

**Your own account is untouched.** Every reminder still fires on its own schedule
with its real numbers in it.

### The iOS install banner, since it was a notifications banner

It stays, and it now says something else. Installing was only ever pitched as the
way to get notifications on iOS; for almost everyone that is no longer a reason.
It is still worth doing on its own — full screen instead of Safari's chrome eating
both ends of every module, a real icon, and a tab iOS cannot quietly evict — so
the copy leads with that. The notifications sentence still exists behind a
`reason` prop, used in exactly one place: your own Settings screen, where it is
the explanation for a toggle that cannot be switched on.

It is also no longer gated on notifications being enabled (which for a shared
instance is never), just on being an iPhone or iPad in a browser tab. It waits
until Meridian's own walkthrough has run once, so a stranger's first thirty
seconds are not two interruptions competing.

## 12.6 Voice transcription, now that the audio is elsewhere

`transcribe-voice` grew a second route.

* **Your account** — unchanged. `{"voice_id": "…"}`, the function downloads the
  audio from your project under your own JWT, transcribes it, writes the row.
  Durable: the answer lands even if you closed the app.
* **Everyone else** — the browser downloads the audio from *their* project and
  posts the bytes to the function as `multipart/form-data`. The function verifies
  the caller's JWT with `getUser()`, calls Groq, and returns the text; it reads
  and writes no table. The client writes the transcript back to its own database.

Because nothing server-side is left holding that row, `useVoice` now flips any
`pending` entry older than ten minutes to `failed`, so a recording whose tab was
closed mid-transcription offers a retry instead of spinning forever.

**Redeploy the function:** `supabase functions deploy transcribe-voice`

## 12.7 Rotating the cron secret — do this before you share the link

An earlier revision of `supabase/notifications_cron.sql` had the real
`CRON_SECRET` written into it, and that file is committed. The value is in this
repository's git history permanently, and rewriting history will not reliably
remove it from existing clones or forks. **Rotating it is what makes the leaked
copy worthless.**

`push-dispatch` is deployed with `--no-verify-jwt` so pg_cron can reach it, which
means that header is the only thing between its URL and anyone who wants to make
it send notifications to every user of the app.

1. Pick a new random string:

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
   ```

2. Set it on the project:

   ```bash
   supabase secrets set CRON_SECRET=the_new_value
   ```

3. Open `supabase/notifications_cron.sql`, put the new value and your project ref
   in place of the two placeholders, run the file in the SQL editor, then **undo
   your edit before committing**.

4. Confirm the old one is dead — this should answer `403 Forbidden`:

   ```bash
   curl -s -X POST https://<PROJECT_REF>.supabase.co/functions/v1/push-dispatch \
     -H "x-cron-secret: SomethingThatMakesItWorkIsEnough"
   ```

5. Confirm the new one lives — within a minute or two:

   ```sql
   select status, return_message, start_time
   from cron.job_run_details order by start_time desc limit 5;
   ```

## 12.8 Vercel Web Analytics

`@vercel/analytics` is installed and `<Analytics />` is mounted in `src/App.tsx`.
It is inert anywhere but the Vercel deployment, so local development is
unaffected.

One thing left for you, in the browser: **Vercel → your project → Analytics →
Enable**. Nothing is recorded until you do, and the script quietly 404s until
then. Redeploy afterwards.

## 12.9 What a new account starts with — and what it doesn't

**The rule: `user_setup.sql` creates tables, indexes, policies, buckets,
functions and triggers. No content.** Kindle is the single exception, and it is
argued below.

The script was originally generated from your own schema, which meant it carried
your life with it. That has been stripped out.

### Removed: Aurum's seeded categories

The `handle_new_user` trigger used to write eleven categories into every new
account: Allowance, Gifts, Business → Recurring Retainer / One-time Project,
College Essentials, Canteen, Eating Out, Transport, Subscriptions, Misc.

That list is not neutral scaffolding — it is a portrait. It assumes a student
living on an allowance, eating at a college canteen, freelancing on retainers.
Handed to a stranger as "your categories", it gets the app wrong about them on
the first screen they see.

`user_setup.sql` now **drops** that trigger and function rather than creating
them, which also cleans up any project made with the older script. It drops the
trigger only — never the rows it already wrote.

Aurum's dashboard has a designed first-run state in its place: the three-step
shape of the module and a button into Settings to make the first category. The
Add Transaction sheet has a matching state, because that sheet is reachable from
the bottom nav even before any category exists.

### Removed: Kindle's other five habits

`DEFAULT_HABITS` used to seed eight: water at four litres, two baths a day,
protein at 100g from natural sources, a skincare routine, avoiding processed
foods, plus gym, sleep and study. The first five are somebody's actual routine.

### Kept: three Kindle habits, deliberately

| Habit | Type |
| --- | --- |
| Gym | binary |
| Sleep (8 hours) | multi-stage, 1–8 |
| Study (5 hours) | multi-stage, 1–5 |

An 8×7 grid with nothing in it does not read as "add a habit", it reads as
broken — a grid is a shape made of its contents. And the spread is the real
reason for the three: one all-or-nothing habit and two counting up on *different*
ranges demonstrate the whole habit model in one glance. A walkthrough would need
three paragraphs to say what three rows of the grid say by themselves.

Kindle's walkthrough now has a step, anchored to the Settings tab, saying in as
many words that these are examples and can be renamed, retargeted or deleted.

Seeding is still client-side (`src/kindle/lib/seed.ts`) and still only runs
against a habits table with zero rows in it, so **your own eight habits are
untouched**.

### Checked and clean

No other module seeds anything. Virtus starts with an empty exercise library,
Loom with no term or classes, Vigil with an empty topic tree, Chronicle with
nothing in any of its three sections. The only `INSERT`s left in the whole script
are the two storage buckets. The only literal column default that is not
machinery is `categories.color`, which is Meridian's brand gold used as the
fallback for a category created without one — a colour, not a preference.

### Known, and left alone

The app formats dates and currency as `en-IN` (₹, Indian date order) throughout.
That is baked into the product rather than seeded per account, so it was out of
scope for this pass — but it is worth knowing that a user in another country sees
rupees. `meridian_notification_settings.timezone` also still defaults to
`Asia/Kolkata` in the auth project's schema; the client overwrites it with the
device's own zone on every save, and shared instances get no notifications at
all, so nothing reads a stale value.

### If you change the schema later

Change `supabase/user_setup.sql` and nothing else. The setup walkthrough imports
that file with `?raw`, so the script users are shown is always the current one.
And keep the rule: structure, not content.

## 12.10 Empty states and the two deep walkthroughs

With the seed data gone, four of the six modules now open completely empty for a
new account. Empty is the first impression, so every zero-state is a designed
screen ending in a button, built from one shared component
(`src/components/ModuleEmptyState.tsx`) with a palette per module — five
hand-rolled versions would have drifted within a week.

**Virtus and Loom get long walkthroughs**, breaking the "keep it short" rule the
other five follow, because both have a setup *chain* rather than a feature:

* **Virtus (9 steps)** — nothing can be logged until an exercise library, split
  days built from it, and a weekly schedule exist, in that order. Miss that and
  the app appears to do nothing at all. The tour also covers the three things
  nobody finds alone: last session's numbers pre-filled as the overload target,
  rest days being a thing you log rather than the absence of one, and the volume
  grid ranking each day against the rolling average of *that same split day*.
* **Loom (8 steps)** — a term and its period times come before anything else can
  exist, class presets are saved once and referenced everywhere, and semester
  versioning with effective dates is the classic feature nobody discovers until
  the week they need it.

One real bug fixed along the way: Loom's walkthrough was mounted *past* the "no
term yet" early return, so a brand-new account — exactly who needs to be told how
terms and versioning work — could never reach it. It is now mounted in both
branches.

Steps with no `anchor` centre themselves instead of pointing at a control, which
is what makes these tours work on an account where most of the UI does not exist
yet.

## 12.11 Paused projects, and the Troubleshooting page

Supabase suspends a free project after about a week without traffic. That is not
an edge case — it describes everyone who tries Meridian and does not open it
daily — so it is the one connection failure the app diagnoses rather than
shrugging at.

`src/lib/projectHealth.ts` probes the REST root and classifies the answer:

| Result | Meaning | What the screen says |
| --- | --- | --- |
| `offline` | `navigator.onLine` is false | "You're offline" |
| `paused` | Gateway answered 540/503, or the body said "paused" | "Your Supabase project **is** paused" |
| `unreachable` | No readable answer at all | "isn't answering… almost always this means paused" |
| `reachable` | It answered; the problem is something else | Schema-missing or sign-in help instead |

**Detection is not always certain, and the copy is honest about which case it is
in.** A gateway error page is not obliged to carry CORS headers, and without them
the browser refuses to let the page read the response — so a genuinely paused
project can land in `unreachable` alongside a deleted one or a dead network.
Hence two headlines rather than one confident guess.

Both paused variants give the same guided restore: a link straight to that
project's dashboard, the exact click path to **Restore project**, a note that it
takes a minute or two, and a Try again that re-runs the whole connection.

**Settings → Troubleshooting** (`/settings/help`) covers eight problems in plain
language, each with the click path: paused projects, wrong or mismatched
credentials, a setup script that did not finish (noting that Supabase runs it as
one transaction, so there is no half-created state to untangle), "Confirm email"
still on, notifications being unavailable, iOS install, data appearing to vanish
after a connection change, and re-entering credentials on a new device.

## 12.12 Before the link goes out

Everything above is done in the repo. This is what is left for you, in order.
Nothing here is optional.

**1. Deploy the rewritten dispatcher.** It was deliberately not deployed last
time, because this build rewrote its `external_data` handling. Until it is, the
old degraded reminders are still what the server sends.

```bash
supabase functions deploy push-dispatch --no-verify-jwt
```

The `--no-verify-jwt` matters: pg_cron has no user session to present, and
without the flag every scheduled tick is rejected. `CRON_SECRET` is what guards
it instead (12.7).

**2. Confirm the dispatcher is filtering.** Within a couple of minutes of the
deploy:

```sql
select id, status_code, content from net._http_response order by id desc limit 5;
```

A healthy tick answers `200` with `{"checked":N,"sent":0,...}` on most minutes.
`checked` should count only accounts with `external_data = false`.

**3. Push the app.** Commit and push; Vercel redeploys on its own. Confirm the
build succeeded in the Vercel dashboard before going any further.

**4. Check your own account still works, on the live URL.** You are the owner
path and nothing in this build should have touched you:

- launcher loads immediately, no setup screen
- Settings still shows the full notifications section with all five toggles
- **Send a test notification** — it should arrive
- all six modules show your existing data, and Kindle still has your eight habits
  (the seed only ever runs against an empty table)

**5. Walk the whole setup flow with a throwaway account.** This is the highest-value
thing you can do and it should be the last thing before you share the link. Use a
real second email and a brand-new free Supabase project:

- [ ] sign up → the setup walkthrough appears, six steps
- [ ] the SQL script copies with one tap and runs clean — `Success. No rows
      returned`
- [ ] Test Connection passes
- [ ] **Aurum opens empty** with the "start with a category" screen; making one
      category then lets you log a transaction
- [ ] **Kindle has exactly three habits** — Gym, Sleep, Study — and the
      walkthrough says they are examples
- [ ] **Virtus opens on the three-step setup screen**, and its button lands on
      Settings → Library
- [ ] **Loom opens on "start with the semester"**, and its walkthrough runs
      there (this was previously unreachable before a term existed)
- [ ] **Vigil → Topics** shows the empty-tree state, and its button opens the
      add-category field
- [ ] Settings → Notifications shows **"Not available for shared instances yet"**
      and no toggles, and never asks for browser permission
- [ ] Settings → Troubleshooting opens and its entries expand
- [ ] on iPhone: the install banner talks about full screen, **not** about
      notifications

**6. Check the paused-project screen, if you can.** Optional and slow, but it is
the state most users will eventually hit. Either wait for the throwaway project
to pause on its own, or pause it by hand from its dashboard (Project Settings →
General → Pause project), then open Meridian: you should get the guided restore
rather than a generic error.

**7. Then share the link.**
