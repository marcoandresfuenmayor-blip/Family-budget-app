"use client";

import { ReactNode, useEffect, useState } from "react";

export type DashboardSection = {
  key: string;
  title: string;
  node: ReactNode;
};

// Combina el orden guardado con las secciones que existen hoy: agrega al
// final las nuevas y descarta las que ya no existen.
export function mergeOrder(saved: string[] | null | undefined, defaults: string[]) {
  const valid = (saved ?? []).filter((k) => defaults.includes(k));
  return [...valid, ...defaults.filter((k) => !valid.includes(k))];
}

export default function SortableSections({
  sections,
  order,
  onSave,
}: {
  sections: DashboardSection[];
  order: string[];
  onSave: (order: string[]) => Promise<void> | void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(order);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(order);
  }, [order, editing]);

  const byKey = new Map(sections.map((s) => [s.key, s]));
  const current = editing ? draft : order;

  function move(key: string, delta: number) {
    setDraft((prev) => {
      const idx = prev.indexOf(key);
      const target = idx + delta;
      if (idx < 0 || target < 0 || target >= prev.length) return prev;
      const next = prev.slice();
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }

  function dropOn(targetKey: string) {
    if (!dragKey || dragKey === targetKey) return;
    setDraft((prev) => {
      const next = prev.filter((k) => k !== dragKey);
      next.splice(next.indexOf(targetKey), 0, dragKey);
      return next;
    });
    setDragKey(null);
  }

  async function finish() {
    setSaving(true);
    await onSave(draft);
    setSaving(false);
    setEditing(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end -mb-3">
        {editing ? (
          <div className="flex gap-2">
            <button
              onClick={() => {
                setDraft(order);
                setEditing(false);
              }}
              className="text-xs font-semibold px-3 py-1.5 rounded-full border border-slate-200 text-slate-500"
            >
              Cancelar
            </button>
            <button onClick={finish} disabled={saving} className="btn-primary !text-xs !px-3 !py-1.5">
              {saving ? "Guardando..." : "✅ Listo"}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="text-xs font-semibold px-3 py-1.5 rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50"
          >
            ↕️ Organizar secciones
          </button>
        )}
      </div>

      {editing && (
        <div className="card border-2 border-dashed border-brand-200 bg-brand-50/40">
          <p className="text-sm font-semibold mb-1">Arrastra para cambiar el orden (o usa las flechas en el celular)</p>
          <p className="text-xs text-slate-500 mb-3">El orden se guarda solo para tu usuario — tu pareja puede tener el suyo.</p>
          <div className="space-y-1.5">
            {draft.map((key, idx) => {
              const s = byKey.get(key);
              if (!s) return null;
              return (
                <div
                  key={key}
                  draggable
                  onDragStart={() => setDragKey(key)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => dropOn(key)}
                  onDragEnd={() => setDragKey(null)}
                  className={`flex items-center justify-between bg-white border rounded-xl px-3 py-2 cursor-grab active:cursor-grabbing ${
                    dragKey === key ? "opacity-50 border-brand-300" : "border-slate-200"
                  }`}
                >
                  <span className="text-sm">
                    <span className="text-slate-400 mr-2">⠿</span>
                    {s.title}
                  </span>
                  <span className="flex gap-1">
                    <button
                      onClick={() => move(key, -1)}
                      disabled={idx === 0}
                      className="w-7 h-7 rounded-lg border border-slate-200 text-xs disabled:opacity-30"
                      aria-label="Subir"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => move(key, 1)}
                      disabled={idx === draft.length - 1}
                      className="w-7 h-7 rounded-lg border border-slate-200 text-xs disabled:opacity-30"
                      aria-label="Bajar"
                    >
                      ▼
                    </button>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {current.map((key) => {
        const s = byKey.get(key);
        return s ? <div key={key}>{s.node}</div> : null;
      })}
    </div>
  );
}
