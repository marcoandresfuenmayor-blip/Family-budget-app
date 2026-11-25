// Proyección del pago de cada tarjeta.
//
// - "Próximo pago": el corte que se paga en la siguiente fecha de pago. Si ese
//   corte ya cerró, el monto es exacto; si no, se proyecta.
// - "Corte en curso": lo que ya llevan + gastos fijos y cuotas que todavía
//   caerán antes del corte + lo que suelen gastar por día (ritmo de los dos
//   cortes anteriores) por los días que faltan.
import { Card, Expense, InstallmentPurchase, RecurringExpense } from "./types";
import { cardBilling, nextOccurrence, previousOccurrence } from "./utils";

const DAY = 24 * 60 * 60 * 1000;

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function addDays(d: Date, n: number) {
  const c = startOfDay(d);
  c.setDate(c.getDate() + n);
  return c;
}
function key(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function daysBetween(a: Date, b: Date) {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY);
}

export type CycleProjection = {
  start: Date; // día siguiente al corte anterior
  closing: Date;
  paymentDate: Date;
  closed: boolean;
  spentSoFar: number;
  pendingFixed: number;
  pendingInstallments: number;
  projectedVariable: number;
  projected: number; // total esperado del corte
};

export type CardProjection = {
  card: Card;
  previousPayment: number; // lo que se pagó (o tocaba pagar) en el pago anterior
  next: CycleProjection; // próximo pago
  open: CycleProjection | null; // corte en curso, si el próximo pago ya cerró
  dailyPace: number;
};

function sumIn(list: Expense[], from: Date, to: Date) {
  const a = key(from);
  const b = key(to);
  return list.filter((e) => e.expense_date >= a && e.expense_date <= b).reduce((t, e) => t + Number(e.amount), 0);
}

// Fechas en (after, until] en que cae un gasto fijo mensual.
function occurrencesBetween(day: number, after: Date, until: Date) {
  const out: Date[] = [];
  let d = nextOccurrence(day, addDays(after, 1));
  while (d <= until) {
    out.push(d);
    d = nextOccurrence(day, addDays(d, 1));
  }
  return out;
}

export function projectCards(
  expenses: Expense[],
  cards: Card[],
  recurring: RecurringExpense[],
  installments: InstallmentPurchase[],
  base = new Date()
): CardProjection[] {
  const today = startOfDay(base);

  return cards.map((card) => {
    const own = expenses.filter((e) => e.card_id === card.id && !e.is_card_payment);
    const variable = own.filter((e) => !e.recurring_expense_id && !e.installment_purchase_id);
    const billing = cardBilling(expenses, card, today);

    // Ritmo diario de gasto variable: los dos cortes completos más recientes.
    const lastClosed = billing.closed ? billing.closingDate : previousOccurrence(card.closing_day, addDays(billing.closingDate, -1));
    const c1 = previousOccurrence(card.closing_day, addDays(lastClosed, -1));
    const c2 = previousOccurrence(card.closing_day, addDays(c1, -1));
    const firstData = own.reduce<string | null>((m, e) => (!m || e.expense_date < m ? e.expense_date : m), null);
    const windowStart = firstData && key(addDays(c2, 1)) < firstData ? new Date(firstData + "T00:00:00") : addDays(c2, 1);
    const windowDays = Math.max(1, daysBetween(windowStart, lastClosed) + 1);
    const dailyPace = sumIn(variable, windowStart, lastClosed) / windowDays;

    const cardRecurring = recurring.filter((r) => r.active && r.card_id === card.id);
    const cardInstallments = installments.filter(
      (i) => i.active && i.card_id === card.id && i.installments_posted < i.total_installments
    );

    function project(start: Date, closing: Date, paymentDate: Date): CycleProjection {
      const closed = closing <= today;
      const spentSoFar = sumIn(own, start, closed ? closing : today);
      if (closed) {
        return { start, closing, paymentDate, closed, spentSoFar, pendingFixed: 0, pendingInstallments: 0, projectedVariable: 0, projected: spentSoFar };
      }
      const pendingFixed = cardRecurring.reduce(
        (t, r) => t + occurrencesBetween(r.day_of_month, today, closing).length * Number(r.amount),
        0
      );
      // Las cuotas se cargan el día de corte.
      const pendingInstallments = cardInstallments.reduce((t, i) => t + Number(i.installment_amount), 0);
      const projectedVariable = dailyPace * Math.max(0, daysBetween(today, closing));
      return {
        start,
        closing,
        paymentDate,
        closed,
        spentSoFar,
        pendingFixed,
        pendingInstallments,
        projectedVariable,
        projected: spentSoFar + pendingFixed + pendingInstallments + projectedVariable,
      };
    }

    const priorClosing = previousOccurrence(card.closing_day, addDays(billing.closingDate, -1));
    const next = project(addDays(priorClosing, 1), billing.closingDate, billing.paymentDate);
    const open = next.closed ? project(addDays(billing.closingDate, 1), billing.nextClosingDate, billing.nextPaymentDate) : null;

    const prevPrior = previousOccurrence(card.closing_day, addDays(priorClosing, -1));
    const previousPayment = sumIn(own, addDays(prevPrior, 1), priorClosing);

    return { card, previousPayment, next, open, dailyPace };
  });
}
