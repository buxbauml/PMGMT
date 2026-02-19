'use client'

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface StatusData {
  name: string
  value: number
}

interface ReportStatusChartProps {
  data: StatusData[]
  loading?: boolean
}

const STATUS_COLORS: Record<string, string> = {
  'To Do': '#94a3b8',       // slate-400
  'In Progress': '#3b82f6', // blue-500
  'Done': '#22c55e',        // green-500
}

const DEFAULT_COLORS = ['#94a3b8', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444']

export function ReportStatusChart({ data, loading = false }: ReportStatusChartProps) {
  const hasData = data.length > 0 && data.some((d) => d.value > 0)

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Tasks by Status</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 items-center justify-center">
        {loading ? (
          <Skeleton className="h-[200px] w-[200px] rounded-full" />
        ) : !hasData ? (
          <p className="py-8 text-sm text-muted-foreground">No task data available</p>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
                nameKey="name"
                label={({ name, percent }) =>
                  `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                }
                labelLine={false}
              >
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={STATUS_COLORS[entry.name] ?? DEFAULT_COLORS[index % DEFAULT_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => [value, 'Tasks']}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
