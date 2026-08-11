"use client";

import { useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import { useHousehold } from "@/lib/HouseholdContext";
import { useTable } from "@/lib/hooks";
import { supabase } from "@/lib/supabaseClient";
import { IncomeEntry, IncomeSource } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

export default function IngresosPage() {
  return (
    <AuthGuard>
      <IngresosContent />
    </AuthGuard>
  );
}

function IngresosContent() {
  const { householdId, session } = useHousehold();
  const { data: sources, refresh: refreshSources } = useTable<IncomeSource>(
    "income_sources",
    householdId,
    { column: "expected_day" }
  );
  const {
    data: entries,
    loading,
    refresh: refreshEntries,
  } = useTable<IncomeEntry>("income_entries", householdId, {
    column: "entry_date",
    ascending: false,
  });

  const [monthFilter, setMonthFilter] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const filtered = entries.filter((e) => e.entry_date.startsWith(monthFilter));
  const total = filtered.reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Ingresos</h1>

      <IncomeSourceManager
        sources={sources}
        householdId={householdId}
        onChange={refreshSources}
      />

      <div className="card">
        <h2 className="font-semibold mb-3">Registrar ingreso</h2>
        <IncomeEntryForm
          sources={sources}
          householdId={householdId}
          userId={session?.user.id ?? null}
          onCreated={refreshEntries}
        />
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h2 className="font-semibold">Historial de ingresos</h2>
          <div className="flex items-center gap-3">
            <input
              type="month"
              className="input !w-auto"
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
            />
            <span className="font-semibold text-emerald-700">{formatCurrency(total)}</span>
          </div>
        </div>

        {loading ? (
          <p className="text-slate-500 text-sm">Cargando...</p>
        ) : filtered.length === 0 ? (
          <p className="text-slate-500 text-sm">No hay ingresos registrados este mes.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b">
                <th className="py-2 pr-2">Fecha</th>
                <th className="py-2 pr-2">Descripción</th>
                <th className="py-2 pr-2 text-right">Monto</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id} className="border-b last:border-0">
                  <td className="py-2 pr-2 whitespace-nowrap">
                    {new Date(e.entry_date + "T00:00:00").toLocaleDateString("es-ES")}
                  </td>
                  <td className="py-2 pr-2">
                    {e.description}
                    {e.is_extra && (
                      <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                        extra
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-2 text-right font-medium">
                    {formatCurrency(Number(e.amount))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function IncomeSourceManager({
  sources,
  householdId,
  onChange,
}: {
  sources: IncomeSource[];
  householdId: string | null;
  onChange: () => void;
}) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [expectedDay, setExpectedDay] = useState("1");
  const [owner, setOwner] = useState("");
  const [saving, setSaving] = useState(false);

  async function addSource(e: React.FormEvent) {
    e.preventDefault();
    if (!householdId || !name || !amount) return;
    setSaving(true);
    await supabase.from("income_sources").insert({
      household_id: householdId,
      name,
      amount: Number(amount),
      expected_day: Number(expectedDay),
      owner_name: owner || null,
    });
    setSaving(false);
    setName("");
    setAmount("");
    setOwner("");
    onChange();
  }

  async function toggleActive(source: IncomeSource) {
    await supabase.from("income_sources").update({ active: !source.active }).eq("id", source.id);
    onChange();
  }

  async function removeSource(id: string) {
    if (!confirm("¿Eliminar este ingreso recurrente?")) return;
    await supabase.from("income_sources").delete().eq("id", id);
    onChange();
  }

  return (
    <div className="card">
      <h2 className="font-semibold mb-3">Ingresos recurrentes (sueldos, etc.)</h2>

      <form onSubmit={addSource} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end mb-4">
        <div className="md:col-span-2">
          <label className="label">Nombre</label>
          <input className="input" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Sueldo Marco" />
        </div>
        <div>
          <label className="label">Monto</label>
          <input className="input" required type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div>
          <label className="label">Día del mes</label>
          <input className="input" type="number" min="1" max="31" value={expectedDay} onChange={(e) => setExpectedDay(e.target.value)} />
        </div>
        <div>
          <label className="label">Persona (opcional)</label>
          <input className="input" value={owner} onChange={(e) => setOwner(e.target.value)} />
        </div>
        <div className="md:col-span-5">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Guardando..." : "Agregar ingreso recurrente"}
          </button>
        </div>
      </form>

      {sources.length > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b">
              <th className="py-2 pr-2">Nombre</th>
              <th className="py-2 pr-2">Día</th>
              <th className="py-2 pr-2">Persona</th>
              <th className="py-2 pr-2 text-right">Monto</th>
              <th className="py-2 pr-2"></th>
              <th className="py-2 pr-2"></th>
            </tr>
          </thead>
          <tbody>
            {sources.map((s) => (
              <tr key={s.id} className="border-b last:border-0">
                <td className="py-2 pr-2">{s.name}</td>
                <td className="py-2 pr-2">{s.expected_day}</td>
                <td className="py-2 pr-2">{s.owner_name ?? "—"}</td>
                <td className="py-2 pr-2 text-right">{formatCurrency(Number(s.amount))}</td>
                <td className="py-2 pr-2">
                  <button onClick={() => toggleActive(s)} className="text-xs text-brand-600 hover:underline">
                    {s.active ? "activo" : "inactivo"}
                  </button>
                </td>
                <td className="py-2 pr-2 text-right">
                  <button onClick={() => removeSource(s.id)} className="text-red-500 hover:underline text-xs">
                    eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function IncomeEntryForm({
  sources,
  householdId,
  userId,
  onCreated,
}: {
  sources: IncomeSource[];
  householdId: string | null;
  userId: string | null;
  onCreated: () => void;
}) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [isExtra, setIsExtra] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!householdId || !amount || !description) return;
    setSaving(true);
    await supabase.from("income_entries").insert({
      household_id: householdId,
      income_source_id: sourceId || null,
      description,
      amount: Number(amount),
      entry_date: date,
      is_extra: isExtra,
      created_by: userId,
    });
    setSaving(false);
    setDescription("");
    setAmount("");
    setIsExtra(false);
    onCreated();
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
      <div>
        <label className="label">Descripción</label>
        <input className="input" required value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ej. Sueldo agosto" />
      </div>
      <div>
        <label className="label">Monto</label>
        <input className="input" required type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>
      <div>
        <label className="label">Fuente (opcional)</label>
        <select className="input" value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
          <option value="">Ninguna</option>
          {sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Fecha</label>
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={isExtra} onChange={(e) => setIsExtra(e.target.checked)} />
          Ingreso extra
        </label>
        <button type="submit" disabled={saving} className="btn-primary ml-auto">
          {saving ? "Guardando..." : "Agregar"}
        </button>
      </div>
    </form>
  );
}
