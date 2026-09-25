"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import Avatar from "@/components/Avatar";
import { useHousehold } from "@/lib/HouseholdContext";
import { useTable } from "@/lib/hooks";
import { supabase } from "@/lib/supabaseClient";
import { Category, CheckinAnswer, CheckinStatus, Expense, HouseholdMember } from "@/lib/types";
import { previousQuincenaRange, quincenaRange } from "@/lib/insights";
import { formatCurrency } from "@/lib/utils";
import { PageHeader, Pill, Section } from "@/components/ui";

const ALIGNMENT = [
  { value: 1, emoji: "😖", label: "Para nada" },
  { value: 2, emoji: "😕", label: "Algo" },
  { value: 3, emoji: "🙂", label: "Bastante" },
  { value: 4, emoji: "😄", label: "Totalmente" },
];

const TENSION = [
  { value: 1, emoji: "😌", label: "Ninguno" },
  { value: 2, emoji: "🤔", label: "Uno chico" },
  { value: 3, emoji: "😬", label: "Sí, uno" },
  { value: 4, emoji: "😣", label: "Varios" },
];

export default function ParejaPage() {
  return (
    <AuthGuard>
      <ParejaContent />
    </AuthGuard>
  );
}

function ParejaContent() {
  const { householdId, session } = useHousehold();
  const userId = session?.user.id ?? null;
  const { data: members, refresh: refreshMembers } = useTable<HouseholdMember>("household_members", householdId);
  const { data: expenses } = useTable<Expense>("expenses", householdId);
  const { data: categories } = useTable<Category>("categories", householdId);

  const period = useMemo(() => quincenaRange(), []);
  const prevPeriod = useMemo(() => previousQuincenaRange(), []);

  const [status, setStatus] = useState<CheckinStatus | null>(null);
  const [editing, setEditing] = useState(false);

  const loadStatus = useCallback(async () => {
    if (!householdId) return;
    const { data } = await supabase.rpc("get_couple_checkins", {
      p_household: householdId,
      p_period: period.start,
    });
    if (data) setStatus(data as CheckinStatus);
  }, [householdId, period.start]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const myAnswer = status?.rows.find((r) => r.user_id === userId) ?? null;
  const partner = members.find((m) => m.user_id !== userId);
  const nameOf = (uid: string) => members.find((m) => m.user_id === uid)?.display_name || "Alguien del hogar";

  const inPeriod = (e: Expense, p: { start: string; end: string }) => e.expense_date >= p.start && e.expense_date <= p.end;
  const current = expenses.filter((e) => inPeriod(e, period) && !e.is_card_payment);
  const previous = expenses.filter((e) => inPeriod(e, prevPeriod) && !e.is_card_payment);

  return (
    <div className="space-y-5">
      <PageHeader
        icon="heart"
        eyebrow={`Quincena del ${period.label}`}
        title="Pareja"
        subtitle="Qué tan alineados se sienten con el dinero, no solo cuánto gastaron"
      />

      <Section
        id="pareja-chequeo"
        icon="heart"
        accent="pink"
        title="Chequeo quincenal"
        subtitle="Dos preguntas, diez segundos. Lo del otro se ve cuando ambos respondan."
        badge={
          !status ? undefined : status.revealed ? (
            <Pill tone="green">Revelado</Pill>
          ) : myAnswer ? (
            <Pill tone="amber">Esperando a tu pareja</Pill>
          ) : (
            <Pill tone="indigo">Te toca responder</Pill>
          )
        }
      >
      {!status ? (
        <p className="text-sm text-slate-500">Cargando...</p>
      ) : !myAnswer || editing ? (
        <CheckinForm
          householdId={householdId}
          userId={userId}
          periodStart={period.start}
          initial={myAnswer}
          onSaved={async () => {
            setEditing(false);
            await loadStatus();
          }}
          onCancel={myAnswer ? () => setEditing(false) : undefined}
        />
      ) : !status.revealed ? (
        <div className="card">
          <p className="font-semibold mb-2">✅ Ya respondiste esta quincena</p>
          <p className="text-sm text-slate-600 mb-3">
            🔒 Tus respuestas quedan guardadas en privado. Se revelan cuando{" "}
            <strong>{partner?.display_name || "tu pareja"}</strong> también responda.
          </p>
          <AnswerSummary answer={myAnswer} name={nameOf(myAnswer.user_id)} />
          <button onClick={() => setEditing(true)} className="text-brand-600 hover:underline text-xs mt-3">
            cambiar mi respuesta
          </button>
        </div>
      ) : (
        <Revealed rows={status.rows} nameOf={nameOf} onEdit={() => setEditing(true)} />
      )}
      </Section>

      <Section
        id="pareja-resumen"
        icon="list"
        accent="sky"
        title="La quincena, en palabras"
        subtitle="Un resumen corto para leer juntos"
        badge={<Pill tone="slate">{formatCurrency(current.reduce((t, e) => t + Number(e.amount), 0))}</Pill>}
      >
        <Narrative current={current} previous={previous} categories={categories} periodLabel={period.label} />
      </Section>

      <Section
        id="pareja-libre"
        icon="gift"
        accent="amber"
        title="Plata libre"
        subtitle="Un monto por persona que se gasta sin dar explicaciones"
      >
        <FreeMoney
          members={members}
          expenses={expenses}
          period={period}
          onChange={refreshMembers}
        />
      </Section>
    </div>
  );
}

function CheckinForm({
  householdId,
  userId,
  periodStart,
  initial,
  onSaved,
  onCancel,
}: {
  householdId: string | null;
  userId: string | null;
  periodStart: string;
  initial: CheckinAnswer | null;
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const [alignment, setAlignment] = useState<number | null>(initial?.alignment ?? null);
  const [tension, setTension] = useState<number | null>(initial?.tension ?? null);
  const [note, setNote] = useState(initial?.note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!householdId || !userId || !alignment || !tension) return;
    setSaving(true);
    setError(null);
    const { error } = await supabase.from("couple_checkins").upsert(
      {
        household_id: householdId,
        user_id: userId,
        period_start: periodStart,
        alignment,
        tension,
        note: note.trim() || null,
      },
      { onConflict: "household_id,user_id,period_start" }
    );
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    onSaved();
  }

  return (
    <div className="card space-y-5">
      <Scale
        question="¿Sentiste que esta quincena gastamos como habíamos hablado?"
        options={ALIGNMENT}
        value={alignment}
        onChange={setAlignment}
      />
      <Scale
        question="¿Hubo algún gasto (tuyo o del otro) que te generó tensión?"
        options={TENSION}
        value={tension}
        onChange={setTension}
      />
      <div>
        <label className="label">¿Algo que quieras que tu pareja sepa? (opcional)</label>
        <input
          className="input"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ej. me preocupa el gasto en comida a domicilio"
          maxLength={200}
        />
      </div>
      <p className="text-xs text-slate-400">🔒 Tu pareja no ve tu respuesta hasta que ambos hayan contestado.</p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button onClick={save} disabled={!alignment || !tension || saving} className="btn-primary">
          {saving ? "Guardando..." : "Guardar mi respuesta"}
        </button>
        {onCancel && (
          <button onClick={onCancel} className="btn-secondary">
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
}

function Scale({
  question,
  options,
  value,
  onChange,
}: {
  question: string;
  options: { value: number; emoji: string; label: string }[];
  value: number | null;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <p className="text-sm font-semibold mb-2">{question}</p>
      <div className="grid grid-cols-4 gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`rounded-xl border-2 py-2.5 text-center transition-colors ${
              value === o.value ? "border-violet-500 bg-violet-50" : "border-slate-200 hover:bg-slate-50"
            }`}
          >
            <span className="text-2xl block">{o.emoji}</span>
            <span className="text-[11px] text-slate-500">{o.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function AnswerSummary({ answer, name }: { answer: CheckinAnswer; name: string }) {
  const a = ALIGNMENT.find((x) => x.value === answer.alignment)!;
  const t = TENSION.find((x) => x.value === answer.tension)!;
  return (
    <div className="space-y-1.5 text-sm">
      <div className="flex items-center gap-2">
        <Avatar name={name} size="sm" />
        <span className="font-semibold">{name}</span>
      </div>
      <p>
        {a.emoji} Gastamos como hablamos: <strong>{a.label.toLowerCase()}</strong>
      </p>
      <p>
        {t.emoji} Gastos que generaron tensión: <strong>{t.label.toLowerCase()}</strong>
      </p>
      {answer.note && <p className="text-slate-600 italic">“{answer.note}”</p>}
    </div>
  );
}

function Revealed({
  rows,
  nameOf,
  onEdit,
}: {
  rows: CheckinAnswer[];
  nameOf: (uid: string) => string;
  onEdit: () => void;
}) {
  const alignments = rows.map((r) => r.alignment);
  const tensions = rows.map((r) => r.tension);
  const gap = Math.max(...alignments) - Math.min(...alignments);
  const maxTension = Math.max(...tensions);
  const minAlignment = Math.min(...alignments);
  const aligned = gap <= 1 && maxTension <= 2 && minAlignment >= 3;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {rows.map((r, i) => (
          <div key={r.user_id} className={`card ${i === 0 ? "bg-sky-50 border-sky-200" : "bg-pink-50 border-pink-200"}`}>
            <AnswerSummary answer={r} name={nameOf(r.user_id)} />
          </div>
        ))}
      </div>
      <div
        className={`rounded-xl border px-4 py-3 text-sm ${
          aligned ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-amber-50 border-amber-200 text-amber-900"
        }`}
      >
        {aligned ? (
          <>🎉 Están en la misma página esta quincena. Nada que conversar con urgencia — sigan así.</>
        ) : (
          <>
            🌡️ Hay una diferencia en cómo vivieron esta quincena. No es grave ni hay alguien que "tenga razón": es una
            buena excusa para una conversación corta de 5 minutos, antes de que crezca. Una idea para empezar: que cada uno
            diga qué gasto le gustaría que hicieran distinto la próxima quincena.
          </>
        )}
      </div>
      <button onClick={onEdit} className="text-brand-600 hover:underline text-xs">
        cambiar mi respuesta
      </button>
    </div>
  );
}

function Narrative({
  current,
  previous,
  categories,
  periodLabel,
}: {
  current: Expense[];
  previous: Expense[];
  categories: Category[];
  periodLabel: string;
}) {
  const total = current.reduce((s, e) => s + Number(e.amount), 0);
  const prevTotal = previous.reduce((s, e) => s + Number(e.amount), 0);
  const extras = current.filter((e) => e.is_extra).reduce((s, e) => s + Number(e.amount), 0);

  const byCat = new Map<string, number>();
  current.forEach((e) => byCat.set(e.category_id, (byCat.get(e.category_id) ?? 0) + Number(e.amount)));
  const prevByCat = new Map<string, number>();
  previous.forEach((e) => prevByCat.set(e.category_id, (prevByCat.get(e.category_id) ?? 0) + Number(e.amount)));
  const top = Array.from(byCat.entries()).sort((a, b) => b[1] - a[1])[0];
  const biggestJump = Array.from(byCat.entries())
    .map(([id, amt]) => ({ id, diff: amt - (prevByCat.get(id) ?? 0) }))
    .sort((a, b) => b.diff - a.diff)[0];
  const cat = (id: string) => {
    const c = categories.find((x) => x.id === id);
    return c ? `${c.icon} ${c.name}` : "Sin categoría";
  };

  return (
    <div className="card">
      {current.length === 0 ? (
        <p className="text-sm text-slate-500">Todavía no hay gastos registrados en esta quincena.</p>
      ) : (
        <p className="text-sm text-slate-700 leading-relaxed">
          En lo que va de la quincena ({periodLabel}) gastaron <strong>{formatCurrency(total)}</strong> entre los dos
          {prevTotal > 0 && (
            <>
              {" "}— la quincena anterior completa fue de <strong>{formatCurrency(prevTotal)}</strong>
            </>
          )}
          . Lo que más pesa es <strong>{cat(top[0])}</strong> ({formatCurrency(top[1])})
          {biggestJump && biggestJump.diff > 0 && biggestJump.id !== top[0] && (
            <>
              , y lo que más subió frente a la quincena pasada fue <strong>{cat(biggestJump.id)}</strong> (+
              {formatCurrency(biggestJump.diff)})
            </>
          )}
          .{" "}
          {extras > 0 ? (
            <>
              Los gastos no planeados (&quot;extra&quot;) suman <strong>{formatCurrency(extras)}</strong>, el{" "}
              {((extras / total) * 100).toFixed(0)}% del total.
            </>
          ) : (
            <>No hay gastos marcados como no planeados — bien ahí.</>
          )}
        </p>
      )}
    </div>
  );
}

function FreeMoney({
  members,
  expenses,
  period,
  onChange,
}: {
  members: HouseholdMember[];
  expenses: Expense[];
  period: { start: string; end: string; label: string };
  onChange: () => void;
}) {
  async function saveAllowance(memberId: string, value: string) {
    await supabase.rpc("set_free_money_allowance", { p_member: memberId, p_amount: Number(value) || 0 });
    onChange();
  }

  return (
    <div className="card">
      <p className="text-xs text-slate-500 mb-4">
        Un monto por persona, por quincena, que cada uno gasta en lo que quiera sin dar explicaciones. Para que cuente
        aquí, marca el gasto como &quot;🎈 De mi plata libre&quot; al registrarlo (o escribe &quot;libre&quot; si lo
        registras por WhatsApp). Pónganse de acuerdo en el monto entre los dos.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {members.map((m) => {
          const name = m.display_name || "Alguien del hogar";
          const allowance = Number(m.free_money_allowance ?? 0);
          const used = expenses
            .filter(
              (e) =>
                e.is_free_money &&
                e.created_by === m.user_id &&
                e.expense_date >= period.start &&
                e.expense_date <= period.end
            )
            .reduce((s, e) => s + Number(e.amount), 0);
          const remaining = allowance - used;
          const pct = allowance > 0 ? Math.min((used / allowance) * 100, 100) : 0;
          return (
            <div key={m.id} className="border border-slate-200 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Avatar name={name} size="sm" />
                <span className="font-semibold text-sm">{name}</span>
              </div>
              <p className={`text-2xl font-bold ${remaining < 0 ? "text-red-600" : "text-slate-800"}`}>
                {formatCurrency(remaining)}
              </p>
              <p className="text-xs text-slate-500 mb-2">
                disponibles · usó {formatCurrency(used)} de {formatCurrency(allowance)}
              </p>
              <div className="w-full bg-slate-100 rounded-full h-2 mb-3">
                <div
                  className={`h-2 rounded-full ${remaining < 0 ? "bg-red-500" : "bg-pink-400"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <label className="label">Monto por quincena</label>
              <input
                type="number"
                min="0"
                step="1"
                className="input !py-1 !w-32"
                defaultValue={allowance || ""}
                placeholder="0"
                onBlur={(e) => saveAllowance(m.id, e.target.value)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
