"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import AuthGuard from "@/components/AuthGuard";
import ExportExcelButton from "@/components/ExportExcelButton";
import AlertBanner from "@/components/AlertBanner";
import CategoryDrilldown from "@/components/CategoryDrilldown";
import RecommendationsPanel from "@/components/RecommendationsPanel";
import GoalsPanel from "@/components/GoalsPanel";
import MiniPieCard from "@/components/MiniPieCard";
import CashFlowTimeline from "@/components/CashFlowTimeline";
import TrendChart from "@/components/TrendChart";
import SectionMosaic, { mergeOrder } from "@/components/SectionMosaic";
import { Accent, Help, IconName, IconTile, PageHeader, Icon } from "@/components/ui";
import { supabase } from "@/lib/supabaseClient";
import { buildCashFlow, monthlySpendSeries, toDateKey } from "@/lib/insights";
import { useHousehold } from "@/lib/HouseholdContext";
import { useTable } from "@/lib/hooks";
import {
  Card,
  Category,
  CategoryBudget,
  Expense,
  HouseholdMember,
  IncomeEntry,
  IncomeSource,
  InstallmentPurchase,
  RecurringExpense,
  SavingsGoal,
} from "@/lib/types";

const DEFAULT_ORDER = [
  "recomendaciones",
  "alertas",
  "flujo",
  "graficos",
  "tendencia",
  "distribucion",
  "limites",
  "metas",
];
import {
  Alert,
  buildCardAlerts,
  buildCategoryAlerts,
  buildIncomeAlerts,
  buildRecommendations,
  cashDateKey,
  computeGoalProgress,
  formatCurrency,
  isInMonth,
  monthLabel,
  monthValueToDate,
  percentChange,
  shiftMonth,
  toMonthValue,
} from "@/lib/utils";

const PIE_COLORS = [
  "#6366f1",
  "#f59e0b",
  "#ef4444",
  "#10b981",
  "#3b82f6",
  "#a855f7",
  "#ec4899",
  "#14b8a6",
  "#f97316",
  "#84cc16",
];

export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardContent />
    </AuthGuard>
  );
}

function DashboardContent() {
  const { householdId, session } = useHousehold();
  const { data: categories } = useTable<Category>("categories", householdId, { column: "name" });
  const { data: budgets } = useTable<CategoryBudget>("category_budgets", householdId);
  const { data: cards } = useTable<Card>("cards", householdId, { column: "name" });
  const { data: expenses } = useTable<Expense>("expenses", householdId);
  const { data: incomeSources } = useTable<IncomeSource>("income_sources", householdId);
  const { data: incomeEntries } = useTable<IncomeEntry>("income_entries", householdId);
  const { data: members, refresh: refreshMembers } = useTable<HouseholdMember>("household_members", householdId);
  const { data: recurringExpenses } = useTable<RecurringExpense>("recurring_expenses", householdId);
  const { data: installmentPurchases } = useTable<InstallmentPurchase>("installment_purchases", householdId);

  // Orden de secciones guardado para este usuario (cada uno tiene el suyo).
  const myMember = members.find((m) => m.user_id === session?.user.id);
  const dashboardOrder = mergeOrder(myMember?.dashboard_order, DEFAULT_ORDER);
  async function saveDashboardOrder(order: string[]) {
    await supabase.rpc("save_dashboard_order", { p_order: order });
    await refreshMembers();
  }
  const { data: goals, refresh: refreshGoals } = useTable<SavingsGoal>("savings_goals", householdId, {
    column: "created_at",
  });

  const [selectedMonth, setSelectedMonth] = useState(() => toMonthValue(new Date()));
  const previousMonth = shiftMonth(selectedMonth, -1);
  const isCurrentMonthSelected = selectedMonth === toMonthValue(new Date());

  const monthExpenses = useMemo(
    () => expenses.filter((e) => isInMonth(e.expense_date, selectedMonth)),
    [expenses, selectedMonth]
  );
  const monthIncome = useMemo(
    () => incomeEntries.filter((e) => isInMonth(e.entry_date, selectedMonth)),
    [incomeEntries, selectedMonth]
  );
  const prevMonthExpenses = useMemo(
    () => expenses.filter((e) => isInMonth(e.expense_date, previousMonth)),
    [expenses, previousMonth]
  );
  const prevMonthIncome = useMemo(
    () => incomeEntries.filter((e) => isInMonth(e.entry_date, previousMonth)),
    [incomeEntries, previousMonth]
  );

  const totalSpent = monthExpenses.reduce((s, e) => s + Number(e.amount), 0);
  const totalIncome = monthIncome.reduce((s, e) => s + Number(e.amount), 0);
  const balance = totalIncome - totalSpent;

  const prevTotalSpent = prevMonthExpenses.reduce((s, e) => s + Number(e.amount), 0);
  const prevTotalIncome = prevMonthIncome.reduce((s, e) => s + Number(e.amount), 0);
  const prevBalance = prevTotalIncome - prevTotalSpent;

  const spentDelta = percentChange(totalSpent, prevTotalSpent);
  const incomeDelta = percentChange(totalIncome, prevTotalIncome);
  const balanceDelta = percentChange(balance, prevBalance);

  // Balance acumulado: ingresos - gastos de TODA la historia hasta el fin del
  // mes seleccionado (se arrastra mes a mes, positivo o negativo), a
  // diferencia del "Balance del mes" que solo mira el mes seleccionado.
  const endOfSelectedMonth = `${selectedMonth}-31`;
  const endOfPrevMonth = `${previousMonth}-31`;
  const accumulatedBalance = useMemo(() => {
    const income = incomeEntries
      .filter((e) => e.entry_date <= endOfSelectedMonth)
      .reduce((s, e) => s + Number(e.amount), 0);
    const spent = expenses
      .filter((e) => e.expense_date <= endOfSelectedMonth)
      .reduce((s, e) => s + Number(e.amount), 0);
    return income - spent;
  }, [incomeEntries, expenses, endOfSelectedMonth]);
  const prevAccumulatedBalance = useMemo(() => {
    const income = incomeEntries
      .filter((e) => e.entry_date <= endOfPrevMonth)
      .reduce((s, e) => s + Number(e.amount), 0);
    const spent = expenses
      .filter((e) => e.expense_date <= endOfPrevMonth)
      .reduce((s, e) => s + Number(e.amount), 0);
    return income - spent;
  }, [incomeEntries, expenses, endOfPrevMonth]);
  const accumulatedDelta = percentChange(accumulatedBalance, prevAccumulatedBalance);

  // ---- Base de las 4 cifras de arriba: "al comprar" (cuándo se consumió) o
  // "al pagar" (cuándo sale el dinero del banco, como el estado de cuenta).
  const [basis, setBasis] = useState<"compra" | "pago">("compra");
  useEffect(() => {
    try {
      const saved = localStorage.getItem("ff-base-cifras");
      if (saved === "pago" || saved === "compra") setBasis(saved);
    } catch {
      /* ignorar */
    }
  }, []);
  function changeBasis(b: "compra" | "pago") {
    setBasis(b);
    try {
      localStorage.setItem("ff-base-cifras", b);
    } catch {
      /* ignorar */
    }
  }
  const cashExpenses = useMemo(
    () => expenses.filter((e) => !e.is_card_payment).map((e) => ({ e, key: cashDateKey(e, cards) })),
    [expenses, cards]
  );
  const cashSpentIn = (month: string) =>
    cashExpenses.filter((x) => x.key.startsWith(month)).reduce((t, x) => t + Number(x.e.amount), 0);
  const cardPaidIn = (month: string) =>
    cashExpenses.filter((x) => x.e.card_id && x.key.startsWith(month)).reduce((t, x) => t + Number(x.e.amount), 0);
  const cashAccumulated = (end: string) =>
    incomeEntries.filter((i) => i.entry_date <= end).reduce((t, i) => t + Number(i.amount), 0) -
    cashExpenses.filter((x) => x.key <= end).reduce((t, x) => t + Number(x.e.amount), 0);

  const isPago = basis === "pago";
  const sumSpent = isPago ? cashSpentIn(selectedMonth) : totalSpent;
  const sumPrevSpent = isPago ? cashSpentIn(previousMonth) : prevTotalSpent;
  const sumBalance = totalIncome - sumSpent;
  const sumPrevBalance = prevTotalIncome - sumPrevSpent;
  const sumAccum = isPago ? cashAccumulated(endOfSelectedMonth) : accumulatedBalance;
  const sumPrevAccum = isPago ? cashAccumulated(endOfPrevMonth) : prevAccumulatedBalance;
  const cardPaidThisMonth = cardPaidIn(selectedMonth);

  // Saldo de hoy (no del mes seleccionado): punto de partida del flujo de caja.
  const todayKey = toDateKey(new Date());
  const balanceToday = useMemo(() => {
    const income = incomeEntries.filter((e) => e.entry_date <= todayKey).reduce((s, e) => s + Number(e.amount), 0);
    const spent = expenses.filter((e) => e.expense_date <= todayKey).reduce((s, e) => s + Number(e.amount), 0);
    return income - spent;
  }, [incomeEntries, expenses, todayKey]);

  // Las alertas y recomendaciones siempre reflejan el momento actual (hoy),
  // sin importar qué mes estés revisando en el resto del dashboard.
  const alerts: Alert[] = useMemo(
    () => [
      ...buildCategoryAlerts(categories, budgets, expenses),
      ...buildCardAlerts(cards),
      ...buildIncomeAlerts(incomeSources),
    ],
    [categories, budgets, expenses, cards, incomeSources]
  );

  const recommendations = useMemo(
    () => buildRecommendations(categories, budgets, expenses, totalIncome, monthValueToDate(selectedMonth)),
    [categories, budgets, expenses, totalIncome, selectedMonth]
  );

  const chartData = categories.map((c) => {
    const spent = monthExpenses
      .filter((e) => e.category_id === c.id)
      .reduce((s, e) => s + Number(e.amount), 0);
    const budget = budgets.find((b) => b.category_id === c.id);
    return {
      name: c.name,
      Gastado: Number(spent.toFixed(2)),
      Límite: Number((budget?.monthly_limit ?? 0).toFixed(2)),
    };
  });

  const overLimitCount = chartData.filter((d) => d.Límite > 0 && d.Gastado > d.Límite).length;

  const pieDataRaw = chartData.filter((d) => d.Gastado > 0);
  const pieTotal = pieDataRaw.reduce((s, d) => s + d.Gastado, 0);
  const pieData = pieDataRaw.map((d) => ({ ...d, pct: pieTotal > 0 ? (d.Gastado / pieTotal) * 100 : 0 }));

  function memberName(userId: string | null | undefined) {
    if (!userId) return "Sin registrar";
    const member = members.find((m) => m.user_id === userId);
    return member?.display_name || "Alguien del hogar";
  }

  // 👥 Gastos por persona: según quién registró cada gasto en la app.
  const expensesByPerson = useMemo(() => {
    const totals = new Map<string, number>();
    for (const e of monthExpenses) {
      const name = memberName(e.created_by);
      totals.set(name, (totals.get(name) ?? 0) + Number(e.amount));
    }
    return Array.from(totals, ([name, value]) => ({ name, value }));
  }, [monthExpenses, members]);

  // 👥 Ingresos por persona: según el "dueño" de la fuente de ingreso.
  const incomeByPerson = useMemo(() => {
    const totals = new Map<string, number>();
    for (const e of monthIncome) {
      const source = incomeSources.find((s) => s.id === e.income_source_id);
      const name = source?.owner_name || "Sin asignar";
      totals.set(name, (totals.get(name) ?? 0) + Number(e.amount));
    }
    return Array.from(totals, ([name, value]) => ({ name, value }));
  }, [monthIncome, incomeSources]);

  // 💳 Qué pagamos con tarjeta, por categoría (excluye el pago mismo de la
  // tarjeta, que no es una compra sino la liquidación del corte anterior).
  const cardSpendByCategory = useMemo(() => {
    const totals = new Map<string, number>();
    for (const e of monthExpenses) {
      if (!e.card_id || e.is_card_payment) continue;
      const cat = categories.find((c) => c.id === e.category_id);
      const name = cat ? `${cat.icon} ${cat.name}` : "Sin categoría";
      totals.set(name, (totals.get(name) ?? 0) + Number(e.amount));
    }
    return Array.from(totals, ([name, value]) => ({ name, value }));
  }, [monthExpenses, categories]);

  // ---- Datos clave de cada mosaico -------------------------------------
  const money0 = (n: number) =>
    new Intl.NumberFormat("es-ES", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n || 0);

  const flow = useMemo(
    () =>
      buildCashFlow({
        startBalance: balanceToday,
        incomeSources,
        incomeEntries,
        recurringExpenses,
        installmentPurchases,
        expenses,
        cards,
        categories,
        days: 30,
      }),
    [balanceToday, incomeSources, incomeEntries, recurringExpenses, installmentPurchases, expenses, cards, categories]
  );
  const weekLimit = toDateKey(new Date(Date.now() + 6 * 86400000));
  const outNext7 = flow.events
    .filter((e) => !e.informative && e.amount < 0 && e.date <= weekLimit)
    .reduce((s, e) => s + Math.abs(e.amount), 0);
  const flowRisk = flow.lowest.balance < 0;

  const trendSeries = useMemo(() => monthlySpendSeries(expenses, selectedMonth, 12), [expenses, selectedMonth]);
  const trendPrev = trendSeries.slice(0, -1);
  const trendAvg = trendPrev.length ? trendPrev.reduce((s, p) => s + p.total, 0) / trendPrev.length : 0;
  const trendLast = trendSeries[trendSeries.length - 1]?.total ?? 0;
  const trendPct = trendAvg > 0 ? ((trendLast - trendAvg) / trendAvg) * 100 : null;

  const budgetedLimit = chartData.reduce((s, d) => s + (d.Límite > 0 ? d.Límite : 0), 0);
  const budgetedSpent = chartData.reduce((s, d) => s + (d.Límite > 0 ? d.Gastado : 0), 0);
  const budgetPct = budgetedLimit > 0 ? (budgetedSpent / budgetedLimit) * 100 : null;

  const topPerson = expensesByPerson.slice().sort((a, b) => b.value - a.value)[0];
  const topPersonPct = topPerson && totalSpent > 0 ? (topPerson.value / totalSpent) * 100 : null;

  const firstGoal = goals[0];
  const goalProgress = firstGoal ? computeGoalProgress(firstGoal, incomeEntries, expenses) : null;
  const redAlerts = alerts.some((a) => a.level === "red");

  const sectionMeta: Record<string, { help: string; icon: IconName; accent: Accent; value: string; caption: string; progress?: number | null; tone?: "bad" | "good" | "neutral" }> = {
    recomendaciones: {
      help: "Sugerencias automáticas para ahorrar, según cómo van sus gastos frente a sus límites e ingresos del mes.",
      icon: "bulb",
      accent: "indigo",
      value: String(recommendations.length),
      caption: recommendations.length === 1 ? "idea para ahorrar" : "ideas para ahorrar",
    },
    alertas: {
      help: "Avisos de cortes y pagos de tarjeta cercanos, ingresos por llegar y categorías cerca o sobre su límite. Toca una alerta de categoría o tarjeta para ver sus gastos.",
      icon: "bell",
      accent: "rose",
      value: String(alerts.length),
      caption: alerts.length ? "requieren atención" : "todo tranquilo",
      tone: redAlerts ? "bad" : alerts.length ? "neutral" : "good",
    },
    flujo: {
      help: "Calendario de los próximos días: sueldos que llegan y pagos que salen (gastos fijos, cuotas, tarjetas), con el saldo que les quedaría día a día.",
      icon: "calendar",
      accent: "sky",
      value: money0(outNext7),
      caption: flowRisk ? "salen en 7 días · ⚠ saldo en riesgo" : "salen en los próximos 7 días",
      tone: flowRisk ? "bad" : "neutral",
    },
    graficos: {
      help: "Cuánto gastaron en cada categoría frente al límite que definieron, y cómo se reparte el gasto del mes.",
      icon: "pie",
      accent: "violet",
      value: money0(totalSpent),
      caption: totalIncome > 0 ? `gastado · ${((totalSpent / totalIncome) * 100).toFixed(0)}% de lo ingresado` : "gastado este mes",
    },
    tendencia: {
      help: "Compara el gasto de este mes con su promedio de meses anteriores. Un número positivo significa que están gastando más de lo normal.",
      icon: "trend",
      accent: "pink",
      value: trendPct === null ? "—" : `${trendPct > 0 ? "+" : ""}${trendPct.toFixed(0)}%`,
      caption: trendPct === null ? "aún sin historial" : "vs. su promedio mensual",
      tone: trendPct === null ? "neutral" : trendPct > 0 ? "bad" : "good",
    },
    distribucion: {
      help: "Quién registró los gastos, de quién vienen los ingresos y en qué se va lo que pagan con tarjeta.",
      icon: "users",
      accent: "teal",
      value: topPersonPct === null ? "—" : `${topPersonPct.toFixed(0)}%`,
      caption: topPerson ? `de los gastos registró ${topPerson.name}` : "sin gastos este mes",
    },
    limites: {
      help: "Qué porcentaje del presupuesto mensual llevan usado, sumando las categorías que tienen límite. Toca para verlo categoría por categoría.",
      icon: "target",
      accent: "amber",
      value: budgetPct === null ? "—" : `${budgetPct.toFixed(0)}%`,
      caption:
        budgetPct === null
          ? "define límites en Categorías"
          : overLimitCount
          ? `del presupuesto · ${overLimitCount} excedida${overLimitCount === 1 ? "" : "s"}`
          : "del presupuesto usado",
      progress: budgetPct,
      tone: overLimitCount ? "bad" : "neutral",
    },
    metas: {
      help: "Avance de su meta de ahorro, calculado con lo que les sobra (ingresos − gastos) desde que crearon la meta.",
      icon: "star",
      accent: "emerald",
      value: goalProgress ? `${goalProgress.pct.toFixed(0)}%` : "—",
      caption: firstGoal ? firstGoal.name : "crea su primera meta",
      progress: goalProgress ? goalProgress.pct : null,
      tone: "neutral",
    },
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon="dashboard"
        eyebrow="Resumen familiar"
        title="Dashboard"
        subtitle={<span className="capitalize">{monthLabel(selectedMonth)}</span>}
        actions={
          <>
            <ExportExcelButton />
            <button
              onClick={() => setSelectedMonth(shiftMonth(selectedMonth, -1))}
              className="btn-secondary !px-2.5 !py-2"
              aria-label="Mes anterior"
            >
              <Icon name="chevronLeft" className="w-4 h-4" />
            </button>
            <input
              type="month"
              className="input !w-auto"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            />
            <button
              onClick={() => setSelectedMonth(shiftMonth(selectedMonth, 1))}
              disabled={isCurrentMonthSelected}
              className="btn-secondary !px-2.5 !py-2"
              aria-label="Mes siguiente"
            >
              <Icon name="chevronRight" className="w-4 h-4" />
            </button>
          </>
        }
      />

      <div className="flex items-center justify-between flex-wrap gap-2 -mb-2">
        <div className="group/help relative flex items-center gap-2 text-xs text-slate-500">
          <span className="font-medium">Contar compras con tarjeta:</span>
          <Help
            text="Al comprar: el gasto cuenta el día de la compra (sirve para controlar en qué gastan). Al pagar: cuenta el día en que pagan la tarjeta, como lo ve el banco (sirve para saber cuánto dinero deberían tener en la cuenta)."
          />
        </div>
        <div className="inline-flex bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
          {(["compra", "pago"] as const).map((b) => (
            <button
              key={b}
              onClick={() => changeBasis(b)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                basis === b ? "bg-brand-gradient text-white shadow" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {b === "compra" ? "Al comprar" : "Al pagar (como el banco)"}
            </button>
          ))}
        </div>
      </div>
      {isPago && (
        <p className="text-xs text-slate-500 -mb-2">
          En {monthLabel(selectedMonth)} los gastos incluyen <strong>{formatCurrency(cardPaidThisMonth)}</strong> de pagos de
          tarjeta (compras de cortes anteriores). Las compras con tarjeta de este mes se cuentan cuando las paguen.
        </p>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <SummaryCard
          label="Ingresos del mes"
          help="Todo el dinero que entró este mes: sueldos e ingresos extra de los dos, según lo registrado en Ingresos. La etiqueta ▲▼ lo compara con el mes anterior. Toca para ver el detalle."
          href={`/ingresos?mes=${selectedMonth}`}
          value={totalIncome}
          icon="wallet"
          accent="emerald"
          delta={incomeDelta}
          goodDirection="up"
        />
        <SummaryCard
          label="Gastos del mes"
          help={
            isPago
              ? "Lo que salió del banco este mes: gastos en efectivo o débito, más lo que pagaron de tarjetas (compras de cortes anteriores). La etiqueta ▲▼ lo compara con el mes anterior."
              : "Todo lo que gastaron este mes entre los dos. Las compras con tarjeta cuentan el día que se hicieron, no cuando se paga la tarjeta. La etiqueta ▲▼ lo compara con el mes anterior. Toca para ver el detalle."
          }
          href={`/gastos?mes=${selectedMonth}`}
          value={sumSpent}
          icon="receipt"
          accent="rose"
          delta={percentChange(sumSpent, sumPrevSpent)}
          goodDirection="down"
        />
        <SummaryCard
          label="Balance del mes"
          help="Ingresos del mes menos gastos del mes. Positivo: este mes les sobró dinero. Negativo: gastaron más de lo que entró."
          value={sumBalance}
          icon="scale"
          accent={sumBalance >= 0 ? "indigo" : "amber"}
          delta={percentChange(sumBalance, sumPrevBalance)}
          goodDirection="up"
        />
        <SummaryCard
          label="Balance acumulado"
          help="La suma de todos los meses desde que usan la app: arrastra el sobrante (o déficit) de los meses anteriores. Es su colchón real disponible hasta hoy."
          value={sumAccum}
          icon="star"
          accent={sumAccum >= 0 ? "violet" : "rose"}
          delta={percentChange(sumAccum, sumPrevAccum)}
          goodDirection="up"
        />
      </div>

      <SectionMosaic
        order={dashboardOrder}
        onSave={saveDashboardOrder}
        storageKey={`ff-dashboard-abiertas-${session?.user.id ?? "anon"}`}
        sections={[
          {
            key: "recomendaciones",
            ...sectionMeta.recomendaciones,
            title: "Recomendaciones",
            node: <RecommendationsPanel recs={recommendations} hideTitle />,
          },
          {
            key: "alertas",
            ...sectionMeta.alertas,
            title: "Alertas",
            node: (
            <div>
              <AlertBanner alerts={alerts} expenses={expenses} categories={categories} cards={cards} />
            </div>
            ),
          },
          {
            key: "flujo",
            ...sectionMeta.flujo,
            title: "Próximos pagos",
            node: (
              <CashFlowTimeline
                startBalance={balanceToday}
                incomeSources={incomeSources}
                incomeEntries={incomeEntries}
                recurringExpenses={recurringExpenses}
                installmentPurchases={installmentPurchases}
                expenses={expenses}
                cards={cards}
                categories={categories}
                hideTitle
              />
            ),
          },
          {
            key: "graficos",
            ...sectionMeta.graficos,
            title: "Gasto del mes",
            node: (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="card">
                <h2 className="font-semibold mb-3">📈 Gastado vs. límite por categoría</h2>
                {chartData.some((d) => d.Límite > 0 || d.Gastado > 0) ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={chartData} margin={{ left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-25} textAnchor="end" height={70} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v: number) => formatCurrency(v)} />
                      <Legend />
                      <Bar dataKey="Gastado" fill="#6366f1" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Límite" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-slate-500">Aún no hay datos suficientes este mes.</p>
                )}
              </div>

              <div className="card">
                <h2 className="font-semibold mb-3">🥧 Distribución de gastos del mes</h2>
                {pieData.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          dataKey="Gastado"
                          nameKey="name"
                          outerRadius={100}
                          label={(entry) => (entry.pct >= 6 ? `${entry.pct.toFixed(0)}%` : "")}
                          labelLine={false}
                        >
                          {pieData.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: number, name: string, props: any) => [
                            `${formatCurrency(value)} (${props.payload.pct.toFixed(0)}%)`,
                            name,
                          ]}
                        />
                      </PieChart>
                    </ResponsiveContainer>

                    {/* Leyenda propia en grilla: evita el solapamiento de la leyenda nativa de recharts */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1.5 mt-2">
                      {pieData
                        .slice()
                        .sort((a, b) => b.pct - a.pct)
                        .map((d) => {
                          const colorIndex = pieData.findIndex((p) => p.name === d.name);
                          return (
                            <div key={d.name} className="flex items-center gap-1.5 text-xs text-slate-600 min-w-0">
                              <span
                                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                style={{ backgroundColor: PIE_COLORS[colorIndex % PIE_COLORS.length] }}
                              />
                              <span className="truncate">{d.name}</span>
                              <span className="text-slate-400 flex-shrink-0">{d.pct.toFixed(0)}%</span>
                            </div>
                          );
                        })}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-slate-500">Registra gastos para ver la distribución.</p>
                )}
              </div>
            </div>
            ),
          },
          {
            key: "tendencia",
            ...sectionMeta.tendencia,
            title: "Tendencia",
            node: <TrendChart expenses={expenses} categories={categories} endMonth={selectedMonth} hideTitle />,
          },
          {
            key: "distribucion",
            ...sectionMeta.distribucion,
            title: "Entre ustedes",
            node: (
            <div>
              <p className="text-xs text-slate-400 mb-3">
                Gastos según quién los registró en la app, ingresos según el dueño de cada fuente, y en
                qué se va lo que pagan con tarjeta.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <MiniPieCard
                  title="🧾 Gastos por persona"
                  data={expensesByPerson}
                  emptyText="Registra gastos para ver la distribución."
                />
                <MiniPieCard
                  title="💵 Ingresos por persona"
                  data={incomeByPerson}
                  emptyText="Registra ingresos para ver la distribución."
                />
                <MiniPieCard
                  title="💳 Tarjeta: en qué se va"
                  data={cardSpendByCategory}
                  emptyText="Aún no hay gastos con tarjeta este mes."
                />
              </div>
            </div>
            ),
          },
          {
            key: "limites",
            ...sectionMeta.limites,
            title: "Límites",
            node: (
            <div className="card">
              <p className="text-xs text-slate-400 mb-3">Haz clic en una categoría para ver el detalle de sus gastos del mes.</p>
              <CategoryDrilldown categories={categories} budgets={budgets} monthExpenses={monthExpenses} cards={cards} />
            </div>
            ),
          },
          {
            key: "metas",
            ...sectionMeta.metas,
            title: "Metas de ahorro",
            node: (
            <GoalsPanel
              goals={goals}
              incomeEntries={incomeEntries}
              expenses={expenses}
              householdId={householdId}
              onChange={refreshGoals}
              hideTitle
            />
            ),
          },
        ]}
      />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  accent,
  delta,
  goodDirection,
  hint,
  href,
  help,
}: {
  label: string;
  value: number;
  icon: IconName;
  accent: Accent;
  delta: number | null;
  goodDirection: "up" | "down";
  hint?: string;
  href?: string;
  help?: string;
}) {
  const isGood = delta === null ? null : goodDirection === "up" ? delta >= 0 : delta <= 0;
  const content = (
    <>
        <div className="flex items-center justify-between gap-2">
          <IconTile icon={icon} accent={accent} size="sm" />
          {delta !== null && (
            <span
              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                isGood ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-600"
              }`}
            >
              {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(0)}%
            </span>
          )}
        </div>
        <p className="text-xs font-medium text-slate-500 mt-3 flex items-center gap-1.5">
          {label}
          {help && <Help text={help} />}
        </p>
        <p className={`text-xl md:text-2xl font-heading font-extrabold tracking-tight mt-0.5 ${value < 0 ? "text-rose-600" : "text-slate-900"}`}>
          {formatCurrency(value)}
        </p>
        {hint && <p className="text-[11px] text-slate-400 mt-1 leading-snug hidden md:block">{hint}</p>}
      {href && (
        <p className="text-[11px] font-semibold text-indigo-600 mt-2 flex items-center gap-1">
          Ver detalle <Icon name="chevronRight" className="w-3 h-3" />
        </p>
      )}
    </>
  );
  const base = "group/help relative hover:z-30 focus-within:z-30 block bg-white rounded-3xl border border-slate-200/70 shadow-sm p-4 md:p-5";
  if (href) {
    return (
      <Link
        href={href}
        title={hint}
        className={`${base} transition-all hover:-translate-y-0.5 hover:shadow-lg hover:border-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-400`}
      >
        {content}
      </Link>
    );
  }
  return (
    <div className={base} title={hint}>
      {content}
    </div>
  );
}
