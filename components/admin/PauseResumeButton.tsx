'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Pause, Play, Loader2 } from 'lucide-react'

interface PauseResumeButtonProps {
  campaignId: string
  currentStatus: 'active' | 'paused'
}

export function PauseResumeButton({ campaignId, currentStatus }: PauseResumeButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const isPaused = currentStatus === 'paused'

  async function handleClick() {
    setLoading(true)
    const action = isPaused ? 'resume' : 'pause'
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/${action}`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? `Failed to ${action} campaign`)
        return
      }
      toast.success(isPaused ? 'Campaign resumed' : 'Campaign paused')
      router.refresh()
    } catch {
      toast.error('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant={isPaused ? 'default' : 'outline'}
      onClick={handleClick}
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      ) : isPaused ? (
        <Play className="w-4 h-4 mr-2" />
      ) : (
        <Pause className="w-4 h-4 mr-2" />
      )}
      {loading ? (isPaused ? 'Resuming…' : 'Pausing…') : isPaused ? 'Resume campaign' : 'Pause campaign'}
    </Button>
  )
}
