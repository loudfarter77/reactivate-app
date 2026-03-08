# PRD.md — AI Reactivation Campaign System
> Placeholder name: **REACTIVATE** (to be renamed)

---

## What This Is

A multi-client SaaS platform that runs AI-powered email and SMS reactivation campaigns on behalf of small business clients. The agency uploads dormant lead CSVs, Claude generates personalised email and SMS sequences, messages are sent automatically, leads can book jobs via a public booking page connected to the client's Google Calendar, and the agency earns a flat commission per completed job. Each campaign can run email only, SMS only, or both — configurable per campaign at creation time.

---

## Who Uses It

| User | Role | Access |
|---|---|---|
| Agency admin (you) | Uploads CSVs, manages campaigns, views all clients, tracks commission | Full access — admin dashboard |
| Agency team member | Same as admin in V1 — invited via Clerk | Full admin access |
| Client | Views their own campaign stats, leads, bookings, marks jobs complete | Restricted — client dashboard (their data only) |
| Lead (end user) | Receives emails/SMS, clicks booking link, books a job | Public — booking page only, no login |

---

## Core Features

### 1. Campaign Management (Admin)
- Upload a CSV of dormant leads for a specific client
- System cleans and validates the CSV (removes duplicates, invalid emails/phones)
- Choose channel at campaign creation: email only, SMS only, or email + SMS
- **Tone selector** — choose from presets: Professional, Friendly, Casual, Urgent, Empathetic. Plus a freeform field for tone nuance beyond the preset (e.g. "slightly humorous", "very direct")
- **Custom instructions** — freeform textarea passed directly to Claude (e.g. "mention we offer a free quote", "don't mention price in Email 1")
- **Consent basis** — admin selects legal basis for contacting leads: "Previous customer", "Quote/enquiry requested", "Service subscriber", "Other"
- Tone, custom instructions, and consent basis stored per campaign
- Admin triggers generation — Claude produces personalised sequences using tone + instructions
- 4 email variants per lead (if email enabled):
  - Email 1: Initial reactivation
  - Email 2: Follow-up (sent Day 3 if no reply)
  - Email 3: Final follow-up (sent Day 8 if no reply)
  - Email 4: Re-engagement (sent if lead clicked but didn't book, or if booking was cancelled)
- 4 SMS variants per lead (if SMS enabled — same sequence logic)
- Every email sets Reply-To to client's contact email — replies from leads go directly to client inbox
- Each email contains a 1x1 tracking pixel — records opened_at on first load
- Note: Apple Mail Privacy Protection may pre-fetch pixels — opens are a useful signal but not 100% accurate
- SMS sent via Twilio with unique booking link per lead
- Leads who reply STOP to SMS are automatically opted out and never messaged again
- Emails sent with randomised delay between sends (30–60 seconds) to protect Gmail deliverability
- Daily send volume capped at DAILY_SEND_LIMIT (default 150) — remaining sends queued for next day
- Admin warned at campaign creation if lead count exceeds safe daily threshold

### 2. Campaign Preview & Edit Before Sending
- After Claude generates sequences, campaign enters "preview" status — nothing sent yet
- Admin can view every generated email and SMS per lead before sending
- Admin can edit any subject or body inline before sending
- Only after admin clicks "Approve & Send" does campaign go active and Email 1 / SMS 1 go out

### 3. Campaign Templates
- Save any campaign configuration as a reusable template
- Templates store: channel, tone preset, tone custom, custom instructions
- Load a template at campaign creation to pre-fill all fields
- Templates editable and deletable from a dedicated templates page

### 4. Duplicate Lead Protection
- At CSV upload, system checks for duplicate emails/phones against existing active campaigns for the same client
- Duplicates flagged to admin before campaign is created — admin can skip or override
- Never silently inserted

### 5. Campaign Pause & Resume
- Admin can pause any active campaign at any time
- When paused: cron job skips all follow-ups for that campaign
- When resumed: schedule continues from where it left off (does not restart)
- Status flow: draft → ready → active → paused → complete

### 6. Failed Send Retry
- Send failures logged in send_failures table with error reason and attempt count
- Failed sends shown on campaign detail page with retry button per lead
- Admin can manually retry per lead
- Daily cron auto-retries up to MAX_SEND_RETRIES attempts
- After max attempts: lead marked send_failed, no further retries

### 7. Booking Page (Public)
- Unique URL per lead containing their booking token
- Records lead click with timestamp when page is visited
- Reads client's Google Calendar availability
- Lead selects slot, confirms name + email, submits
- Booking created in Google Calendar and Supabase
- Attribution recorded: clicked → booked

### 8. Booking Confirmation to Lead (Toggleable)
- When a lead books, a confirmation email is automatically sent to the lead
- Includes: business name, booked date/time, client contact details
- Toggleable per campaign via send_booking_confirmation flag (default on)
- Toggled at campaign creation and editable from campaign detail page

### 9. Booking Reminder to Lead (Toggleable)
- Reminder email/SMS sent to lead REMINDER_HOURS_BEFORE hours before their appointment
- Reduces no-shows, directly improves completion rate and commission
- Toggleable per campaign via send_booking_reminder flag (default on)
- Toggled at campaign creation and editable from campaign detail page

### 10. Booking Cancellation Sync
- Daily cron checks Google Calendar for cancelled or deleted events
- Any booking whose google_event_id no longer exists or is cancelled is updated to status = "cancelled"
- Cancelled bookings do not trigger commission
- Optional re-engagement Email 4 sent to cancelled leads

### 11. Client Dashboard (Clerk-protected, per-client)
- Campaign stats: emails sent, opened, clicked, booked, completed — shown as percentages
- Full lead list: name, status, date added (email/phone NOT shown — privacy)
- All bookings with scheduled date/time and "Mark as Complete" button
- Raise a commission dispute on any completed booking
- Toggle booking notifications on/off per campaign
- Cannot see other clients' data

### 12. Client Booking Notifications
- Email notification sent to client when a new booking is made
- Includes: lead name, booked time slot, dashboard link
- Toggleable per campaign via notify_client flag (default on)

### 13. Agency Admin Dashboard (Clerk-protected, admin only)
- All clients overview with campaign performance summary and conversion rates
- Per client: campaign list, lead list with audit log, booking list, analytics
- Admin override — manually mark any booking as complete
- Commission tracker: jobs completed × flat fee per client
- Commission CSV export for invoicing
- Campaign send log CSV export per campaign (every lead, every email/SMS, all timestamps)
- Open disputes list with resolution tools
- Notes per client (freeform, admin only, never shown to client)
- Failed send log per campaign with retry buttons

### 14. Commission Disputes
- Client can raise a dispute on any completed booking from their dashboard with a written reason
- Admin sees all open disputes in a dedicated disputes page
- Admin can resolve (uphold or reject) with notes
- Disputed bookings flagged in billing dashboard until resolved

### 15. Auto-Complete
- Daily cron checks all bookings where status = "booked" and scheduled_at is more than AUTO_COMPLETE_DAYS ago
- Automatically marked completed, completed_by = "auto", commission recorded
- Protects against clients who forget or avoid marking completions

### 16. Lead Event Audit Log
- Every significant action on a lead logged to lead_events table with timestamp
- Events: email sent, email opened, SMS sent, booking link clicked, booked, completed, unsubscribed, data erased
- Viewable per lead in admin campaign detail view — full history for debugging and disputes

### 17. Campaign Performance Analytics
- Per campaign stats as percentages: open rate, click rate, booking rate, completion rate
- Visible on campaign detail page and admin home dashboard
- Helps identify which campaigns, tones, and client types perform best

### 18. Multi-User Agency Access
- Additional admin users invitable via Clerk by email
- All admin users have full access in V1
- Admin user list visible in settings page

### 19. Notes Per Client
- Freeform notes field on each client record (commission arrangements, special instructions, relationship notes)
- Editable from client detail page — admin only, never shown to client

### 20. GDPR / Data Handling
- Admin can erase a lead's personal data on request (right to erasure)
- Erasure anonymises: name → "Deleted User", email → "deleted@deleted.com", phone → null
- Booking and attribution records retained for billing purposes
- Monthly cron auto-anonymises leads from campaigns completed over DATA_RETENTION_MONTHS ago
- Admin notified when data retention cron runs with count of anonymised records
- Privacy policy page at /privacy

### 21. Legal Email Compliance
- Every outgoing email includes: agency name, agency address, unsubscribe link
- Footer appended server-side — never optional, never skippable
- Unsubscribe link: /unsubscribe/[token] — sets email_opt_out = true, shows confirmation
- Terms of service page at /terms
- Consent basis stored per campaign for legal defensibility if challenged
- All env vars: AGENCY_NAME, AGENCY_ADDRESS

### 22. Attribution Tracking
Full chain tracked per lead:
`Email/SMS Sent → Email Opened → Email/SMS Clicked → Booking Page Visited → Booked → Job Completed → Commission Owed`

---

## What This Is NOT

- Not a cold outreach tool — leads must have a prior relationship with the client
- Not a self-serve platform — clients do not upload CSVs or manage campaigns
- Not a payment processor — commission tracked, not automatically charged
- Not a CRM — no lead scoring, no sales pipeline
- Not white-labelled — clients see the platform as-is
- No inbound reply capture — replies route to client inbox directly via Reply-To header

---

## Commission Model

- Flat fee per completed job (amount configurable per client)
- Tracked in Supabase, visible in admin billing dashboard
- CSV export for invoicing — no automatic charging in V1
- Client can raise disputes from their dashboard

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| Auth | Clerk (multi-tenant) |
| Database | Supabase (Postgres) |
| Email sending | Gmail SMTP via nodemailer |
| SMS sending | Twilio |
| Email/SMS generation | Claude API (Anthropic) |
| Calendar | Google Calendar API |
| Hosting | Vercel |
| Repo | GitHub (new repo, separate from waitlist app) |

---

## Out of Scope for V1

- Automatic payment/invoicing
- Client self-onboarding
- WhatsApp or other channels beyond email and SMS
- White labelling
- A/B testing email/SMS variants
- Mobile app
- Inbound reply capture
