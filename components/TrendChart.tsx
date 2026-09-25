"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Category, Expense } from "@/lib/types";
import { monthlySpendSeries } from "@/lib/insights";
import { formatCurrency } from "@/lib/utils";

export default function TrendChart({
  expenses,
  categories,
  endMonth,
  hideTitle = false,
}: {
  expenses: Expense[];
  categories: Category[];
  endMonth: string;
  hideTitle?: boolean;
}) {
  const [categoryId, setCategoryId] = useState("");
  const data = useMemo(
    () => monthlySpendSeries(expenses, endMonth, 12, categoryId || undefined),
    [expenses, endMonth, categoryId]
  );
  const average = data.length ? data.reduce((s, d) => s + d.total, 0) / data.length : 0;
  const last = data[data.length - 1];
  const vsAverage = last && average > 0 ? ((last.total - average) / average) * 100 : null;
  const selected = categories.find((c) => c.id === categoryId);

  return (
    <div className="card">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
        {hideTitle ? <span /> : <h2 className="font-semibold">📉 Tendencia de gasto mes a mes</h2>}
        <select className="input !w-auto !py-1 text-sm" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">Todas las categorías</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.icon} {c.name}
            </option>
          ))}
        </select>
      </div>

      {data.length < 2 ? (
        <p className="text-sm text-slate-500">
          Necesitas al menos dos meses con gastos registrados{selected ? ` en ${selected.name}` : ""} para ver una tendencia.
        </p>
      ) : (
        <>
          <p className="text-xs text-slate-500 mb-2">
            Promedio {data.length} meses: <strong>{formatCurrency(average)}</strong>
            {vsAverage !== null && (
              <>
                {" "}· este mes va{" "}
                <strong className={vsAverage > 0 ? "text-rose-600" : "text-emerald-600"}>
                  {vsAverage > 0 ? "▲" : "▼"} {Math.abs(vsAverage).toFixed(0)}%
                </strong>{" "}
                {vsAverage > 0 ? "sobre" : "bajo"} el promedio
              </>
            )}
          </p>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={data} margin={{ left: -15, right: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Legend />
              <Bar dataKey="total" name={selected ? selected.name : "Gasto total"} fill="#a5b4fc" radius={[4, 4, 0, 0]} />
              <Line
                type="monotone"
                dataKey="trend"
                name="Tendencia (promedio 3 meses)"
                stroke="#e11d48"
                strokeWidth={2.5}
                dot={false}
              />
              <ReferenceLine y={average} stroke="#94a3b8" strokeDasharray="4 4" />
            </ComposedChart>
          </ResponsiveContainer>
          <p className="text-[11px] text-slate-400">
            Barras: lo gastado cada mes. Línea roja: tendencia (promedio de los últimos 3 meses). Línea gris punteada: promedio
            general del período.
          </p>
        </>
      )}
    </div>
  );
}
