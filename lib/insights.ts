import {
  Card,
  Category,
  Expense,
  IncomeEntry,
  IncomeSource,
  InstallmentPurchase,
  RecurringExpense,
} from "./types";
import { previousOccurrence } from "./utils";

// -----------------------------------------------------------------
// FECHAS
// -----------------------------------------------------------------
export function toDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Último día real del mes ("2026-09" -> "2026-09-30"). Postgres rechaza
// fechas inexistentes como "2026-09-31", así que no se puede usar "-31" fijo.
export function monthEndKey(month: string) {
  const [y, m] = month.split("-").map(Number);
  return `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
}

export function daysInMonthOf(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

function dayMatches(configuredDay: number, d: Date) {
  return Math.min(configuredDay, daysInMonthOf(d)) === d.getDate();
}

function addDays(d: Date, n: number) {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  copy.setDate(copy.getDate() + n);
  return copy;
}

// Quincena actual: del 1 al 15, o del 16 a fin de mes.
export function quincenaRange(base = new Date()) {
  const firstHalf = base.getDate() <= 15;
  const start = new Date(base.getFullYear(), base.getMonth(), firstHalf ? 1 : 16);
  const end = new Date(base.getFullYear(), base.getMonth(), firstHalf ? 15 : daysInMonthOf(base));
  const monthName = start.toLocaleDateString("es-ES", { month: "long" });
  return {
    start: toDateKey(start),
    end: toDateKey(end),
    label: `${start.getDate()} al ${end.getDate()} de ${monthName}`,
  };
}

export function previousQuincenaRange(base = new Date()) {
  const { start } = quincenaRange(base);
  const [y, m, d] = start.split("-").map(Number);
  return quincenaRange(new Date(y, m - 1, d - 1));
}

// -----------------------------------------------------------------
// TEXTO: normalizar descripciones para agrupar el mismo pago
// -----------------------------------------------------------------
export function normalizeText(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function stripAutoSuffix(description: string) {
  return description
    .replace(/\s*\(autom[^)]*\)\s*/gi, " ")
    .replace(/\s*\(cuota\s*\d+\s*\/\s*\d+\)\s*/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function descriptionKey(description: string) {
  return normalizeText(stripAutoSuffix(description));
}

// -----------------------------------------------------------------
// FLUJO DE CAJA: próximos movimientos día a día
// -----------------------------------------------------------------
export type CashFlowEvent = {
  id: string;
  date: string;
  kind: "income" | "expense" | "installment" | "card_closing" | "card_payment";
  title: string;
  subtitle: string;
  amount: number; // con signo; 0 si es solo informativo
  informative: boolean;
  balanceAfter: number;
};

const KIND_ORDER: Record<CashFlowEvent["kind"], number> = {
  income: 0,
  card_closing: 1,
  expense: 2,
  installment: 3,
  card_payment: 4,
};

export function buildCashFlow(params: {
  startBalance: number;
  incomeSources: IncomeSource[];
  incomeEntries: IncomeEntry[];
  recurringExpenses: RecurringExpense[];
  installmentPurchases: InstallmentPurchase[];
  expenses: Expense[];
  cards: Card[];
  categories: Category[];
  days?: number;
  base?: Date;
}) {
  const {
    startBalance,
    incomeSources,
    incomeEntries,
    recurringExpenses,
    installmentPurchases,
    expenses,
    cards,
    categories,
    days = 30,
    base = new Date(),
  } = params;

  const today = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  const raw: Omit<CashFlowEvent, "balanceAfter">[] = [];
  const projectedInstallments = new Map<string, number>();
  // Cargos proyectados que caen en una tarjeta (para estimar su próximo pago).
  const projectedCardCharges: { cardId: string; date: string; amount: number }[] = [];

  const catLabel = (id: string) => {
    const c = categories.find((x) => x.id === id);
    return c ? `${c.icon} ${c.name}` : "Sin categoría";
  };
  const cardName = (id: string | null) => cards.find((c) => c.id === id)?.name;

  for (let i = 0; i < days; i++) {
    const d = addDays(today, i);
    const key = toDateKey(d);
    const monthKey = key.slice(0, 7);

    for (const s of incomeSources) {
      if (!s.active || !dayMatches(s.expected_day, d)) continue;
      const received = incomeEntries.some(
        (e) => e.income_source_id === s.id && e.entry_date.startsWith(monthKey)
      );
      if (received) continue;
      raw.push({
        id: `inc-${s.id}-${key}`,
        date: key,
        kind: "income",
        title: s.name,
        subtitle: `Ingreso recurrente${s.owner_name ? ` · ${s.owner_name}` : ""}`,
        amount: Number(s.amount),
        informative: false,
      });
    }

    for (const t of recurringExpenses) {
      if (!t.active || !dayMatches(t.day_of_month, d)) continue;
      const posted = expenses.some(
        (e) => e.recurring_expense_id === t.id && e.expense_date.startsWith(monthKey)
      );
      if (posted) continue;
      const card = cardName(t.card_id);
      raw.push({
        id: `rec-${t.id}-${key}`,
        date: key,
        kind: "expense",
        title: t.description,
        subtitle: `Gasto fijo · ${catLabel(t.category_id)}${card ? ` · 💳 ${card}` : ""}`,
        amount: -Number(t.amount),
        informative: false,
      });
      if (t.card_id) projectedCardCharges.push({ cardId: t.card_id, date: key, amount: Number(t.amount) });
    }

    for (const ip of installmentPurchases) {
      if (!ip.active) continue;
      const card = cards.find((c) => c.id === ip.card_id);
      if (!card || !dayMatches(card.closing_day, d)) continue;
      const already = projectedInstallments.get(ip.id) ?? 0;
      if (ip.installments_posted + already >= ip.total_installments) continue;
      const postedThisMonth = expenses.some(
        (e) => e.installment_purchase_id === ip.id && e.expense_date.startsWith(monthKey)
      );
      if (postedThisMonth) continue;
      const n = ip.installments_posted + already + 1;
      projectedInstallments.set(ip.id, already + 1);
      raw.push({
        id: `ins-${ip.id}-${key}`,
        date: key,
        kind: "installment",
        title: `${ip.description} (cuota ${n}/${ip.total_installments})`,
        subtitle: `Compra diferida · 💳 ${card.name}`,
        amount: -Number(ip.installment_amount),
        informative: false,
      });
      projectedCardCharges.push({ cardId: card.id, date: key, amount: Number(ip.installment_amount) });
    }

    for (const c of cards) {
      if (dayMatches(c.closing_day, d)) {
        raw.push({
          id: `clo-${c.id}-${key}`,
          date: key,
          kind: "card_closing",
          title: `Corte tarjeta ${c.name}`,
          subtitle: "Desde aquí empieza a acumular el siguiente ciclo",
          amount: 0,
          informative: true,
        });
      }
    }
  }

  // Pagos de tarjeta: se calculan al final porque incluyen cargos proyectados.
  for (let i = 0; i < days; i++) {
    const d = addDays(today, i);
    const key = toDateKey(d);
    for (const c of cards) {
      if (!dayMatches(c.payment_day, d)) continue;
      const lastClosing = previousOccurrence(c.closing_day, d);
      const dayBefore = addDays(lastClosing, -1);
      const priorClosing = previousOccurrence(c.closing_day, dayBefore);
      const from = toDateKey(priorClosing);
      const to = toDateKey(lastClosing);
      const registered = expenses
        .filter((e) => e.card_id === c.id && !e.is_card_payment && e.expense_date > from && e.expense_date <= to)
        .reduce((s, e) => s + Number(e.amount), 0);
      const projected = projectedCardCharges
        .filter((p) => p.cardId === c.id && p.date > from && p.date <= to)
        .reduce((s, p) => s + p.amount, 0);
      const due = registered + projected;
      if (due <= 0) continue;
      const alreadyPaid = expenses.some(
        (e) => e.card_id === c.id && e.is_card_payment && e.expense_date.startsWith(key.slice(0, 7))
      );
      if (alreadyPaid) continue;
      const counts = !!c.auto_post_payment;
      raw.push({
        id: `pay-${c.id}-${key}`,
        date: key,
        kind: "card_payment",
        title: `Pago tarjeta ${c.name}`,
        subtitle: counts
          ? "Se registrará solo como gasto (auto-pago activado)"
          : "≈ lo que toca pagar · las compras ya se descontaron al registrarlas",
        amount: -due,
        informative: !counts,
      });
    }
  }

  raw.sort((a, b) => (a.date === b.date ? KIND_ORDER[a.kind] - KIND_ORDER[b.kind] : a.date.localeCompare(b.date)));

  let balance = startBalance;
  let lowest = { balance: startBalance, date: toDateKey(today) };
  const events: CashFlowEvent[] = raw.map((e) => {
    if (!e.informative) balance += e.amount;
    if (balance < lowest.balance) lowest = { balance, date: e.date };
    return { ...e, balanceAfter: balance };
  });

  return { events, lowest, endBalance: balance };
}

// -----------------------------------------------------------------
// TENDENCIA: gasto por mes (total o de una categoría)
// -----------------------------------------------------------------
export function monthlySpendSeries(
  expenses: Expense[],
  endMonth: string,
  months = 12,
  categoryId?: string
) {
  const [y, m] = endMonth.split("-").map(Number);
  const series: { month: string; label: string; total: number; trend: number | null }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const total = expenses
      .filter(
        (e) =>
          e.expense_date.startsWith(key) &&
          !e.is_card_payment &&
          (!categoryId || e.category_id === categoryId)
      )
      .reduce((s, e) => s + Number(e.amount), 0);
    series.push({
      month: key,
      label: d.toLocaleDateString("es-ES", { month: "short", year: "2-digit" }),
      total: Number(total.toFixed(2)),
      trend: null,
    });
  }
  // Recortar meses vacíos al inicio (antes de que empezaran a usar la app).
  const firstWithData = series.findIndex((s) => s.total > 0);
  const trimmed = firstWithData === -1 ? [] : series.slice(firstWithData);
  // Línea de tendencia: promedio móvil de 3 meses.
  trimmed.forEach((point, idx) => {
    const window = trimmed.slice(Math.max(0, idx - 2), idx + 1);
    point.trend = Number((window.reduce((s, p) => s + p.total, 0) / window.length).toFixed(2));
  });
  return trimmed;
}

// -----------------------------------------------------------------
// PROMEDIOS POR PAGO ESPECÍFICO (luz, agua, gasolina…)
// -----------------------------------------------------------------
export type ServiceAverage = {
  key: string;
  name: string;
  categoryId: string;
  categoryIds: string[];
  monthly: { month: string; total: number }[];
  monthsWithData: number;
  average: number;
  last: number;
  lastMonth: string;
  min: number;
  max: number;
  changeVsAverage: number | null;
  timesRegistered: number;
};

export function serviceAverages(expenses: Expense[], endMonth: string, monthsBack = 12): ServiceAverage[] {
  const [y, m] = endMonth.split("-").map(Number);
  const startKey = (() => {
    const d = new Date(y, m - monthsBack, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  })();

  const groups = new Map<string, Expense[]>();
  for (const e of expenses) {
    if (e.is_card_payment) continue;
    const month = e.expense_date.slice(0, 7);
    if (month < startKey || month > endMonth) continue;
    const key = descriptionKey(e.description);
    if (!key) continue;
    const list = groups.get(key) ?? [];
    list.push(e);
    groups.set(key, list);
  }

  const result: ServiceAverage[] = [];
  groups.forEach((list, key) => {
    const sorted = list.slice().sort((a, b) => b.expense_date.localeCompare(a.expense_date));
    const byMonth = new Map<string, number>();
    for (const e of list) {
      const month = e.expense_date.slice(0, 7);
      byMonth.set(month, (byMonth.get(month) ?? 0) + Number(e.amount));
    }
    const monthly = Array.from(byMonth, ([month, total]) => ({ month, total }))
      .sort((a, b) => a.month.localeCompare(b.month));
    const totals = monthly.map((x) => x.total);
    const average = totals.reduce((s, t) => s + t, 0) / totals.length;
    const lastEntry = monthly[monthly.length - 1];
    const previous = monthly.slice(0, -1).map((x) => x.total);
    const prevAverage = previous.length ? previous.reduce((s, t) => s + t, 0) / previous.length : null;
    result.push({
      key,
      name: stripAutoSuffix(sorted[0].description),
      categoryId: sorted[0].category_id,
      categoryIds: Array.from(new Set(list.map((e) => e.category_id))),
      monthly,
      monthsWithData: monthly.length,
      average,
      last: lastEntry.total,
      lastMonth: lastEntry.month,
      min: Math.min(...totals),
      max: Math.max(...totals),
      changeVsAverage: prevAverage && prevAverage > 0 ? ((lastEntry.total - prevAverage) / prevAverage) * 100 : null,
      timesRegistered: list.length,
    });
  });

  return result;
}
