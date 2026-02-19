'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

interface BurndownPoint {
  date: string
  ideal: number
  actual: number
}

interface ReportBurndownChartProps {
  sprintName: string
  data: BurndownPoint[]
  loading?: boolean
}

export function ReportBurndownChart({
  sprintName,
  data,
  loading = false,
}: ReportBurndownChartProps) {
  const hasData = data.length > 0

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm font-medium">Sprint Burndown</CardTitle>
          <Badge variant="secondary" className="text-xs">
            {sprintName}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-[250px] w-full" />
        ) : !hasData ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No burndown data available
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <LineChart
              data={data}
              margin={{ top: 5, right: 5, left: -10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 12 }}
                label={{
                  value: 'Tasks remaining',
                  angle: -90,
                  position: 'insideLeft',
                  style: { fontSize: 11, fill: '#94a3b8' },
                }}
              />
              <Tooltip
                formatter={(value, name) => [
                  value,
                  name === 'ideal' ? 'Ideal Remaining' : 'Actual Remaining',
                ]}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="ideal"
                stroke="#94a3b8"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                name="Ideal"
              />
              <Line
                type="monotone"
                dataKey="actual"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ fill: '#3b82f6', r: 3 }}
                name="Actual"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
