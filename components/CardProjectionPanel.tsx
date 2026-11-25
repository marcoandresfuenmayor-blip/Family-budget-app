"use client";

import { CardProjection, CycleProjection } from "@/lib/cardProjection";
import { formatCurrency } from "@/lib/utils";

const fmtDate = (d: Date) => d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });

function Breakdown({ c }: { c: CycleProjection }) {
  if (c.closed) return <p className="text-[11px] text-slate-400">Corte cerrado el {fmtDate(c.closing)}: el monto ya no cambia.</p>;
  const rows: [string, number][] = [
    ["Ya llevan", c.spentSoFar],
    ["Gastos fijos que faltan", c.pendingFixed],
    ["Cuotas diferidas", c.pendingInstallments],
    ["Ritmo habitual hasta el corte", c.projectedVariable],
  ];
  return (
    <div className="space-y-0.5">
      {rows
        .filter(([, v]) => v > 0.004)
        .map(([k, v]) => (
          <p key={k} className="text-[11px] text-slate-500 flex justify-between gap-2">
            <span>{k}</span>
            <span className="tabular-nums">{formatCurrency(v)}</span>
          </p>
        ))}
      <p className="text-[11px] text-slate-400">Corte el {fmtDate(c.closing)}.</p>
    </div>
  );
}

export default function CardProjectionPanel({ projections }: { projections: CardProjection[] }) {
  if (projections.length === 0) return <div className="card text-sm text-slate-500">No hay tarjetas registradas.</div>;

  const nextTotal = projections.reduce((t, p) => t + p.next.projected, 0);
  const prevTotal = projections.reduce((t, p) => t + p.previousPayment, 0);
  const openTotal = projections.reduce((t, p) => t + (p.open?.projected ?? 0), 0);
  const diff = nextTotal - prevTotal;

  return (
    <div className="space-y-3">
      <div className="card">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <p className="text-xs text-slate-500">Pago anterior</p>
            <p className="text-lg font-bold text-slate-700">{formatCurrency(prevTotal)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Próximo pago</p>
            <p className={`text-lg font-bold ${diff > prevTotal * 0.05 ? "text-rose-600" : "text-slate-900"}`}>{formatCurrency(nextTotal)}</p>
            {prevTotal > 0 && (
              <p className={`text-[11px] font-semibold ${diff > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                {diff > 0 ? "▲" : "▼"} {formatCurrency(Math.abs(diff))} vs. el anterior
              </p>
            )}
          </div>
          {openTotal > 0 && (
            <div>
              <p className="text-xs text-slate-500">Pago siguiente (proyección)</p>
              <p className="text-lg font-bold text-slate-700">{formatCurrency(openTotal)}</p>
              <p className="text-[11px] text-slate-400">si siguen gastando a su ritmo</p>
            </div>
          )}
        </div>
        {diff > prevTotal * 0.05 && prevTotal > 0 && (
          <p className="text-xs bg-rose-50 text-rose-700 rounded-xl px-3 py-2 mt-3">
            ⚠ El próximo pago viene {formatCurrency(diff)} más alto que el anterior. Revisen si tienen ese dinero apartado.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {projections.map((p) => (
          <div key={p.card.id} className="card">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold text-slate-900">{p.card.name}</h4>
              <span className="text-[11px] text-slate-400">ritmo: {formatCurrency(p.dailyPace)}/día</span>
            </div>
            <div className="border-b border-slate-100 pb-2 mb-2">
              <div className="flex justify-between items-baseline">
                <span className="text-sm text-slate-600">
                  Pago del {fmtDate(p.next.paymentDate)} {p.next.closed ? "" : "(proyección)"}
                </span>
                <span className="font-bold text-slate-900">{formatCurrency(p.next.projected)}</span>
              </div>
              <p className="text-[11px] text-slate-400 mb-1">Anterior: {formatCurrency(p.previousPayment)}</p>
              <Breakdown c={p.next} />
            </div>
            {p.open && (
              <div>
                <div className="flex justify-between items-baseline">
                  <span className="text-sm text-slate-600">Pago del {fmtDate(p.open.paymentDate)} (proyección)</span>
                  <span className="font-semibold text-slate-700">{formatCurrency(p.open.projected)}</span>
                </div>
                <Breakdown c={p.open} />
              </div>
            )}
          </div>
        ))}
      </div>
      <p className="text-[11px] text-slate-400">
        La proyección suma lo que ya compraron en el corte, los gastos fijos y cuotas que caerán antes del corte, y lo que
        suelen gastar por día en compras variables (promedio de los dos cortes anteriores). El IVA de servicios digitales
        solo se incluye si lo registraron.
      </p>
    </div>
  );
}
