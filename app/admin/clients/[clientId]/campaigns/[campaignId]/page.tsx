import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/lib/button-variants'
import { Badge } from '@/components/ui/badge'
import { ChevronLeft, Zap } from 'lucide-react'

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  ready: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  active: 'bg-green-500/10 text-green-600 dark:text-green-400',
  paused: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  complete: 'bg-muted text-muted-foreground',
}

interface Props {
  params: Promise<{ clientId: string; campaignId: string }>
}

export default async function CampaignDetailPage({ params }: Props) {
  const { clientId, campaignId } = await params
  const supabase = getSupabaseClient()

  const { data: campaign, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .eq('client_id', clientId)
    .single()

  if (error || !campaign) notFound()

  const { data: client } = await supabase
    .from('clients')
    .select('name')
    .eq('id', clientId)
    .single()

  const { count: leadCount } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .eq('campaign_id', campaignId)

  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Link
          href={`/admin/clients/${clientId}`}
          className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }))}
        >
          <ChevronLeft className="w-4 h-4" />
        </Link>
        <span className="text-sm text-muted-foreground">{client?.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-foreground">{campaign.name}</h1>
            <span
              className={cn(
                'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize',
                STATUS_STYLES[campaign.status] ?? 'bg-muted text-muted-foreground'
              )}
            >
              {campaign.status}
            </span>
          </div>
          <p className="text-sm text-muted-foreground capitalize">
            {campaign.channel} · {campaign.tone_preset} tone · {leadCount ?? 0} leads
          </p>
        </div>

        {/* Generate button — active when status is draft */}
        {campaign.status === 'draft' && (
          <Link
            href={`/api/campaigns/${campaignId}/generate`}
            className={cn(buttonVariants())}
            prefetch={false}
          >
            <Zap className="w-4 h-4 mr-2" />
            Generate sequences
          </Link>
        )}

        {campaign.status === 'ready' && (
          <Link
            href={`/admin/clients/${clientId}/campaigns/${campaignId}/preview`}
            className={cn(buttonVariants())}
          >
            Preview &amp; send
          </Link>
        )}
      </div>

      {/* Status-based call-to-action */}
      {campaign.status === 'draft' && (
        <div className="rounded-lg border border-border p-6 text-center space-y-3">
          <Zap className="w-8 h-8 text-muted-foreground/40 mx-auto" />
          <p className="text-sm font-medium text-foreground">Ready to generate</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Click <strong>Generate sequences</strong> to have Claude create personalised email
            and SMS sequences for all {leadCount ?? 0} leads. You&apos;ll be able to review and
            edit everything before sending.
          </p>
        </div>
      )}

      {/* Campaign metadata */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Channel', value: campaign.channel.toUpperCase() },
          { label: 'Tone', value: campaign.tone_preset },
          { label: 'Consent basis', value: campaign.consent_basis },
          { label: 'Leads', value: String(leadCount ?? 0) },
        ].map(({ label, value }) => (
          <div key={label} className="p-4 rounded-lg border border-border">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-sm font-medium text-foreground mt-1 capitalize">{value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
