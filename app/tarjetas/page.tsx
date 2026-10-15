"use client";

import { useEffect, useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import { useHousehold } from "@/lib/HouseholdContext";
import { useTable } from "@/lib/hooks";
import { supabase } from "@/lib/supabaseClient";
import { Card, Category, Expense } from "@/lib/types";
import { cardBilling, formatCurrency } from "@/lib/utils";
import ExpenseMiniList from "@/components/ExpenseMiniList";
import { PageHeader, Pill, Section } from "@/components/ui";

export default function TarjetasPage() {
  return (
    <AuthGuard>
      <TarjetasContent />
    </AuthGuard>
  );
}

function TarjetasContent() {
  const { householdId } = useHousehold();
  const { data: cards, loading, refresh } = useTable<Card>("cards", householdId, {
    column: "name",
  });
  const { data: expenses } = useTable<Expense>("expenses", householdId);
  const { data: categories } = useTable<Category>("categories", householdId, { column: "name" });

  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [openList, setOpenList] = useState<string | null>(null); // "cardId:due" | "cardId:next"
  const [name, setName] = useState("");
  const [closingDay, setClosingDay] = useState("15");
  const [paymentDay, setPaymentDay] = useState("25");
  const [creditLimit, setCreditLimit] = useState("");
  const [autoPostPayment, setAutoPostPayment] = useState(false);
  const [paymentCategoryId, setPaymentCategoryId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editingCard) {
      setName(editingCard.name);
      setClosingDay(String(editingCard.closing_day));
      setPaymentDay(String(editingCard.payment_day));
      setCreditLimit(editingCard.credit_limit ? String(editingCard.credit_limit) : "");
      setAutoPostPayment(!!editingCard.auto_post_payment);
      setPaymentCategoryId(editingCard.payment_category_id ?? "");
    } else {
      setName("");
      setClosingDay("15");
      setPaymentDay("25");
      setCreditLimit("");
      setAutoPostPayment(false);
      setPaymentCategoryId("");
    }
    setError(null);
  }, [editingCard]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!householdId || !name) return;
    setSaving(true);
    setError(null);

    const payload = {
      name,
      closing_day: Number(closingDay),
      payment_day: Number(paymentDay),
      credit_limit: creditLimit ? Number(creditLimit) : null,
      auto_post_payment: autoPostPayment,
      payment_category_id: paymentCategoryId || null,
    };

    const { error } = editingCard
      ? await supabase.from("cards").update(payload).eq("id", editingCard.id)
      : await supabase.from("cards").insert({ household_id: householdId, ...payload });

    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setEditingCard(null);
    refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta tarjeta?")) return;
    await supabase.from("cards").delete().eq("id", id);
    if (editingCard?.id === id) setEditingCard(null);
    refresh();
  }

  return (
    <div className="space-y-5">
      <PageHeader
        icon="card"
        eyebrow="Crédito"
        title="Tarjetas"
        subtitle="Cortes, pagos y cuánto deben en cada tarjeta"
      />

      <Section
        id="tarjetas-lista"
        help="Para cada tarjeta: cuánto toca pagar en el próximo pago y lo que ya se está acumulando para el pago siguiente. Toca cualquier monto para ver sus consumos."
        icon="card"
        accent="violet"
        title="Mis tarjetas"
        subtitle="Lo que toca pagar y lo que se va acumulando"
        badge={
          <Pill tone="amber">
            {formatCurrency(cards.reduce((t, c) => t + cardBilling(expenses, c).dueTotal, 0))} próximo pago
          </Pill>
        }
      >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
          <p className="text-slate-500 text-sm">Cargando...</p>
        ) : cards.length === 0 ? (
          <p className="text-slate-500 text-sm">Aún no has agregado tarjetas.</p>
        ) : (
          cards.map((card) => renderCard(card))
        )}
      </div>
      </Section>

      <Section
        id="tarjetas-form"
        help="Agrega una tarjeta o cambia su día de corte, día de pago y límite de crédito."
        icon="plus"
        accent="indigo"
        title={editingCard ? `Editar tarjeta: ${editingCard.name}` : "Agregar tarjeta"}
        subtitle="Día de corte, día de pago, límite y auto-pago"
        openSignal={editingCard?.id}
        defaultOpen={false}
      >
      <form onSubmit={handleSubmit} className="card grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
        {editingCard && (
          <div className="md:col-span-5 flex items-center justify-between bg-brand-50 text-brand-700 text-sm rounded-lg px-3 py-2">
            <span>✏️ Editando: {editingCard.name}</span>
            <button type="button" onClick={() => setEditingCard(null)} className="underline">
              Cancelar
            </button>
          </div>
        )}
        <div>
          <label className="label">Nombre</label>
          <input className="input" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Visa BBVA" />
        </div>
        <div>
          <label className="label">Día de corte</label>
          <input className="input" type="number" min="1" max="31" value={closingDay} onChange={(e) => setClosingDay(e.target.value)} />
        </div>
        <div>
          <label className="label">Día límite de pago</label>
          <input className="input" type="number" min="1" max="31" value={paymentDay} onChange={(e) => setPaymentDay(e.target.value)} />
        </div>
        <div>
          <label className="label">Límite de crédito (opcional)</label>
          <input className="input" type="number" min="0" step="0.01" value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} />
        </div>
        <div>
          <button type="submit" disabled={saving} className="btn-primary w-full">
            {saving ? "Guardando..." : editingCard ? "Guardar cambios" : "Agregar tarjeta"}
          </button>
        </div>

        <div className="md:col-span-5 border-t border-slate-100 pt-3 flex flex-wrap items-end gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={autoPostPayment}
              onChange={(e) => setAutoPostPayment(e.target.checked)}
            />
            💳 Registrar el pago automáticamente en su fecha de pago
            <span className="text-xs text-amber-600">(por ahora mejor apagado: el gasto se contaría dos veces)</span>
          </label>
          <div>
            <label className="label">Categoría del pago</label>
            <select
              className="input"
              value={paymentCategoryId}
              onChange={(e) => setPaymentCategoryId(e.target.value)}
              disabled={!autoPostPayment}
            >
              <option value="">Selecciona una categoría</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        {autoPostPayment && !paymentCategoryId && (
          <p className="md:col-span-5 text-xs text-amber-600">
            ⚠️ Elige una categoría para que el pago automático pueda registrarse (sugerencia: "💳
            Tarjetas / Deudas").
          </p>
        )}
        {error && <p className="md:col-span-5 text-sm text-red-600">{error}</p>}
      </form>
      </Section>
    </div>
  );

  function renderCard(card: Card) {
    {
            const b = cardBilling(expenses, card);
            const fmt = (d: Date) => d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
            const utilizationPct = card.credit_limit
              ? Math.min(((b.dueTotal + b.nextTotal) / Number(card.credit_limit)) * 100, 999)
              : null;
            const dueKey = `${card.id}:due`;
            const nextKey = `${card.id}:next`;
            const pillColor =
              utilizationPct === null
                ? "bg-slate-100 text-slate-600"
                : utilizationPct >= 70
                ? "bg-red-100 text-red-700"
                : utilizationPct >= 30
                ? "bg-amber-100 text-amber-700"
                : "bg-emerald-100 text-emerald-700";
            const barColor =
              utilizationPct === null
                ? "bg-slate-300"
                : utilizationPct >= 70
                ? "bg-red-500"
                : utilizationPct >= 30
                ? "bg-amber-500"
                : "bg-emerald-500";
            return (
              <div key={card.id} className={`card ${editingCard?.id === card.id ? "ring-2 ring-brand-400" : ""}`}>
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 via-indigo-900 to-violet-800 text-white p-4 mb-3 shadow-lg">
                  <span className="absolute -right-8 -top-8 w-28 h-28 rounded-full bg-white/10" aria-hidden />
                  <span className="absolute right-10 -bottom-10 w-24 h-24 rounded-full bg-white/5" aria-hidden />
                  <div className="relative flex items-center justify-between">
                    <span className="w-9 h-6 rounded-md bg-gradient-to-br from-amber-200 to-amber-400 opacity-90" aria-hidden />
                    {utilizationPct !== null && (
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${pillColor}`}>
                        {utilizationPct.toFixed(0)}% del límite
                      </span>
                    )}
                  </div>
                  <p className="relative text-lg font-bold mt-4 tracking-wide">{card.name}</p>
                  <p className="relative text-xs text-white/60">
                    Corte día {card.closing_day} · Pago día {card.payment_day}
                  </p>
                </div>
                <div className="flex justify-end gap-3 mb-2 -mt-1">
                  <button onClick={() => setEditingCard(card)} className="text-brand-600 hover:underline text-xs">
                    editar
                  </button>
                  <button onClick={() => handleDelete(card.id)} className="text-red-500 hover:underline text-xs">
                    eliminar
                  </button>
                </div>

                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 mb-2">
                  <button
                    onClick={() => setOpenList(openList === dueKey ? null : dueKey)}
                    aria-expanded={openList === dueKey}
                    className="w-full text-left"
                  >
                    <span className="flex items-center justify-between text-sm gap-2">
                      <span className="text-amber-800">
                        💰 Próximo pago: <strong>{fmt(b.paymentDate)}</strong>
                      </span>
                      <span className="flex items-center gap-1.5 font-bold text-amber-900">
                        {formatCurrency(b.dueTotal)}
                        <span className={`text-amber-500 text-xs transition-transform ${openList === dueKey ? "rotate-180" : ""}`}>▼</span>
                      </span>
                    </span>
                    <span className="block text-xs text-amber-700 mt-1">
                      {b.closed
                        ? `Corte cerrado el ${fmt(b.closingDate)}: este monto ya no cambia.`
                        : `Todavía suma compras hasta el corte del ${fmt(b.closingDate)}.`}{" "}
                      <span className="font-semibold underline">
                        {openList === dueKey ? "Ocultar consumos" : `Ver ${b.dueExpenses.length} consumo${b.dueExpenses.length === 1 ? "" : "s"}`}
                      </span>
                    </span>
                  </button>
                  {openList === dueKey && (
                    <ExpenseMiniList expenses={b.dueExpenses} categories={categories} emptyText="No hay consumos en este corte." />
                  )}
                </div>

                <div className="bg-slate-50 rounded-xl p-3 mb-3">
                  <button
                    onClick={() => setOpenList(openList === nextKey ? null : nextKey)}
                    aria-expanded={openList === nextKey}
                    className="w-full text-left"
                  >
                    <span className="flex items-center justify-between text-sm gap-2">
                      <span className="text-slate-600">
                        📈 Para el pago del <strong>{fmt(b.nextPaymentDate)}</strong>
                      </span>
                      <span className="flex items-center gap-1.5 font-semibold text-slate-800">
                        {formatCurrency(b.nextTotal)}
                        <span className={`text-slate-400 text-xs transition-transform ${openList === nextKey ? "rotate-180" : ""}`}>▼</span>
                      </span>
                    </span>
                    <span className="block text-xs text-slate-500 mt-1">
                      Compras hechas después del corte del {fmt(b.closingDate)}: se pagan un mes después.{" "}
                      {b.nextExpenses.length > 0 && (
                        <span className="font-semibold underline">
                          {openList === nextKey ? "Ocultar consumos" : `Ver ${b.nextExpenses.length} consumo${b.nextExpenses.length === 1 ? "" : "s"}`}
                        </span>
                      )}
                    </span>
                  </button>
                  {openList === nextKey && (
                    <ExpenseMiniList expenses={b.nextExpenses} categories={categories} emptyText="Todavía no hay compras para ese pago." />
                  )}
                  {card.credit_limit && (
                    <div className="w-full bg-slate-200 rounded-full h-2 mt-2">
                      <div
                        className={`h-2 rounded-full ${barColor}`}
                        style={{ width: `${Math.min(utilizationPct ?? 0, 100)}%` }}
                      />
                    </div>
                  )}
                </div>

                <div className="text-sm space-y-1 text-slate-600">
                  <p>
                    📅 {b.closed ? "Próximo corte" : "Corte"}: <strong>{fmt(b.closed ? b.nextClosingDate : b.closingDate)}</strong> (día{" "}
                    {card.closing_day})
                  </p>
                  <p className="text-xs text-slate-400">
                    {card.auto_post_payment
                      ? "⚡ El pago se registra solo como gasto el día de pago."
                      : "Auto-pago desactivado (recomendado por ahora)."}
                  </p>
                  {card.credit_limit && (
                    <p>🧾 Límite de crédito: {formatCurrency(Number(card.credit_limit))}</p>
                  )}
                </div>
              </div>
            );
    }
  }
}
