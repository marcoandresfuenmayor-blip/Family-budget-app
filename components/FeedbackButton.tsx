"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { useHousehold } from "@/lib/HouseholdContext";
import { supabase } from "@/lib/supabaseClient";
import { Icon } from "@/components/ui";

const KINDS = [
  { value: "idea", label: "💡 Idea" },
  { value: "problema", label: "🐞 Problema" },
  { value: "me_gusta", label: "❤️ Me gusta" },
  { value: "otro", label: "💬 Otro" },
];

// Botón flotante para dejar una opinión desde cualquier pantalla.
export default function FeedbackButton() {
  const pathname = usePathname();
  const { session, householdId } = useHousehold();
  const [open, setOpen] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [kind, setKind] = useState("idea");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  if (!session) return null;

  function close() {
    setOpen(false);
    setTimeout(() => {
      setSent(false);
      setScore(null);
      setKind("idea");
      setMessage("");
      setError(null);
    }, 200);
  }

  async function send() {
    if (score === null && !message.trim()) {
      setError("Elige una nota o escribe un comentario.");
      return;
    }
    setSending(true);
    setError(null);
    const { error } = await supabase.from("app_feedback").insert({
      user_id: session!.user.id,
      household_id: householdId,
      kind,
      score,
      message: message.trim() || null,
      page: pathname,
    });
    setSending(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-30 flex items-center gap-2 bg-brand-gradient text-white text-sm font-semibold pl-3 pr-4 py-2.5 rounded-full shadow-lg shadow-indigo-500/30 hover:scale-105 transition-transform"
        title="Cuéntanos qué mejorar o qué te gusta de la app"
      >
        <Icon name="chat" className="w-4 h-4" />
        Opinión
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" onClick={close}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="font-heading font-bold text-slate-900">Tu opinión</h3>
                <p className="text-xs text-slate-500">Nos ayuda a decidir qué mejorar primero.</p>
              </div>
              <button onClick={close} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center" aria-label="Cerrar">
                <Icon name="x" className="w-4 h-4" />
              </button>
            </div>

            {sent ? (
              <div className="text-center py-6">
                <p className="text-3xl mb-2">🙌</p>
                <p className="font-semibold text-slate-800">¡Gracias!</p>
                <p className="text-sm text-slate-500">Recibimos tu opinión.</p>
                <button onClick={close} className="btn-primary mt-4">
                  Cerrar
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-slate-700 mb-2">
                    ¿Qué tan probable es que recomiendes la app a otra pareja?
                  </p>
                  <div className="grid grid-cols-11 gap-1">
                    {Array.from({ length: 11 }, (_, n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setScore(n)}
                        className={`h-9 rounded-lg text-sm font-semibold border transition-colors ${
                          score === n
                            ? n >= 9
                              ? "bg-emerald-500 border-emerald-500 text-white"
                              : n >= 7
                              ? "bg-amber-400 border-amber-400 text-white"
                              : "bg-rose-500 border-rose-500 text-white"
                            : "border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                    <span>Nada probable</span>
                    <span>Muy probable</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {KINDS.map((k) => (
                    <button
                      key={k.value}
                      type="button"
                      onClick={() => setKind(k.value)}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${
                        kind === k.value ? "bg-brand-50 border-brand-300 text-brand-700" : "border-slate-200 text-slate-600"
                      }`}
                    >
                      {k.label}
                    </button>
                  ))}
                </div>

                <textarea
                  className="input min-h-[96px]"
                  maxLength={2000}
                  placeholder="Cuéntanos qué mejorarías, qué te costó entender o qué te gustaría que la app hiciera"
                  value={message}
                  onChange={(e) => {
                    setMessage(e.target.value);
                    setError(null);
                  }}
                />

                {error && <p className="text-sm text-rose-600">{error}</p>}

                <button onClick={send} disabled={sending} className="btn-primary w-full">
                  {sending ? "Enviando..." : "Enviar opinión"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
