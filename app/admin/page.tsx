"use client";

import { useEffect, useMemo, useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import { PageHeader, Pill, Section } from "@/components/ui";
import { supabase } from "@/lib/supabaseClient";

type Insights = {
  usuarios: number;
  hogares: number;
  hogares_activos_30d: number;
  perfiles_completos: number;
  por_edad: Record<string, number>;
  por_genero: Record<string, number>;
  por_ciudad: Record<string, number>;
  nps: { respuestas: number; promotores: number; pasivos: number; detractores: number };
  feedback: {
    created_at: string;
    kind: string;
    score: number | null;
    message: string | null;
    page: string | null;
    age_range: string | null;
    gender: string | null;
  }[];
};

const KIND_LABEL: Record<string, string> = { idea: "💡 Idea", problema: "🐞 Problema", me_gusta: "❤️ Me gusta", otro: "💬 Otro" };
const GENDER_LABEL: Record<string, string> = {
  mujer: "Mujer",
  hombre: "Hombre",
  otro: "Otro",
  prefiero_no_decir: "Prefiero no decir",
  sin_dato: "Sin dato",
};
const AGE_ORDER = ["18-24", "25-34", "35-44", "45-54", "55+", "Sin dato"];

export default function AdminPage() {
  return (
    <AuthGuard>
      <AdminContent />
    </AuthGuard>
  );
}

function Bars({ data, labels, order }: { data: Record<string, number>; labels?: Record<string, string>; order?: string[] }) {
  const entries = Object.entries(data).sort((a, b) =>
    order ? order.indexOf(a[0]) - order.indexOf(b[0]) : b[1] - a[1]
  );
  const total = entries.reduce((s, [, n]) => s + n, 0);
  if (total === 0) return <p className="text-sm text-slate-400">Aún no hay datos.</p>;
  return (
    <div className="space-y-2">
      {entries.map(([k, n]) => (
        <div key={k}>
          <div className="flex justify-between text-xs text-slate-600 mb-0.5">
            <span>{labels?.[k] ?? k}</span>
            <span className="font-semibold">
              {n} · {Math.round((n / total) * 100)}%
            </span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-brand-gradient rounded-full" style={{ width: `${(n / total) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function AdminContent() {
  const [data, setData] = useState<Insights | null>(null);
  const [denied, setDenied] = useState(false);
  const [kind, setKind] = useState("");

  useEffect(() => {
    supabase.rpc("admin_insights").then(({ data, error }) => {
      if (error) setDenied(true);
      else setData(data as Insights);
    });
  }, []);

  const feedback = useMemo(() => (data?.feedback ?? []).filter((f) => !kind || f.kind === kind), [data, kind]);

  if (denied) {
    return <div className="card text-sm text-slate-600">Esta sección es solo para el administrador de la app.</div>;
  }
  if (!data) return <div className="card text-sm text-slate-500">Cargando...</div>;

  const nps = data.nps;
  const npsScore = nps.respuestas ? Math.round(((nps.promotores - nps.detractores) / nps.respuestas) * 100) : null;
  const kpis = [
    { label: "Usuarios", value: data.usuarios },
    { label: "Hogares", value: data.hogares },
    { label: "Hogares activos (30 días)", value: data.hogares_activos_30d },
    { label: "Perfiles completos", value: data.perfiles_completos },
  ];

  return (
    <div className="space-y-5">
      <PageHeader icon="chart" eyebrow="Administración" title="Clientes" subtitle="Quiénes usan la app y qué opinan (datos agrupados y anónimos)" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="bg-white rounded-3xl border border-slate-200/70 shadow-sm p-4">
            <p className="text-xs font-medium text-slate-500">{k.label}</p>
            <p className="text-2xl font-heading font-extrabold text-slate-900 mt-1">{k.value}</p>
          </div>
        ))}
      </div>

      <Section
        id="admin-nps"
        icon="star"
        accent="emerald"
        title="Recomendación (NPS)"
        subtitle="Última nota de 0 a 10 de cada usuario"
        help="NPS = % de promotores (9-10) menos % de detractores (0-6). Sobre 0 es aceptable, sobre 30 es bueno y sobre 50 es excelente."
        badge={npsScore !== null ? <Pill tone={npsScore >= 30 ? "green" : npsScore >= 0 ? "amber" : "red"}>NPS {npsScore}</Pill> : undefined}
      >
        <div className="card">
          {nps.respuestas === 0 ? (
            <p className="text-sm text-slate-400">Aún no hay notas. Aparecerán cuando los usuarios usen el botón "Opinión".</p>
          ) : (
            <Bars
              data={{ Promotores: nps.promotores, Pasivos: nps.pasivos, Detractores: nps.detractores }}
              order={["Promotores", "Pasivos", "Detractores"]}
            />
          )}
        </div>
      </Section>

      <Section id="admin-perfil" icon="users" accent="indigo" title="Perfil de los usuarios" subtitle="Solo quienes aceptaron compartir sus datos">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="card">
            <h4 className="text-sm font-semibold mb-3">Edad</h4>
            <Bars data={data.por_edad} order={AGE_ORDER} />
          </div>
          <div className="card">
            <h4 className="text-sm font-semibold mb-3">Género</h4>
            <Bars data={data.por_genero} labels={GENDER_LABEL} />
          </div>
          <div className="card">
            <h4 className="text-sm font-semibold mb-3">Ciudad</h4>
            <Bars data={data.por_ciudad} />
          </div>
        </div>
      </Section>

      <Section
        id="admin-feedback"
        icon="chat"
        accent="violet"
        title="Comentarios"
        subtitle="Lo que escriben los usuarios, con su rango de edad y género"
        badge={<Pill tone="indigo">{data.feedback.length}</Pill>}
      >
        <div className="card">
          <div className="flex flex-wrap gap-2 mb-3">
            {[["", "Todos"], ...Object.entries(KIND_LABEL)].map(([v, l]) => (
              <button
                key={v}
                onClick={() => setKind(v)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${
                  kind === v ? "bg-brand-50 border-brand-300 text-brand-700" : "border-slate-200 text-slate-600"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
          {feedback.length === 0 ? (
            <p className="text-sm text-slate-400">No hay comentarios todavía.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {feedback.map((f, i) => (
                <li key={i} className="py-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mb-1">
                    <span className="font-semibold text-slate-700">{KIND_LABEL[f.kind] ?? f.kind}</span>
                    {f.score !== null && <span>Nota {f.score}/10</span>}
                    {f.age_range && <span>· {f.age_range}</span>}
                    {f.gender && <span>· {GENDER_LABEL[f.gender] ?? f.gender}</span>}
                    {f.page && <span>· en {f.page}</span>}
                    <span className="ml-auto">{new Date(f.created_at).toLocaleDateString("es-ES")}</span>
                  </div>
                  {f.message && <p className="text-sm text-slate-800 whitespace-pre-line">{f.message}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Section>
    </div>
  );
}
