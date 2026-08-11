"use client";

import { useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import { useHousehold } from "@/lib/HouseholdContext";
import { useTable } from "@/lib/hooks";
import { supabase } from "@/lib/supabaseClient";
import { Card } from "@/lib/types";
import { formatCurrency, nextOccurrence } from "@/lib/utils";

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

  const [name, setName] = useState("");
  const [closingDay, setClosingDay] = useState("15");
  const [paymentDay, setPaymentDay] = useState("25");
  const [creditLimit, setCreditLimit] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!householdId || !name) return;
    setSaving(true);
    setError(null);
    const { error } = await supabase.from("cards").insert({
      household_id: householdId,
      name,
      closing_day: Number(closingDay),
      payment_day: Number(paymentDay),
      credit_limit: creditLimit ? Number(creditLimit) : null,
    });
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setName("");
    setCreditLimit("");
    refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta tarjeta?")) return;
    await supabase.from("cards").delete().eq("id", id);
    refresh();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Tarjetas de crédito</h1>

      <form onSubmit={handleSubmit} className="card grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
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
            {saving ? "Guardando..." : "Agregar tarjeta"}
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
            return (
              <div key={card.id} className="card">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold">{card.name}</h3>
                  <button
                    onClick={() => handleDelete(card.id)}
                    className="text-red-500 hover:underline text-xs"
                  >
                    eliminar
                  </button>
                </div>
                <div className="text-sm space-y-1 text-slate-600">
                  <p>
                    📅 Próximo corte: <strong>{closing.toLocaleDateString("es-ES")}</strong> (día{" "}
                    {card.closing_day})
                  </p>
                  <p>
                    💵 Próximo pago: <strong>{payment.toLocaleDateString("es-ES")}</strong> (día{" "}
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
