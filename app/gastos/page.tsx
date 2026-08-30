"use client";

import { useEffect, useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import { useHousehold } from "@/lib/HouseholdContext";
import { useTable } from "@/lib/hooks";
import { supabase } from "@/lib/supabaseClient";
import { Card, Category, Expense, HouseholdMember, RecurringExpense } from "@/lib/types";
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
  const { data: recurringExpenses, refresh: refreshRecurring } = useTable<RecurringExpense>(
    "recurring_expenses",
    householdId,
    { column: "day_of_month" }
  );
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

  type SortKey = "expense_date" | "description" | "amount" | "category" | "card" | "registered";
  const [sortBy, setSortBy] = useState<SortKey>("expense_date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const ASC_DEFAULT: SortKey[] = ["description", "category", "card"];

  function toggleSort(key: SortKey) {
    if (sortBy === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortDir(ASC_DEFAULT.includes(key) ? "asc" : "desc");
    }
  }

  function sortIndicator(key: SortKey) {
    if (sortBy !== key) return "";
    return sortDir === "asc" ? " ▲" : " ▼";
  }

  function memberName(userId: string | null | undefined) {
    if (!userId) return "—";
    const member = members.find((m) => m.user_id === userId);
    return member?.display_name || "Alguien del hogar";
  }

  function categoryName(id: string) {
    return categories.find((c) => c.id === id)?.name ?? "";
  }

  function cardName(id: string | null) {
    return cards.find((c) => c.id === id)?.name ?? "";
  }

  // Fecha/hora efectiva de "registro": la última edición si existe, si no la creación.
  function registeredKey(e: Expense) {
    return e.updated_at ?? e.created_at ?? "";
  }

  const filtered = expenses
    .filter((e) => e.expense_date.startsWith(monthFilter))
    .slice()
    .sort((a, b) => {
      let cmp = 0;
      if (sortBy === "description") {
        cmp = a.description.localeCompare(b.description, "es");
      } else if (sortBy === "amount") {
        cmp = Number(a.amount) - Number(b.amount);
      } else if (sortBy === "category") {
        cmp = categoryName(a.category_id).localeCompare(categoryName(b.category_id), "es");
      } else if (sortBy === "card") {
        cmp = cardName(a.card_id).localeCompare(cardName(b.card_id), "es");
      } else if (sortBy === "registered") {
        cmp = registeredKey(a).localeCompare(registeredKey(b));
      } else {
        cmp = a.expense_date.localeCompare(b.expense_date);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  const total = filtered.reduce((s, e) => s + Number(e.amount), 0);

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

  async function registerNow(tpl: RecurringExpense) {
    if (!householdId) return;
    const today = new Date().toISOString().slice(0, 10);
    const { data: existing } = await supabase
      .from("expenses")
      .select("id")
      .eq("recurring_expense_id", tpl.id)
      .gte("expense_date", today.slice(0, 7) + "-01")
      .lte("expense_date", today.slice(0, 7) + "-31");
    if (existing && existing.length > 0) {
      alert("Este gasto fijo ya se registró este mes.");
      return;
    }
    await supabase.from("expenses").insert({
      household_id: householdId,
      category_id: tpl.category_id,
      card_id: tpl.card_id,
      description: `${tpl.description} (automático)`,
      amount: tpl.amount,
      expense_date: today,
      is_recurring: true,
      is_extra: false,
      recurring_expense_id: tpl.id,
      created_by: session?.user.id ?? null,
    });
    refresh();
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
                  <th className="py-2 pr-2 cursor-pointer select-none hover:text-slate-700" onClick={() => toggleSort("expense_date")}>
                    Fecha{sortIndicator("expense_date")}
                  </th>
                  <th className="py-2 pr-2 cursor-pointer select-none hover:text-slate-700" onClick={() => toggleSort("description")}>
                    Descripción{sortIndicator("description")}
                  </th>
                  <th className="py-2 pr-2 cursor-pointer select-none hover:text-slate-700" onClick={() => toggleSort("category")}>
                    Categoría{sortIndicator("category")}
                  </th>
                  <th className="py-2 pr-2 cursor-pointer select-none hover:text-slate-700" onClick={() => toggleSort("card")}>
                    Tarjeta{sortIndicator("card")}
                  </th>
                  <th className="py-2 pr-2 cursor-pointer select-none hover:text-slate-700" onClick={() => toggleSort("registered")}>
                    Registrado{sortIndicator("registered")}
                  </th>
                  <th className="py-2 pr-2 text-right cursor-pointer select-none hover:text-slate-700" onClick={() => toggleSort("amount")}>
                    Monto{sortIndicator("amount")}
                  </th>
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
                        {e.is_card_payment && (
                          <span className="ml-2 text-xs bg-sky-100 text-sky-700 px-1.5 py-0.5 rounded">
                            pago tarjeta
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

      <div className="card bg-sky-50 border-sky-200 text-sky-900 text-sm">
        💡 <strong>¿Cómo funciona esto?</strong> Los "gastos fijos recurrentes" de abajo son
        plantillas: tú eliges cuáles se auto-repiten cada mes. Si activaste el auto-registro (ver
        README), se registran solos el día que corresponda; si no, usa{" "}
        <strong>"⚡ Registrar ahora"</strong>. Los gastos marcados como "fijo" en el formulario de
        arriba NO se repiten solos — son de un solo mes, a menos que los crees como plantilla aquí.
      </div>

      <RecurringExpenseManager
        recurringExpenses={recurringExpenses}
        categories={categories}
        cards={cards}
        householdId={householdId}
        onChange={refreshRecurring}
        onRegisterNow={registerNow}
      />
    </div>
  );
}

function RecurringExpenseManager({
  recurringExpenses,
  categories,
  cards,
  householdId,
  onChange,
  onRegisterNow,
}: {
  recurringExpenses: RecurringExpense[];
  categories: Category[];
  cards: Card[];
  householdId: string | null;
  onChange: () => void;
  onRegisterNow: (tpl: RecurringExpense) => void;
}) {
  const [editingTpl, setEditingTpl] = useState<RecurringExpense | null>(null);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [cardId, setCardId] = useState("");
  const [dayOfMonth, setDayOfMonth] = useState("1");
  const [saving, setSaving] = useState(false);

  type TplSortKey = "description" | "category" | "card" | "day_of_month" | "amount";
  const [tplSortBy, setTplSortBy] = useState<TplSortKey>("day_of_month");
  const [tplSortDir, setTplSortDir] = useState<"asc" | "desc">("asc");
  const TPL_ASC_DEFAULT: TplSortKey[] = ["description", "category", "card", "day_of_month"];

  function toggleTplSort(key: TplSortKey) {
    if (tplSortBy === key) {
      setTplSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setTplSortBy(key);
      setTplSortDir(TPL_ASC_DEFAULT.includes(key) ? "asc" : "desc");
    }
  }

  function tplSortIndicator(key: TplSortKey) {
    if (tplSortBy !== key) return "";
    return tplSortDir === "asc" ? " ▲" : " ▼";
  }

  function tplCategoryName(id: string) {
    return categories.find((c) => c.id === id)?.name ?? "";
  }

  function tplCardName(id: string | null) {
    return cards.find((c) => c.id === id)?.name ?? "";
  }

  const sortedTpls = recurringExpenses
    .slice()
    .sort((a, b) => {
      let cmp = 0;
      if (tplSortBy === "description") {
        cmp = a.description.localeCompare(b.description, "es");
      } else if (tplSortBy === "category") {
        cmp = tplCategoryName(a.category_id).localeCompare(tplCategoryName(b.category_id), "es");
      } else if (tplSortBy === "card") {
        cmp = tplCardName(a.card_id).localeCompare(tplCardName(b.card_id), "es");
      } else if (tplSortBy === "amount") {
        cmp = Number(a.amount) - Number(b.amount);
      } else {
        cmp = a.day_of_month - b.day_of_month;
      }
      return tplSortDir === "asc" ? cmp : -cmp;
    });

  const activeTotal = recurringExpenses
    .filter((t) => t.active)
    .reduce((s, t) => s + Number(t.amount), 0);
  const activeCount = recurringExpenses.filter((t) => t.active).length;

  useEffect(() => {
    if (editingTpl) {
      setDescription(editingTpl.description);
      setAmount(String(editingTpl.amount));
      setCategoryId(editingTpl.category_id);
      setCardId(editingTpl.card_id ?? "");
      setDayOfMonth(String(editingTpl.day_of_month));
    } else {
      setDescription("");
      setAmount("");
      setCategoryId("");
      setCardId("");
      setDayOfMonth("1");
    }
  }, [editingTpl]);

  async function saveTpl(e: React.FormEvent) {
    e.preventDefault();
    if (!householdId || !description || !amount || !categoryId) return;
    setSaving(true);

    const payload = {
      description,
      amount: Number(amount),
      category_id: categoryId,
      card_id: cardId || null,
      day_of_month: Number(dayOfMonth),
    };

    if (editingTpl) {
      await supabase.from("recurring_expenses").update(payload).eq("id", editingTpl.id);
    } else {
      await supabase.from("recurring_expenses").insert({ household_id: householdId, ...payload });
    }

    setSaving(false);
    setEditingTpl(null);
    onChange();
  }

  async function toggleActive(tpl: RecurringExpense) {
    await supabase.from("recurring_expenses").update({ active: !tpl.active }).eq("id", tpl.id);
    onChange();
  }

  async function removeTpl(id: string) {
    if (!confirm("¿Eliminar este gasto fijo recurrente? (los gastos ya registrados no se borran)")) return;
    await supabase.from("recurring_expenses").delete().eq("id", id);
    if (editingTpl?.id === id) setEditingTpl(null);
    onChange();
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 className="font-semibold">
          🔁 Gastos fijos recurrentes{" "}
          <span className="text-slate-400 font-normal">
            ({activeCount} activo{activeCount === 1 ? "" : "s"})
          </span>
        </h2>
        <span className="font-semibold text-brand-700">
          Total fijos activos: {formatCurrency(activeTotal)}
        </span>
      </div>

      <form onSubmit={saveTpl} className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end mb-4">
        {editingTpl && (
          <div className="md:col-span-6 flex items-center justify-between bg-brand-50 text-brand-700 text-sm rounded-lg px-3 py-2">
            <span>✏️ Editando: {editingTpl.description}</span>
            <button type="button" onClick={() => setEditingTpl(null)} className="underline">
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
            placeholder="Ej. Arriendo"
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
          <select className="input" required value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
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
          <label className="label">Día del mes</label>
          <input
            className="input"
            type="number"
            min="1"
            max="31"
            value={dayOfMonth}
            onChange={(e) => setDayOfMonth(e.target.value)}
          />
        </div>
        <div className="md:col-span-6">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Guardando..." : editingTpl ? "Guardar cambios" : "Agregar gasto fijo"}
          </button>
        </div>
      </form>

      {recurringExpenses.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b">
                <th className="py-2 pr-2 cursor-pointer select-none hover:text-slate-700" onClick={() => toggleTplSort("description")}>
                  Descripción{tplSortIndicator("description")}
                </th>
                <th className="py-2 pr-2 cursor-pointer select-none hover:text-slate-700" onClick={() => toggleTplSort("category")}>
                  Categoría{tplSortIndicator("category")}
                </th>
                <th className="py-2 pr-2 cursor-pointer select-none hover:text-slate-700" onClick={() => toggleTplSort("card")}>
                  Tarjeta{tplSortIndicator("card")}
                </th>
                <th className="py-2 pr-2 cursor-pointer select-none hover:text-slate-700" onClick={() => toggleTplSort("day_of_month")}>
                  Día{tplSortIndicator("day_of_month")}
                </th>
                <th className="py-2 pr-2 text-right cursor-pointer select-none hover:text-slate-700" onClick={() => toggleTplSort("amount")}>
                  Monto{tplSortIndicator("amount")}
                </th>
                <th className="py-2 pr-2"></th>
                <th className="py-2 pr-2"></th>
                <th className="py-2 pr-2"></th>
              </tr>
            </thead>
            <tbody>
              {sortedTpls.map((tpl) => {
                const cat = categories.find((c) => c.id === tpl.category_id);
                const card = cards.find((c) => c.id === tpl.card_id);
                return (
                  <tr key={tpl.id} className={`border-b last:border-0 ${editingTpl?.id === tpl.id ? "bg-brand-50" : ""}`}>
                    <td className="py-2 pr-2">{tpl.description}</td>
                    <td className="py-2 pr-2">{cat ? `${cat.icon} ${cat.name}` : "—"}</td>
                    <td className="py-2 pr-2">{card ? card.name : "—"}</td>
                    <td className="py-2 pr-2">{tpl.day_of_month}</td>
                    <td className="py-2 pr-2 text-right">{formatCurrency(Number(tpl.amount))}</td>
                    <td className="py-2 pr-2">
                      <button onClick={() => toggleActive(tpl)} className="text-xs text-brand-600 hover:underline">
                        {tpl.active ? "activo" : "inactivo"}
                      </button>
                    </td>
                    <td className="py-2 pr-2">
                      <button
                        onClick={() => onRegisterNow(tpl)}
                        className="text-xs bg-emerald-100 text-emerald-700 hover:bg-emerald-200 px-2 py-1 rounded-lg font-medium whitespace-nowrap"
                      >
                        ⚡ Registrar ahora
                      </button>
                    </td>
                    <td className="py-2 pr-2 text-right whitespace-nowrap">
                      <button
                        onClick={() => setEditingTpl(tpl)}
                        className="text-brand-600 hover:underline text-xs mr-3"
                      >
                        editar
                      </button>
                      <button onClick={() => removeTpl(tpl.id)} className="text-red-500 hover:underline text-xs">
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
