# AI_rules.md — AI Reactivation Campaign System

---

## Security Rules (Non-Negotiable)

### Secrets
- Never use NEXT_PUBLIC_ prefix on any secret or server-only key
- Server-only vars: SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY, GMAIL_APP_PASSWORD, TWILIO_AUTH_TOKEN, GOOGLE_CLIENT_SECRET, CRON_SECRET, TWILIO_WEBHOOK_SECRET
- All secrets in .env.local only — never hardcoded, never committed
- Run `git status` before every push — confirm .env.local is not tracked

### Supabase
- Always use getSupabaseClient() function pattern — never a module-level singleton
- Use service role key (server-only) for admin API routes
- Use anon key only for public/client-facing routes
- RLS enabled on all tables — never disable
- Never expose service role key to browser under any circumstance

### API Routes
- Every API route input validated with Zod before any processing
- Every admin route checks userId against ADMIN_USER_IDS before executing
- Every client route checks Clerk org membership before executing
- Cron routes verify CRON_SECRET header — reject if missing or wrong
- Twilio webhook route verifies Twilio signature header — reject if invalid
- Rate limit the booking route and unsubscribe route to prevent abuse

### Email Security
- Every outgoing email must set Reply-To header to the client's contact email
- Every outgoing email must include unsubscribe link, agency name, and agency address in footer — appended server-side, never skippable
- Never send an email if lead.email_opt_out = true — check before every send
- Never send an SMS if lead.sms_opt_out = true — check before every send
- Never send to a lead if campaign status = "paused"
- Never send more than the defined 4-email sequence to any lead
- Gmail App Password stored in env only — never in code or database
- AGENCY_NAME and AGENCY_ADDRESS are env vars — never hardcoded
- Randomise send delay 30–60 seconds between each email send
- Enforce DAILY_SEND_LIMIT — never exceed in a single day

### GDPR & Data
- Lead deletion must anonymise, not hard delete — billing records must be retained
- Never log personal data (name, email, phone) in server logs or error messages
- On erasure: name → "Deleted User", email → "deleted@deleted.com", phone → null, status → "deleted"

### Claude API
- Anthropic API key is server-only — never referenced in client components
- Never expose prompt templates or system prompts to the client/browser
- Always validate Claude returns exactly 4 emails or 4 SMS messages — throw if not
- Custom instructions treated as hard constraints Claude must follow
- Prompts must instruct Claude to avoid spam trigger words

---

## Approved Libraries

| Library | Purpose |
|---|---|
| @clerk/nextjs | Auth and multi-tenancy |
| @supabase/supabase-js | Database client |
| @anthropic-ai/sdk | Claude API |
| nodemailer | Gmail SMTP email sending |
| twilio | SMS sending and webhook verification |
| googleapis | Google Calendar API |
| papaparse | CSV parsing |
| zod | Input validation on all API routes |
| date-fns | Date manipulation |
| shadcn/ui | UI component library — use for all UI primitives |
| Inter (via next/font) | Typography |

Do not add any library not on this list without asking first.

---

## Claude API Usage

### Tone Preset Mapping
| Preset | Prompt Language |
|---|---|
| professional | "formal, respectful, business-like" |
| friendly | "warm, approachable, conversational" |
| casual | "relaxed, informal, like a friend" |
| urgent | "time-sensitive, direct, action-focused" |
| empathetic | "understanding, caring, patient" |

- If tone_custom is set: append "Additionally: [tone_custom]" to the tone instruction
- If custom_instructions is set: append as explicit rules Claude must follow
- Always instruct Claude: emails under 150 words, no spam language, no ALL CAPS, no excessive punctuation
- SMS: under 160 characters including booking link placeholder

### Validation
- generateEmailSequence must return exactly 4 objects with { subject, body }
- generateSmsSequence must return exactly 4 objects with { body }
- Throw a descriptive error if count is wrong — do not silently continue

---

## Code Conventions

- All API route files: `route.ts` inside `app/api/`
- All lib files: `kebab-case.ts` inside `lib/`
- All components: `PascalCase.tsx`
- Database columns: `snake_case`
- Environment variables: `SCREAMING_SNAKE_CASE`
- Never use default exports for utility functions — use named exports
- Use async/await throughout — no raw .then() chains
- Every try/catch must log the error with context before re-throwing or returning a response

---

## Campaign Safety Checks (enforce in every relevant function)

Before sending any email or SMS, always check in this order:
1. campaign.status === "active" — reject if paused, draft, or complete
2. lead.email_opt_out === false (for email sends)
3. lead.sms_opt_out === false (for SMS sends)
4. lead.send_failure_count < MAX_SEND_RETRIES
5. lead.status is not "deleted" or "unsubscribed"

Campaign cannot transition from "ready" to "active" without admin explicitly calling the send route — enforce server-side.

---

## UI & Design Rules

### Component Library
- Use **shadcn/ui** for all UI components — install via `npx shadcn-ui@latest init`
- Do not build custom UI primitives (buttons, inputs, modals, tables) from scratch — use shadcn/ui components
- Extend shadcn/ui components where needed — do not replace them

### Styling
- Tailwind CSS utility classes only — no inline styles, no CSS modules, no styled-components
- Dark mode is the default — light mode must also work (use Tailwind `dark:` classes throughout)
- Use CSS variables for colours (shadcn/ui default setup handles this)
- Consistent spacing: use Tailwind spacing scale, do not invent arbitrary values

### Design Principles
- Modern SaaS neutral aesthetic — think Notion, Intercom, Linear
- Every page must look like a real shipped product — no raw HTML, no unstyled forms
- Clean hierarchy: clear headings, readable body text, strong visual separation between sections
- Data-heavy pages (lead lists, campaign tables) must use proper tables with sorting indicators
- Status indicators (campaign status, lead status) must use colour-coded badges — not plain text
- Empty states must be designed — never show a blank page or empty table without a helpful message
- Loading states must be handled — use shadcn/ui Skeleton components while data fetches
- Error states must be handled — show clear, friendly error messages, never raw error strings

### Layout
- Admin dashboard: persistent left sidebar navigation + main content area
- Client dashboard: simpler top navigation + main content area
- Sidebar items: Dashboard, Clients, Templates, Disputes, Billing, Settings (admin) — adapt per role
- All pages must be fully responsive down to 768px minimum

### Component Structure
- Break every page into small, reusable components — never build a 300-line page component
- Shared components go in `components/ui/`
- Admin-specific components go in `components/admin/`
- Dashboard-specific components go in `components/dashboard/`
- Booking page components go in `components/booking/`
- Every component must have a single clear responsibility

### Typography
- Use the Inter font (shadcn/ui default)
- Heading hierarchy: h1 for page titles, h2 for section titles, h3 for card titles
- Body text: text-sm or text-base — never smaller than text-xs for readable content
