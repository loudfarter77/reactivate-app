# plan.md — AI Reactivation Campaign System
> Living document — check off each step as completed

---

## Phase 1 — Project Setup

- [ ] Create new GitHub repo: `reactivate-app`
- [ ] Scaffold Next.js 14 with TypeScript, Tailwind, App Router (no Turbopack, no src/)
- [ ] Verify .gitignore covers .env.local, node_modules, .next
- [ ] Run `git status` — confirm .env.local is not tracked
- [ ] Install core dependencies: `@clerk/nextjs @supabase/supabase-js @anthropic-ai/sdk nodemailer twilio papaparse zod date-fns googleapis`
- [ ] Initialise shadcn/ui: `npx shadcn-ui@latest init` — choose Dark default, CSS variables, Inter font
- [ ] Install shadcn/ui components: button, input, label, card, table, badge, dialog, dropdown-menu, select, textarea, skeleton, toast, tabs, separator, avatar
- [ ] Run `npm audit` — confirm 0 vulnerabilities
- [ ] Create .env.local with all variable names from architecture.md (values added as services are set up)
- [ ] Connect repo to Vercel — do NOT deploy yet
- [ ] Push initial commit to GitHub

---

## Phase 2 — Supabase Setup

- [ ] Create new Supabase project: `reactivate-app`
- [ ] Create all tables via SQL editor (in this order to respect FK dependencies):
  - [ ] `clients`
  - [ ] `campaign_templates`
  - [ ] `campaigns` (with template_id FK, all toggle columns, consent_basis)
  - [ ] `leads` (with booking_token DEFAULT gen_random_uuid(), email_opt_out, send_failure_count)
  - [ ] `emails`
  - [ ] `sms_messages`
  - [ ] `bookings` (with disputed + dispute_reason columns)
  - [ ] `send_failures`
  - [ ] `commission_disputes`
  - [ ] `lead_events`
- [ ] Enable RLS on all 10 tables
- [ ] Write RLS policies:
  - [ ] `clients` — admin only (read/write)
  - [ ] `campaign_templates` — admin only
  - [ ] `campaigns` — admin write, clients read their own
  - [ ] `leads` — admin read/write all, clients read their own
  - [ ] `emails` — admin only
  - [ ] `sms_messages` — admin only
  - [ ] `bookings` — admin read/write all, clients read their own
  - [ ] `send_failures` — admin only
  - [ ] `commission_disputes` — admin read/write all, clients read their own
  - [ ] `lead_events` — admin only
- [ ] Add Supabase URL + anon key to .env.local
- [ ] Add Supabase service role key to .env.local
- [ ] Create `lib/supabase.ts` with getSupabaseClient() function pattern — never module-level singleton

---

## Phase 3 — Clerk Setup

- [ ] Create new Clerk application: `reactivate-app`
- [ ] Enable Organisations in Clerk dashboard
- [ ] Add Clerk publishable key + secret key to .env.local
- [ ] Create `app/layout.tsx` with ClerkProvider
- [ ] Create `proxy.ts` (middleware) with route protection:
  - [ ] `/admin/*` — check userId is in ADMIN_USER_IDS
  - [ ] `/dashboard/*` — any authenticated Clerk user
  - [ ] `/book/*`, `/unsubscribe/*`, `/privacy`, `/terms` — public
- [ ] Create `app/sign-in/[[...rest]]/page.tsx`
- [ ] Create `app/sign-up/[[...rest]]/page.tsx`
- [ ] Sign up as first user → copy Clerk user ID → add to .env.local as ADMIN_USER_IDS
- [ ] Test: /admin redirects to sign-in when logged out, loads after auth, /dashboard accessible to non-admin

---

## Phase 4 — Admin: Client Management

- [ ] Create `app/admin/page.tsx` — admin home (placeholder for now, populated in Phase 17)
- [ ] Create `app/admin/clients/page.tsx` — client list from Supabase
- [ ] Create `app/admin/clients/new/page.tsx` — create client form (name, email, commission, notes, google_calendar_id)
- [ ] Create API route `app/api/clients/create/route.ts`:
  - [ ] Validate admin auth
  - [ ] Validate input with Zod
  - [ ] Insert into clients table
  - [ ] Create Clerk organisation for client
  - [ ] Store clerk_org_id on client record
- [ ] Create `app/admin/clients/[clientId]/page.tsx` — client detail with notes field (editable)
- [ ] API route to update client notes
- [ ] Test: create a test client, verify in Supabase + Clerk, edit notes

---

## Phase 5 — Admin: Campaign Templates

- [ ] Create `app/admin/templates/page.tsx` — template list
- [ ] Create API route `app/api/campaigns/templates/route.ts`:
  - [ ] GET: list all templates
  - [ ] POST: create new template (validate admin auth + Zod)
- [ ] Create API route `app/api/campaigns/templates/[templateId]/route.ts`:
  - [ ] GET: fetch single template
  - [ ] PUT: update template
  - [ ] DELETE: delete template
- [ ] Test: create, edit, delete a template

---

## Phase 6 — Admin: Campaign Creation + CSV Upload

- [ ] Create `app/admin/clients/[clientId]/campaigns/new/page.tsx` with:
  - [ ] Campaign name field
  - [ ] Template selector (optional — loads saved template fields)
  - [ ] Channel selector: email only, SMS only, email + SMS
  - [ ] Tone preset selector: Professional, Friendly, Casual, Urgent, Empathetic
  - [ ] Tone custom field: freeform
  - [ ] Custom instructions textarea
  - [ ] Consent basis selector: Previous customer / Quote requested / Service subscriber / Other
  - [ ] Toggles: notify_client, send_booking_confirmation, send_booking_reminder (all default on)
  - [ ] CSV upload field
  - [ ] Deliverability warning if lead count > DAILY_SEND_LIMIT
- [ ] Create `lib/csv.ts` using papaparse + zod:
  - [ ] Required: name, email (if email channel), phone (if SMS channel)
  - [ ] Validate email format per row
  - [ ] Validate phone format per row
  - [ ] Strip whitespace
  - [ ] Remove duplicates within the CSV itself
  - [ ] Cap at 1000 rows
  - [ ] Return validated rows + error summary
- [ ] Create API route `app/api/campaigns/create/route.ts`:
  - [ ] Validate admin auth
  - [ ] Validate all input with Zod
  - [ ] Check for duplicates vs existing active campaigns for same client
  - [ ] Return duplicate warning — require admin confirmation before proceeding
  - [ ] Insert campaign (status: draft)
  - [ ] Insert validated leads (booking_token auto-generated)
  - [ ] Return campaign ID + lead count + duplicate count
- [ ] Test: upload CSV, verify leads in Supabase with booking tokens, verify duplicate warning fires

---

## Phase 7 — Claude Email + SMS Generation

- [ ] Create `lib/claude.ts`:
  - [ ] Function: `generateEmailSequence(lead, clientBusiness, tonePreset, toneCustom, customInstructions)`
  - [ ] Tone preset maps to prompt language (see AI_rules.md)
  - [ ] If toneCustom: append "Additionally: [toneCustom]"
  - [ ] If customInstructions: append as hard rules Claude must follow
  - [ ] Instructs Claude: under 150 words per email, no spam language
  - [ ] Returns: array of exactly 4 { subject, body } objects
  - [ ] Validate: throw if not exactly 4
  - [ ] Function: `generateSmsSequence(lead, clientBusiness, tonePreset, toneCustom, customInstructions)`
  - [ ] Returns: array of exactly 4 { body } objects (each under 160 chars)
  - [ ] Validate: throw if not exactly 4
- [ ] Create API route `app/api/campaigns/[campaignId]/generate/route.ts`:
  - [ ] Validate admin auth
  - [ ] Fetch campaign + all leads
  - [ ] For each lead: generate email sequence (if channel includes email)
  - [ ] For each lead: generate SMS sequence (if channel includes SMS)
  - [ ] Store in emails + sms_messages tables
  - [ ] Update campaign status to "ready"
- [ ] Test: trigger generation, verify emails/SMS in Supabase, verify campaign status = "ready"

---

## Phase 8 — Campaign Preview + Edit

- [ ] Create `app/admin/clients/[clientId]/campaigns/[campaignId]/preview/page.tsx`:
  - [ ] List all leads with their Email 1 subject + body preview
  - [ ] Expandable view to see all 4 emails per lead
  - [ ] Inline edit fields for subject and body per email
  - [ ] "Approve & Send" button — only enabled when campaign status = "ready"
- [ ] Create API route `app/api/campaigns/[campaignId]/emails/[emailId]/edit/route.ts`:
  - [ ] Validate admin auth
  - [ ] Validate campaign status = "ready" — reject if not
  - [ ] Update email subject + body in Supabase
- [ ] Test: generate, edit an email, approve and send, verify edited content sent

---

## Phase 9 — Gmail SMTP Sending

- [ ] Set up Gmail App Password:
  - [ ] Enable 2FA on Gmail account
  - [ ] Generate App Password for "Mail"
  - [ ] Add GMAIL_USER + GMAIL_APP_PASSWORD to .env.local
- [ ] Create `lib/gmail.ts`:
  - [ ] Configure nodemailer with Gmail SMTP
  - [ ] Function: `sendEmail(to, subject, body, bookingUrl, replyTo, emailId)`
  - [ ] Set Reply-To header to replyTo (client's email) on every send
  - [ ] Append legal footer: agency name, agency address, unsubscribe link
  - [ ] Embed tracking pixel: `<img src="/api/track/open/[emailId]" width="1" height="1" style="display:none" />`
  - [ ] Include unique booking URL in email body
  - [ ] Enforce randomised delay 30–60 seconds between sends
- [ ] Create API route `app/api/campaigns/[campaignId]/send/route.ts`:
  - [ ] Validate admin auth
  - [ ] Validate campaign status = "ready"
  - [ ] Fetch campaign + leads + Email 1 per lead
  - [ ] Check DAILY_SEND_LIMIT — queue remainder if exceeded
  - [ ] For each lead: check email_opt_out before sending
  - [ ] Send Email 1 with rate limiting delay
  - [ ] On failure: log to send_failures, increment lead.send_failure_count
  - [ ] Update emails.sent_at, lead status to "emailed"
  - [ ] Update campaign status to "active"
- [ ] Create API route `app/api/track/open/[emailId]/route.ts`:
  - [ ] Look up email by ID — silently return 1x1 GIF if not found
  - [ ] Set emails.opened_at only if not already set (first open only)
  - [ ] Return 1x1 transparent GIF with Cache-Control: no-store
  - [ ] Never return an error — always return the GIF
- [ ] Add AGENCY_NAME, AGENCY_ADDRESS to .env.local
- [ ] Test: send to own email, verify Reply-To is client email, verify footer, verify tracking pixel fires, verify booking link is unique per lead

---

## Phase 10 — Email Unsubscribe

- [ ] Create `app/unsubscribe/[token]/page.tsx`:
  - [ ] Fetch lead by booking_token
  - [ ] Call unsubscribe API route
  - [ ] Show confirmation: "You have been unsubscribed"
- [ ] Create API route `app/api/unsubscribe/[token]/route.ts`:
  - [ ] Validate token exists
  - [ ] Set leads.email_opt_out = true
  - [ ] Log event to lead_events: "unsubscribed"
  - [ ] Return success
- [ ] Verify all email send functions check email_opt_out before sending
- [ ] Test: click unsubscribe link, verify email_opt_out = true, verify no further emails sent

---

## Phase 11 — Follow-up Email Cron

- [ ] Create API route `app/api/cron/follow-up/route.ts`:
  - [ ] Verify CRON_SECRET header
  - [ ] Skip leads where campaign.status = "paused"
  - [ ] Check email_opt_out and sms_opt_out before every send
  - [ ] Email 2: status = "emailed" + email 1 sent > 3 days ago + email 2 not sent
  - [ ] Email 3: status = "emailed" + email 1 sent > 8 days ago + email 3 not sent
  - [ ] Email 4: status = "clicked" + clicked > 24hrs ago + not booked + email 4 not sent
  - [ ] On failure: log to send_failures
  - [ ] Update sent_at after each send
- [ ] Add CRON_SECRET to .env.local
- [ ] Configure vercel.json cron: `{ "path": "/api/cron/follow-up", "schedule": "0 9 * * *" }`
- [ ] Test: manually trigger, verify correct emails sent, verify paused campaigns skipped

---

## Phase 12 — Failed Send Retry

- [ ] Verify send_failures table exists (created in Phase 2)
- [ ] Create API route `app/api/sends/retry/route.ts`:
  - [ ] Validate admin auth
  - [ ] Accept leadId + channel + sequenceNumber
  - [ ] Check attempt_count < MAX_SEND_RETRIES
  - [ ] Retry the send
  - [ ] On success: mark send_failures.resolved = true
  - [ ] On failure: increment attempt_count, if >= MAX_SEND_RETRIES set lead status to "send_failed"
- [ ] Create API route `app/api/cron/retry-sends/route.ts`:
  - [ ] Verify CRON_SECRET
  - [ ] Fetch unresolved failures where attempt_count < MAX_SEND_RETRIES
  - [ ] Retry each — update resolved/attempt_count
- [ ] Add to vercel.json: `{ "path": "/api/cron/retry-sends", "schedule": "0 11 * * *" }`
- [ ] Show failed sends on campaign detail page with retry button
- [ ] Test: simulate failure, verify in failed sends list, retry, verify resolved

---

## Phase 13 — Public Booking Page

- [ ] Set up Google Calendar API:
  - [ ] Enable Google Calendar API in Google Cloud console
  - [ ] Create OAuth 2.0 credentials
  - [ ] Add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI to .env.local
- [ ] Create `lib/calendar.ts`:
  - [ ] Function: `getAvailableSlots(calendarId, date)` — fetch free slots
  - [ ] Function: `createBooking(calendarId, slot, leadName, leadEmail)` — create event, return eventId
  - [ ] Function: `checkBookingStatus(calendarId, eventId)` — return event status or null if deleted
- [ ] Create `app/book/[token]/page.tsx`:
  - [ ] Fetch lead by booking_token — show error if invalid
  - [ ] Update lead.status = "clicked", set clicked_at
  - [ ] Fetch client's Google Calendar availability
  - [ ] Display available time slots
  - [ ] Booking form: confirm name + email, select slot, submit
- [ ] Create API route `app/api/leads/[token]/book/route.ts`:
  - [ ] Validate token
  - [ ] Create Google Calendar event
  - [ ] Insert booking into bookings table
  - [ ] Update lead status to "booked"
  - [ ] Log event to lead_events: "booked"
  - [ ] If campaign.send_booking_confirmation = true → send confirmation email to lead
  - [ ] If campaign.notify_client = true → send notification email to client
- [ ] Test: click a booking link, complete booking, verify in Supabase + Google Calendar, verify confirmation + notification emails

---

## Phase 14 — Booking Confirmation + Reminder

- [ ] Update `lib/gmail.ts` — add `sendBookingConfirmation(to, replyTo, clientName, scheduledAt)` function:
  - [ ] Include business name, date/time, client contact details
  - [ ] Include legal footer
- [ ] Update `lib/gmail.ts` — add `sendBookingReminder(to, replyTo, clientName, scheduledAt)` function:
  - [ ] Friendly reminder with date/time
  - [ ] Include legal footer
- [ ] Create API route `app/api/cron/reminders/route.ts`:
  - [ ] Verify CRON_SECRET
  - [ ] Fetch bookings where status = "booked" AND scheduled_at is within REMINDER_HOURS_BEFORE hours
  - [ ] For each: check campaign.send_booking_reminder = true before sending
  - [ ] Send reminder email/SMS to lead
- [ ] Add to vercel.json: `{ "path": "/api/cron/reminders", "schedule": "0 8 * * *" }`
- [ ] Test: create a booking, manually trigger reminders cron, verify reminder sent

---

## Phase 15 — Booking Cancellation Sync

- [ ] Create API route `app/api/cron/calendar-sync/route.ts`:
  - [ ] Verify CRON_SECRET
  - [ ] Fetch all bookings where status = "booked"
  - [ ] For each: call checkBookingStatus(calendarId, eventId)
  - [ ] If null or cancelled: update booking status to "cancelled", update lead status to "cancelled"
  - [ ] Log event to lead_events: "booking_cancelled"
  - [ ] Optionally send re-engagement Email 4 to cancelled lead
- [ ] Add to vercel.json: `{ "path": "/api/cron/calendar-sync", "schedule": "0 7 * * *" }`
- [ ] Test: cancel a Google Calendar event, run cron, verify booking marked cancelled

---

## Phase 16 — Client Dashboard

- [ ] Create `app/dashboard/page.tsx`:
  - [ ] Verify Clerk auth + get orgId
  - [ ] Fetch client record by clerk_org_id
  - [ ] Campaign stats as percentages: open rate, click rate, booking rate, completion rate
  - [ ] Lead list: name, status, date added (NO email/phone)
  - [ ] Bookings list with "Mark as Complete" button
  - [ ] Notification toggle per campaign (notify_client)
  - [ ] "Raise Dispute" button per completed booking
- [ ] Create API route `app/api/jobs/complete/route.ts`:
  - [ ] Accept bookingId + completedBy ("client" or "admin")
  - [ ] If client: validate booking belongs to their org
  - [ ] If admin: validate admin auth
  - [ ] Update booking status to "completed", set completed_at, completed_by, commission_owed
  - [ ] Update lead status to "completed"
  - [ ] Log event to lead_events: "completed"
- [ ] Create API route `app/api/bookings/[bookingId]/dispute/route.ts`:
  - [ ] Validate booking belongs to client's org
  - [ ] Insert into commission_disputes table (status: "open")
  - [ ] Update booking status to "disputed"
- [ ] Test: mark booking complete as client, raise a dispute, verify records in Supabase

---

## Phase 17 — Auto-Complete + Admin Overrides

- [ ] Create API route `app/api/jobs/auto-complete/route.ts`:
  - [ ] Verify CRON_SECRET
  - [ ] Fetch bookings where status = "booked" AND scheduled_at < NOW() - AUTO_COMPLETE_DAYS
  - [ ] For each: mark complete, completed_by = "auto", set commission_owed
  - [ ] Update lead status to "completed"
  - [ ] Log event to lead_events: "auto_completed"
- [ ] Add to vercel.json: `{ "path": "/api/jobs/auto-complete", "schedule": "0 10 * * *" }`
- [ ] Add "Admin Override Complete" button to admin campaign detail view
- [ ] Test: trigger auto-complete cron, verify bookings marked, verify completed_by = "auto"

---

## Phase 18 — Admin Billing Dashboard + Disputes

- [ ] Create `app/admin/billing/page.tsx`:
  - [ ] All completed bookings grouped by client
  - [ ] Per client: jobs completed, commission per job, total owed
  - [ ] Disputed bookings flagged (shown separately until resolved)
  - [ ] "Export Commission CSV" button
  - [ ] "Export Send Log" button per campaign
- [ ] Create API route `app/api/billing/export/route.ts`:
  - [ ] Validate admin auth
  - [ ] Fetch all completed bookings
  - [ ] Generate CSV: client, lead name, email, completed date, commission, completed_by
  - [ ] Return as downloadable CSV
- [ ] Create API route `app/api/billing/send-log/[campaignId]/route.ts`:
  - [ ] Validate admin auth
  - [ ] Fetch all leads + emails + sms_messages for campaign
  - [ ] Generate CSV: lead name, email, phone, email 1–4 sent/opened/clicked, SMS 1–4 sent/clicked, status
  - [ ] Return as downloadable CSV
- [ ] Create `app/admin/disputes/page.tsx`:
  - [ ] List all open disputes: client name, booking details, dispute reason, date raised
  - [ ] Resolve button per dispute
- [ ] Create API route `app/api/disputes/[disputeId]/resolve/route.ts`:
  - [ ] Validate admin auth
  - [ ] Accept status ("resolved" or "rejected") + admin_notes
  - [ ] Update commission_disputes record
  - [ ] If rejected: revert booking status to "completed"
  - [ ] If resolved: booking stays "disputed", commission_owed set to 0
- [ ] Test: download commission CSV, download send log, resolve a dispute

---

## Phase 19 — Campaign Pause + Resume

- [ ] Create API route `app/api/campaigns/[campaignId]/pause/route.ts`:
  - [ ] Validate admin auth
  - [ ] Check campaign status = "active"
  - [ ] Set status to "paused"
- [ ] Create API route `app/api/campaigns/[campaignId]/resume/route.ts`:
  - [ ] Validate admin auth
  - [ ] Check campaign status = "paused"
  - [ ] Set status to "active"
- [ ] Add pause/resume buttons to campaign detail page
- [ ] Test: pause campaign, trigger follow-up cron, verify no sends, resume, verify sends resume

---

## Phase 20 — Lead Audit Log + GDPR Erasure

- [ ] Verify lead_events is populated throughout all prior phases (email_sent, booked, completed, unsubscribed etc.)
- [ ] Display lead event log on campaign detail page per lead (admin only)
- [ ] Create API route `app/api/leads/[leadId]/delete/route.ts`:
  - [ ] Validate admin auth
  - [ ] Set name = "Deleted User", email = "deleted@deleted.com", phone = null, status = "deleted"
  - [ ] Log event to lead_events: "data_erased"
  - [ ] Return success
- [ ] Add "Erase Lead Data" button to lead detail view — require confirmation modal (irreversible)
- [ ] Test: erase a lead, verify anonymisation, verify booking records retained, verify event logged

---

## Phase 21 — Campaign Performance Analytics

- [ ] Add analytics calculation to campaign detail page:
  - [ ] Open rate = emails opened / emails sent
  - [ ] Click rate = leads clicked / emails sent
  - [ ] Booking rate = leads booked / emails sent
  - [ ] Completion rate = jobs completed / leads booked
- [ ] Add summary analytics to admin home page (aggregated across all campaigns)
- [ ] Test: run a full test campaign, verify percentages are accurate

---

## Phase 22 — Multi-User Agency Access

- [ ] Update proxy.ts to read ADMIN_USER_IDS as comma-separated list
- [ ] Create `app/admin/settings/page.tsx`:
  - [ ] List current admin users (by Clerk ID)
  - [ ] Invite new admin user by email via Clerk
- [ ] Update .env.local to support multiple IDs in ADMIN_USER_IDS
- [ ] Test: invite a second admin user, verify they can access /admin

---

## Phase 23 — Legal Pages

- [ ] Create `app/privacy/page.tsx` — privacy policy explaining data collection, retention, erasure rights
- [ ] Create `app/terms/page.tsx` — terms of service covering liability, commission, acceptable use
- [ ] Add links to /privacy and /terms in every email footer (alongside unsubscribe link)
- [ ] Test: verify pages are publicly accessible without login

---

## Phase 24 — Data Retention Automation

- [ ] Create API route `app/api/cron/data-retention/route.ts`:
  - [ ] Verify CRON_SECRET
  - [ ] Fetch leads from campaigns where status = "complete" AND campaign.created_at < DATA_RETENTION_MONTHS ago
  - [ ] For each lead: anonymise (name, email, phone) — retain bookings + events
  - [ ] Count anonymised records
  - [ ] Send admin notification email with count
- [ ] Add to vercel.json: `{ "path": "/api/cron/data-retention", "schedule": "0 3 1 * *" }` (monthly)
- [ ] Test: manually trigger, verify anonymisation, verify admin notification sent

---

## Phase 25 — SMS Channel (Twilio)

- [ ] Create Twilio account + purchase phone number
- [ ] Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, TWILIO_WEBHOOK_SECRET to .env.local
- [ ] Create `lib/twilio.ts`:
  - [ ] Configure Twilio client
  - [ ] Function: `sendSms(to, body)` — check sms_opt_out before sending
  - [ ] Include unique booking URL in every message
- [ ] Update generate route to run generateSmsSequence for SMS-enabled campaigns
- [ ] Update send route to send SMS 1 alongside Email 1 if SMS enabled
- [ ] Update follow-up cron to send SMS follow-ups on same Day 3 / Day 8 / clicked-not-booked schedule
- [ ] Create API route `app/api/webhooks/twilio/route.ts`:
  - [ ] Verify Twilio webhook signature header — reject if invalid
  - [ ] Parse inbound message body
  - [ ] If body contains "stop", "unsubscribe", "cancel" → set lead.sms_opt_out = true
  - [ ] Log event to lead_events: "sms_opted_out"
- [ ] Register webhook URL in Twilio dashboard → /api/webhooks/twilio
- [ ] Test: send SMS to own phone, verify booking link works, test STOP reply, verify opt-out

---

## Phase 26 — Vercel Deployment

- [ ] Add all env vars to Vercel dashboard
- [ ] Deploy — verify build succeeds with 0 errors
- [ ] Verify vercel.json cron jobs are recognised
- [ ] Test full flow on production URL:
  - [ ] Create client → create campaign → upload CSV → generate → preview → approve & send
  - [ ] Click booking link → complete booking → verify confirmation email → verify client notification
  - [ ] Mark job complete → verify commission recorded
  - [ ] Trigger reminders cron → verify reminder sent
  - [ ] Check billing dashboard → download commission CSV + send log CSV
- [ ] Run `npm audit` — confirm 0 vulnerabilities
- [ ] Run `git status` — confirm no secrets committed

---

## Phase 27 — Hardening (Post-launch)

- [ ] Add rate limiting to /book/[token] route (prevent token brute-forcing)
- [ ] Add rate limiting to /unsubscribe/[token] route (prevent abuse)
- [ ] Add error alerting — email admin on cron failure
- [ ] Review all RLS policies — tighten where possible
- [ ] Add Clerk JWT → Supabase integration for proper multi-tenant RLS
- [ ] Verify all server-only secrets have no NEXT_PUBLIC_ prefix
- [ ] Final security review of all API routes — confirm every route validates auth before executing
