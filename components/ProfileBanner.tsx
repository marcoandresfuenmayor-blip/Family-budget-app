"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useHousehold } from "@/lib/HouseholdContext";
import { supabase } from "@/lib/supabaseClient";
import { Icon } from "@/components/ui";

const DISMISS_KEY = "ff-perfil-banner-oculto";

// Invitación discreta a completar el perfil; se puede cerrar para siempre.
export default function ProfileBanner() {
  const { session } = useHousehold();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const userId = session?.user.id;
    if (!userId) return;
    try {
      if (localStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      /* ignorar */
    }
    supabase
      .from("user_profiles")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => setShow(!data));
  }, [session?.user.id]);

  if (!show) return null;

  function dismiss() {
    setShow(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignorar */
    }
  }

  return (
    <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-100 text-indigo-900 rounded-2xl px-4 py-3 text-sm">
      <Icon name="users" className="w-5 h-5 shrink-0 text-indigo-500" />
      <p className="flex-1">
        Ayúdanos a mejorar la app: completa tu perfil en 30 segundos (edad, género y ciudad, todo opcional).
      </p>
      <Link href="/perfil" className="font-semibold text-indigo-700 hover:underline whitespace-nowrap">
        Completar
      </Link>
      <button onClick={dismiss} className="text-indigo-400 hover:text-indigo-700" aria-label="Ocultar">
        <Icon name="x" className="w-4 h-4" />
      </button>
    </div>
  );
}
