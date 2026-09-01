export type Household = {
  id: string;
  name: string;
  invite_code: string;
  created_at: string;
};

export type HouseholdMember = {
  id: string;
  household_id: string;
  user_id: string;
  display_name: string | null;
};

export type Category = {
  id: string;
  household_id: string;
  name: string;
  icon: string;
  is_discretionary: boolean;
};

export type CategoryBudget = {
  id: string;
  household_id: string;
  category_id: string;
  monthly_limit: number;
  alert_threshold_pct: number;
};

export type Card = {
  id: string;
  household_id: string;
  name: string;
  closing_day: number;
  payment_day: number;
  credit_limit: number | null;
  color: string;
  auto_post_payment?: boolean;
  payment_category_id?: string | null;
};

export type IncomeSource = {
  id: string;
  household_id: string;
  name: string;
  amount: number;
  expected_day: number;
  owner_name: string | null;
  active: boolean;
};

export type IncomeEntry = {
  id: string;
  household_id: string;
  income_source_id: string | null;
  description: string;
  amount: number;
  entry_date: string;
  is_extra: boolean;
};

export type Expense = {
  id: string;
  household_id: string;
  category_id: string;
  card_id: string | null;
  description: string;
  amount: number;
  expense_date: string;
  is_recurring: boolean;
  is_extra: boolean;
  created_by: string | null;
  created_at: string;
  updated_by?: string | null;
  updated_at?: string | null;
  is_card_payment?: boolean;
  installment_purchase_id?: string | null;
};

export type InstallmentPurchase = {
  id: string;
  household_id: string;
  category_id: string;
  card_id: string;
  description: string;
  installment_amount: number;
  total_installments: number;
  installments_posted: number;
  active: boolean;
};

export type RecurringExpense = {
  id: string;
  household_id: string;
  category_id: string;
  card_id: string | null;
  description: string;
  amount: number;
  day_of_month: number;
  active: boolean;
};

export type SavingsGoal = {
  id: string;
  household_id: string;
  name: string;
  target_amount: number;
  target_date: string | null;
  created_at: string;
};
