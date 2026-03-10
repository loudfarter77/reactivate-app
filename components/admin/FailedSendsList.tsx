'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { SendFailure } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { RotateCcw, Loader2, AlertTriangle } from 'lucide-react'

interface FailedSendWithLead extends SendFailure {
  leadName: string
}

interface FailedSendsListProps {
  failures: FailedSendWithLead[]
}

export function FailedSendsList({ failures: initialFailures }: FailedSendsListProps) {
  const [failures, setFailures] = useState(initialFailures)
  const [retrying, setRetrying] = useState<Set<string>>(new Set())

  async function handleRetry(failureId: string) {
    setRetrying((prev) => new Set(prev).add(failureId))
    try {
      const res = await fetch('/api/sends/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ send_failure_id: failureId }),
      })
      const json = await res.json()

      if (!res.ok) {
        if (json.maxedOut) {
          toast.error('Max retry attempts reached — lead marked as send_failed')
          // Remove from list (it won't be retried again)
          setFailures((prev) => prev.filter((f) => f.id !== failureId))
        } else {
          toast.error(json.error ?? 'Retry failed')
        }
        return
      }

      toast.success('Send retried successfully')
      setFailures((prev) => prev.filter((f) => f.id !== failureId))
    } catch {
      toast.error('Something went wrong during retry')
    } finally {
      setRetrying((prev) => {
        const next = new Set(prev)
        next.delete(failureId)
        return next
      })
    }
  }

  if (failures.length === 0) return null

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-destructive" />
        <h3 className="text-base font-semibold text-foreground">
          Failed sends ({failures.length})
        </h3>
      </div>
      <p className="text-xs text-muted-foreground">
        These sends failed. Click Retry to attempt again. After{' '}
        {process.env.NEXT_PUBLIC_MAX_SEND_RETRIES ?? '3'} attempts the lead is marked{' '}
        <span className="font-mono">send_failed</span>.
      </p>
      <div className="rounded-lg border border-destructive/20 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-destructive/5">
              <TableHead className="font-medium">Lead</TableHead>
              <TableHead className="font-medium">Channel</TableHead>
              <TableHead className="font-medium">Email #</TableHead>
              <TableHead className="font-medium">Error</TableHead>
              <TableHead className="font-medium">Attempts</TableHead>
              <TableHead className="font-medium">First failed</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {failures.map((failure) => {
              const isRetrying = retrying.has(failure.id)
              return (
                <TableRow key={failure.id} className="hover:bg-muted/10">
                  <TableCell className="font-medium text-foreground">
                    {failure.leadName}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs uppercase">
                      {failure.channel}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    Email {failure.sequence_number}
                  </TableCell>
                  <TableCell className="text-xs text-destructive font-mono max-w-56 truncate">
                    {failure.error_message}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {failure.attempt_count}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDistanceToNow(new Date(failure.created_at), { addSuffix: true })}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRetry(failure.id)}
                      disabled={isRetrying}
                    >
                      {isRetrying ? (
                        <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                      ) : (
                        <RotateCcw className="w-3 h-3 mr-1.5" />
                      )}
                      {isRetrying ? 'Retrying…' : 'Retry'}
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
