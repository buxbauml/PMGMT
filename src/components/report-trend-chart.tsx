'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface TrendData {
  week: string
  completed: number
}

interface ReportTrendChartProps {
  data: TrendData[]
  loading?: boolean
}

export function ReportTrendChart({ data, loading = false }: ReportTrendChartProps) {
  const hasData = data.length > 0

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">
          Completion Trend (Last 8 Weeks)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-[250px] w-full" />
        ) : !hasData ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No completion data available yet
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <LineChart
              data={data}
              margin={{ top: 5, right: 5, left: -10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="week"
                tick={{ fontSize: 12 }}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                formatter={(value) => [value, 'Tasks Completed']}
              />
              <Line
                type="monotone"
                dataKey="completed"
                stroke="#22c55e"
                strokeWidth={2}
                dot={{ fill: '#22c55e', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
