import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminUserId } from '@/lib/auth'
import { retryEmailSend } from '@/lib/retry-send'

const retrySchema = z.object({
  send_failure_id: z.string().uuid(),
})

export async function POST(req: NextRequest) {
  try {
    // 1. Admin auth
    const adminUserId = await getAdminUserId()
    if (!adminUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Validate input
    const body = await req.json()
    const parsed = retrySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
        { status: 400 }
      )
    }

    // 3. Attempt retry
    const result = await retryEmailSend(parsed.data.send_failure_id)

    if (result.maxedOut) {
      return NextResponse.json(
        { error: 'Maximum retry attempts reached — lead marked as send_failed', maxedOut: true },
        { status: 400 }
      )
    }

    if (!result.success) {
      return NextResponse.json({ error: result.error ?? 'Retry failed' }, { status: 500 })
    }

    return NextResponse.json({ success: true, resolved: result.resolved })
  } catch (err) {
    console.error('[sends/retry] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
