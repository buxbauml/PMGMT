'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface AssigneeData {
  name: string
  tasks: number
}

interface ReportAssigneeChartProps {
  data: AssigneeData[]
  loading?: boolean
}

export function ReportAssigneeChart({ data, loading = false }: ReportAssigneeChartProps) {
  const hasData = data.length > 0

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Tasks by Assignee</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 items-center justify-center">
        {loading ? (
          <Skeleton className="h-[200px] w-full" />
        ) : !hasData ? (
          <p className="py-8 text-sm text-muted-foreground">No assignee data available</p>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart
              data={data}
              margin={{ top: 5, right: 5, left: -10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12 }}
                interval={0}
                angle={data.length > 5 ? -30 : 0}
                textAnchor={data.length > 5 ? 'end' : 'middle'}
                height={data.length > 5 ? 60 : 30}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                formatter={(value) => [value, 'Tasks']}
              />
              <Bar
                dataKey="tasks"
                fill="#3b82f6"
                radius={[4, 4, 0, 0]}
                maxBarSize={50}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
