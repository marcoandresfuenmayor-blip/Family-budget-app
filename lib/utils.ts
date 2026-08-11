import { Card, Category, CategoryBudget, Expense, IncomeSource } from "./types";

export function formatCurrency(value: number, currency = "USD") {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

export function currentMonthRange(base = new Date()) {
  const start = new Date(base.getFullYear(), base.getMonth(), 1);
  const end = new Date(base.getFullYear(), base.getMonth() + 1, 0);
  return { start, end };
}

export function isInCurrentMonth(dateStr: string, base = new Date()) {
  const d = new Date(dateStr + "T00:00:00");
  return d.getFullYear() === base.getFullYear() && d.getMonth() === base.getMonth();
}

// Próxima fecha (día del mes) a partir de hoy. Si ya pasó este mes, devuelve la del mes siguiente.
export function nextOccurrence(day: number, base = new Date()): Date {
  const clampedDay = Math.min(day, daysInMonth(base.getFullYear(), base.getMonth()));
  let candidate = new Date(base.getFullYear(), base.getMonth(), clampedDay);
  if (candidate < stripTime(base)) {
    const nextMonth = new Date(base.getFullYear(), base.getMonth() + 1, 1);
    const clampedNext = Math.min(day, daysInMonth(nextMonth.getFullYear(), nextMonth.getMonth()));
    candidate = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), clampedNext);
  }
  return candidate;
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function stripTime(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function daysUntil(date: Date, base = new Date()) {
  const diff = stripTime(date).getTime() - stripTime(base).getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

// -----------------------------------------------------------------
// ALERTAS
// -----------------------------------------------------------------
export type Alert = {
  id: string;
  level: "red" | "yellow" | "blue";
  title: string;
  message: string;
};

export function buildCategoryAlerts(
  categories: Category[],
  budgets: CategoryBudget[],
  expenses: Expense[],
  base = new Date()
): Alert[] {
  const alerts: Alert[] = [];
  const monthExpenses = expenses.filter((e) => isInCurrentMonth(e.expense_date, base));

  for (const budget of budgets) {
    if (!budget.monthly_limit || budget.monthly_limit <= 0) continue;
    const category = categories.find((c) => c.id === budget.category_id);
    if (!category) continue;

    const spent = monthExpenses
      .filter((e) => e.category_id === budget.category_id)
      .reduce((sum, e) => sum + Number(e.amount), 0);

    const pct = (spent / budget.monthly_limit) * 100;

    if (pct >= 100) {
      alerts.push({
        id: `cat-${budget.category_id}-over`,
        level: "red",
        title: `${category.icon} ${category.name}: límite superado`,
        message: `Gastaste ${formatCurrency(spent)} de ${formatCurrency(
          budget.monthly_limit
        )} (${pct.toFixed(0)}%).`,
      });
    } else if (pct >= budget.alert_threshold_pct) {
      alerts.push({
        id: `cat-${budget.category_id}-warn`,
        level: "yellow",
        title: `${category.icon} ${category.name}: cerca del límite`,
        message: `Llevas ${formatCurrency(spent)} de ${formatCurrency(
          budget.monthly_limit
        )} (${pct.toFixed(0)}%).`,
      });
    }
  }

  return alerts;
}

export function buildCardAlerts(cards: Card[], base = new Date(), windowDays = 3): Alert[] {
  const alerts: Alert[] = [];
  for (const card of cards) {
    const closing = nextOccurrence(card.closing_day, base);
    const payment = nextOccurrence(card.payment_day, base);

    const dClosing = daysUntil(closing, base);
    const dPayment = daysUntil(payment, base);

    if (dClosing <= windowDays) {
      alerts.push({
        id: `card-${card.id}-closing`,
        level: dClosing <= 1 ? "red" : "yellow",
        title: `💳 ${card.name}: corte próximo`,
        message:
          dClosing === 0
            ? "La tarjeta cierra hoy."
            : `Cierra en ${dClosing} día(s) (${closing.toLocaleDateString("es-ES")}).`,
      });
    }
    if (dPayment <= windowDays) {
      alerts.push({
        id: `card-${card.id}-payment`,
        level: dPayment <= 1 ? "red" : "yellow",
        title: `💳 ${card.name}: pago próximo`,
        message:
          dPayment === 0
            ? "El pago vence hoy."
            : `Vence en ${dPayment} día(s) (${payment.toLocaleDateString("es-ES")}).`,
      });
    }
  }
  return alerts;
}

export function buildIncomeAlerts(
  sources: IncomeSource[],
  base = new Date(),
  windowDays = 2
): Alert[] {
  const alerts: Alert[] = [];
  for (const source of sources.filter((s) => s.active)) {
    const next = nextOccurrence(source.expected_day, base);
    const d = daysUntil(next, base);
    if (d <= windowDays) {
      alerts.push({
        id: `income-${source.id}`,
        level: "blue",
        title: `💰 Ingreso próximo: ${source.name}`,
        message:
          d === 0
            ? `Se espera hoy (${formatCurrency(source.amount)}).`
            : `En ${d} día(s), ${formatCurrency(source.amount)} (${next.toLocaleDateString(
                "es-ES"
              )}).`,
      });
    }
  }
  return alerts;
}

// -----------------------------------------------------------------
// RECOMENDACIONES
// -----------------------------------------------------------------
export type Recommendation = {
  id: string;
  title: string;
  detail: string;
};

export function buildRecommendations(
  categories: Category[],
  budgets: CategoryBudget[],
  expenses: Expense[],
  totalIncomeThisMonth: number,
  base = new Date()
): Recommendation[] {
  const recs: Recommendation[] = [];
  const monthExpenses = expenses.filter((e) => isInCurrentMonth(e.expense_date, base));
  const totalExpenses = monthExpenses.reduce((s, e) => s + Number(e.amount), 0);

  // 1. Categorías discrecionales que superan el límite o son altas
  for (const category of categories.filter((c) => c.is_discretionary)) {
    const spent = monthExpenses
      .filter((e) => e.category_id === category.id)
      .reduce((s, e) => s + Number(e.amount), 0);
    const budget = budgets.find((b) => b.category_id === category.id);

    if (budget && budget.monthly_limit > 0 && spent > budget.monthly_limit) {
      const exceso = spent - budget.monthly_limit;
      recs.push({
        id: `rec-over-${category.id}`,
        title: `Reduce ${category.name}`,
        detail: `Este mes superaste el límite en ${formatCurrency(
          exceso
        )}. Si recortas un 20% aquí, liberarías ${formatCurrency(spent * 0.2)} para tu fondo familiar.`,
      });
    } else if (totalExpenses > 0 && spent / totalExpenses > 0.15) {
      recs.push({
        id: `rec-high-${category.id}`,
        title: `${category.name} pesa mucho en tu presupuesto`,
        detail: `Representa ${(
          (spent / totalExpenses) *
          100
        ).toFixed(0)}% de tus gastos del mes (${formatCurrency(
          spent
        )}). Considera fijar un límite si aún no lo tienes.`,
      });
    }
  }

  // 2. Tasa de ahorro general
  if (totalIncomeThisMonth > 0) {
    const savingsRate = ((totalIncomeThisMonth - totalExpenses) / totalIncomeThisMonth) * 100;
    if (savingsRate < 10) {
      recs.push({
        id: "rec-savings-low",
        title: "Tasa de ahorro baja",
        detail: `Este mes ahorraste ${savingsRate.toFixed(
          0
        )}% de tus ingresos. Un objetivo saludable para poder invertir en proyectos familiares es al menos 15-20%.`,
      });
    } else {
      const surplus = totalIncomeThisMonth - totalExpenses;
      recs.push({
        id: "rec-savings-ok",
        title: "Buen margen para invertir",
        detail: `Te sobran ${formatCurrency(
          surplus
        )} este mes (${savingsRate.toFixed(
          0
        )}% de ahorro). Podrías destinar una parte fija a un fondo de proyectos familiares.`,
      });
    }
  }

  // 3. Gastos "extra" no planeados
  const extras = monthExpenses.filter((e) => e.is_extra);
  const extrasTotal = extras.reduce((s, e) => s + Number(e.amount), 0);
  if (extrasTotal > 0 && totalExpenses > 0 && extrasTotal / totalExpenses > 0.1) {
    recs.push({
      id: "rec-extras",
      title: "Muchos gastos no planeados",
      detail: `Los gastos extra suman ${formatCurrency(
        extrasTotal
      )} (${((extrasTotal / totalExpenses) * 100).toFixed(
        0
      )}% del mes). Planificarlos con anticipación ayuda a controlarlos mejor.`,
    });
  }

  return recs;
}
