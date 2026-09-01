"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatCurrency } from "@/lib/utils";

const COLORS = [
  "#6366f1",
  "#f59e0b",
  "#ef4444",
  "#10b981",
  "#3b82f6",
  "#a855f7",
  "#ec4899",
  "#14b8a6",
  "#f97316",
  "#84cc16",
];

export default function MiniPieCard({
  title,
  data,
  emptyText = "Sin datos este mes.",
}: {
  title: string;
  data: { name: string; value: number }[];
  emptyText?: string;
}) {
  const filtered = data.filter((d) => d.value > 0);
  const total = filtered.reduce((s, d) => s + d.value, 0);
  const pieData = filtered.map((d) => ({ ...d, pct: total > 0 ? (d.value / total) * 100 : 0 }));

  return (
    <div className="card">
      <h3 className="font-semibold mb-2 text-sm">{title}</h3>
      {pieData.length > 0 ? (
        <>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                outerRadius={75}
                label={(entry) => (entry.pct >= 8 ? `${entry.pct.toFixed(0)}%` : "")}
                labelLine={false}
              >
                {pieData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number, name: string, props: any) => [
                  `${formatCurrency(value)} (${props.payload.pct.toFixed(0)}%)`,
                  name,
                ]}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1 mt-1">
            {pieData
              .slice()
              .sort((a, b) => b.pct - a.pct)
              .map((d) => {
                const colorIndex = pieData.findIndex((p) => p.name === d.name);
                return (
                  <div key={d.name} className="flex items-center gap-1.5 text-xs text-slate-600">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: COLORS[colorIndex % COLORS.length] }}
                    />
                    <span className="truncate flex-1">{d.name}</span>
                    <span className="text-slate-400 flex-shrink-0">{d.pct.toFixed(0)}%</span>
                    <span className="font-medium text-slate-700 flex-shrink-0">
                      {formatCurrency(d.value)}
                    </span>
                  </div>
                );
              })}
          </div>
        </>
      ) : (
        <p className="text-sm text-slate-500">{emptyText}</p>
      )}
    </div>
  );
}
