# Green Engineering Academy — Website

Next.js 15 + Supabase site for the GEA at Livermore High School: public marketing pages,
a leadership application system, a hidden admin portal, an interview-booking flow, and a
moderated student Q&A.

## What's included

| Page | Path | Notes |
|---|---|---|
| Home | `/` | Hero + academy overview, original copy |
| Curriculum | `/curriculum` | Four-year course sequence |
| Leadership | `/leadership` | President shown filled; every other seat shows "I'm Interested" until it's filled in Supabase |
| Apply for a role | `/leadership/apply/[role]` | Public form → `applications` table. Publicist role requires a "proof of work" field |
| Student Q&A | `/qa` | Public: ask a question; view approved Q&A |
| Upperclassman sign-in | `/login` | For students allowed to answer Q&A |
| Upperclassman dashboard | `/dashboard` | Answer approved questions (goes to "pending" for admin approval) |
| **Admin portal (hidden)** | `/admin-portal-x7k9` | Not linked anywhere. Manage applications, send interview invites, open interview slots, moderate Q&A, fill/vacate leadership seats |
| Admin login | `/admin-portal-x7k9/login` | |
| Interview booking | `/interview/[token]` | Sent only via the interview-invite email; unguessable per-applicant link |

## 1. Create the Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. Open the **SQL Editor** and run everything in `supabase/schema.sql`. This creates every
   table, Row Level Security policy, and the two RPC functions the interview page depends on.
3. Grab your Project URL, `anon` public key, and `service_role` secret key from
   **Project Settings > API**.

## 2. Set environment variables

Copy `.env.local.example` to `.env.local` and fill in:

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — from Supabase.
- `SUPABASE_SERVICE_ROLE_KEY` — **server only**, used exclusively in
  `app/api/send-interview-invite/route.ts` to bypass RLS for the invite email flow. Never
  reference this in a `"use client"` file.
- `NEXT_PUBLIC_SITE_URL` — your deployed domain (or `http://localhost:3000` locally). Used to
  build the interview booking link.
- `RESEND_API_KEY` / `RESEND_FROM_EMAIL` — sign up at [resend.com](https://resend.com), verify a
  sending domain, and create an API key. Until this is set, "Send Interview Invite" in the admin
  portal will show you the booking link directly instead of emailing it, so you can still test
  the flow without an email provider.

## 3. Confirm the school email domain

`lib/roles.ts` has an `ALLOWED_EMAIL_DOMAINS` list used to validate applicant emails on both the
application form and before any interview invite is sent. It's currently set to LVJUSD-style
domains — **double check this matches your students' real email domain** and update it if not.

## 4. Add your first admin account

Applications and Q&A moderation are gated behind an `admins` table, keyed to a real Supabase Auth
user:

1. In Supabase, go to **Authentication > Users > Add user** and create an account with your email
   and a password (turn off "auto confirm" only if you want to verify email first).
2. In the **SQL Editor**, run:
   ```sql
   insert into admins (auth_user_id, name)
   values ('paste-the-user-id-here', 'Your Name');
   ```
3. Sign in at `/admin-portal-x7k9/login`.

## 5. Add upperclassmen who can answer Q&A

Same pattern as admins:

1. Create their Supabase Auth user (or have them sign up — see note below).
2. Insert a row:
   ```sql
   insert into upperclassmen (auth_user_id, name, school_email)
   values ('their-auth-user-id', 'Full Name', 'their@schoolemail.org');
   ```
3. They sign in at `/login` and answer from `/dashboard`.

There's no public sign-up page by design — officers add upperclassmen manually, since GEA asked
for a "designated login" per answerer, not open registration.

## 6. Fill the President seat (and any other seat)

Either use the **Leadership Board** tab in the admin portal, or run SQL directly:

```sql
insert into leadership_members (role, name, bio)
values ('president', 'Jaden', 'GEA President')
on conflict (role) do update set name = excluded.name, bio = excluded.bio;
```

Every role you don't insert a row for shows as open on `/leadership`, with an "I'm Interested"
button leading to that role's application form.

## 7. Open interview slots

From the admin portal's **Interview Slots** tab, add lunch-period time blocks (label + date/time).
These are what applicants pick from once you send them an invite.

## 8. Run locally

```bash
npm install
npm run dev
```

## 9. Deploy

Deploy to Vercel (recommended, matches this project's config out of the box) and add the same
environment variables in the Vercel dashboard. Set `NEXT_PUBLIC_SITE_URL` to your real production
URL so interview links in emails point to the live site.

## Security notes

- The admin portal path (`/admin-portal-x7k9`) is unlisted, not authenticated-by-obscurity alone —
  every admin action is also gated by the `admins` table and Row Level Security. Rename the path
  to something only you know before you deploy, and update the link in
  `app/admin-portal-x7k9/login/page.tsx`'s redirect if you do.
- The interview booking page never reads the `applications` table directly. It only calls the
  `get_application_by_token` and `book_interview_slot` Postgres functions, which return the
  minimum fields needed and validate the token server-side — so a stolen or guessed link can't be
  used to browse other applicants' data.
- `SUPABASE_SERVICE_ROLE_KEY` must stay server-side only. It's used in one file
  (`app/api/send-interview-invite/route.ts`) and nowhere else.
