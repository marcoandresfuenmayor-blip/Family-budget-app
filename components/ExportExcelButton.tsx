"use client";

import { useState } from "react";
import { useHousehold } from "@/lib/HouseholdContext";
import { supabase } from "@/lib/supabaseClient";
import { Icon } from "@/components/ui";

// Botón que descarga un Excel con todo el historial del hogar:
// resumen mensual, ingresos y gastos. Trae los datos al momento del clic.
export default function ExportExcelButton({ variant = "header" }: { variant?: "header" | "plain" }) {
  const { householdId } = useHousehold();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (!householdId || busy) return;
    setBusy(true);
    setError(null);
    try {
      const q = (table: string) => supabase.from(table).select("*").eq("household_id", householdId);
      const [inc, exp, cat, card, src, mem] = await Promise.all([
        q("income_entries"),
        q("expenses"),
        q("categories"),
        q("cards"),
        q("income_sources"),
        q("household_members"),
      ]);
      const failed = [inc, exp, cat, card, src, mem].find((r) => r.error);
      if (failed?.error) throw failed.error;
      const { downloadFinanceExcel } = await import("@/lib/exportExcel");
      await downloadFinanceExcel({
        incomes: inc.data ?? [],
        expenses: exp.data ?? [],
        categories: cat.data ?? [],
        cards: card.data ?? [],
        sources: src.data ?? [],
        members: mem.data ?? [],
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo generar el archivo");
    } finally {
      setBusy(false);
    }
  }

  const cls =
    variant === "header"
      ? "flex items-center gap-2 bg-white/15 hover:bg-white/25 text-white ring-1 ring-white/25 font-semibold text-sm px-3 py-2 rounded-xl transition-colors disabled:opacity-50"
      : "flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-sm px-3 py-2 rounded-xl shadow-sm disabled:opacity-50";

  return (
    <span className="inline-flex flex-col items-end">
      <button onClick={run} disabled={busy || !householdId} className={cls} title="Descarga un Excel con el resumen mensual, todos los ingresos y todos los gastos">
        <Icon name="arrowDown" className="w-4 h-4" />
        {busy ? "Generando..." : "Descargar Excel"}
      </button>
      {error && <span className="text-[11px] text-rose-200 mt-1">{error}</span>}
    </span>
  );
}
