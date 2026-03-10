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
  const headerRow = headers.map(csvEscape).join(',')
  const dataRows = rows.map((row) => row.map(csvEscape).join(','))
  return [headerRow, ...dataRows].join('\n')
}

export async function GET(req: NextRequest) {
  try {
    const adminUserId = await getAdminUserId()
    if (!adminUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = getSupabaseClient()

    // Fetch all completed + disputed bookings with client and lead info
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select(`
        id,
        scheduled_at,
        completed_at,
        completed_by,
        commission_owed,
        status,
        leads(name, email),
        clients(name, business_name)
      `)
      .in('status', ['completed', 'disputed'])
      .order('completed_at', { ascending: false })

    if (error) {
      console.error('[billing/export] Supabase error:', error.message)
      return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 })
    }

    const headers = [
      'Client',
      'Lead Name',
      'Lead Email',
      'Appointment Date',
      'Completed Date',
      'Completed By',
      'Commission (£)',
      'Status',
    ]

    const rows = (bookings ?? []).map((b) => {
      const lead = b.leads as unknown as { name: string; email: string | null } | null
      const client = b.clients as unknown as {
        name: string
        business_name: string | null
      } | null

      return [
        client?.business_name || client?.name || '',
        lead?.name || '',
        lead?.email || '',
        b.scheduled_at ? new Date(b.scheduled_at).toISOString().split('T')[0] : '',
        b.completed_at ? new Date(b.completed_at).toISOString().split('T')[0] : '',
        b.completed_by || '',
        ((b.commission_owed ?? 0) / 100).toFixed(2),
        b.status,
      ]
    })

    const csv = buildCsv(headers, rows)
    const filename = `commission-export-${new Date().toISOString().split('T')[0]}.csv`

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    console.error('[billing/export] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
