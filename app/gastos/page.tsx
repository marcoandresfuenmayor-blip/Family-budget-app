"use client";

import { useEffect, useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import Avatar from "@/components/Avatar";
import { useHousehold } from "@/lib/HouseholdContext";
import { useTable } from "@/lib/hooks";
import { supabase } from "@/lib/supabaseClient";
import { Card, Category, Expense, HouseholdMember, InstallmentPurchase, RecurringExpense } from "@/lib/types";
import { formatCurrency, monthLabel, nextOccurrence } from "@/lib/utils";
import { PageHeader, Pill, Section, Tip } from "@/components/ui";
import { monthEndKey, toDateKey } from "@/lib/insights";

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
  const { data: installmentPurchases, refresh: refreshInstallments } = useTable<InstallmentPurchase>(
    "installment_purchases",
    householdId,
    { column: "created_at", ascending: false }
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

  // Si viene desde el Dashboard (?mes=2026-10), abre ese mes.
  useEffect(() => {
    const mes = new URLSearchParams(window.location.search).get("mes");
    if (mes && /^\d{4}-\d{2}$/.test(mes)) setMonthFilter(mes);
  }, []);

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
  }

  async function registerNow(tpl: RecurringExpense) {
    if (!householdId) return;
    const today = toDateKey(new Date());
    const { data: existing } = await supabase
      .from("expenses")
      .select("id")
      .eq("recurring_expense_id", tpl.id)
      .gte("expense_date", today.slice(0, 7) + "-01")
      .lte("expense_date", monthEndKey(today.slice(0, 7)));
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

  async function registerInstallmentNow(ip: InstallmentPurchase) {
    if (!householdId || ip.installments_posted >= ip.total_installments) return;
    const today = toDateKey(new Date());
    const { data: existing } = await supabase
      .from("expenses")
      .select("id")
      .eq("installment_purchase_id", ip.id)
      .gte("expense_date", today.slice(0, 7) + "-01")
      .lte("expense_date", monthEndKey(today.slice(0, 7)));
    if (existing && existing.length > 0) {
      alert("Esta cuota ya se registró este mes.");
      return;
    }
    const nextNum = ip.installments_posted + 1;
    await supabase.from("expenses").insert({
      household_id: householdId,
      category_id: ip.category_id,
      card_id: ip.card_id,
      description: `${ip.description} (cuota ${nextNum}/${ip.total_installments})`,
      amount: ip.installment_amount,
      expense_date: today,
      is_recurring: false,
      is_extra: false,
      installment_purchase_id: ip.id,
      created_by: session?.user.id ?? null,
    });
    await supabase
      .from("installment_purchases")
      .update({
        installments_posted: nextNum,
        active: nextNum < ip.total_installments,
      })
      .eq("id", ip.id);
    refresh();
    refreshInstallments();
  }

  return (
    <div className="space-y-5">
      <PageHeader
        icon="receipt"
        eyebrow="Movimientos"
        title="Gastos"
        subtitle="Registra, revisa y automatiza los gastos del hogar"
        actions={
          <input
            type="month"
            className="input !w-auto"
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
          />
        }
      />

      <Section
        id="gastos-registrar"
        help="Anota un gasto: qué fue, cuánto, en qué categoría y con qué tarjeta (o efectivo). Marca &quot;extra&quot; si no estaba planeado, o &quot;plata libre&quot; si sale de tu monto personal."
        icon="plus"
        accent="rose"
        title={editingExpense ? "Editar gasto" : "Registrar gasto"}
        subtitle="Descripción, monto, categoría y tarjeta"
        openSignal={editingExpense?.id}
      >
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
      </Section>

      <Section
        id="gastos-lista"
        help="Todos los gastos del mes elegido arriba. Toca un encabezado de la tabla para ordenar, y usa editar o eliminar en cada fila."
        icon="list"
        accent="indigo"
        title={<span className="capitalize">Gastos de {monthLabel(monthFilter)}</span>}
        subtitle={`${filtered.length} registro${filtered.length === 1 ? "" : "s"} · toca un encabezado para ordenar`}
        badge={<Pill tone="indigo">{formatCurrency(total)}</Pill>}
      >
      <div className="card">

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
                        {e.is_free_money && (
                          <span className="ml-2 text-xs bg-pink-100 text-pink-700 px-1.5 py-0.5 rounded">
                            🎈 libre
                          </span>
                        )}
                        {e.source === "whatsapp" && (
                          <span className="ml-2 text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">
                            💬 whatsapp
                          </span>
                        )}
                        {e.installment_purchase_id && (
                          <span className="ml-2 text-xs bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded">
                            cuota
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-2">
                        {cat ? `${cat.icon} ${cat.name}` : "—"}
                      </td>
                      <td className="py-2 pr-2">{card ? card.name : "—"}</td>
                      <td className="py-2 pr-2 text-xs text-slate-500 whitespace-nowrap">
                        {wasEdited ? (
                          <div className="flex items-center gap-1.5">
                            <Avatar name={memberName(e.updated_by)} size="sm" />
                            <span>
                              ✏️ {memberName(e.updated_by)}
                              <br />
                              {formatDateTime(e.updated_at as string)}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <Avatar name={memberName(e.created_by)} size="sm" />
                            <span>
                              {memberName(e.created_by)}
                              <br />
                              {formatDateTime(e.created_at)}
                            </span>
                          </div>
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
      </Section>

      <Section
        id="gastos-fijos"
        help="Plantillas de gastos que se repiten cada mes (arriendo, internet, Netflix…). Se registran solos el día que elijas, sin que tengas que anotarlos."
        icon="repeat"
        accent="violet"
        title="Gastos fijos recurrentes"
        subtitle="Se registran solos cada mes, el día que elijas"
        badge={
          <Pill tone="indigo">
            {formatCurrency(recurringExpenses.filter((t) => t.active).reduce((s, t) => s + Number(t.amount), 0))}/mes
          </Pill>
        }
        defaultOpen={false}
      >
      <Tip>
        <strong>¿Cómo funciona esto?</strong> Los "gastos fijos recurrentes" de abajo son
        plantillas: tú eliges cuáles se auto-repiten cada mes. Si activaste el auto-registro (ver
        README), se registran solos el día que corresponda; si no, usa{" "}
        <strong>"⚡ Registrar ahora"</strong>. Los gastos marcados como "fijo" en el formulario de
        arriba NO se repiten solos — son de un solo mes, a menos que los crees como plantilla aquí.
      </Tip>

      <RecurringExpenseManager
        recurringExpenses={recurringExpenses}
        categories={categories}
        cards={cards}
        householdId={householdId}
        onChange={refreshRecurring}
        onRegisterNow={registerNow}
      />
      </Section>

      <Section
        id="gastos-cuotas"
        help="Compras diferidas a meses: registras la cuota y el plazo, y en cada corte de la tarjeta se anota una cuota sola hasta terminar."
        icon="calendar"
        accent="amber"
        title="Compras diferidas a cuotas"
        subtitle="Compras a meses: una cuota por cada corte de la tarjeta"
        badge={
          <Pill tone="amber">
            {installmentPurchases.filter((i) => i.active).length} activa
            {installmentPurchases.filter((i) => i.active).length === 1 ? "" : "s"}
          </Pill>
        }
        defaultOpen={false}
      >
      <Tip>
        <strong>Compras diferidas a cuotas:</strong> úsalo cuando pagas algo "a meses" con la
        tarjeta. Ingresas el monto de cada cuota y a cuántos meses la difieres; la primera cuota se
        registra sola en el próximo corte de esa tarjeta, y una cuota más en cada corte siguiente,
        hasta completar el plazo — sin que tengas que acordarte de anotarla cada mes.
      </Tip>

      <InstallmentManager
        installmentPurchases={installmentPurchases}
        categories={categories}
        cards={cards}
        householdId={householdId}
        onChange={refreshInstallments}
        onRegisterNow={registerInstallmentNow}
      />
      </Section>
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
        <span className="text-sm text-slate-500">
          {activeCount} plantilla{activeCount === 1 ? "" : "s"} activa{activeCount === 1 ? "" : "s"}
        </span>
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

function InstallmentManager({
  installmentPurchases,
  categories,
  cards,
  householdId,
  onChange,
  onRegisterNow,
}: {
  installmentPurchases: InstallmentPurchase[];
  categories: Category[];
  cards: Card[];
  householdId: string | null;
  onChange: () => void;
  onRegisterNow: (ip: InstallmentPurchase) => void;
}) {
  const [editingIp, setEditingIp] = useState<InstallmentPurchase | null>(null);
  const [description, setDescription] = useState("");
  const [installmentAmount, setInstallmentAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [cardId, setCardId] = useState("");
  const [totalInstallments, setTotalInstallments] = useState("12");
  const [saving, setSaving] = useState(false);

  type IpSortKey = "description" | "category" | "card" | "amount" | "progress" | "next";
  const [ipSortBy, setIpSortBy] = useState<IpSortKey>("next");
  const [ipSortDir, setIpSortDir] = useState<"asc" | "desc">("asc");
  const IP_ASC_DEFAULT: IpSortKey[] = ["description", "category", "card", "next"];

  function toggleIpSort(key: IpSortKey) {
    if (ipSortBy === key) {
      setIpSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setIpSortBy(key);
      setIpSortDir(IP_ASC_DEFAULT.includes(key) ? "asc" : "desc");
    }
  }

  function ipSortIndicator(key: IpSortKey) {
    if (ipSortBy !== key) return "";
    return ipSortDir === "asc" ? " ▲" : " ▼";
  }

  function ipCategoryName(id: string) {
    return categories.find((c) => c.id === id)?.name ?? "";
  }

  function ipCard(id: string) {
    return cards.find((c) => c.id === id);
  }

  function nextDueDate(ip: InstallmentPurchase) {
    const card = ipCard(ip.card_id);
    if (!card || ip.installments_posted >= ip.total_installments) return null;
    return nextOccurrence(card.closing_day);
  }

  useEffect(() => {
    if (editingIp) {
      setDescription(editingIp.description);
      setInstallmentAmount(String(editingIp.installment_amount));
      setCategoryId(editingIp.category_id);
      setCardId(editingIp.card_id);
      setTotalInstallments(String(editingIp.total_installments));
    } else {
      setDescription("");
      setInstallmentAmount("");
      setCategoryId("");
      setCardId("");
      setTotalInstallments("12");
    }
  }, [editingIp]);

  async function saveIp(e: React.FormEvent) {
    e.preventDefault();
    if (!householdId || !description || !installmentAmount || !categoryId || !cardId) return;
    setSaving(true);

    const payload = {
      description,
      installment_amount: Number(installmentAmount),
      category_id: categoryId,
      card_id: cardId,
      total_installments: Number(totalInstallments),
    };

    if (editingIp) {
      await supabase.from("installment_purchases").update(payload).eq("id", editingIp.id);
    } else {
      await supabase.from("installment_purchases").insert({
        household_id: householdId,
        installments_posted: 0,
        ...payload,
      });
    }

    setSaving(false);
    setEditingIp(null);
    onChange();
  }

  async function toggleActive(ip: InstallmentPurchase) {
    await supabase.from("installment_purchases").update({ active: !ip.active }).eq("id", ip.id);
    onChange();
  }

  async function removeIp(id: string) {
    if (!confirm("¿Eliminar esta compra diferida? (las cuotas ya registradas no se borran)")) return;
    await supabase.from("installment_purchases").delete().eq("id", id);
    if (editingIp?.id === id) setEditingIp(null);
    onChange();
  }

  const sortedIps = installmentPurchases.slice().sort((a, b) => {
    let cmp = 0;
    if (ipSortBy === "description") {
      cmp = a.description.localeCompare(b.description, "es");
    } else if (ipSortBy === "category") {
      cmp = ipCategoryName(a.category_id).localeCompare(ipCategoryName(b.category_id), "es");
    } else if (ipSortBy === "card") {
      cmp = (ipCard(a.card_id)?.name ?? "").localeCompare(ipCard(b.card_id)?.name ?? "", "es");
    } else if (ipSortBy === "amount") {
      cmp = Number(a.installment_amount) - Number(b.installment_amount);
    } else if (ipSortBy === "progress") {
      cmp = a.installments_posted / a.total_installments - b.installments_posted / b.total_installments;
    } else {
      const da = nextDueDate(a);
      const db = nextDueDate(b);
      if (!da && !db) cmp = 0;
      else if (!da) cmp = 1;
      else if (!db) cmp = -1;
      else cmp = da.getTime() - db.getTime();
    }
    return ipSortDir === "asc" ? cmp : -cmp;
  });

  const activeTotal = installmentPurchases
    .filter((ip) => ip.active)
    .reduce((s, ip) => s + Number(ip.installment_amount), 0);
  const activeCount = installmentPurchases.filter((ip) => ip.active).length;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <span className="text-sm text-slate-500">
          {activeCount} compra{activeCount === 1 ? "" : "s"} activa{activeCount === 1 ? "" : "s"}
        </span>
        <span className="font-semibold text-violet-700">
          Total cuotas activas: {formatCurrency(activeTotal)}/mes
        </span>
      </div>

      <form onSubmit={saveIp} className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end mb-4">
        {editingIp && (
          <div className="md:col-span-6 flex items-center justify-between bg-brand-50 text-brand-700 text-sm rounded-lg px-3 py-2">
            <span>✏️ Editando: {editingIp.description}</span>
            <button type="button" onClick={() => setEditingIp(null)} className="underline">
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
            placeholder="Ej. Lavadora"
          />
        </div>
        <div>
          <label className="label">Cuota mensual</label>
          <input
            className="input"
            required
            type="number"
            min="0"
            step="0.01"
            value={installmentAmount}
            onChange={(e) => setInstallmentAmount(e.target.value)}
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
          <label className="label">Tarjeta</label>
          <select className="input" required value={cardId} onChange={(e) => setCardId(e.target.value)}>
            <option value="">Selecciona</option>
            {cards.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Número de meses</label>
          <input
            className="input"
            required
            type="number"
            min="1"
            value={totalInstallments}
            onChange={(e) => setTotalInstallments(e.target.value)}
          />
        </div>
        <div className="md:col-span-6">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Guardando..." : editingIp ? "Guardar cambios" : "Agregar compra diferida"}
          </button>
        </div>
      </form>

      {installmentPurchases.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b">
                <th className="py-2 pr-2 cursor-pointer select-none hover:text-slate-700" onClick={() => toggleIpSort("description")}>
                  Descripción{ipSortIndicator("description")}
                </th>
                <th className="py-2 pr-2 cursor-pointer select-none hover:text-slate-700" onClick={() => toggleIpSort("category")}>
                  Categoría{ipSortIndicator("category")}
                </th>
                <th className="py-2 pr-2 cursor-pointer select-none hover:text-slate-700" onClick={() => toggleIpSort("card")}>
                  Tarjeta{ipSortIndicator("card")}
                </th>
                <th className="py-2 pr-2 cursor-pointer select-none hover:text-slate-700" onClick={() => toggleIpSort("progress")}>
                  Progreso{ipSortIndicator("progress")}
                </th>
                <th className="py-2 pr-2 cursor-pointer select-none hover:text-slate-700" onClick={() => toggleIpSort("next")}>
                  Próxima cuota{ipSortIndicator("next")}
                </th>
                <th className="py-2 pr-2 text-right cursor-pointer select-none hover:text-slate-700" onClick={() => toggleIpSort("amount")}>
                  Cuota{ipSortIndicator("amount")}
                </th>
                <th className="py-2 pr-2"></th>
                <th className="py-2 pr-2"></th>
                <th className="py-2 pr-2"></th>
              </tr>
            </thead>
            <tbody>
              {sortedIps.map((ip) => {
                const cat = categories.find((c) => c.id === ip.category_id);
                const card = ipCard(ip.card_id);
                const due = nextDueDate(ip);
                const completed = ip.installments_posted >= ip.total_installments;
                return (
                  <tr key={ip.id} className={`border-b last:border-0 ${editingIp?.id === ip.id ? "bg-brand-50" : completed ? "opacity-60" : ""}`}>
                    <td className="py-2 pr-2">{ip.description}</td>
                    <td className="py-2 pr-2">{cat ? `${cat.icon} ${cat.name}` : "—"}</td>
                    <td className="py-2 pr-2">{card ? card.name : "—"}</td>
                    <td className="py-2 pr-2 whitespace-nowrap">
                      {completed ? "✅ completada" : `cuota ${ip.installments_posted}/${ip.total_installments}`}
                    </td>
                    <td className="py-2 pr-2 whitespace-nowrap">
                      {due ? due.toLocaleDateString("es-ES") : "—"}
                    </td>
                    <td className="py-2 pr-2 text-right">{formatCurrency(Number(ip.installment_amount))}</td>
                    <td className="py-2 pr-2">
                      <button onClick={() => toggleActive(ip)} className="text-xs text-brand-600 hover:underline">
                        {ip.active ? "activa" : "pausada"}
                      </button>
                    </td>
                    <td className="py-2 pr-2">
                      {!completed && (
                        <button
                          onClick={() => onRegisterNow(ip)}
                          className="text-xs bg-emerald-100 text-emerald-700 hover:bg-emerald-200 px-2 py-1 rounded-lg font-medium whitespace-nowrap"
                        >
                          ⚡ Registrar cuota
                        </button>
                      )}
                    </td>
                    <td className="py-2 pr-2 text-right whitespace-nowrap">
                      <button
                        onClick={() => setEditingIp(ip)}
                        className="text-brand-600 hover:underline text-xs mr-3"
                      >
                        editar
                      </button>
                      <button onClick={() => removeIp(ip.id)} className="text-red-500 hover:underline text-xs">
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
  const [date, setDate] = useState(() => toDateKey(new Date()));
  const [isRecurring, setIsRecurring] = useState(false);
  const [isExtra, setIsExtra] = useState(false);
  const [isFreeMoney, setIsFreeMoney] = useState(false);
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
      setIsFreeMoney(!!editingExpense.is_free_money);
    } else {
      setDescription("");
      setAmount("");
      setCategoryId("");
      setCardId("");
      setDate(toDateKey(new Date()));
      setIsRecurring(false);
      setIsExtra(false);
      setIsFreeMoney(false);
    }
    setError(null);
  }, [editingExpense]);

  async function isDuplicate() {
    const { data } = await supabase
      .from("expenses")
      .select("id, description")
      .eq("expense_date", date)
      .eq("amount", Number(amount));
    if (!data) return false;
    const desc = description.trim().toLowerCase();
    return data.some((d) => d.id !== editingExpense?.id && d.description.trim().toLowerCase() === desc);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!householdId || !categoryId || !amount) return;

    if (await isDuplicate()) {
      const proceed = confirm(
        `Ya existe un gasto de ${formatCurrency(Number(amount))} el ${date} con la misma descripción ("${description}"). ¿Quieres guardarlo de todas formas?`
      );
      if (!proceed) return;
    }

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
          is_free_money: isFreeMoney,
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
        is_free_money: isFreeMoney,
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
        <label className="flex items-center gap-2 text-sm text-slate-600" title="Se descuenta de tu plata libre de la quincena (ver sección Pareja)">
          <input type="checkbox" checked={isFreeMoney} onChange={(e) => setIsFreeMoney(e.target.checked)} />
          🎈 De mi plata libre
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button type="submit" disabled={saving} className="btn-primary ml-auto">
          {saving ? "Guardando..." : editingExpense ? "Guardar cambios" : "Agregar gasto"}
        </button>
      </div>
    </form>
  );
}
