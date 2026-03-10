import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabase'
import { CreateCampaignForm } from '@/components/admin/CreateCampaignForm'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/lib/button-variants'
import { ChevronLeft } from 'lucide-react'

interface Props {
  params: Promise<{ clientId: string }>
}

export default async function NewCampaignPage({ params }: Props) {
  const { clientId } = await params
  const supabase = getSupabaseClient()

  // Verify client exists
  const { data: client, error } = await supabase
    .from('clients')
    .select('id, name')
    .eq('id', clientId)
    .single()

  if (error || !client) notFound()

  // Fetch templates for the template selector
  const { data: templates } = await supabase
    .from('campaign_templates')
    .select('*')
    .order('name', { ascending: true })

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link
          href={`/admin/clients/${clientId}`}
          className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }))}
        >
          <ChevronLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">New campaign</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            for <span className="text-foreground font-medium">{client.name}</span>
          </p>
        </div>
      </div>

      <CreateCampaignForm clientId={clientId} templates={templates ?? []} />
    </div>
  )
}
