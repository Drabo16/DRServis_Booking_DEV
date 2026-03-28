export interface Transaction {
  id: string;
  date: string;
  description: string;
  category: string;
  amount: number;
  type: 'income' | 'expense';
}

export interface FinancialSummary {
  totalRevenue: number;
  totalExpenses: number;
  eventCosts: number;
  operatingExpenses: number;
  netProfit: number;
  grossProfit: number;
  grossMargin: number;
  profitMargin: number;
  topExpenseCategory: { category: string; amount: number } | null;
  topRevenueSource: { source: string; amount: number } | null;
}

export interface MonthlySummary {
  id: string;
  monthName: string;
  revenue: number;
  expenses: number;
  profit: number;
  margin: number;
  transactionCount: number;
}

export interface EventSummary {
  name: string;
  date: string;
  revenue: number;
  expenses: number;
  profit: number;
  margin: number;
  transactionCount: number;
}

export type DateRangeOption = 'all' | 'thisYear' | 'last30Days' | 'last90Days' | 'custom' | string;
