# architecture.md — AI Reactivation Campaign System

---

## Folder Structure

```
reactivate/
├── app/
│   ├── layout.tsx                            # Root layout with ClerkProvider
│   ├── page.tsx                              # Landing/home (redirect to admin or sign-in)
│   ├── sign-in/[[...rest]]/page.tsx          # Clerk sign-in
│   ├── sign-up/[[...rest]]/page.tsx          # Clerk sign-up
│   ├── privacy/page.tsx                      # Privacy policy (public)
│   ├── terms/page.tsx                        # Terms of service (public)
│   ├── unsubscribe/[token]/page.tsx          # Email unsubscribe confirmation (public)
│   ├── book/[token]/page.tsx                 # Public booking page (unique per lead)
│   ├── admin/
│   │   ├── page.tsx                          # Admin home — all clients + performance overview
│   │   ├── settings/page.tsx                 # Admin user management
│   │   ├── templates/page.tsx                # Campaign templates list + create/edit
│   │   ├── disputes/page.tsx                 # All open commission disputes
│   │   ├── billing/page.tsx                  # Commission tracker + CSV exports
│   │   └── clients/
│   │       ├── page.tsx                      # Client list
│   │       ├── new/page.tsx                  # Create new client
│   │       └── [clientId]/
│   │           ├── page.tsx                  # Client detail + notes + campaign list
│   │           └── campaigns/
│   │               ├── new/page.tsx          # Create campaign + CSV upload
│   │               └── [campaignId]/
│   │                   ├── page.tsx          # Campaign detail + lead list + analytics + failed sends
│   │                   └── preview/page.tsx  # Preview + edit generated emails/SMS before sending
│   └── dashboard/
│       └── page.tsx                          # Client dashboard (Clerk org-scoped)
├── components/
│   ├── ui/                                   # Shared UI components
│   ├── admin/                                # Admin-specific components
│   ├── dashboard/                            # Client dashboard components
│   └── booking/                              # Booking page components
├── lib/
│   ├── supabase.ts                           # Supabase client (always use getSupabaseClient())
│   ├── clerk.ts                              # Clerk helpers
│   ├── gmail.ts                              # Gmail SMTP sender (nodemailer)
│   ├── claude.ts                             # Claude API email + SMS generator
│   ├── twilio.ts                             # Twilio SMS sender
│   ├── calendar.ts                           # Google Calendar integration
│   └── csv.ts                                # CSV parser + validator
├── app/api/
│   ├── campaigns/
│   │   ├── create/route.ts                   # Create campaign + parse + validate CSV
│   │   ├── templates/route.ts                # List + create campaign templates
│   │   ├── templates/[templateId]/route.ts   # Get / update / delete template
│   │   ├── [campaignId]/generate/route.ts    # Generate email/SMS sequences via Claude
│   │   ├── [campaignId]/send/route.ts        # Approve + trigger Email 1 / SMS 1 sending
│   │   ├── [campaignId]/emails/[emailId]/edit/route.ts  # Edit generated email before sending
│   │   ├── [campaignId]/pause/route.ts       # Pause active campaign
│   │   └── [campaignId]/resume/route.ts      # Resume paused campaign
│   ├── leads/
│   │   ├── [token]/book/route.ts             # Handle booking submission
│   │   └── [leadId]/delete/route.ts          # GDPR erasure — anonymise lead data
│   ├── bookings/
│   │   └── [bookingId]/dispute/route.ts      # Client raises commission dispute
│   ├── disputes/
│   │   └── [disputeId]/resolve/route.ts      # Admin resolves dispute
│   ├── track/
│   │   └── open/[emailId]/route.ts           # Tracking pixel — records email open
│   ├── unsubscribe/
│   │   └── [token]/route.ts                  # Sets email_opt_out = true on lead
│   ├── sends/
│   │   └── retry/route.ts                    # Manually retry a failed send
│   ├── jobs/
│   │   ├── complete/route.ts                 # Mark job complete (client or admin)
│   │   └── auto-complete/route.ts            # Cron — auto-complete old bookings
│   ├── cron/
│   │   ├── follow-up/route.ts                # Daily — send follow-up emails/SMS
│   │   ├── reminders/route.ts                # Daily — send booking reminders to leads
│   │   ├── calendar-sync/route.ts            # Daily — sync cancelled Google Calendar events
│   │   ├── retry-sends/route.ts              # Daily — auto-retry failed sends
│   │   └── data-retention/route.ts           # Monthly — anonymise old lead data
│   ├── webhooks/
│   │   └── twilio/route.ts                   # Inbound SMS — handle STOP opt-outs
│   └── billing/
│       ├── export/route.ts                   # CSV export of commission owed
│       └── send-log/[campaignId]/route.ts    # CSV export of full campaign send log
├── proxy.ts                                  # Clerk middleware (route protection)
├── vercel.json                               # Cron job schedule
├── .env.local                                # Secrets (never committed)
├── .gitignore
├── package.json
└── tsconfig.json
```

---

## Supabase Database Schema

### `clients`
| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| name | TEXT | Business name |
| email | TEXT | Client contact email |
| clerk_org_id | TEXT | Links Clerk org to client record |
| commission_per_job | INTEGER | Flat fee in cents |
| google_calendar_id | TEXT | Client's Google Calendar ID |
| notes | TEXT | Freeform admin notes — never shown to client |
| created_at | TIMESTAMPTZ | Auto |

### `campaign_templates`
| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| name | TEXT | Template name |
| channel | TEXT | email, sms, or both |
| tone_preset | TEXT | Saved tone preset |
| tone_custom | TEXT | Saved freeform tone addition |
| custom_instructions | TEXT | Saved Claude instructions |
| created_at | TIMESTAMPTZ | Auto |

### `campaigns`
| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| client_id | UUID | FK → clients |
| template_id | UUID | FK → campaign_templates (optional) |
| name | TEXT | Campaign name |
| status | TEXT | draft, ready, active, paused, complete |
| channel | TEXT | email, sms, or both |
| tone_preset | TEXT | professional, friendly, casual, urgent, empathetic |
| tone_custom | TEXT | Freeform tone addition |
| custom_instructions | TEXT | Freeform Claude instructions |
| consent_basis | TEXT | Previous customer / Quote requested / Service subscriber / Other |
| notify_client | BOOLEAN | Default true — notify client on new booking |
| send_booking_confirmation | BOOLEAN | Default true — send confirmation email to lead after booking |
| send_booking_reminder | BOOLEAN | Default true — send reminder to lead before appointment |
| send_rate_per_hour | INTEGER | Default 30 — max emails per hour for deliverability |
| created_at | TIMESTAMPTZ | Auto |

### `leads`
| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| campaign_id | UUID | FK → campaigns |
| client_id | UUID | FK → clients |
| name | TEXT | Lead's name |
| email | TEXT | Required if channel includes email |
| phone | TEXT | Required if channel includes SMS |
| booking_token | UUID | Unique token for booking URL — DEFAULT gen_random_uuid() |
| status | TEXT | pending, emailed, sms_sent, clicked, booked, completed, unsubscribed, send_failed, cancelled, deleted |
| sms_opt_out | BOOLEAN | Default false — true if lead replies STOP |
| email_opt_out | BOOLEAN | Default false — true if lead clicks unsubscribe |
| send_failure_count | INTEGER | Default 0 — increments on each failed send |
| created_at | TIMESTAMPTZ | Auto |

### `emails`
| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| lead_id | UUID | FK → leads |
| sequence_number | INTEGER | 1, 2, 3, or 4 |
| subject | TEXT | Generated by Claude (editable before send) |
| body | TEXT | Generated by Claude (editable before send) |
| sent_at | TIMESTAMPTZ | When sent |
| opened_at | TIMESTAMPTZ | When tracking pixel fired (first open only) |
| clicked_at | TIMESTAMPTZ | When booking link clicked |

### `sms_messages`
| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| lead_id | UUID | FK → leads |
| sequence_number | INTEGER | 1, 2, 3, or 4 |
| body | TEXT | Generated by Claude (under 160 chars) |
| sent_at | TIMESTAMPTZ | When sent |
| clicked_at | TIMESTAMPTZ | When booking link clicked |

### `bookings`
| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| lead_id | UUID | FK → leads |
| client_id | UUID | FK → clients |
| scheduled_at | TIMESTAMPTZ | Booked time slot |
| google_event_id | TEXT | Google Calendar event ID |
| status | TEXT | booked, completed, cancelled, disputed |
| completed_at | TIMESTAMPTZ | When marked complete |
| completed_by | TEXT | "client", "admin", or "auto" |
| commission_owed | INTEGER | In cents |
| created_at | TIMESTAMPTZ | Auto |

### `send_failures`
| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| lead_id | UUID | FK → leads |
| campaign_id | UUID | FK → campaigns |
| channel | TEXT | email or sms |
| sequence_number | INTEGER | Which sequence message failed |
| error_message | TEXT | Raw error from Gmail/Twilio |
| attempt_count | INTEGER | Default 1 — increments on retry |
| resolved | BOOLEAN | Default false — true when send succeeds or max attempts hit |
| created_at | TIMESTAMPTZ | Auto |

### `commission_disputes`
| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| booking_id | UUID | FK → bookings |
| client_id | UUID | FK → clients |
| reason | TEXT | Client's dispute reason |
| status | TEXT | open, resolved, rejected |
| admin_notes | TEXT | Admin response/resolution notes |
| created_at | TIMESTAMPTZ | Auto |

### `lead_events`
| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| lead_id | UUID | FK → leads |
| event_type | TEXT | email_sent, email_opened, sms_sent, clicked, booked, completed, unsubscribed, data_erased |
| description | TEXT | Human-readable description |
| created_at | TIMESTAMPTZ | Auto — event timestamp |

---

## Data Flow

### Campaign Creation Flow
```
Admin fills campaign form (tone, instructions, consent basis, toggles)
→ Admin uploads CSV
→ API validates CSV — checks for duplicates vs existing campaigns
→ Duplicates flagged to admin — admin confirms/skips
→ Campaign inserted (status: draft)
→ Leads inserted with booking_token auto-generated
→ Admin triggers generation
→ Claude generates 4 emails + 4 SMS per lead
→ Emails/SMS stored in Supabase
→ Campaign status set to "ready"
→ Admin reviews preview — edits if needed
→ Admin clicks "Approve & Send"
→ Email 1 / SMS 1 sent with rate limiting (randomised delay)
→ Campaign status set to "active"
```

### Follow-up Flow
```
Cron runs daily
→ Skip if campaign status = "paused"
→ Leads with email 1 sent > 3 days ago + no email 2 → send Email 2
→ Leads with email 1 sent > 8 days ago + no email 3 → send Email 3
→ Leads with clicked > 24hrs ago + not booked + no email 4 → send Email 4
→ Update sent_at timestamps
```

### Booking Flow
```
Lead clicks booking link in email/SMS
→ Lead status updated to "clicked" + clicked_at recorded
→ /book/[token] page loads
→ Google Calendar API fetches available slots
→ Lead selects slot + submits
→ Google Calendar event created
→ Booking inserted into Supabase
→ Lead status updated to "booked"
→ If send_booking_confirmation = true → confirmation email sent to lead
→ If notify_client = true → notification email sent to client
```

### Reminder Flow
```
Cron runs daily
→ Fetch bookings where status = "booked" AND scheduled_at is within REMINDER_HOURS_BEFORE hours
→ If send_booking_reminder = true on campaign → send reminder email/SMS to lead
```

### Job Completion Flow
```
Client clicks "Mark as Complete" on booking
→ API validates booking belongs to their org
→ Booking status → "completed", completed_by = "client"
→ commission_owed = client.commission_per_job
→ Lead status → "completed"
→ Admin billing dashboard updated
```

---

## Auth Architecture (Clerk Multi-tenancy)

| Role | Clerk Setup | Access |
|---|---|---|
| Agency admin | Clerk users with ID in ADMIN_USER_IDS env var | All /admin/* routes |
| Agency team | Additional Clerk users added to ADMIN_USER_IDS | All /admin/* routes |
| Client | Clerk organisation per client | /dashboard/* scoped to their org |
| Lead | No auth | /book/[token], /unsubscribe/[token] only |

### Route Protection (proxy.ts)
- `/admin/*` — admin only (check userId against ADMIN_USER_IDS list)
- `/dashboard/*` — any authenticated Clerk user
- `/book/*` — public
- `/unsubscribe/*` — public
- `/privacy`, `/terms` — public
- `/sign-in`, `/sign-up` — public

---

## Naming Conventions

- Files: `kebab-case.ts`
- Components: `PascalCase.tsx`
- Functions: `camelCase`
- Database columns: `snake_case`
- Environment variables: `SCREAMING_SNAKE_CASE`
- API routes: `/api/resource/action`

---

## Environment Variables

```
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
ADMIN_USER_IDS=                          # Comma-separated Clerk user IDs with admin access

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=               # Server-only — never expose to browser

# Claude
ANTHROPIC_API_KEY=                       # Server-only — never expose to browser

# Gmail SMTP
GMAIL_USER=
GMAIL_APP_PASSWORD=                      # Server-only — App Password, not account password

# Twilio
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=                       # Server-only
TWILIO_PHONE_NUMBER=
TWILIO_WEBHOOK_SECRET=                   # For verifying inbound webhook signature

# Google Calendar
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=                    # Server-only
GOOGLE_REDIRECT_URI=

# App Config
ADMIN_USER_IDS=                          # Comma-separated list of Clerk user IDs with admin access
AUTO_COMPLETE_DAYS=3                     # Days after booking before auto-complete triggers
CRON_SECRET=                             # Shared secret header to secure all cron routes
AGENCY_NAME=                             # Injected into every email footer
AGENCY_ADDRESS=                          # Injected into every email footer
MAX_SEND_RETRIES=3                       # Max send attempts before marking lead send_failed
DAILY_SEND_LIMIT=150                     # Max emails/day per Gmail account
DATA_RETENTION_MONTHS=12                 # Months before completed campaign data is anonymised
REMINDER_HOURS_BEFORE=24                 # Hours before appointment to send booking reminder
```
