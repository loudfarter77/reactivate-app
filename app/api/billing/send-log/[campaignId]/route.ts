import { NextRequest, NextResponse } from 'next/server'
import { getAdminUserId } from '@/lib/auth'
import { getSupabaseClient } from '@/lib/supabase'

function csvEscape(v: string | number | null | undefined): string {
  const str = v == null ? '' : String(v)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function buildCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  return [headers.map(csvEscape).join(','), ...rows.map((r) => r.map(csvEscape).join(','))].join('\n')
}

function ts(v: string | null | undefined): string {
  if (!v) return ''
  return new Date(v).toISOString()
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const adminUserId = await getAdminUserId()
    if (!adminUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { campaignId } = await params
    const supabase = getSupabaseClient()

    // Verify campaign exists
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id, name, channel')
      .eq('id', campaignId)
      .single()

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Fetch all leads for this campaign
    const { data: leads } = await supabase
      .from('leads')
      .select('id, name, email, phone, status')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: true })

    if (!leads || leads.length === 0) {
      return new NextResponse('Lead Name,Status\n(no leads)', {
        headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="send-log.csv"' },
      })
    }

    const leadIds = leads.map((l) => l.id)

    // Fetch all emails and SMS for these leads
    const [{ data: emails }, { data: smsList }] = await Promise.all([
      supabase
        .from('emails')
        .select('lead_id, sequence_number, sent_at, opened_at, clicked_at')
        .in('lead_id', leadIds),
      supabase
        .from('sms_messages')
        .select('lead_id, sequence_number, sent_at, clicked_at')
        .in('lead_id', leadIds),
    ])

    // Group by lead_id → sequence_number
    type EmailRow = { sent_at: string | null; opened_at: string | null; clicked_at: string | null }
    type SmsRow = { sent_at: string | null; clicked_at: string | null }

    const emailMap = new Map<string, Record<number, EmailRow>>()
    const smsMap = new Map<string, Record<number, SmsRow>>()

    for (const e of emails ?? []) {
      if (!emailMap.has(e.lead_id)) emailMap.set(e.lead_id, {})
      emailMap.get(e.lead_id)![e.sequence_number] = e
    }
    for (const s of smsList ?? []) {
      if (!smsMap.has(s.lead_id)) smsMap.set(s.lead_id, {})
      smsMap.get(s.lead_id)![s.sequence_number] = s
    }

    const hasEmail = campaign.channel === 'email' || campaign.channel === 'both'
    const hasSms = campaign.channel === 'sms' || campaign.channel === 'both'

    const headers: string[] = ['Lead Name', 'Email', 'Phone']

    if (hasEmail) {
      for (let i = 1; i <= 4; i++) {
        headers.push(`Email ${i} Sent`, `Email ${i} Opened`, `Email ${i} Clicked`)
      }
    }
    if (hasSms) {
      for (let i = 1; i <= 4; i++) {
        headers.push(`SMS ${i} Sent`, `SMS ${i} Clicked`)
      }
    }
    headers.push('Status')

    const rows = leads.map((lead) => {
      const eMap = emailMap.get(lead.id) ?? {}
      const sMap = smsMap.get(lead.id) ?? {}

      const row: (string | null)[] = [lead.name, lead.email ?? '', lead.phone ?? '']

      if (hasEmail) {
        for (let i = 1; i <= 4; i++) {
          const e = eMap[i]
          row.push(ts(e?.sent_at), ts(e?.opened_at), ts(e?.clicked_at))
        }
      }
      if (hasSms) {
        for (let i = 1; i <= 4; i++) {
          const s = sMap[i]
          row.push(ts(s?.sent_at), ts(s?.clicked_at))
        }
      }
      row.push(lead.status)
      return row
    })

    const csv = buildCsv(headers, rows)
    const safeName = campaign.name.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase()
    const filename = `send-log-${safeName}-${new Date().toISOString().split('T')[0]}.csv`

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    console.error('[billing/send-log] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
