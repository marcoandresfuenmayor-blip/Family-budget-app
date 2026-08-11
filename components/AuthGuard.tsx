"use client";

import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useHousehold } from "@/lib/HouseholdContext";
import { supabase } from "@/lib/supabaseClient";

export default function AuthGuard({ children }: { children: ReactNode }) {
  const { session, loading, householdId, refresh } = useHousehold();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !session) {
      router.replace("/login");
    }
  }, [loading, session, router]);

  if (loading) {
    return <div className="max-w-6xl mx-auto px-4 py-10 text-slate-500">Cargando...</div>;
  }

  if (!session) return null;

  if (!householdId) {
    return <HouseholdOnboarding onDone={refresh} displayNameHint={session.user.email ?? ""} />;
  }

  return <>{children}</>;
}

function HouseholdOnboarding({
  onDone,
  displayNameHint,
}: {
  onDone: () => Promise<void>;
  displayNameHint: string;
}) {
  const [tab, setTab] = useState<"create" | "join">("create");
  const [householdName, setHouseholdName] = useState("Mi Familia");
  const [displayName, setDisplayName] = useState(displayNameHint.split("@")[0]);
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function createHousehold(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error } = await supabase.rpc("create_household_with_defaults", {
        household_name: householdName,
        display_name: displayName,
      });
      if (error) throw error;
      await onDone();
    } catch (err: any) {
      setError(err.message ?? "No se pudo crear el hogar");
    } finally {
      setLoading(false);
    }
  }

  async function joinHousehold(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error } = await supabase.rpc("join_household_by_code", {
        code: inviteCode.trim(),
        display_name: displayName,
      });
      if (error) throw error;
      await onDone();
    } catch (err: any) {
      setError(err.message ?? "Código inválido");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="card w-full max-w-md">
        <h2 className="text-lg font-semibold mb-1">Configura tu hogar</h2>
        <p className="text-sm text-slate-500 mb-4">
          Crea un hogar nuevo o únete al de tu pareja con un código de invitación.
        </p>

        <div className="flex gap-2 mb-4">
          <button
            className={`flex-1 py-2 rounded-lg text-sm font-medium ${
              tab === "create" ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600"
            }`}
            onClick={() => setTab("create")}
          >
            Crear hogar
          </button>
          <button
            className={`flex-1 py-2 rounded-lg text-sm font-medium ${
              tab === "join" ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600"
            }`}
            onClick={() => setTab("join")}
          >
            Unirme con código
          </button>
        </div>

        <div className="mb-4">
          <label className="label">Tu nombre (para identificarte en el hogar)</label>
          <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </div>

        {tab === "create" ? (
          <form onSubmit={createHousehold} className="space-y-4">
            <div>
              <label className="label">Nombre del hogar</label>
              <input
                className="input"
                value={householdName}
                onChange={(e) => setHouseholdName(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? "Creando..." : "Crear hogar"}
            </button>
            <p className="text-xs text-slate-500">
              Después de crear el hogar, ve a la sección de Categorías para ver el código de
              invitación y compartirlo con tu pareja.
            </p>
          </form>
        ) : (
          <form onSubmit={joinHousehold} className="space-y-4">
            <div>
              <label className="label">Código de invitación</label>
              <input
                className="input"
                placeholder="Pégalo aquí"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? "Uniéndome..." : "Unirme al hogar"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
