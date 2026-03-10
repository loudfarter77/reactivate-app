import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase'

// 1×1 transparent GIF — hardcoded bytes, no external dependency
const TRANSPARENT_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
)

const GIF_RESPONSE_HEADERS = {
  'Content-Type': 'image/gif',
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ emailId: string }> }
) {
  // Always return the GIF — tracking is best-effort, never block the response
  try {
    const { emailId } = await params

    const supabase = getSupabaseClient()

    // Look up email — silently skip if not found (invalid or expired link)
    const { data: email } = await supabase
      .from('emails')
      .select('id, opened_at, lead_id')
      .eq('id', emailId)
      .single()

    if (email && !email.opened_at) {
      // First open only — do not overwrite subsequent opens
      const now = new Date().toISOString()
      await Promise.all([
        supabase.from('emails').update({ opened_at: now }).eq('id', emailId),
        supabase.from('lead_events').insert({
          lead_id: email.lead_id,
          event_type: 'email_opened',
          description: 'Email opened (tracking pixel fired)',
        }),
      ])
    }
  } catch (err) {
    // Never let tracking errors surface to the client — just log and return GIF
    console.error('[track/open] Error recording open:', err)
  }

  return new NextResponse(TRANSPARENT_GIF, {
    status: 200,
    headers: GIF_RESPONSE_HEADERS,
  })
}
