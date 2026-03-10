import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase'
import { retryEmailSend } from '@/lib/retry-send'

export const maxDuration = 300

function verifyCronSecret(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return false
  return req.headers.get('authorization') === `Bearer ${cronSecret}`
}

export async function POST(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseClient()
  const maxSendRetries = parseInt(process.env.MAX_SEND_RETRIES ?? '3', 10)

  // Fetch all unresolved email failures below the max retry threshold
  const { data: failures, error } = await supabase
    .from('send_failures')
    .select('id, lead_id, campaign_id, attempt_count')
    .eq('resolved', false)
    .eq('channel', 'email')
    .lt('attempt_count', maxSendRetries)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[cron/retry-sends] Failed to fetch failures:', error.message)
    return NextResponse.json({ error: 'Failed to fetch failures' }, { status: 500 })
  }

  if (!failures || failures.length === 0) {
    return NextResponse.json({ message: 'No unresolved failures to retry', retried: 0 })
  }

  let resolved = 0
  let stillFailed = 0
  let maxedOut = 0

  for (const failure of failures) {
    const result = await retryEmailSend(failure.id)

    if (result.resolved) resolved++
    else if (result.maxedOut) maxedOut++
    else stillFailed++
  }

  return NextResponse.json({
    success: true,
    retried: failures.length,
    resolved,
    still_failed: stillFailed,
    maxed_out: maxedOut,
    message: `Retry cron complete: ${resolved} resolved, ${stillFailed} still failing, ${maxedOut} maxed out`,
  })
}
