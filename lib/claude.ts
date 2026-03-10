import Anthropic from '@anthropic-ai/sdk'

// ============================================================
// Types
// ============================================================

export interface GeneratedEmail {
  subject: string
  body: string
}

export interface GeneratedSms {
  body: string
}

// ============================================================
// Tone preset → prompt language (from AI_rules.md)
// ============================================================

const TONE_MAP: Record<string, string> = {
  professional: 'formal, respectful, business-like',
  friendly: 'warm, approachable, conversational',
  casual: 'relaxed, informal, like a friend',
  urgent: 'time-sensitive, direct, action-focused',
  empathetic: 'understanding, caring, patient',
}

// ============================================================
// Internal helpers
// ============================================================

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set')
  // Never pass the key to the browser — this function is server-only
  return new Anthropic({ apiKey })
}

function buildToneClause(tonePreset: string, toneCustom: string | null): string {
  const base = TONE_MAP[tonePreset] ?? 'professional, respectful, business-like'
  return toneCustom ? `${base}. Additionally: ${toneCustom}.` : base
}

function buildInstructionsBlock(customInstructions: string | null): string {
  if (!customInstructions) return ''
  return `\n\nHard rules you MUST follow:\n${customInstructions}`
}

function extractJsonFromText(text: string): string {
  // Strip markdown code fences if Claude wrapped the JSON
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenceMatch) return fenceMatch[1].trim()
  // Find the first [...] block
  const arrayMatch = text.match(/\[[\s\S]*\]/)
  if (arrayMatch) return arrayMatch[0]
  return text.trim()
}

// ============================================================
// generateEmailSequence
// ============================================================

/**
 * Generates a personalised 4-email reactivation sequence for a lead.
 * Server-side only — never import this in client components.
 *
 * Returns exactly 4 { subject, body } objects or throws.
 */
export async function generateEmailSequence(
  lead: { name: string },
  clientBusiness: string,
  tonePreset: string,
  toneCustom: string | null,
  customInstructions: string | null
): Promise<GeneratedEmail[]> {
  const client = getClient()
  const tone = buildToneClause(tonePreset, toneCustom)
  const instructions = buildInstructionsBlock(customInstructions)

  const prompt = `You are a copywriter crafting personalised reactivation emails for a small business.

Lead name: ${lead.name}
Business name: ${clientBusiness}
Tone: ${tone}${instructions}

Write exactly 4 emails with distinct purposes:
- Email 1: Initial reactivation — warm re-introduction, acknowledge the time since last contact, easy CTA with booking link
- Email 2: Follow-up — assume no reply to Email 1, reinforce the value, mention the booking link again
- Email 3: Final follow-up — last-chance tone, gentle urgency, booking link
- Email 4: Re-engagement — for leads who clicked but didn't book, or whose appointment was cancelled — acknowledge the near-miss, offer to reschedule

Non-negotiable rules:
- Every email body must be 150 words or fewer
- No spam trigger words (e.g. FREE, WINNER, CLICK HERE, GUARANTEED, LIMITED TIME)
- No ALL CAPS words
- No excessive punctuation (!!!, ???, ...)
- Address the lead by name (${lead.name}) naturally — not in every line
- Include [BOOKING_LINK] exactly once per email body as a natural call to action — this will be replaced with the real URL
- Each subject line must be unique and not clickbait
- Write in plain text — no HTML, no markdown
- Do not start with "Dear" — begin naturally
- Do not include unsubscribe text — that is appended automatically

Return ONLY a valid JSON array with exactly 4 objects. No preamble, no explanation, no code blocks.
Format: [{"subject":"...","body":"..."},{"subject":"...","body":"..."},{"subject":"...","body":"..."},{"subject":"...","body":"..."}]`

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 3000,
    messages: [{ role: 'user', content: prompt }],
  })

  const rawText = message.content[0]?.type === 'text' ? message.content[0].text : ''
  const jsonStr = extractJsonFromText(rawText)

  let emails: GeneratedEmail[]
  try {
    emails = JSON.parse(jsonStr)
  } catch {
    throw new Error(
      `Claude returned invalid JSON for email sequence (lead: ${lead.name}). Raw: ${rawText.slice(0, 200)}`
    )
  }

  if (!Array.isArray(emails) || emails.length !== 4) {
    throw new Error(
      `Claude returned ${Array.isArray(emails) ? emails.length : 'non-array'} emails for ${lead.name} — expected exactly 4`
    )
  }

  for (let i = 0; i < 4; i++) {
    if (typeof emails[i]?.subject !== 'string' || typeof emails[i]?.body !== 'string') {
      throw new Error(`Email ${i + 1} for ${lead.name} is missing required subject or body fields`)
    }
  }

  return emails
}

// ============================================================
// generateSmsSequence
// ============================================================

/**
 * Generates a personalised 4-SMS reactivation sequence for a lead.
 * Server-side only — never import this in client components.
 *
 * Returns exactly 4 { body } objects or throws.
 * Each body is guaranteed ≤ 160 characters.
 */
export async function generateSmsSequence(
  lead: { name: string },
  clientBusiness: string,
  tonePreset: string,
  toneCustom: string | null,
  customInstructions: string | null
): Promise<GeneratedSms[]> {
  const client = getClient()
  const tone = buildToneClause(tonePreset, toneCustom)
  const instructions = buildInstructionsBlock(customInstructions)

  const prompt = `You are writing personalised SMS reactivation messages for a small business.

Lead name: ${lead.name}
Business name: ${clientBusiness}
Tone: ${tone}${instructions}

Write exactly 4 SMS messages:
- SMS 1: Initial reactivation — short, personal, include booking link
- SMS 2: Follow-up — assume no reply to SMS 1
- SMS 3: Final follow-up — last attempt
- SMS 4: Re-engagement — for leads who clicked but didn't book or cancelled

Non-negotiable rules:
- Each message body must be 160 characters or fewer (including the literal text "[BOOKING_LINK]")
- Include [BOOKING_LINK] naturally in each message — it will be replaced with the real URL
- No spam trigger words
- Write personally to ${lead.name} — you may use their name once
- Count your characters carefully before returning — 160 is an absolute hard limit
- Do not include opt-out text — that is handled automatically

Return ONLY a valid JSON array with exactly 4 objects. No preamble, no explanation.
Format: [{"body":"..."},{"body":"..."},{"body":"..."},{"body":"..."}]`

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  const rawText = message.content[0]?.type === 'text' ? message.content[0].text : ''
  const jsonStr = extractJsonFromText(rawText)

  let smsList: GeneratedSms[]
  try {
    smsList = JSON.parse(jsonStr)
  } catch {
    throw new Error(
      `Claude returned invalid JSON for SMS sequence (lead: ${lead.name}). Raw: ${rawText.slice(0, 200)}`
    )
  }

  if (!Array.isArray(smsList) || smsList.length !== 4) {
    throw new Error(
      `Claude returned ${Array.isArray(smsList) ? smsList.length : 'non-array'} SMS for ${lead.name} — expected exactly 4`
    )
  }

  for (let i = 0; i < 4; i++) {
    if (typeof smsList[i]?.body !== 'string') {
      throw new Error(`SMS ${i + 1} for ${lead.name} is missing required body field`)
    }
    // Hard-cap at 160 chars — safety net if Claude exceeds the limit
    if (smsList[i].body.length > 160) {
      smsList[i].body = smsList[i].body.slice(0, 157) + '…'
    }
  }

  return smsList
}
