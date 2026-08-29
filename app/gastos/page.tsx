"use client";

import { useEffect, useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import { useHousehold } from "@/lib/HouseholdContext";
import { useTable } from "@/lib/hooks";
import { supabase } from "@/lib/supabaseClient";
import { Card, Category, Expense, HouseholdMember } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

export default function GastosPage() {
  return (
    <AuthGuard>
      <GastosContent />
    </AuthGuard>
  );
}

function GastosContent() {
  const { householdId, session } = useHousehold();
  const { data: categories } = useTable<Category>("categories", householdId, {
    column: "name",
  });
  const { data: cards } = useTable<Card>("cards", householdId, { column: "name" });
  const { data: members } = useTable<HouseholdMember>("household_members", householdId);
  const {
    data: expenses,
    loading,
    refresh,
  } = useTable<Expense>("expenses", householdId, { column: "expense_date", ascending: false });

  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  const [monthFilter, setMonthFilter] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const filtered = expenses.filter((e) => e.expense_date.startsWith(monthFilter));
  const total = filtered.reduce((s, e) => s + Number(e.amount), 0);

  function memberName(userId: string | null | undefined) {
    if (!userId) return "—";
    const member = members.find((m) => m.user_id === userId);
    return member?.display_name || "Alguien del hogar";
  }

  function formatDateTime(iso: string) {
    return new Date(iso).toLocaleString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este gasto?")) return;
    await supabase.from("expenses").delete().eq("id", id);
    if (editingExpense?.id === id) setEditingExpense(null);
    refresh();
  }

  function handleEdit(expense: Expense) {
    setEditingExpense(expense);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">🧾 Gastos mensuales</h1>
        <input
          type="month"
          className="input !w-auto"
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
        />
      </div>

      <ExpenseForm
        categories={categories}
        cards={cards}
        householdId={householdId}
        userId={session?.user.id ?? null}
        editingExpense={editingExpense}
        onCancelEdit={() => setEditingExpense(null)}
        onSaved={() => {
          setEditingExpense(null);
          refresh();
        }}
      />

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">
            Gastos de {monthFilter} <span className="text-slate-400 font-normal">({filtered.length})</span>
          </h2>
          <span className="font-semibold text-brand-700">{formatCurrency(total)}</span>
        </div>

        {loading ? (
          <p className="text-slate-500 text-sm">Cargando...</p>
        ) : filtered.length === 0 ? (
          <p className="text-slate-500 text-sm">No hay gastos registrados este mes.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b">
                  <th className="py-2 pr-2">Fecha</th>
                  <th className="py-2 pr-2">Descripción</th>
                  <th className="py-2 pr-2">Categoría</th>
                  <th className="py-2 pr-2">Tarjeta</th>
                  <th className="py-2 pr-2">Registrado</th>
                  <th className="py-2 pr-2 text-right">Monto</th>
                  <th className="py-2 pr-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => {
                  const cat = categories.find((c) => c.id === e.category_id);
                  const card = cards.find((c) => c.id === e.card_id);
                  const wasEdited = !!e.updated_at;
                  return (
                    <tr key={e.id} className={`border-b last:border-0 ${editingExpense?.id === e.id ? "bg-brand-50" : ""}`}>
                      <td className="py-2 pr-2 whitespace-nowrap">
                        {new Date(e.expense_date + "T00:00:00").toLocaleDateString("es-ES")}
                      </td>
                      <td className="py-2 pr-2">
                        {e.description}
                        {e.is_extra && (
                          <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                            extra
                          </span>
                        )}
                        {e.is_recurring && (
                          <span className="ml-2 text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                            fijo
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-2">
                        {cat ? `${cat.icon} ${cat.name}` : "—"}
                      </td>
                      <td className="py-2 pr-2">{card ? card.name : "—"}</td>
                      <td className="py-2 pr-2 text-xs text-slate-500 whitespace-nowrap">
                        {wasEdited ? (
                          <>
                            ✏️ {memberName(e.updated_by)}
                            <br />
                            {formatDateTime(e.updated_at as string)}
                          </>
                        ) : (
                          <>
                            👤 {memberName(e.created_by)}
                            <br />
                            {formatDateTime(e.created_at)}
                          </>
                        )}
                      </td>
                      <td className="py-2 pr-2 text-right font-medium whitespace-nowrap">
                        {formatCurrency(Number(e.amount))}
                      </td>
                      <td className="py-2 pr-2 text-right whitespace-nowrap">
                        <button
                          onClick={() => handleEdit(e)}
                          className="text-brand-600 hover:underline text-xs mr-3"
                        >
                          editar
                        </button>
                        <button
                          onClick={() => handleDelete(e.id)}
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
          </div>
        )}
      </div>
    </div>
  );
}

function ExpenseForm({
  categories,
  cards,
  householdId,
  userId,
  editingExpense,
  onCancelEdit,
  onSaved,
}: {
  categories: Category[];
  cards: Card[];
  householdId: string | null;
  userId: string | null;
  editingExpense: Expense | null;
  onCancelEdit: () => void;
  onSaved: () => void;
}) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [cardId, setCardId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [isRecurring, setIsRecurring] = useState(false);
  const [isExtra, setIsExtra] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editingExpense) {
      setDescription(editingExpense.description);
      setAmount(String(editingExpense.amount));
      setCategoryId(editingExpense.category_id);
      setCardId(editingExpense.card_id ?? "");
      setDate(editingExpense.expense_date);
      setIsRecurring(editingExpense.is_recurring);
      setIsExtra(editingExpense.is_extra);
    } else {
      setDescription("");
      setAmount("");
      setCategoryId("");
      setCardId("");
      setDate(new Date().toISOString().slice(0, 10));
      setIsRecurring(false);
      setIsExtra(false);
    }
    setError(null);
  }, [editingExpense]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!householdId || !categoryId || !amount) return;
    setSaving(true);
    setError(null);

    if (editingExpense) {
      const { error } = await supabase
        .from("expenses")
        .update({
          category_id: categoryId,
          card_id: cardId || null,
          description,
          amount: Number(amount),
          expense_date: date,
          is_recurring: isRecurring,
          is_extra: isExtra,
          updated_by: userId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingExpense.id);
      setSaving(false);
      if (error) {
        setError(error.message);
        return;
      }
    } else {
      const { error } = await supabase.from("expenses").insert({
        household_id: householdId,
        category_id: categoryId,
        card_id: cardId || null,
        description,
        amount: Number(amount),
        expense_date: date,
        is_recurring: isRecurring,
        is_extra: isExtra,
        created_by: userId,
      });
      setSaving(false);
      if (error) {
        setError(error.message);
        return;
      }
    }

    onSaved();
  }

  return (
    <form onSubmit={handleSubmit} className="card grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
      {editingExpense && (
        <div className="md:col-span-6 flex items-center justify-between bg-brand-50 text-brand-700 text-sm rounded-lg px-3 py-2">
          <span>✏️ Editando: {editingExpense.description}</span>
          <button type="button" onClick={onCancelEdit} className="underline">
            Cancelar
          </button>
        </div>
      )}
      <div className="md:col-span-2">
        <label className="label">Descripción</label>
        <input
          className="input"
          required
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Ej. Supermercado"
        />
      </div>
      <div>
        <label className="label">Monto</label>
        <input
          className="input"
          required
          type="number"
          min="0"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>
      <div>
        <label className="label">Categoría</label>
        <select
          className="input"
          required
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        >
          <option value="">Selecciona</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.icon} {c.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Tarjeta (opcional)</label>
        <select className="input" value={cardId} onChange={(e) => setCardId(e.target.value)}>
          <option value="">Ninguna / efectivo</option>
          {cards.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Fecha</label>
        <input
          className="input"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      <div className="md:col-span-6 flex items-center gap-6 flex-wrap">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={isRecurring}
            onChange={(e) => setIsRecurring(e.target.checked)}
          />
          Gasto fijo mensual
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={isExtra} onChange={(e) => setIsExtra(e.target.checked)} />
          Gasto adicional / no planeado
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button type="submit" disabled={saving} className="btn-primary ml-auto">
          {saving ? "Guardando..." : editingExpense ? "Guardar cambios" : "Agregar gasto"}
        </button>
      </div>
    </form>
  );
}
