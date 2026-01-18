"use client"

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts"

interface DashboardChartProps {
    data: { name: string, value: number }[]
}

export function DashboardChart({ data }: DashboardChartProps) {
    if (!data || data.every(d => d.value === 0)) {
        return (
            <div className="h-[300px] flex items-center justify-center text-slate-400 text-sm font-medium border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                No orders in the last 7 days
            </div>
        )
    }

    return (
        <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data}>
                <XAxis
                    dataKey="name"
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                />
                <YAxis
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `${value}`}
                />
                <Tooltip
                    cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar
                    dataKey="value"
                    fill="#10b981"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={50}
                />
            </BarChart>
        </ResponsiveContainer>
    )
}
