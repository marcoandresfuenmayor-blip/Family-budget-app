"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Expense } from "@/lib/types";
import { descriptionKey, stripAutoSuffix, toDateKey } from "@/lib/insights";
import { Icon } from "@/components/ui";

// Revisión semanal: desde el domingo, avisa si en los últimos 7 días hubo
// días sin ningún gasto registrado o si faltan gastos que suelen aparecer
// todas las semanas (supermercado, Uber, gasolina...). Se cierra con
// "Todo registrado" y vuelve a aparecer el domingo siguiente.
const WEEKS_BACK = 8;
const MIN_WEEKS = 4; // aparece en al menos 4 de las últimas 8 semanas

function addDays(d: Date, n: number) {
  const c = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  c.setDate(c.getDate() + n);
  return c;
}

export default function WeeklyReminder({ expenses }: { expenses: Expense[] }) {
  const today = new Date();
  const lastSunday = addDays(today, -today.getDay());
  const weekKey = `ff-revision-semanal-${toDateKey(lastSunday)}`;
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(weekKey) === "1");
    } catch {
      setDismissed(false);
    }
  }, [weekKey]);

  const info = useMemo(() => {
    const manual = expenses.filter((e) => !e.recurring_expense_id && !e.installment_purchase_id && !e.is_card_payment);
    if (manual.length === 0) return null;
    const firstKey = manual.reduce((m, e) => (e.expense_date < m ? e.expense_date : m), manual[0].expense_date);

    // Días de los últimos 7 sin ningún gasto registrado.
    const emptyDays: Date[] = [];
    for (let i = 7; i >= 1; i--) {
      const d = addDays(today, -i);
      const k = toDateKey(d);
      if (k < firstKey) continue;
      if (!manual.some((e) => e.expense_date === k)) emptyDays.push(d);
    }

    // Gastos habituales que no aparecen en los últimos 7 días.
    const weekStart = toDateKey(addDays(today, -7));
    const weeks = new Map<string, { label: string; weeks: Set<number>; recent: boolean }>();
    for (const e of manual) {
      const diff = Math.floor((today.getTime() - new Date(e.expense_date + "T00:00:00").getTime()) / (7 * 86400000));
      if (diff < 0 || diff >= WEEKS_BACK) continue;
      const k = descriptionKey(e.description);
      if (!k || /^ajuste/.test(k)) continue;
      const item = weeks.get(k) ?? { label: stripAutoSuffix(e.description), weeks: new Set<number>(), recent: false };
      item.weeks.add(diff);
      if (e.expense_date >= weekStart) item.recent = true;
      weeks.set(k, item);
    }
    const missingHabits = Array.from(weeks.values())
      .filter((w) => w.weeks.size >= MIN_WEEKS && !w.recent)
      .sort((a, b) => b.weeks.size - a.weeks.size)
      .slice(0, 4);

    // Registros con más de 3 días de atraso en los últimos 30 días.
    const since = toDateKey(addDays(today, -30));
    const late = manual.filter(
      (e) => e.expense_date >= since && e.created_at && (new Date(e.created_at).getTime() - new Date(e.expense_date + "T23:59:59").getTime()) / 86400000 > 3
    ).length;

    return { emptyDays, missingHabits, late };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenses, toDateKey(today)]);

  if (dismissed || !info) return null;
  if (info.emptyDays.length === 0 && info.missingHabits.length === 0) return null;

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(weekKey, "1");
    } catch {
      /* ignorar */
    }
  }

  const fmt = (d: Date) => d.toLocaleDateString("es-ES", { weekday: "short", day: "numeric" });

  return (
    <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl px-4 py-3 text-sm">
      <div className="flex items-start gap-3">
        <Icon name="bell" className="w-5 h-5 shrink-0 text-amber-500 mt-0.5" />
        <div className="flex-1 space-y-1">
          <p className="font-semibold">Revisión semanal: ¿registraron todo?</p>
          {info.emptyDays.length > 0 && (
            <p>
              Días sin gastos registrados: <strong>{info.emptyDays.map(fmt).join(", ")}</strong>.
            </p>
          )}
          {info.missingHabits.length > 0 && (
            <p>
              Suelen registrar cada semana y esta no aparece:{" "}
              <strong>{info.missingHabits.map((h) => h.label).join(", ")}</strong>.
            </p>
          )}
          {info.late > 0 && (
            <p className="text-xs text-amber-700">
              En los últimos 30 días, {info.late} gasto{info.late === 1 ? "" : "s"} se registr{info.late === 1 ? "ó" : "aron"} con
              más de 3 días de atraso. Registrar el mismo día evita descuadres.
            </p>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            <Link href="/gastos" className="btn-primary !text-xs !px-3 !py-1.5">
              Registrar gasto
            </Link>
            <button onClick={dismiss} className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-amber-300 bg-white hover:bg-amber-100">
              ✓ Todo registrado
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
