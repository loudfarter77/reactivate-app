import { getSupabaseClient } from '@/lib/supabase'
import { TemplateList } from '@/components/admin/TemplateList'

export default async function TemplatesPage() {
  const supabase = getSupabaseClient()
  const { data: templates, error } = await supabase
    .from('campaign_templates')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return (
      <div className="text-destructive text-sm">
        Failed to load templates. Please try again.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <TemplateList initialTemplates={templates} />
    </div>
  )
}
