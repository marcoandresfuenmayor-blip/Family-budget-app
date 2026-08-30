"use client";

import { useMemo, useState } from "react";
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
import AlertBanner from "@/components/AlertBanner";
import CategoryDrilldown from "@/components/CategoryDrilldown";
import RecommendationsPanel from "@/components/RecommendationsPanel";
import GoalsPanel from "@/components/GoalsPanel";
import { useHousehold } from "@/lib/HouseholdContext";
import { useTable } from "@/lib/hooks";
import { Card, Category, CategoryBudget, Expense, IncomeEntry, IncomeSource, SavingsGoal } from "@/lib/types";
import {
  Alert,
  buildCardAlerts,
  buildCategoryAlerts,
  buildIncomeAlerts,
  buildRecommendations,
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
  const { householdId } = useHousehold();
  const { data: categories } = useTable<Category>("categories", householdId, { column: "name" });
  const { data: budgets } = useTable<CategoryBudget>("category_budgets", householdId);
  const { data: cards } = useTable<Card>("cards", householdId, { column: "name" });
  const { data: expenses } = useTable<Expense>("expenses", householdId);
  const { data: incomeSources } = useTable<IncomeSource>("income_sources", householdId);
  const { data: incomeEntries } = useTable<IncomeEntry>("income_entries", householdId);
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

  const pieDataRaw = chartData.filter((d) => d.Gastado > 0);
  const pieTotal = pieDataRaw.reduce((s, d) => s + d.Gastado, 0);
  const pieData = pieDataRaw.map((d) => ({ ...d, pct: pieTotal > 0 ? (d.Gastado / pieTotal) * 100 : 0 }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">
          📊 Dashboard familiar <span className="text-base font-normal text-slate-400">— {monthLabel(selectedMonth)}</span>
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedMonth(shiftMonth(selectedMonth, -1))}
            className="btn-secondary !px-2 !py-1.5"
            aria-label="Mes anterior"
          >
            ←
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
            className="btn-secondary !px-2 !py-1.5"
            aria-label="Mes siguiente"
          >
            →
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <SummaryCard
          label="Ingresos del mes"
          value={totalIncome}
          emoji="💵"
          delta={incomeDelta}
          goodDirection="up"
          className="bg-emerald-50 border-emerald-200 text-emerald-800"
        />
        <SummaryCard
          label="Gastos del mes"
          value={totalSpent}
          emoji="🧾"
          delta={spentDelta}
          goodDirection="down"
          className="bg-rose-50 border-rose-200 text-rose-800"
        />
        <SummaryCard
          label="Balance del mes"
          value={balance}
          emoji={balance >= 0 ? "🎉" : "⚠️"}
          delta={balanceDelta}
          goodDirection="up"
          className={
            balance >= 0
              ? "bg-brand-50 border-brand-100 text-brand-800"
              : "bg-amber-50 border-amber-200 text-amber-800"
          }
        />
        <SummaryCard
          label="Balance acumulado"
          value={accumulatedBalance}
          emoji={accumulatedBalance >= 0 ? "💰" : "🚨"}
          delta={accumulatedDelta}
          goodDirection="up"
          className={
            accumulatedBalance >= 0
              ? "bg-indigo-50 border-indigo-200 text-indigo-800"
              : "bg-red-50 border-red-200 text-red-800"
          }
        />
      </div>
      <p className="text-xs text-slate-400 -mt-3">
        💡 El "Balance acumulado" arrastra el sobrante (o déficit) de todos los meses anteriores —
        es tu colchón real disponible hasta hoy. El "Balance del mes" solo mira {monthLabel(selectedMonth)}.
      </p>

      <div>
        <h2 className="font-semibold mb-2">🔔 Alertas</h2>
        <AlertBanner alerts={alerts} />
      </div>

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

      <div className="card">
        <h2 className="font-semibold mb-1">🎯 Límites por categoría</h2>
        <p className="text-xs text-slate-400 mb-3">Haz clic en una categoría para ver el detalle de sus gastos del mes.</p>
        <CategoryDrilldown categories={categories} budgets={budgets} monthExpenses={monthExpenses} cards={cards} />
      </div>

      <GoalsPanel
        goals={goals}
        incomeEntries={incomeEntries}
        expenses={expenses}
        householdId={householdId}
        onChange={refreshGoals}
      />

      <RecommendationsPanel recs={recommendations} />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  emoji,
  className,
  delta,
  goodDirection,
}: {
  label: string;
  value: number;
  emoji: string;
  className: string;
  delta: number | null;
  goodDirection: "up" | "down";
}) {
  const isGood = delta === null ? null : goodDirection === "up" ? delta >= 0 : delta <= 0;
  return (
    <div className={`card border ${className}`}>
      <p className="text-sm opacity-80 flex items-center gap-1.5">
        <span className="text-lg">{emoji}</span> {label}
      </p>
      <p className="text-2xl font-heading font-bold mt-1">{formatCurrency(value)}</p>
      {delta !== null && (
        <p className={`text-xs mt-1 font-medium ${isGood ? "text-emerald-700" : "text-red-600"}`}>
          {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(0)}% vs mes anterior
        </p>
      )}
    </div>
  );
}
