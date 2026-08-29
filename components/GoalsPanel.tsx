"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Expense, IncomeEntry, SavingsGoal } from "@/lib/types";
import { computeGoalProgress, formatCurrency } from "@/lib/utils";

export default function GoalsPanel({
  goals,
  incomeEntries,
  expenses,
  householdId,
  onChange,
}: {
  goals: SavingsGoal[];
  incomeEntries: IncomeEntry[];
  expenses: Expense[];
  householdId: string | null;
  onChange: () => void;
}) {
  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  async function addGoal(e: React.FormEvent) {
    e.preventDefault();
    if (!householdId || !name || !targetAmount) return;
    setSaving(true);
    await supabase.from("savings_goals").insert({
      household_id: householdId,
      name,
      target_amount: Number(targetAmount),
      target_date: targetDate || null,
    });
    setSaving(false);
    setName("");
    setTargetAmount("");
    setTargetDate("");
    setShowForm(false);
    onChange();
  }

  async function removeGoal(id: string) {
    if (!confirm("¿Eliminar esta meta?")) return;
    await supabase.from("savings_goals").delete().eq("id", id);
    onChange();
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold">🏡 Metas de ahorro familiar</h2>
        <button onClick={() => setShowForm((v) => !v)} className="text-sm text-brand-600 hover:underline">
          {showForm ? "Cancelar" : "+ Nueva meta"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={addGoal} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end mb-4 bg-slate-50 p-3 rounded-xl">
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
              {saving ? "Guardando..." : "Crear meta"}
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
