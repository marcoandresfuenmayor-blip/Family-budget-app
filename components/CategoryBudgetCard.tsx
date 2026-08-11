"use client";

import { formatCurrency } from "@/lib/utils";

export default function CategoryBudgetCard({
  icon,
  name,
  spent,
  limit,
}: {
  icon: string;
  name: string;
  spent: number;
  limit: number;
}) {
  const hasLimit = limit > 0;
  const pct = hasLimit ? Math.min((spent / limit) * 100, 999) : 0;
  const barColor = pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-emerald-500";

  return (
    <div className="border border-slate-200 rounded-lg p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium">
          {icon} {name}
        </span>
        <span className="text-xs text-slate-500">
          {formatCurrency(spent)}
          {hasLimit && <> / {formatCurrency(limit)}</>}
        </span>
      </div>
      {hasLimit ? (
        <div className="w-full bg-slate-100 rounded-full h-2">
          <div
            className={`h-2 rounded-full ${barColor}`}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
      ) : (
        <p className="text-xs text-slate-400">Sin límite definido</p>
      )}
    </div>
  );
}
