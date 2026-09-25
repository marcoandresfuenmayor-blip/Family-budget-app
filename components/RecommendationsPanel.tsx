"use client";

import { Recommendation } from "@/lib/utils";

export default function RecommendationsPanel({ recs, hideTitle = false }: { recs: Recommendation[]; hideTitle?: boolean }) {
  return (
    <div className="card">
      {!hideTitle && <h2 className="font-semibold mb-3">💡 Recomendaciones para ahorrar e invertir</h2>}
      {recs.length === 0 ? (
        <p className="text-sm text-slate-500">
          Aún no hay suficientes datos este mes para generar recomendaciones. Carga tus gastos e
          ingresos para empezar a ver sugerencias.
        </p>
      ) : (
        <ul className="space-y-3">
          {recs.map((r) => (
            <li key={r.id} className="border-l-4 border-brand-400 pl-3">
              <p className="text-sm font-medium">{r.title}</p>
              <p className="text-sm text-slate-600">{r.detail}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
