"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { Accent, ACCENTS, Icon, IconName, IconTile } from "@/components/ui";

export type MosaicSection = {
  key: string;
  title: string;
  icon: IconName;
  accent: Accent;
  value: string; // el dato clave, en grande
  caption: string;
  progress?: number | null; // 0-100, dibuja una barra
  tone?: "bad" | "good" | "neutral";
  node: ReactNode; // el detalle que se abre al tocar
};

// Combina el orden guardado con las secciones que existen hoy.
export function mergeOrder(saved: string[] | null | undefined, defaults: string[]) {
  const valid = (saved ?? []).filter((k) => defaults.includes(k));
  return [...valid, ...defaults.filter((k) => !valid.includes(k))];
}

export default function SectionMosaic({
  sections,
  order,
  onSave,
  storageKey,
}: {
  sections: MosaicSection[];
  order: string[];
  onSave: (order: string[]) => Promise<void> | void;
  storageKey: string;
}) {
  const [openKeys, setOpenKeys] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(order);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const panelRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const lastOpened = useRef<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) setOpenKeys(JSON.parse(saved));
    } catch {
      /* ignorar */
    }
  }, [storageKey]);

  useEffect(() => {
    if (!editing) setDraft(order);
  }, [order, editing]);

  // Al abrir un mosaico, baja suavemente hasta su detalle.
  useEffect(() => {
    const key = lastOpened.current;
    if (key && openKeys.includes(key)) {
      panelRefs.current[key]?.scrollIntoView({ behavior: "smooth", block: "start" });
      lastOpened.current = null;
    }
  }, [openKeys]);

  function persist(next: string[]) {
    setOpenKeys(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      /* ignorar */
    }
  }

  function toggle(key: string) {
    if (openKeys.includes(key)) persist(openKeys.filter((k) => k !== key));
    else {
      lastOpened.current = key;
      persist([...openKeys, key]);
    }
  }

  const byKey = new Map(sections.map((s) => [s.key, s]));
  const allOpen = sections.length > 0 && sections.every((s) => openKeys.includes(s.key));

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

  const current = editing ? draft : order;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="font-heading font-bold text-lg text-slate-900">Tu resumen</h2>
          <p className="text-xs text-slate-500">Toca un recuadro para ver el detalle.</p>
        </div>
        <div className="flex gap-2">
          {editing ? (
            <>
              <button
                onClick={() => {
                  setDraft(order);
                  setEditing(false);
                }}
                className="text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-600"
              >
                Cancelar
              </button>
              <button onClick={finish} disabled={saving} className="btn-primary !text-xs !px-3 !py-2">
                {saving ? "Guardando..." : "Guardar orden"}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => persist(allOpen ? [] : sections.map((s) => s.key))}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 shadow-sm"
              >
                <Icon name={allOpen ? "shrink" : "expand"} className="w-3.5 h-3.5" />
                {allOpen ? "Cerrar todo" : "Abrir todo"}
              </button>
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 shadow-sm"
              >
                <Icon name="grip" className="w-3.5 h-3.5" />
                Organizar
              </button>
            </>
          )}
        </div>
      </div>

      {editing && (
        <p className="text-xs text-slate-500 -mt-2">
          Arrastra los recuadros (o usa las flechas) para cambiar el orden. Se guarda solo para tu usuario.
        </p>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {current.map((key, idx) => {
          const s = byKey.get(key);
          if (!s) return null;
          const isOpen = openKeys.includes(key);
          const a = ACCENTS[s.accent];
          const valueColor = s.tone === "bad" ? "text-rose-600" : s.tone === "good" ? "text-emerald-600" : "text-slate-900";
          return (
            <div
              key={key}
              draggable={editing}
              onDragStart={() => setDragKey(key)}
              onDragOver={(e) => editing && e.preventDefault()}
              onDrop={() => editing && dropOn(key)}
              onDragEnd={() => setDragKey(null)}
              className={`relative ${dragKey === key ? "opacity-40" : ""}`}
            >
              <button
                onClick={() => !editing && toggle(key)}
                aria-expanded={isOpen}
                className={`group relative w-full h-full text-left bg-white rounded-3xl p-4 border overflow-hidden transition-all ${
                  editing ? "cursor-grab border-dashed border-slate-300" : "border-slate-200/70 hover:-translate-y-0.5 hover:shadow-lg"
                } ${isOpen ? `ring-2 ${a.ring} shadow-lg` : "shadow-sm"}`}
              >
                <span className={`absolute -right-8 -top-8 w-28 h-28 rounded-full ${a.soft}`} aria-hidden />
                <span className="relative flex items-center gap-2.5">
                  <IconTile icon={s.icon} accent={s.accent} size="sm" />
                  <span className="text-[13px] font-semibold text-slate-700 leading-tight">{s.title}</span>
                </span>
                <span className={`relative block text-2xl md:text-[28px] font-extrabold tracking-tight mt-4 ${valueColor}`}>
                  {s.value}
                </span>
                <span className="relative block text-xs text-slate-500 mt-0.5 line-clamp-2">{s.caption}</span>
                {typeof s.progress === "number" && (
                  <span className="relative block h-1.5 bg-slate-100 rounded-full mt-3 overflow-hidden">
                    <span
                      className={`block h-full rounded-full bg-gradient-to-r ${s.progress >= 100 ? "from-rose-500 to-red-500" : a.tile}`}
                      style={{ width: `${Math.min(Math.max(s.progress, 0), 100)}%` }}
                    />
                  </span>
                )}
                {!editing && (
                  <span
                    className={`absolute right-3 bottom-3 w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                      isOpen ? `${a.soft} ${a.text} rotate-180` : "text-slate-300 group-hover:text-slate-500"
                    }`}
                  >
                    <Icon name="chevronDown" className="w-4 h-4" />
                  </span>
                )}
              </button>
              {editing && (
                <span className="absolute top-2 right-2 flex gap-1">
                  <button
                    onClick={() => move(key, -1)}
                    disabled={idx === 0}
                    className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-600 flex items-center justify-center disabled:opacity-30"
                    aria-label="Mover antes"
                  >
                    <Icon name="chevronLeft" className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => move(key, 1)}
                    disabled={idx === current.length - 1}
                    className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-600 flex items-center justify-center disabled:opacity-30"
                    aria-label="Mover después"
                  >
                    <Icon name="chevronRight" className="w-4 h-4" />
                  </button>
                </span>
              )}
            </div>
          );
        })}
      </div>

      {!editing &&
        order
          .filter((k) => openKeys.includes(k))
          .map((key) => {
            const s = byKey.get(key);
            if (!s) return null;
            return (
              <div
                key={key}
                ref={(el) => {
                  panelRefs.current[key] = el;
                }}
                className={`scroll-mt-24 bg-white rounded-3xl shadow-md border border-slate-200/70 border-t-4 ${ACCENTS[s.accent].top} overflow-hidden`}
              >
                <div className="flex items-center gap-3 px-5 py-4">
                  <IconTile icon={s.icon} accent={s.accent} />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-900">{s.title}</h3>
                    <p className="text-xs text-slate-500 truncate">
                      {s.value} · {s.caption}
                    </p>
                  </div>
                  <button
                    onClick={() => toggle(key)}
                    className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center"
                    aria-label="Cerrar"
                  >
                    <Icon name="x" className="w-4 h-4" />
                  </button>
                </div>
                <div className="bg-slate-50/80 border-t border-slate-100 p-3 md:p-4">{s.node}</div>
              </div>
            );
          })}
    </div>
  );
}
