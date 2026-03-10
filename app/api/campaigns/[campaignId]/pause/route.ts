import { NextRequest, NextResponse } from 'next/server'
import { getAdminUserId } from '@/lib/auth'
import { getSupabaseClient } from '@/lib/supabase'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const adminUserId = await getAdminUserId()
    if (!adminUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { campaignId } = await params
    const supabase = getSupabaseClient()

    const { data: campaign } = await supabase
      .from('campaigns')
      .select('status')
      .eq('id', campaignId)
      .single()

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    if (campaign.status !== 'active') {
      return NextResponse.json(
        { error: `Campaign is "${campaign.status}" — can only pause an active campaign` },
        { status: 400 }
      )
    }

    await supabase.from('campaigns').update({ status: 'paused' }).eq('id', campaignId)

    return NextResponse.json({ success: true, status: 'paused' })
  } catch (err) {
    console.error('[campaigns/pause] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
