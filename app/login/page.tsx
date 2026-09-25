"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useHousehold } from "@/lib/HouseholdContext";
import { Icon } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const { session, refresh } = useHousehold();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session) router.replace("/");
  }, [session, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await refresh();
        router.replace("/");
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setInfo(
          "Cuenta creada. Si tu proyecto de Supabase requiere confirmación por correo, revisa tu bandeja de entrada antes de iniciar sesión."
        );
        setMode("login");
      }
    } catch (err: any) {
      setError(err.message ?? "Ocurrió un error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 overflow-y-auto flex items-center justify-center bg-brand-gradient px-4 py-10">
      <div className="absolute -left-24 -top-24 w-96 h-96 rounded-full bg-white/10" aria-hidden />
      <div className="absolute -right-24 -bottom-32 w-[28rem] h-[28rem] rounded-full bg-white/10" aria-hidden />
      <div className="relative bg-white rounded-3xl shadow-2xl p-7 w-full max-w-sm">
        <div className="flex justify-center mb-4">
          <span className="w-14 h-14 rounded-2xl bg-brand-gradient flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
            <Icon name="wallet" className="w-7 h-7" />
          </span>
        </div>
        <h1 className="text-2xl font-heading font-bold mb-1 text-center">Finanzas Familiares</h1>
        <p className="text-center text-sm text-slate-500 mb-6">
          {mode === "login" ? "Inicia sesión" : "Crea tu cuenta"}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Correo</label>
            <input
              className="input"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Contraseña</label>
            <input
              className="input"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {info && <p className="text-sm text-emerald-600">{info}</p>}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Cargando..." : mode === "login" ? "Entrar" : "Crear cuenta"}
          </button>
        </form>

        <button
          className="text-sm text-brand-600 mt-4 w-full text-center hover:underline"
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setError(null);
            setInfo(null);
          }}
        >
          {mode === "login" ? "¿No tienes cuenta? Regístrate" : "¿Ya tienes cuenta? Inicia sesión"}
        </button>
      </div>
    </div>
  );
}
