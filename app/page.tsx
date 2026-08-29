"use client";

import { useMemo } from "react";
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
import CategoryBudgetCard from "@/components/CategoryBudgetCard";
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
  isInCurrentMonth,
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

  const monthExpenses = useMemo(
    () => expenses.filter((e) => isInCurrentMonth(e.expense_date)),
    [expenses]
  );
  const monthIncome = useMemo(
    () => incomeEntries.filter((e) => isInCurrentMonth(e.entry_date)),
    [incomeEntries]
  );

  const totalSpent = monthExpenses.reduce((s, e) => s + Number(e.amount), 0);
  const totalIncome = monthIncome.reduce((s, e) => s + Number(e.amount), 0);
  const balance = totalIncome - totalSpent;

  const alerts: Alert[] = useMemo(
    () => [
      ...buildCategoryAlerts(categories, budgets, expenses),
      ...buildCardAlerts(cards),
      ...buildIncomeAlerts(incomeSources),
    ],
    [categories, budgets, expenses, cards, incomeSources]
  );

  const recommendations = useMemo(
    () => buildRecommendations(categories, budgets, expenses, totalIncome),
    [categories, budgets, expenses, totalIncome]
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

  const pieData = chartData.filter((d) => d.Gastado > 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">📊 Dashboard familiar</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SummaryCard
          label="Ingresos del mes"
          value={totalIncome}
          emoji="💵"
          className="bg-emerald-50 border-emerald-200 text-emerald-800"
        />
        <SummaryCard
          label="Gastos del mes"
          value={totalSpent}
          emoji="🧾"
          className="bg-rose-50 border-rose-200 text-rose-800"
        />
        <SummaryCard
          label="Balance"
          value={balance}
          emoji={balance >= 0 ? "🎉" : "⚠️"}
          className={
            balance >= 0
              ? "bg-brand-50 border-brand-100 text-brand-800"
              : "bg-amber-50 border-amber-200 text-amber-800"
          }
        />
      </div>

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
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={pieData} dataKey="Gastado" nameKey="name" outerRadius={100} label>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-slate-500">Registra gastos para ver la distribución.</p>
          )}
        </div>
      </div>

      <div className="card">
        <h2 className="font-semibold mb-3">🎯 Límites por categoría</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {categories.map((c) => {
            const spent = monthExpenses
              .filter((e) => e.category_id === c.id)
              .reduce((s, e) => s + Number(e.amount), 0);
            const budget = budgets.find((b) => b.category_id === c.id);
            return (
              <CategoryBudgetCard
                key={c.id}
                icon={c.icon}
                name={c.name}
                spent={spent}
                limit={budget?.monthly_limit ?? 0}
              />
            );
          })}
        </div>
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
}: {
  label: string;
  value: number;
  emoji: string;
  className: string;
}) {
  return (
    <div className={`card border ${className}`}>
      <p className="text-sm opacity-80 flex items-center gap-1.5">
        <span className="text-lg">{emoji}</span> {label}
      </p>
      <p className="text-2xl font-heading font-bold mt-1">{formatCurrency(value)}</p>
    </div>
  );
}
