"use client";

import { useEffect, useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import { useHousehold } from "@/lib/HouseholdContext";
import { useTable } from "@/lib/hooks";
import { supabase } from "@/lib/supabaseClient";
import { Card, Expense } from "@/lib/types";
import { cardCycleSpend, formatCurrency, nextOccurrence } from "@/lib/utils";

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

  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [name, setName] = useState("");
  const [closingDay, setClosingDay] = useState("15");
  const [paymentDay, setPaymentDay] = useState("25");
  const [creditLimit, setCreditLimit] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editingCard) {
      setName(editingCard.name);
      setClosingDay(String(editingCard.closing_day));
      setPaymentDay(String(editingCard.payment_day));
      setCreditLimit(editingCard.credit_limit ? String(editingCard.credit_limit) : "");
    } else {
      setName("");
      setClosingDay("15");
      setPaymentDay("25");
      setCreditLimit("");
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
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">💳 Tarjetas de crédito</h1>

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
        {error && <p className="md:col-span-5 text-sm text-red-600">{error}</p>}
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
          <p className="text-slate-500 text-sm">Cargando...</p>
        ) : cards.length === 0 ? (
          <p className="text-slate-500 text-sm">Aún no has agregado tarjetas.</p>
        ) : (
          cards.map((card) => {
            const closing = nextOccurrence(card.closing_day);
            const payment = nextOccurrence(card.payment_day);
            const cycleSpend = cardCycleSpend(expenses, card.id, card.closing_day);
            const utilizationPct = card.credit_limit
              ? Math.min((cycleSpend / Number(card.credit_limit)) * 100, 999)
              : null;
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
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold">💳 {card.name}</h3>
                  <div className="flex items-center gap-2">
                    {utilizationPct !== null && (
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${pillColor}`}>
                        {utilizationPct.toFixed(0)}% del límite
                      </span>
                    )}
                    <button
                      onClick={() => {
                        setEditingCard(card);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className="text-brand-600 hover:underline text-xs"
                    >
                      editar
                    </button>
                    <button
                      onClick={() => handleDelete(card.id)}
                      className="text-red-500 hover:underline text-xs"
                    >
                      eliminar
                    </button>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-xl p-3 mb-3">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-slate-500">Saldo de este corte</span>
                    <span className="font-semibold text-slate-800">{formatCurrency(cycleSpend)}</span>
                  </div>
                  {card.credit_limit && (
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${barColor}`}
                        style={{ width: `${Math.min(utilizationPct ?? 0, 100)}%` }}
                      />
                    </div>
                  )}
                </div>

                <div className="text-sm space-y-1 text-slate-600">
                  <p>
                    📅 Próximo corte: <strong>{closing.toLocaleDateString("es-ES")}</strong> (día{" "}
                    {card.closing_day})
                  </p>
                  <p>
                    💵 Fecha de pago: <strong>{payment.toLocaleDateString("es-ES")}</strong> (día{" "}
                    {card.payment_day})
                  </p>
                  {card.credit_limit && (
                    <p>🧾 Límite de crédito: {formatCurrency(Number(card.credit_limit))}</p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
