"use client";

import { useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import Avatar from "@/components/Avatar";
import { useHousehold } from "@/lib/HouseholdContext";
import { useTable } from "@/lib/hooks";
import { supabase } from "@/lib/supabaseClient";
import { HouseholdMember, WhatsappLink } from "@/lib/types";

const BOT_NUMBER = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "").replace(/\D/g, "");
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCode() {
  const values = new Uint32Array(6);
  crypto.getRandomValues(values);
  return Array.from(values, (v) => ALPHABET[v % ALPHABET.length]).join("");
}

function maskPhone(phone: string) {
  return phone.length > 6 ? `+${phone.slice(0, 3)} ••• ${phone.slice(-4)}` : phone;
}

export default function WhatsappPage() {
  return (
    <AuthGuard>
      <WhatsappContent />
    </AuthGuard>
  );
}

function WhatsappContent() {
  const { householdId, session } = useHousehold();
  const userId = session?.user.id ?? null;
  const { data: links, refresh } = useTable<WhatsappLink>("whatsapp_links", householdId);
  const { data: members } = useTable<HouseholdMember>("household_members", householdId);
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const nameOf = (uid: string) => members.find((m) => m.user_id === uid)?.display_name || "Alguien del hogar";

  async function generate() {
    if (!householdId || !userId) return;
    setBusy(true);
    setError(null);
    // Borra códigos viejos propios y crea uno nuevo (válido 15 minutos).
    await supabase.from("whatsapp_link_codes").delete().eq("user_id", userId);
    let lastError: string | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const candidate = randomCode();
      const { error } = await supabase
        .from("whatsapp_link_codes")
        .insert({ code: candidate, user_id: userId, household_id: householdId });
      if (!error) {
        setCode(candidate);
        setBusy(false);
        return;
      }
      lastError = error.message;
    }
    setError(lastError);
    setBusy(false);
  }

  async function unlink(id: string) {
    if (!confirm("¿Desvincular este número? Dejará de poder registrar gastos por WhatsApp.")) return;
    await supabase.from("whatsapp_links").delete().eq("id", id);
    refresh();
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl p-5 text-white bg-gradient-to-br from-emerald-600 to-emerald-400">
        <h1 className="text-2xl font-bold">💬 Registrar gastos por WhatsApp</h1>
        <p className="text-sm opacity-90 mt-1">
          Escríbele al número de la app &quot;gasolina 20&quot; y el gasto queda registrado, sin abrir nada.
        </p>
      </div>

      {!BOT_NUMBER && (
        <div className="card bg-amber-50 border-amber-200 text-amber-900 text-sm">
          ⚙️ <strong>Falta terminar la configuración.</strong> El número de WhatsApp de la app todavía no está conectado.
          Sigue la sección <strong>3.6</strong> del README (crear la app en Meta y poner las variables en Vercel). Mientras
          tanto puedes generar tu código igual; funcionará apenas quede conectado.
        </div>
      )}

      <div className="card">
        <h2 className="font-semibold mb-1">1. Vincula tu número</h2>
        <p className="text-sm text-slate-600 mb-3">
          Cada uno vincula su propio celular. Genera un código y mándalo por WhatsApp{" "}
          {BOT_NUMBER ? (
            <>
              al <strong>+{BOT_NUMBER}</strong>
            </>
          ) : (
            "al número de la app"
          )}{" "}
          — así se comprueba que el número es tuyo.
        </p>
        {code ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <p className="text-sm text-emerald-800 mb-1">Envía este mensaje (vence en 15 minutos):</p>
            <p className="text-2xl font-bold tracking-widest text-emerald-900 select-all">vincular {code}</p>
            {BOT_NUMBER && (
              <a
                href={`https://wa.me/${BOT_NUMBER}?text=${encodeURIComponent(`vincular ${code}`)}`}
                target="_blank"
                rel="noreferrer"
                className="btn-primary inline-block mt-3"
              >
                Abrir WhatsApp con el mensaje listo
              </a>
            )}
            <button onClick={generate} className="text-xs text-emerald-700 underline ml-3">
              generar otro
            </button>
          </div>
        ) : (
          <button onClick={generate} disabled={busy} className="btn-primary">
            {busy ? "Generando..." : "Generar código"}
          </button>
        )}
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      </div>

      <div className="card">
        <h2 className="font-semibold mb-3">2. Números vinculados</h2>
        {links.length === 0 ? (
          <p className="text-sm text-slate-500">Todavía no hay números vinculados.</p>
        ) : (
          <div className="space-y-2">
            {links.map((l) => (
              <div key={l.id} className="flex items-center justify-between border border-slate-200 rounded-xl px-3 py-2">
                <div className="flex items-center gap-2">
                  <Avatar name={nameOf(l.user_id)} size="sm" />
                  <span className="text-sm font-medium">{nameOf(l.user_id)}</span>
                  <span className="text-sm text-slate-500">{maskPhone(l.phone)}</span>
                </div>
                {l.user_id === userId && (
                  <button onClick={() => unlink(l.id)} className="text-red-500 hover:underline text-xs">
                    desvincular
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="font-semibold mb-3">3. Qué le puedes escribir</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
          {[
            ["gasolina 20", "Registra $20; la categoría la adivina (aprende de lo que ya registraron)"],
            ["supermaxi 34,50 daya", "Con la tarjeta Daya (sirve el nombre de cualquier tarjeta)"],
            ["almuerzo 8 libre", "Se descuenta de tu plata libre de la quincena"],
            ["cine 12 extra", "Queda marcado como gasto no planeado"],
            ["cuánto llevo en alimentación", "Cuánto van y cuánto les queda en esa categoría"],
            ["resumen", "Ingresos, gastos y balance del mes"],
            ["deshacer", "Borra lo último que registraste por WhatsApp (24 h)"],
            ["ayuda", "Te recuerda todo esto"],
          ].map(([cmd, desc]) => (
            <div key={cmd} className="bg-slate-50 rounded-xl px-3 py-2">
              <p className="font-mono font-semibold text-emerald-700">{cmd}</p>
              <p className="text-xs text-slate-500">{desc}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-400 mt-3">
          Los gastos que llegan por WhatsApp aparecen en Gastos con la etiqueta &quot;💬 whatsapp&quot; y a nombre de quien
          los mandó. Fotos de recibos todavía no — viene en una próxima versión.
        </p>
      </div>
    </div>
  );
}
