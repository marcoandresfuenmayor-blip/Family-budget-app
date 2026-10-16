import { Card, Category, CategoryBudget, Expense, IncomeEntry, IncomeSource, SavingsGoal } from "./types";

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

// Formato "YYYY-MM" de un mes cualquiera (para selects tipo <input type="month">).
export function toMonthValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function isInMonth(dateStr: string, monthValue: string) {
  return dateStr.startsWith(monthValue);
}

export function shiftMonth(monthValue: string, delta: number) {
  const [y, m] = monthValue.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return toMonthValue(d);
}

export function monthValueToDate(monthValue: string) {
  const [y, m] = monthValue.split("-").map(Number);
  return new Date(y, m - 1, 1);
}

export function monthLabel(monthValue: string) {
  return monthValueToDate(monthValue).toLocaleDateString("es-ES", {
    month: "long",
    year: "numeric",
  });
}

// % de cambio entre dos totales, para comparar contra el mes anterior.
export function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
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

// La ocurrencia anterior (o de hoy, si hoy es ese día) de un día del mes.
// Junto con nextOccurrence delimita el ciclo de facturación "abierto" de una tarjeta.
export function previousOccurrence(day: number, base = new Date()): Date {
  const clampedDay = Math.min(day, daysInMonth(base.getFullYear(), base.getMonth()));
  const candidate = new Date(base.getFullYear(), base.getMonth(), clampedDay);
  if (candidate > stripTime(base)) {
    const prevMonth = new Date(base.getFullYear(), base.getMonth() - 1, 1);
    const clampedPrev = Math.min(day, daysInMonth(prevMonth.getFullYear(), prevMonth.getMonth()));
    return new Date(prevMonth.getFullYear(), prevMonth.getMonth(), clampedPrev);
  }
  return candidate;
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
  categoryId?: string;
  cardId?: string;
  cardKind?: "closing" | "payment";
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
        categoryId: budget.category_id,
        level: "red",
        title: `${category.icon} ${category.name}: límite superado`,
        message: `Gastaste ${formatCurrency(spent)} de ${formatCurrency(
          budget.monthly_limit
        )} (${pct.toFixed(0)}%).`,
      });
    } else if (pct >= budget.alert_threshold_pct) {
      alerts.push({
        id: `cat-${budget.category_id}-warn`,
        categoryId: budget.category_id,
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
        cardId: card.id,
        cardKind: "closing",
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
        cardId: card.id,
        cardKind: "payment",
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

// -----------------------------------------------------------------
// TARJETAS: ciclo de facturación actual
// -----------------------------------------------------------------
export function cardCycleRange(closingDay: number, base = new Date()) {
  const cycleStart = previousOccurrence(closingDay, base);
  const cycleEnd = nextOccurrence(closingDay, base);
  return { cycleStart, cycleEnd };
}

// Suma de gastos de una tarjeta desde el último corte hasta hoy: lo que se
// va acumulando para el corte que todavía está abierto (aún no se cobra).
export function cardCycleSpend(expenses: Expense[], cardId: string, closingDay: number, base = new Date()) {
  const { cycleStart } = cardCycleRange(closingDay, base);
  return expenses
    .filter((e) => e.card_id === cardId && !e.is_card_payment)
    .filter((e) => {
      const d = new Date(e.expense_date + "T00:00:00");
      return d > cycleStart && d <= base;
    })
    .reduce((sum, e) => sum + Number(e.amount), 0);
}

// Suma de gastos del corte YA CERRADO (el ciclo anterior al actual): esto es
// lo que realmente toca pagar en la próxima fecha de pago. Un gasto hecho
// después del último corte no entra aquí — pasa automáticamente al corte
// siguiente (cardCycleSpend), que se pagará un mes después.
export function cardClosedCycleDue(expenses: Expense[], cardId: string, closingDay: number, base = new Date()) {
  const { cycleStart: lastClosing } = cardCycleRange(closingDay, base);
  const dayBefore = new Date(lastClosing);
  dayBefore.setDate(dayBefore.getDate() - 1);
  const priorClosing = previousOccurrence(closingDay, dayBefore);

  return expenses
    .filter((e) => e.card_id === cardId && !e.is_card_payment)
    .filter((e) => {
      const d = new Date(e.expense_date + "T00:00:00");
      return d > priorClosing && d <= lastClosing;
    })
    .reduce((sum, e) => sum + Number(e.amount), 0);
}

// -----------------------------------------------------------------
// METAS DE AHORRO
// -----------------------------------------------------------------
export type GoalProgress = {
  saved: number;
  pct: number;
  monthsLeft: number | null;
};

// El "ahorro" hacia una meta se calcula como el superávit real
// (ingresos - gastos) acumulado desde que se creó la meta, sin contar
// más de lo que la meta pide.
export function computeGoalProgress(
  goal: SavingsGoal,
  incomeEntries: IncomeEntry[],
  expenses: Expense[],
  base = new Date()
): GoalProgress {
  const since = new Date(goal.created_at);

  const totalIncome = incomeEntries
    .filter((e) => new Date(e.entry_date + "T00:00:00") >= since)
    .reduce((sum, e) => sum + Number(e.amount), 0);

  const totalExpenses = expenses
    .filter((e) => new Date(e.expense_date + "T00:00:00") >= since)
    .reduce((sum, e) => sum + Number(e.amount), 0);

  const surplus = Math.max(0, totalIncome - totalExpenses);
  const saved = Math.min(surplus, goal.target_amount);
  const pct = goal.target_amount > 0 ? (saved / goal.target_amount) * 100 : 0;

  const monthsElapsed = Math.max(1, (base.getTime() - since.getTime()) / (1000 * 60 * 60 * 24 * 30));
  const monthlyRate = surplus / monthsElapsed;
  const remaining = Math.max(0, goal.target_amount - saved);
  const monthsLeft = monthlyRate > 0.01 ? Math.ceil(remaining / monthlyRate) : null;

  return { saved, pct, monthsLeft };
}

// -----------------------------------------------------------------
// TARJETAS: qué paga el PRÓXIMO pago y qué queda para el siguiente
// -----------------------------------------------------------------
// El próximo pago (día de pago) liquida el último corte que ocurre ANTES de
// esa fecha. Si ese corte todavía no llega, el monto sigue sumando compras.
// Ejemplo: corte 18, pago 5. El 15/10, el pago del 5/11 cubre las compras
// del 19/09 al 18/10 (aún abierto). Lo comprado desde el 19/10 va al pago
// del 5/12.
function addDaysTo(d: Date, n: number) {
  const c = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  c.setDate(c.getDate() + n);
  return c;
}

export type CardBilling = {
  paymentDate: Date;
  closingDate: Date; // corte que liquida el próximo pago
  closed: boolean; // ese corte ya pasó (el monto ya no cambia)
  dueExpenses: Expense[];
  dueTotal: number;
  nextPaymentDate: Date;
  nextClosingDate: Date;
  nextExpenses: Expense[]; // compras que ya caen en el pago siguiente
  nextTotal: number;
};

export function cardBilling(expenses: Expense[], card: Card, base = new Date()): CardBilling {
  const today = stripTime(base);
  const paymentDate = nextOccurrence(card.payment_day, today);
  const closingDate = previousOccurrence(card.closing_day, addDaysTo(paymentDate, -1));
  const priorClosing = previousOccurrence(card.closing_day, addDaysTo(closingDate, -1));
  const closed = closingDate <= today;
  const nextPaymentDate = nextOccurrence(card.payment_day, addDaysTo(paymentDate, 1));
  const nextClosingDate = nextOccurrence(card.closing_day, addDaysTo(closingDate, 1));

  const own = expenses
    .filter((e) => e.card_id === card.id && !e.is_card_payment)
    .map((e) => ({ e, d: new Date(e.expense_date + "T00:00:00") }));
  const byDateDesc = (a: Expense, b: Expense) => b.expense_date.localeCompare(a.expense_date);

  const dueExpenses = own.filter(({ d }) => d > priorClosing && d <= closingDate).map(({ e }) => e).sort(byDateDesc);
  const nextExpenses = own.filter(({ d }) => d > closingDate && d <= nextClosingDate).map(({ e }) => e).sort(byDateDesc);
  const sum = (list: Expense[]) => list.reduce((t, e) => t + Number(e.amount), 0);

  return {
    paymentDate,
    closingDate,
    closed,
    dueExpenses,
    dueTotal: sum(dueExpenses),
    nextPaymentDate,
    nextClosingDate,
    nextExpenses,
    nextTotal: sum(nextExpenses),
  };
}

// -----------------------------------------------------------------
// FECHA DE PAGO (CAJA): cuándo sale realmente el dinero del banco
// -----------------------------------------------------------------
// Una compra con tarjeta no sale del banco el día de la compra, sino el día
// de pago del corte al que pertenece. Ej.: tarjeta corte 18 / pago 5:
// compra del 10-sep -> corte 18-sep -> se paga el 5-oct.
function keyOf(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function cardPaymentDateKey(card: Card, purchaseKey: string) {
  const purchase = new Date(purchaseKey + "T00:00:00");
  const closing = nextOccurrence(card.closing_day, purchase); // el mismo día si es día de corte
  return keyOf(nextOccurrence(card.payment_day, addDaysTo(closing, 1)));
}

// Fecha en que el gasto afecta la cuenta bancaria.
export function cashDateKey(e: Expense, cards: Card[]) {
  if (!e.card_id) return e.expense_date;
  const card = cards.find((c) => c.id === e.card_id);
  return card ? cardPaymentDateKey(card, e.expense_date) : e.expense_date;
}
