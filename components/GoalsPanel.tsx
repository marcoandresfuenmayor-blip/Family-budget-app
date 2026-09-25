"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Expense, IncomeEntry, SavingsGoal } from "@/lib/types";
import { computeGoalProgress, formatCurrency } from "@/lib/utils";

export default function GoalsPanel({
  goals,
  incomeEntries,
  expenses,
  householdId,
  onChange,
  hideTitle = false,
}: {
  goals: SavingsGoal[];
  incomeEntries: IncomeEntry[];
  expenses: Expense[];
  householdId: string | null;
  onChange: () => void;
  hideTitle?: boolean;
}) {
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);
  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (editingGoal) {
      setName(editingGoal.name);
      setTargetAmount(String(editingGoal.target_amount));
      setTargetDate(editingGoal.target_date ?? "");
      setShowForm(true);
    }
  }, [editingGoal]);

  function resetForm() {
    setEditingGoal(null);
    setName("");
    setTargetAmount("");
    setTargetDate("");
    setShowForm(false);
  }

  async function saveGoal(e: React.FormEvent) {
    e.preventDefault();
    if (!householdId || !name || !targetAmount) return;
    setSaving(true);

    const payload = {
      name,
      target_amount: Number(targetAmount),
      target_date: targetDate || null,
    };

    if (editingGoal) {
      await supabase.from("savings_goals").update(payload).eq("id", editingGoal.id);
    } else {
      await supabase.from("savings_goals").insert({ household_id: householdId, ...payload });
    }

    setSaving(false);
    resetForm();
    onChange();
  }

  async function removeGoal(id: string) {
    if (!confirm("¿Eliminar esta meta?")) return;
    await supabase.from("savings_goals").delete().eq("id", id);
    if (editingGoal?.id === id) resetForm();
    onChange();
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        {hideTitle ? <span /> : <h2 className="font-semibold">🏡 Metas de ahorro familiar</h2>}
        <button
          onClick={() => (showForm ? resetForm() : setShowForm(true))}
          className="text-sm text-brand-600 hover:underline"
        >
          {showForm ? "Cancelar" : "+ Nueva meta"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={saveGoal} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end mb-4 bg-slate-50 p-3 rounded-xl">
          {editingGoal && (
            <div className="md:col-span-4 text-sm text-brand-700">✏️ Editando: {editingGoal.name}</div>
          )}
          <div className="md:col-span-2">
            <label className="label">Nombre del proyecto</label>
            <input
              className="input"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Remodelar la cocina"
            />
          </div>
          <div>
            <label className="label">Monto objetivo</label>
            <input
              className="input"
              required
              type="number"
              min="0"
              step="0.01"
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Fecha meta (opcional)</label>
            <input className="input" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
          </div>
          <div className="md:col-span-4">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? "Guardando..." : editingGoal ? "Guardar cambios" : "Crear meta"}
            </button>
          </div>
        </form>
      )}

      {goals.length === 0 ? (
        <p className="text-sm text-slate-500">
          Todavía no tienes metas. Crea una para un proyecto familiar (vacaciones, remodelación,
          fondo de emergencia) y la app calculará tu progreso solo, según lo que ahorres cada mes.
        </p>
      ) : (
        <p className="text-xs text-slate-400 mb-3">
          ℹ️ El monto ahorrado es un <strong>estimado automático</strong> (ingresos − gastos
          registrados desde que creaste la meta) — no es una transferencia real, es una forma de
          ver cuánto podrías haber apartado a este ritmo.
        </p>
      )}
      {goals.length > 0 && (
        <div className="space-y-4">
          {goals.map((goal) => {
            const { saved, pct, monthsLeft } = computeGoalProgress(goal, incomeEntries, expenses);
            return (
              <div
                key={goal.id}
                className="rounded-2xl p-4 bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-100"
              >
                <div className="flex items-center justify-between mb-1 flex-wrap gap-1">
                  <h3 className="font-semibold text-purple-900">{goal.name}</h3>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-purple-800">
                      {formatCurrency(saved)} / {formatCurrency(Number(goal.target_amount))}
                    </span>
                    <button
                      onClick={() => setEditingGoal(goal)}
                      className="text-brand-600 hover:underline text-xs"
                    >
                      editar
                    </button>
                    <button
                      onClick={() => removeGoal(goal.id)}
                      className="text-red-500 hover:underline text-xs"
                    >
                      eliminar
                    </button>
                  </div>
                </div>
                <div className="w-full bg-white/70 rounded-full h-3">
                  <div
                    className="h-3 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500"
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-purple-700 mt-2">
                  {pct >= 100
                    ? "🎉 ¡Meta alcanzada!"
                    : monthsLeft
                    ? `A este ritmo de ahorro, la meta se alcanza en ~${monthsLeft} mes${monthsLeft === 1 ? "" : "es"}.`
                    : "Aún no hay suficiente historial de ahorro para estimar cuándo la alcanzarás."}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
