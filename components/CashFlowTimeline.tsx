"use client";

import { useMemo, useState } from "react";
import {
  Card,
  Category,
  Expense,
  IncomeEntry,
  IncomeSource,
  InstallmentPurchase,
  RecurringExpense,
} from "@/lib/types";
import { buildCashFlow, CashFlowEvent, toDateKey } from "@/lib/insights";
import { formatCurrency } from "@/lib/utils";

const ICONS: Record<CashFlowEvent["kind"], string> = {
  income: "💵",
  expense: "🧾",
  installment: "🗓️",
  card_closing: "✂️",
  card_payment: "💳",
};

const STYLES: Record<CashFlowEvent["kind"], string> = {
  income: "bg-emerald-100",
  expense: "bg-rose-100",
  installment: "bg-violet-100",
  card_closing: "bg-sky-100",
  card_payment: "bg-amber-100",
};

function formatDay(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export default function CashFlowTimeline(props: {
  startBalance: number;
  incomeSources: IncomeSource[];
  incomeEntries: IncomeEntry[];
  recurringExpenses: RecurringExpense[];
  installmentPurchases: InstallmentPurchase[];
  expenses: Expense[];
  cards: Card[];
  categories: Category[];
}) {
  const [days, setDays] = useState(30);
  const [view, setView] = useState<"lista" | "calendario">("lista");

  const { events, lowest, endBalance } = useMemo(
    () => buildCashFlow({ ...props, days }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.startBalance, props.incomeSources, props.incomeEntries, props.recurringExpenses, props.installmentPurchases, props.expenses, props.cards, props.categories, days]
  );

  const todayKey = toDateKey(new Date());
  const grouped = useMemo(() => {
    const map = new Map<string, CashFlowEvent[]>();
    for (const e of events) {
      const list = map.get(e.date) ?? [];
      list.push(e);
      map.set(e.date, list);
    }
    return Array.from(map.entries());
  }, [events]);

  const totalOut = events.filter((e) => !e.informative && e.amount < 0).reduce((s, e) => s + e.amount, 0);
  const totalIn = events.filter((e) => e.amount > 0).reduce((s, e) => s + e.amount, 0);
  const risky = lowest.balance < 0;

  return (
    <div className="card">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <h2 className="font-semibold">📆 Próximos pagos y cobros</h2>
        <div className="flex gap-1.5 flex-wrap">
          {[7, 15, 30].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`text-xs font-semibold px-3 py-1 rounded-full border ${
                days === d ? "bg-brand-50 border-brand-200 text-brand-700" : "border-slate-200 text-slate-500"
              }`}
            >
              {d} días
            </button>
          ))}
          <button
            onClick={() => setView(view === "lista" ? "calendario" : "lista")}
            className="text-xs font-semibold px-3 py-1 rounded-full border border-slate-200 text-slate-500"
          >
            {view === "lista" ? "🗓️ Ver calendario" : "📋 Ver lista"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <Stat label="Saldo hoy" value={formatCurrency(props.startBalance)} />
        <Stat label={`Entra (${days} días)`} value={formatCurrency(totalIn)} tone="good" />
        <Stat label={`Sale (${days} días)`} value={formatCurrency(Math.abs(totalOut))} tone="bad" />
        <Stat
          label="Punto más bajo"
          value={`${formatCurrency(lowest.balance)} · ${formatDay(lowest.date)}`}
          tone={risky ? "bad" : "neutral"}
        />
      </div>

      {risky && (
        <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded-xl px-3 py-2 mb-3">
          ⚠️ Con lo programado, el saldo se pondría negativo alrededor del <strong>{formatDay(lowest.date)}</strong>{" "}
          antes de que entre el siguiente ingreso. Vale la pena revisar si se puede mover algún pago o adelantar un cobro.
        </div>
      )}

      {events.length === 0 ? (
        <p className="text-sm text-slate-500">
          No hay movimientos programados en estos días. Se llenan solos a partir de tus ingresos recurrentes, gastos
          fijos, compras diferidas y tarjetas.
        </p>
      ) : view === "lista" ? (
        <div className="relative pl-6 max-h-[480px] overflow-y-auto pr-1">
          <div className="absolute left-2 top-1 bottom-1 w-0.5 bg-slate-200" />
          {grouped.map(([date, list]) => (
            <div key={date} className="mb-3">
              <p className={`text-[11px] font-bold uppercase tracking-wide mb-1 ${date === todayKey ? "text-brand-700" : "text-slate-400"}`}>
                {date === todayKey ? "Hoy · " : ""}
                {formatDay(date)}
              </p>
              {list.map((e) => (
                <div
                  key={e.id}
                  className={`relative flex items-center justify-between gap-3 border rounded-xl px-3 py-2 mb-1.5 bg-white ${
                    !e.informative && e.balanceAfter < 0 ? "border-red-200 bg-red-50" : "border-slate-200"
                  }`}
                >
                  <span className="absolute -left-[19px] top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-slate-300 ring-2 ring-white" />
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0 ${STYLES[e.kind]}`}>
                      {ICONS[e.kind]}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{e.title}</p>
                      <p className="text-xs text-slate-400 truncate">{e.subtitle}</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p
                      className={`text-sm font-bold ${
                        e.kind === "card_closing"
                          ? "text-slate-400"
                          : e.informative
                          ? "text-amber-600"
                          : e.amount > 0
                          ? "text-emerald-600"
                          : "text-rose-600"
                      }`}
                    >
                      {e.kind === "card_closing"
                        ? "—"
                        : `${e.amount > 0 ? "+" : e.informative ? "≈ " : ""}${formatCurrency(e.amount)}`}
                    </p>
                    {!e.informative && (
                      <p className={`text-[11px] ${e.balanceAfter < 0 ? "text-red-600 font-bold" : "text-slate-400"}`}>
                        saldo {formatCurrency(e.balanceAfter)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <CalendarGrid events={events} days={days} />
      )}

      <p className="text-[11px] text-slate-400 mt-2">
        Parte del balance acumulado de hoy. Los pagos de tarjeta en amarillo son informativos: las compras con tarjeta ya
        se descontaron cuando las registraste, así que no se restan dos veces.
      </p>
    </div>
  );
}

function Stat({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "good" | "bad" | "neutral" }) {
  const color = tone === "good" ? "text-emerald-700" : tone === "bad" ? "text-rose-700" : "text-slate-800";
  return (
    <div className="bg-slate-50 rounded-xl px-3 py-2">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className={`text-sm font-bold ${color}`}>{value}</p>
    </div>
  );
}

function CalendarGrid({ events, days }: { events: CashFlowEvent[]; days: number }) {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  // Empieza en lunes para que la grilla quede alineada por semanas.
  const offset = (start.getDay() + 6) % 7;
  const gridStart = new Date(start);
  gridStart.setDate(start.getDate() - offset);
  const totalCells = Math.ceil((offset + days) / 7) * 7;
  const byDate = new Map<string, CashFlowEvent[]>();
  events.forEach((e) => byDate.set(e.date, [...(byDate.get(e.date) ?? []), e]));
  const todayKey = toDateKey(start);
  const lastKey = toDateKey(new Date(start.getFullYear(), start.getMonth(), start.getDate() + days - 1));

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
          <p key={d} className="text-[10px] font-bold text-slate-400 text-center uppercase">
            {d}
          </p>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: totalCells }).map((_, i) => {
          const d = new Date(gridStart);
          d.setDate(gridStart.getDate() + i);
          const key = toDateKey(d);
          const inRange = key >= todayKey && key <= lastKey;
          const list = byDate.get(key) ?? [];
          const net = list.filter((e) => !e.informative).reduce((s, e) => s + e.amount, 0);
          const lastBalance = list.filter((e) => !e.informative).slice(-1)[0]?.balanceAfter;
          return (
            <div
              key={key}
              title={list.map((e) => `${e.title}: ${formatCurrency(e.amount)}`).join("\n")}
              className={`min-h-[64px] rounded-lg border p-1 text-[10px] ${
                !inRange
                  ? "bg-slate-50 border-slate-100 text-slate-300"
                  : lastBalance !== undefined && lastBalance < 0
                  ? "bg-red-50 border-red-200"
                  : key === todayKey
                  ? "bg-brand-50 border-brand-200"
                  : "bg-white border-slate-200"
              }`}
            >
              <p className="font-bold text-slate-500">{d.getDate()}</p>
              {inRange && (
                <div className="flex flex-wrap gap-0.5 mt-0.5">
                  {list.map((e) => (
                    <span key={e.id}>{ICONS[e.kind]}</span>
                  ))}
                </div>
              )}
              {inRange && net !== 0 && (
                <p className={`font-semibold mt-0.5 ${net > 0 ? "text-emerald-600" : "text-rose-600"}`}>
                  {net > 0 ? "+" : ""}
                  {Math.round(net)}
                </p>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-slate-400 mt-2">Pasa el cursor (o mantén presionado) sobre un día para ver el detalle.</p>
    </div>
  );
}
