import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getSupabaseClient } from '@/lib/supabase'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  try {
    const { bookingId } = await params
    const { orgId } = await auth()

    if (!orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = getSupabaseClient()

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, lead_id, client_id, status, clients(clerk_org_id)')
      .eq('id', bookingId)
      .single()

    if (bookingError || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    const clientData = booking.clients as unknown as { clerk_org_id: string | null }
    if (orgId !== clientData.clerk_org_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (booking.status !== 'booked') {
      return NextResponse.json(
        { error: 'Only upcoming bookings can be cancelled' },
        { status: 400 }
      )
    }

    await supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', bookingId)

    // Set lead back to clicked — they had engaged before booking
    await supabase
      .from('leads')
      .update({ status: 'clicked' })
      .eq('id', booking.lead_id)

    await supabase.from('lead_events').insert({
      lead_id: booking.lead_id,
      event_type: 'booking_cancelled',
      description: 'Booking cancelled by client',
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[bookings/cancel] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
