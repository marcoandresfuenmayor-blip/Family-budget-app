"use client";

import { useEffect, useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import { useHousehold } from "@/lib/HouseholdContext";
import { useTable } from "@/lib/hooks";
import { supabase } from "@/lib/supabaseClient";
import { Category, CategoryBudget, Household } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

export default function CategoriasPage() {
  return (
    <AuthGuard>
      <CategoriasContent />
    </AuthGuard>
  );
}

function CategoriasContent() {
  const { householdId } = useHousehold();
  const { data: categories, refresh: refreshCategories } = useTable<Category>(
    "categories",
    householdId,
    { column: "name" }
  );
  const { data: budgets, refresh: refreshBudgets } = useTable<CategoryBudget>(
    "category_budgets",
    householdId
  );
  const [household, setHousehold] = useState<Household | null>(null);

  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("📦");
  const [isDiscretionary, setIsDiscretionary] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!householdId) return;
    supabase
      .from("households")
      .select("*")
      .eq("id", householdId)
      .maybeSingle()
      .then(({ data }) => setHousehold(data));
  }, [householdId]);

  useEffect(() => {
    if (editingCategory) {
      setName(editingCategory.name);
      setIcon(editingCategory.icon || "📦");
      setIsDiscretionary(editingCategory.is_discretionary);
    } else {
      setName("");
      setIcon("📦");
      setIsDiscretionary(true);
    }
  }, [editingCategory]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!householdId || !name) return;
    setSaving(true);

    if (editingCategory) {
      await supabase
        .from("categories")
        .update({ name, icon, is_discretionary: isDiscretionary })
        .eq("id", editingCategory.id);
    } else {
      const { data } = await supabase
        .from("categories")
        .insert({ household_id: householdId, name, icon, is_discretionary: isDiscretionary })
        .select()
        .single();
      if (data) {
        await supabase
          .from("category_budgets")
          .insert({ household_id: householdId, category_id: data.id, monthly_limit: 0 });
      }
    }

    setSaving(false);
    setEditingCategory(null);
    refreshCategories();
    refreshBudgets();
  }

  async function updateLimit(categoryId: string, value: string) {
    const budget = budgets.find((b) => b.category_id === categoryId);
    const monthly_limit = Number(value) || 0;
    if (budget) {
      await supabase.from("category_budgets").update({ monthly_limit }).eq("id", budget.id);
    } else if (householdId) {
      await supabase
        .from("category_budgets")
        .insert({ household_id: householdId, category_id: categoryId, monthly_limit });
    }
    refreshBudgets();
  }

  async function updateThreshold(categoryId: string, value: string) {
    const budget = budgets.find((b) => b.category_id === categoryId);
    if (!budget) return;
    await supabase
      .from("category_budgets")
      .update({ alert_threshold_pct: Number(value) || 80 })
      .eq("id", budget.id);
    refreshBudgets();
  }

  async function deleteCategory(id: string) {
    if (!confirm("¿Eliminar categoría? Los gastos ya cargados con esta categoría no se eliminan.")) return;
    await supabase.from("categories").delete().eq("id", id);
    if (editingCategory?.id === id) setEditingCategory(null);
    refreshCategories();
    refreshBudgets();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">🏷️ Categorías y límites de gasto</h1>

      {household && (
        <div className="card bg-brand-50 border-brand-100">
          <h2 className="font-semibold mb-1">Invita a tu pareja</h2>
          <p className="text-sm text-slate-600 mb-2">
            Comparte este código en la app para que se una a <strong>{household.name}</strong>:
          </p>
          <code className="bg-white border border-brand-200 rounded px-3 py-2 inline-block text-sm select-all">
            {household.invite_code}
          </code>
        </div>
      )}

      <form onSubmit={handleSubmit} className="card flex flex-wrap gap-3 items-end">
        {editingCategory && (
          <div className="w-full flex items-center justify-between bg-brand-50 text-brand-700 text-sm rounded-lg px-3 py-2">
            <span>✏️ Editando: {editingCategory.icon} {editingCategory.name}</span>
            <button type="button" onClick={() => setEditingCategory(null)} className="underline">
              Cancelar
            </button>
          </div>
        )}
        <div className="w-20">
          <label className="label">Ícono</label>
          <input className="input text-center" value={icon} onChange={(e) => setIcon(e.target.value)} />
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="label">{editingCategory ? "Nombre de la categoría" : "Nueva categoría"}</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Mascotas" />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600 mb-2">
          <input type="checkbox" checked={isDiscretionary} onChange={(e) => setIsDiscretionary(e.target.checked)} />
          Gasto reducible (discrecional)
        </label>
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? "Guardando..." : editingCategory ? "Guardar cambios" : "Agregar categoría"}
        </button>
      </form>

      <div className="card">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b">
              <th className="py-2 pr-2">Categoría</th>
              <th className="py-2 pr-2">Tipo</th>
              <th className="py-2 pr-2">Límite mensual</th>
              <th className="py-2 pr-2">Alerta a partir de (%)</th>
              <th className="py-2 pr-2"></th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => {
              const budget = budgets.find((b) => b.category_id === c.id);
              return (
                <tr key={c.id} className={`border-b last:border-0 ${editingCategory?.id === c.id ? "bg-brand-50" : ""}`}>
                  <td className="py-2 pr-2">
                    {c.icon} {c.name}
                  </td>
                  <td className="py-2 pr-2 text-slate-500">
                    {c.is_discretionary ? "Reducible" : "Fijo"}
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      className="input !py-1 !w-28"
                      defaultValue={budget?.monthly_limit ?? 0}
                      onBlur={(e) => updateLimit(c.id, e.target.value)}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="number"
                      min="1"
                      max="100"
                      className="input !py-1 !w-20"
                      defaultValue={budget?.alert_threshold_pct ?? 80}
                      onBlur={(e) => updateThreshold(c.id, e.target.value)}
                    />
                  </td>
                  <td className="py-2 pr-2 text-right whitespace-nowrap">
                    <button
                      onClick={() => {
                        setEditingCategory(c);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className="text-brand-600 hover:underline text-xs mr-3"
                    >
                      editar
                    </button>
                    <button
                      onClick={() => deleteCategory(c.id)}
                      className="text-red-500 hover:underline text-xs"
                    >
                      eliminar
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="text-xs text-slate-400 mt-3">
          El límite se guarda al salir del campo (haz clic afuera). Un límite en 0 significa "sin límite".
          {" "}Total presupuestado: {formatCurrency(budgets.reduce((s, b) => s + Number(b.monthly_limit), 0))}
        </p>
      </div>
    </div>
  );
}
