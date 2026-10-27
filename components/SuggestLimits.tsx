"use client";

import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Category, CategoryBudget, Expense } from "@/lib/types";
import { formatCurrency, monthLabel, shiftMonth, toMonthValue } from "@/lib/utils";
import { Icon } from "@/components/ui";

// Propone límites mensuales a partir de lo que realmente gastan:
// promedio de los últimos 3 meses COMPLETOS (sin el mes en curso), sin contar
// ajustes manuales. A las categorías reducibles se
// les pide un 5% menos para empujar el ahorro; las fijas quedan en su promedio.
// Nada se guarda hasta que ustedes revisan y tocan "Aplicar".
const MONTHS = 3;
const SAVING_PCT = 5;

type Row = {
  category: Category;
  current: number;
  average: number;
  suggested: number;
};

function roundUp5(n: number) {
  return Math.ceil(n / 5) * 5;
}

export default function SuggestLimits({
  categories,
  budgets,
  expenses,
  householdId,
  onApplied,
}: {
  categories: Category[];
  budgets: CategoryBudget[];
  expenses: Expense[];
  householdId: string | null;
  onApplied: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const { rows, months } = useMemo(() => {
    const current = toMonthValue(new Date());
    const firstMonth = expenses.reduce<string | null>((min, e) => {
      const m = e.expense_date.slice(0, 7);
      return !min || m < min ? m : min;
    }, null);
    const months = Array.from({ length: MONTHS }, (_, i) => shiftMonth(current, -(i + 1))).filter(
      (m) => firstMonth && m >= firstMonth
    );
    const rows: Row[] = [];
    if (months.length === 0) return { rows, months };
    for (const c of categories) {
      const total = expenses
        .filter(
          (e) =>
            e.category_id === c.id &&
            !e.is_card_payment &&
            !/^ajuste/i.test(e.description.trim()) &&
            months.includes(e.expense_date.slice(0, 7))
        )
        .reduce((s, e) => s + Number(e.amount), 0);
      const average = total / months.length;
      if (average <= 0) continue;
      const target = c.is_discretionary ? average * (1 - SAVING_PCT / 100) : average;
      const current = Number(budgets.find((b) => b.category_id === c.id)?.monthly_limit ?? 0);
      rows.push({ category: c, current, average, suggested: roundUp5(target) });
    }
    rows.sort((a, b) => b.average - a.average);
    return { rows, months };
  }, [categories, budgets, expenses]);

  function start() {
    const v: Record<string, string> = {};
    const ch: Record<string, boolean> = {};
    rows.forEach((r) => {
      v[r.category.id] = String(r.suggested);
      ch[r.category.id] = r.suggested !== r.current;
    });
    setValues(v);
    setChecked(ch);
    setDone(null);
    setOpen(true);
  }

  async function apply() {
    if (!householdId) return;
    setSaving(true);
    const selected = rows.filter((r) => checked[r.category.id]);
    for (const r of selected) {
      const monthly_limit = Math.max(0, Number(values[r.category.id]) || 0);
      const budget = budgets.find((b) => b.category_id === r.category.id);
      if (budget) await supabase.from("category_budgets").update({ monthly_limit }).eq("id", budget.id);
      else
        await supabase
          .from("category_budgets")
          .insert({ household_id: householdId, category_id: r.category.id, monthly_limit });
    }
    setSaving(false);
    setOpen(false);
    setDone(`Se actualizaron ${selected.length} límite${selected.length === 1 ? "" : "s"}.`);
    onApplied();
  }

  const selectedCount = rows.filter((r) => checked[r.category.id]).length;
  const newTotal = rows.reduce(
    (s, r) => s + (checked[r.category.id] ? Number(values[r.category.id]) || 0 : r.current),
    0
  );

  if (!open) {
    return (
      <div className="flex items-center gap-3 flex-wrap mb-3">
        <button
          type="button"
          onClick={start}
          disabled={rows.length === 0}
          className="btn-primary !text-sm flex items-center gap-2"
          title="Calcula un límite para cada categoría con el promedio de lo que gastaron en los últimos meses completos"
        >
          <Icon name="bulb" className="w-4 h-4" />
          Sugerir límites
        </button>
        {rows.length === 0 && (
          <span className="text-xs text-slate-500">Se necesita al menos un mes completo registrado para sugerir límites.</span>
        )}
        {done && <span className="text-xs font-semibold text-emerald-600">{done}</span>}
      </div>
    );
  }

  return (
    <div className="card border-2 border-brand-200 mb-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="font-semibold text-slate-900 flex items-center gap-2">
            <Icon name="bulb" className="w-4 h-4 text-amber-500" /> Límites sugeridos
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Promedio de {months.map((m) => monthLabel(m)).join(", ")} (sin ajustes). Reducibles: {SAVING_PCT}% menos
            para ayudarles a ahorrar. Fijos: igual a su promedio. Redondeado a $5. Revisa y cambia lo que quieras.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center shrink-0"
          aria-label="Cerrar"
        >
          <Icon name="x" className="w-4 h-4" />
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b">
              <th className="py-2 pr-2 w-8"></th>
              <th className="py-2 pr-2">Categoría</th>
              <th className="py-2 pr-2 text-right">Límite actual</th>
              <th className="py-2 pr-2 text-right">Promedio real</th>
              <th className="py-2 pr-2">Sugerido</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const id = r.category.id;
              const val = Number(values[id]) || 0;
              const diff = val - r.current;
              return (
                <tr key={id} className={`border-b last:border-0 ${checked[id] ? "" : "opacity-50"}`}>
                  <td className="py-2 pr-2">
                    <input
                      type="checkbox"
                      checked={!!checked[id]}
                      onChange={(e) => setChecked((p) => ({ ...p, [id]: e.target.checked }))}
                      aria-label={`Aplicar a ${r.category.name}`}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    {r.category.icon} {r.category.name}
                    <span className="ml-2 text-[11px] text-slate-400">{r.category.is_discretionary ? "Reducible" : "Fijo"}</span>
                  </td>
                  <td className="py-2 pr-2 text-right text-slate-500">{r.current > 0 ? formatCurrency(r.current) : "Sin límite"}</td>
                  <td className="py-2 pr-2 text-right font-medium">{formatCurrency(r.average)}</td>
                  <td className="py-2 pr-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        className="input !py-1 !w-24"
                        value={values[id] ?? ""}
                        onChange={(e) => setValues((p) => ({ ...p, [id]: e.target.value }))}
                      />
                      {r.current > 0 && diff !== 0 && (
                        <span className={`text-[11px] font-semibold ${diff < 0 ? "text-emerald-600" : "text-amber-600"}`}>
                          {diff > 0 ? "+" : ""}
                          {formatCurrency(diff)}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between gap-3 flex-wrap mt-3 pt-3 border-t border-slate-100">
        <p className="text-xs text-slate-500">
          Nuevo total presupuestado (de estas categorías): <strong>{formatCurrency(newTotal)}</strong>/mes
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={() => setOpen(false)} className="btn-secondary !text-sm">
            Cancelar
          </button>
          <button type="button" onClick={apply} disabled={saving || selectedCount === 0} className="btn-primary !text-sm">
            {saving ? "Aplicando..." : `Aplicar ${selectedCount} límite${selectedCount === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    </div>
  );
}
