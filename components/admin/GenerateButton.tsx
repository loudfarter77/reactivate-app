'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Loader2, Zap } from 'lucide-react'

interface GenerateButtonProps {
  campaignId: string
  clientId: string
  leadCount: number
}

export function GenerateButton({ campaignId, clientId, leadCount }: GenerateButtonProps) {
  const router = useRouter()
  const [generating, setGenerating] = useState(false)

  async function handleGenerate() {
    setGenerating(true)
    const toastId = toast.loading(
      `Generating sequences for ${leadCount} lead${leadCount !== 1 ? 's' : ''}… this may take a minute.`
    )

    try {
      const res = await fetch(`/api/campaigns/${campaignId}/generate`, {
        method: 'POST',
      })

      const json = await res.json()

      if (!res.ok) {
        toast.error(json.error ?? 'Generation failed', { id: toastId })
        return
      }

      if (json.failed > 0) {
        toast.warning(
          `Generated ${json.generated} leads. ${json.failed} failed: ${json.failed_leads.slice(0, 3).join(', ')}${json.failed > 3 ? '…' : ''}`,
          { id: toastId }
        )
      } else {
        toast.success(`All ${json.generated} sequences generated successfully.`, { id: toastId })
      }

      // Refresh and navigate to preview
      router.push(`/admin/clients/${clientId}/campaigns/${campaignId}/preview`)
      router.refresh()
    } catch {
      toast.error('Something went wrong during generation.', { id: toastId })
    } finally {
      setGenerating(false)
    }
  }

  return (
    <Button onClick={handleGenerate} disabled={generating}>
      {generating ? (
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      ) : (
        <Zap className="w-4 h-4 mr-2" />
      )}
      {generating ? 'Generating…' : 'Generate sequences'}
    </Button>
  )
}
