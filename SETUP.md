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
