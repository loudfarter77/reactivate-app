import { NextRequest, NextResponse } from 'next/server'
import { getAdminUserId } from '@/lib/auth'
import { getSupabaseClient } from '@/lib/supabase'
import { generateEmailSequence, generateSmsSequence } from '@/lib/claude'

// Vercel max execution time — set to 300s for large campaigns
export const maxDuration = 300

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    // 1. Admin auth
    const adminUserId = await getAdminUserId()
    if (!adminUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { campaignId } = await params
    const supabase = getSupabaseClient()

    // 2. Fetch campaign
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('*, clients(name)')
      .eq('id', campaignId)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    if (campaign.status !== 'draft') {
      return NextResponse.json(
        { error: `Campaign is "${campaign.status}" — can only generate for draft campaigns` },
        { status: 400 }
      )
    }

    // 3. Fetch all leads for this campaign
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('id, name, email, phone, last_contact_date, service_type, purchase_value, notes')
      .eq('campaign_id', campaignId)
      .not('status', 'in', '(deleted)')

    if (leadsError || !leads || leads.length === 0) {
      return NextResponse.json({ error: 'No leads found for this campaign' }, { status: 400 })
    }

    // The client business name comes from the joined clients record
    const clientName =
      (campaign.clients as { name: string } | null)?.name ?? 'the business'

    const channel = campaign.channel as 'email' | 'sms' | 'both'
    const { tone_preset, tone_custom, custom_instructions } = campaign

    const failedLeads: string[] = []
    let generatedCount = 0

    // 4. Generate + insert sequences for each lead
    for (const lead of leads) {
      try {
        const emailInserts: object[] = []
        const smsInserts: object[] = []

        // Build lead context (enrichment fields only included if non-blank)
        const leadContext = {
          name: lead.name,
          last_contact_date: lead.last_contact_date ?? undefined,
          service_type: lead.service_type ?? undefined,
          purchase_value: lead.purchase_value ?? undefined,
          notes: lead.notes ?? undefined,
        }

        // Generate email sequence
        if (channel === 'email' || channel === 'both') {
          const emails = await generateEmailSequence(
            leadContext,
            clientName,
            tone_preset,
            tone_custom,
            custom_instructions
          )
          for (let i = 0; i < 4; i++) {
            emailInserts.push({
              lead_id: lead.id,
              sequence_number: i + 1,
              subject: emails[i].subject,
              body: emails[i].body,
            })
          }
        }

        // Generate SMS sequence
        if (channel === 'sms' || channel === 'both') {
          const smsList = await generateSmsSequence(
            leadContext,
            clientName,
            tone_preset,
            tone_custom,
            custom_instructions
          )
          for (let i = 0; i < 4; i++) {
            smsInserts.push({
              lead_id: lead.id,
              sequence_number: i + 1,
              body: smsList[i].body,
            })
          }
        }

        // Insert emails
        if (emailInserts.length > 0) {
          const { error } = await supabase.from('emails').insert(emailInserts)
          if (error) throw new Error(`Email insert failed: ${error.message}`)
        }

        // Insert SMS
        if (smsInserts.length > 0) {
          const { error } = await supabase.from('sms_messages').insert(smsInserts)
          if (error) throw new Error(`SMS insert failed: ${error.message}`)
        }

        generatedCount++
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error(`[generate] Failed for lead ${lead.id} (${lead.name}):`, message)
        failedLeads.push(lead.name)
        // Continue with other leads — don't abort the whole batch
      }
    }

    // 5. Update campaign status to "ready" (even if some leads failed)
    if (generatedCount > 0) {
      const { error: updateError } = await supabase
        .from('campaigns')
        .update({ status: 'ready' })
        .eq('id', campaignId)

      if (updateError) {
        console.error('[generate] Failed to update campaign status:', updateError.message)
      }
    }

    return NextResponse.json({
      success: true,
      generated: generatedCount,
      failed: failedLeads.length,
      failed_leads: failedLeads,
      status: generatedCount > 0 ? 'ready' : 'draft',
    })
  } catch (err) {
    console.error('[generate] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
