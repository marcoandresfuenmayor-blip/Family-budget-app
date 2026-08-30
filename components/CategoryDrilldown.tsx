"use client";

import { useState } from "react";
import { Card as CardType, Category, CategoryBudget, Expense } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

export default function CategoryDrilldown({
  categories,
  budgets,
  monthExpenses,
  cards,
}: {
  categories: Category[];
  budgets: CategoryBudget[];
  monthExpenses: Expense[];
  cards: CardType[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      {categories.map((c) => {
        const catExpenses = monthExpenses
          .filter((e) => e.category_id === c.id)
          .slice()
          .sort((a, b) => b.expense_date.localeCompare(a.expense_date));
        const spent = catExpenses.reduce((s, e) => s + Number(e.amount), 0);
        const budget = budgets.find((b) => b.category_id === c.id);
        const limit = budget?.monthly_limit ?? 0;
        const hasLimit = limit > 0;
        const pct = hasLimit ? Math.min((spent / limit) * 100, 999) : 0;
        const barColor = pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-emerald-500";
        const isOpen = openId === c.id;

        return (
          <div key={c.id} className="border border-slate-200 rounded-xl overflow-hidden">
            <button
              onClick={() => setOpenId(isOpen ? null : c.id)}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 transition-colors text-left"
            >
              <span className="text-sm font-semibold w-40 flex-shrink-0 truncate">
                {c.icon} {c.name}
              </span>
              <div className="flex-1 bg-slate-100 rounded-full h-2 min-w-0">
                {hasLimit && (
                  <div className={`h-2 rounded-full ${barColor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                )}
              </div>
              <span className="text-xs text-slate-500 w-28 flex-shrink-0 text-right">
                {formatCurrency(spent)}
                {hasLimit && <> / {formatCurrency(limit)}</>}
              </span>
              <svg
                className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`}
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                  clipRule="evenodd"
                />
              </svg>
            </button>

            {isOpen && (
              <div className="px-3 pb-3 pt-1 border-t border-slate-100 bg-slate-50/50">
                {catExpenses.length === 0 ? (
                  <p className="text-xs text-slate-400 py-2">Sin gastos en esta categoría este mes.</p>
                ) : (
                  <div className="divide-y divide-dashed divide-slate-200">
                    {catExpenses.map((e) => {
                      const card = cards.find((cd) => cd.id === e.card_id);
                      return (
                        <div key={e.id} className="flex items-center justify-between py-1.5 text-xs">
                          <div className="text-slate-600 flex items-center gap-1.5 min-w-0">
                            <span className="truncate">{e.description}</span>
                            <span className="text-slate-400 flex-shrink-0">
                              {new Date(e.expense_date + "T00:00:00").toLocaleDateString("es-ES", {
                                day: "2-digit",
                                month: "2-digit",
                              })}
                            </span>
                            {card && (
                              <span className="text-slate-400 flex-shrink-0">· {card.name}</span>
                            )}
                            {e.is_extra && (
                              <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded flex-shrink-0">
                                extra
                              </span>
                            )}
                            {e.is_recurring && (
                              <span className="bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded flex-shrink-0">
                                fijo
                              </span>
                            )}
                            {e.is_card_payment && (
                              <span className="bg-sky-100 text-sky-700 px-1.5 py-0.5 rounded flex-shrink-0">
                                pago tarjeta
                              </span>
                            )}
                          </div>
                          <span className="font-medium text-slate-800 flex-shrink-0 ml-2">
                            {formatCurrency(Number(e.amount))}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
