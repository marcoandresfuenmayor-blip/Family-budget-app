"use client";

import { Card, Category, Expense } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

// Lista compacta de gastos, para desplegar debajo de un total
// (por pagar de una tarjeta, una alerta de categoría, etc.).
export default function ExpenseMiniList({
  expenses,
  categories,
  cards,
  showCard = false,
  emptyText = "No hay consumos en este período.",
}: {
  expenses: Expense[];
  categories: Category[];
  cards?: Card[];
  showCard?: boolean;
  emptyText?: string;
}) {
  if (expenses.length === 0) return <p className="text-xs text-slate-500 py-2">{emptyText}</p>;
  const total = expenses.reduce((t, e) => t + Number(e.amount), 0);
  return (
    <div className="mt-2 bg-white rounded-xl border border-slate-200/70 overflow-hidden">
      <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
        {expenses.map((e) => {
          const cat = categories.find((c) => c.id === e.category_id);
          const card = showCard ? cards?.find((c) => c.id === e.card_id) : undefined;
          return (
            <div key={e.id} className="flex items-center gap-3 px-3 py-2 text-sm">
              <span className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                {cat?.icon ?? "📦"}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-slate-800 truncate">{e.description}</span>
                <span className="block text-[11px] text-slate-400">
                  {new Date(e.expense_date + "T00:00:00").toLocaleDateString("es-ES", { day: "2-digit", month: "short" })}
                  {cat ? ` · ${cat.name}` : ""}
                  {card ? ` · 💳 ${card.name}` : showCard ? " · efectivo" : ""}
                </span>
              </span>
              <span className="font-semibold text-slate-800 whitespace-nowrap">{formatCurrency(Number(e.amount))}</span>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between px-3 py-2 bg-slate-50 text-xs font-semibold text-slate-600 border-t border-slate-100">
        <span>
          {expenses.length} consumo{expenses.length === 1 ? "" : "s"}
        </span>
        <span>{formatCurrency(total)}</span>
      </div>
    </div>
  );
}
