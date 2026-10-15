"use client";

import { useState } from "react";
import { Card, Category, Expense } from "@/lib/types";
import { Alert, cardBilling, isInCurrentMonth } from "@/lib/utils";
import ExpenseMiniList from "@/components/ExpenseMiniList";
import { Icon } from "@/components/ui";

const styles: Record<Alert["level"], string> = {
  red: "bg-red-50 border-red-200 text-red-800",
  yellow: "bg-amber-50 border-amber-200 text-amber-800",
  blue: "bg-sky-50 border-sky-200 text-sky-800",
};

export default function AlertBanner({
  alerts,
  expenses = [],
  categories = [],
  cards = [],
}: {
  alerts: Alert[];
  expenses?: Expense[];
  categories?: Category[];
  cards?: Card[];
}) {
  const [open, setOpen] = useState<string | null>(null);

  if (alerts.length === 0) {
    return (
      <div className="card bg-emerald-50 border-emerald-200 text-emerald-800 text-sm">
        ✅ Todo tranquilo: no hay alertas activas por ahora.
      </div>
    );
  }

  // Gastos que explican cada alerta (si aplica).
  function detail(a: Alert): { list: Expense[]; label: string } | null {
    if (a.categoryId) {
      const list = expenses
        .filter((e) => e.category_id === a.categoryId && isInCurrentMonth(e.expense_date))
        .sort((x, y) => y.expense_date.localeCompare(x.expense_date));
      return { list, label: "Ver gastos de esta categoría este mes" };
    }
    if (a.cardId) {
      const card = cards.find((c) => c.id === a.cardId);
      if (!card) return null;
      const b = cardBilling(expenses, card);
      return a.cardKind === "payment"
        ? { list: b.dueExpenses, label: "Ver consumos que entran en este pago" }
        : { list: b.closed ? b.nextExpenses : b.dueExpenses, label: "Ver consumos de este corte" };
    }
    return null;
  }

  return (
    <div className="space-y-2">
      {alerts.map((a) => {
        const d = detail(a);
        const isOpen = open === a.id;
        return (
          <div key={a.id} className={`card border ${styles[a.level]}`}>
            {d ? (
              <button
                onClick={() => setOpen(isOpen ? null : a.id)}
                aria-expanded={isOpen}
                className="w-full flex items-start gap-3 text-left"
              >
                <span className="flex-1">
                  <span className="block font-medium text-sm">{a.title}</span>
                  <span className="block text-sm opacity-90">{a.message}</span>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold mt-1.5 opacity-80">
                    {isOpen ? "Ocultar gastos" : `${d.label} (${d.list.length})`}
                  </span>
                </span>
                <span
                  className={`w-7 h-7 rounded-full bg-white/70 flex items-center justify-center flex-shrink-0 transition-transform ${
                    isOpen ? "rotate-180" : ""
                  }`}
                >
                  <Icon name="chevronDown" className="w-4 h-4" />
                </span>
              </button>
            ) : (
              <>
                <p className="font-medium text-sm">{a.title}</p>
                <p className="text-sm opacity-90">{a.message}</p>
              </>
            )}
            {d && isOpen && <ExpenseMiniList expenses={d.list} categories={categories} cards={cards} showCard={!!a.categoryId} />}
          </div>
        );
      })}
    </div>
  );
}
