"use client";

import { useMemo, useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import { useHousehold } from "@/lib/HouseholdContext";
import { useTable } from "@/lib/hooks";
import { Category, Expense } from "@/lib/types";
import { serviceAverages, ServiceAverage, normalizeText } from "@/lib/insights";
import { formatCurrency, monthLabel, toMonthValue } from "@/lib/utils";

export default function PromediosPage() {
  return (
    <AuthGuard>
      <PromediosContent />
    </AuthGuard>
  );
}

type SortKey = "average" | "last" | "change" | "name" | "months";

function PromediosContent() {
  const { householdId } = useHousehold();
  const { data: expenses } = useTable<Expense>("expenses", householdId);
  const { data: categories } = useTable<Category>("categories", householdId, { column: "name" });

  const [endMonth, setEndMonth] = useState(() => toMonthValue(new Date()));
  const [monthsBack, setMonthsBack] = useState(12);
  const [categoryId, setCategoryId] = useState("");
  const [search, setSearch] = useState("");
  const [onlyRepeating, setOnlyRepeating] = useState(true);
  const [sortBy, setSortBy] = useState<SortKey>("average");
  const [openCats, setOpenCats] = useState<Set<string>>(new Set());

  const all = useMemo(() => serviceAverages(expenses, endMonth, monthsBack), [expenses, endMonth, monthsBack]);

  const filtered = all
    .filter((s) => !onlyRepeating || s.monthsWithData >= 2)
    .filter((s) => !categoryId || s.categoryId === categoryId)
    .filter((s) => !search || normalizeText(s.name).includes(normalizeText(search)));

  const sorter = (a: ServiceAverage, b: ServiceAverage) => {
    if (sortBy === "name") return a.name.localeCompare(b.name, "es");
    if (sortBy === "last") return b.last - a.last;
    if (sortBy === "months") return b.monthsWithData - a.monthsWithData;
    if (sortBy === "change") return (b.changeVsAverage ?? -Infinity) - (a.changeVsAverage ?? -Infinity);
    return b.average - a.average;
  };

  const byCategory = new Map<string, ServiceAverage[]>();
  filtered.forEach((s) => byCategory.set(s.categoryId, [...(byCategory.get(s.categoryId) ?? []), s]));
  const groups = Array.from(byCategory.entries())
    .map(([id, list]) => ({
      id,
      category: categories.find((c) => c.id === id),
      list: list.sort(sorter),
      monthlyAverage: list.reduce((s, x) => s + x.average, 0),
    }))
    .sort((a, b) => b.monthlyAverage - a.monthlyAverage);

  const mixedCategory = filtered.filter((s) => s.categoryIds.length > 1);
  const inOtros = filtered.filter((s) => {
    const c = categories.find((x) => x.id === s.categoryId);
    return c && normalizeText(c.name).includes("otros") && s.monthsWithData >= 2;
  });

  function toggle(id: string) {
    setOpenCats((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allOpen = groups.length > 0 && groups.every((g) => openCats.has(g.id));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">📈 Promedios por pago</h1>
        <p className="text-sm text-slate-500 mt-1">
          Cuánto pagan en promedio por cada cosa específica (luz, agua, internet, gasolina…), no solo por categoría — para
          saber si una planilla llegó más alta de lo normal.
        </p>
      </div>

      <div className="card flex flex-wrap gap-3 items-end">
        <div>
          <label className="label">Hasta el mes</label>
          <input type="month" className="input !w-auto" value={endMonth} onChange={(e) => setEndMonth(e.target.value)} />
        </div>
        <div>
          <label className="label">Mirar hacia atrás</label>
          <select className="input !w-auto" value={monthsBack} onChange={(e) => setMonthsBack(Number(e.target.value))}>
            <option value={3}>3 meses</option>
            <option value={6}>6 meses</option>
            <option value={12}>12 meses</option>
          </select>
        </div>
        <div>
          <label className="label">Categoría</label>
          <select className="input !w-auto" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Todas</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className="label">Buscar</label>
          <input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ej. luz, gasolina" />
        </div>
        <div>
          <label className="label">Ordenar por</label>
          <select className="input !w-auto" value={sortBy} onChange={(e) => setSortBy(e.target.value as SortKey)}>
            <option value="average">Promedio mensual</option>
            <option value="last">Último mes</option>
            <option value="change">Mayor alza vs promedio</option>
            <option value="months">Meses registrados</option>
            <option value="name">Nombre (A-Z)</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600 mb-2">
          <input type="checkbox" checked={onlyRepeating} onChange={(e) => setOnlyRepeating(e.target.checked)} />
          Solo pagos que se repiten (2+ meses)
        </label>
      </div>

      {(mixedCategory.length > 0 || inOtros.length > 0) && (
        <div className="card bg-amber-50 border-amber-200 text-amber-900 text-sm space-y-1">
          <p className="font-semibold">🧹 Para que la información sea más exacta</p>
          {mixedCategory.length > 0 && (
            <p>
              Estos pagos se registraron en más de una categoría y se mezclan los números:{" "}
              <strong>{mixedCategory.slice(0, 5).map((s) => s.name).join(", ")}</strong>
              {mixedCategory.length > 5 ? "…" : ""}. Conviene dejarlos siempre en la misma (puedes editarlos en Gastos).
            </p>
          )}
          {inOtros.length > 0 && (
            <p>
              Estos se repiten cada mes pero están en &quot;Otros&quot;:{" "}
              <strong>{inOtros.slice(0, 5).map((s) => s.name).join(", ")}</strong>
              {inOtros.length > 5 ? "…" : ""}. Quizás merecen su propia categoría para no perderlos de vista.
            </p>
          )}
          <p className="text-xs text-amber-700">
            Tip: usa siempre el mismo nombre para el mismo pago (ej. &quot;Luz&quot;, no a veces &quot;Luz&quot; y a veces
            &quot;CNEL&quot;) — así se agrupan bien.
          </p>
        </div>
      )}

      {groups.length === 0 ? (
        <p className="text-sm text-slate-500">
          No hay pagos que coincidan. Si recién empiezas, desmarca &quot;solo pagos que se repiten&quot; o espera a tener
          dos meses de datos.
        </p>
      ) : (
        <div className="space-y-2">
          <div className="flex justify-end">
            <button
              onClick={() => setOpenCats(allOpen ? new Set() : new Set(groups.map((g) => g.id)))}
              className="text-xs text-brand-600 hover:underline"
            >
              {allOpen ? "Contraer todo" : "Expandir todo"}
            </button>
          </div>
          {groups.map((g) => {
            const isOpen = openCats.has(g.id);
            return (
              <div key={g.id} className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                <button
                  onClick={() => toggle(g.id)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 text-left"
                >
                  <span className="font-semibold text-sm">
                    {g.category ? `${g.category.icon} ${g.category.name}` : "Sin categoría"}{" "}
                    <span className="text-slate-400 font-normal">({g.list.length})</span>
                  </span>
                  <span className="text-sm text-slate-600">
                    ≈ {formatCurrency(g.monthlyAverage)}/mes <span className="text-slate-400 ml-2">{isOpen ? "▾" : "▸"}</span>
                  </span>
                </button>
                {isOpen && (
                  <div className="overflow-x-auto border-t border-slate-100">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-slate-500 border-b bg-slate-50">
                          <th className="py-2 px-3">Pago</th>
                          <th className="py-2 px-3 text-right">Promedio/mes</th>
                          <th className="py-2 px-3 text-right">Último</th>
                          <th className="py-2 px-3 text-right">vs. antes</th>
                          <th className="py-2 px-3 text-right">Mín – Máx</th>
                          <th className="py-2 px-3">Historial</th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.list.map((s) => (
                          <tr key={s.key} className="border-b last:border-0">
                            <td className="py-2 px-3">
                              <p className="font-medium">{s.name}</p>
                              <p className="text-xs text-slate-400">
                                {s.monthsWithData} {s.monthsWithData === 1 ? "mes" : "meses"} · {s.timesRegistered} registros
                              </p>
                            </td>
                            <td className="py-2 px-3 text-right font-semibold whitespace-nowrap">{formatCurrency(s.average)}</td>
                            <td className="py-2 px-3 text-right whitespace-nowrap">
                              {formatCurrency(s.last)}
                              <p className="text-[11px] text-slate-400">{monthLabel(s.lastMonth)}</p>
                            </td>
                            <td className="py-2 px-3 text-right whitespace-nowrap">
                              {s.changeVsAverage === null ? (
                                <span className="text-slate-300">—</span>
                              ) : (
                                <span
                                  className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                    s.changeVsAverage > 10
                                      ? "bg-rose-100 text-rose-700"
                                      : s.changeVsAverage < -10
                                      ? "bg-emerald-100 text-emerald-700"
                                      : "bg-slate-100 text-slate-600"
                                  }`}
                                >
                                  {s.changeVsAverage > 0 ? "▲" : "▼"} {Math.abs(s.changeVsAverage).toFixed(0)}%
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-right text-xs text-slate-500 whitespace-nowrap">
                              {formatCurrency(s.min)} – {formatCurrency(s.max)}
                            </td>
                            <td className="py-2 px-3">
                              <Sparkline values={s.monthly.map((m) => m.total)} labels={s.monthly.map((m) => monthLabel(m.month))} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-slate-400">
        &quot;vs. antes&quot; compara el último mes con el promedio de los meses anteriores. Los pagos automáticos
        (&quot;automático&quot;, &quot;cuota x/y&quot;) se agrupan con los registrados a mano si tienen el mismo nombre.
      </p>
    </div>
  );
}

function Sparkline({ values, labels }: { values: number[]; labels: string[] }) {
  const max = Math.max(...values, 1);
  return (
    <div className="flex items-end gap-0.5 h-8">
      {values.map((v, i) => (
        <div
          key={i}
          title={`${labels[i]}: ${formatCurrency(v)}`}
          className={`w-2 rounded-sm ${i === values.length - 1 ? "bg-brand-500" : "bg-brand-200"}`}
          style={{ height: `${Math.max((v / max) * 100, 6)}%` }}
        />
      ))}
    </div>
  );
}
