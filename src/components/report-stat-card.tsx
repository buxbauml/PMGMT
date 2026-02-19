'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'

interface ReportStatCardProps {
  label: string
  value: string | number
  subtitle?: string
  /** Optional progress bar (0-100) */
  progress?: number
  loading?: boolean
}

export function ReportStatCard({
  label,
  value,
  subtitle,
  progress,
  loading = false,
}: ReportStatCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <>
            <p className="text-2xl font-bold">{value}</p>
            {subtitle && (
              <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
            )}
            {progress !== undefined && (
              <Progress value={progress} className="mt-2 h-1.5" />
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
