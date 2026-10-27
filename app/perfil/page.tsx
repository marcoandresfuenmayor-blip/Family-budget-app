"use client";

import { useEffect, useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import { PageHeader, Section } from "@/components/ui";
import { useHousehold } from "@/lib/HouseholdContext";
import { supabase } from "@/lib/supabaseClient";

const GENDERS = [
  { value: "mujer", label: "Mujer" },
  { value: "hombre", label: "Hombre" },
  { value: "otro", label: "Otro" },
  { value: "prefiero_no_decir", label: "Prefiero no decir" },
];

export default function PerfilPage() {
  return (
    <AuthGuard>
      <PerfilContent />
    </AuthGuard>
  );
}

function PerfilContent() {
  const { session } = useHousehold();
  const userId = session?.user.id;
  const [birthYear, setBirthYear] = useState("");
  const [gender, setGender] = useState("");
  const [city, setCity] = useState("");
  const [consent, setConsent] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!userId) return;
    supabase
      .from("user_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setHasProfile(true);
        setBirthYear(data.birth_year ? String(data.birth_year) : "");
        setGender(data.gender ?? "");
        setCity(data.city ?? "");
        setConsent(!!data.consent_at);
      });
  }, [userId]);

  const thisYear = new Date().getFullYear();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    if (!consent) {
      setMessage({ ok: false, text: "Para guardar tus datos, marca la casilla de consentimiento." });
      return;
    }
    const year = birthYear ? Number(birthYear) : null;
    if (year !== null && (year < 1920 || year > thisYear - 16)) {
      setMessage({ ok: false, text: "Revisa el año de nacimiento." });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("user_profiles").upsert({
      user_id: userId,
      birth_year: year,
      gender: gender || null,
      city: city.trim() || null,
      consent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    setSaving(false);
    if (error) setMessage({ ok: false, text: error.message });
    else {
      setHasProfile(true);
      setMessage({ ok: true, text: "Guardado. ¡Gracias por ayudarnos a mejorar!" });
    }
  }

  async function removeData() {
    if (!userId || !confirm("¿Borrar tus datos de perfil? Esto no afecta tus gastos ni ingresos.")) return;
    await supabase.from("user_profiles").delete().eq("user_id", userId);
    setBirthYear("");
    setGender("");
    setCity("");
    setConsent(false);
    setHasProfile(false);
    setMessage({ ok: true, text: "Tus datos de perfil fueron borrados." });
  }

  return (
    <div className="space-y-5">
      <PageHeader icon="users" eyebrow="Tu cuenta" title="Mi perfil" subtitle="Datos opcionales que nos ayudan a mejorar la app" />

      <Section
        id="perfil-datos"
        icon="users"
        accent="indigo"
        title="Sobre ti"
        subtitle="Edad, género y ciudad (todo opcional)"
        help="Usamos estos datos solo de forma agrupada (por ejemplo: cuántas personas de 25 a 34 años usan la app) para entender qué necesitan los usuarios. Nunca se muestran tu nombre, correo ni tus montos."
      >
        <form onSubmit={save} className="card grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="label">Año de nacimiento</label>
            <input
              className="input"
              type="number"
              min={1920}
              max={thisYear - 16}
              placeholder="1990"
              value={birthYear}
              onChange={(e) => setBirthYear(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Género</label>
            <select className="input" value={gender} onChange={(e) => setGender(e.target.value)}>
              <option value="">Selecciona</option>
              {GENDERS.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Ciudad</label>
            <input className="input" maxLength={80} placeholder="Quito" value={city} onChange={(e) => setCity(e.target.value)} />
          </div>

          <label className="md:col-span-3 flex items-start gap-2 text-sm text-slate-600 bg-slate-50 rounded-xl p-3">
            <input type="checkbox" className="mt-1" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>
              Acepto que se usen estos datos, de forma agrupada y anónima, para mejorar la app. Puedo borrarlos cuando
              quiera desde esta misma página.
            </span>
          </label>

          <div className="md:col-span-3 flex items-center gap-3 flex-wrap">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? "Guardando..." : "Guardar"}
            </button>
            {hasProfile && (
              <button type="button" onClick={removeData} className="text-sm text-rose-600 hover:underline">
                Borrar mis datos de perfil
              </button>
            )}
            {message && (
              <span className={`text-sm ${message.ok ? "text-emerald-600" : "text-rose-600"}`}>{message.text}</span>
            )}
          </div>
        </form>
      </Section>
    </div>
  );
}
