/**
 * Financial data processing for Excel/CSV uploads.
 * Adapted from the Google AI Studio prototype.
 * Handles Czech date formats, Excel serial numbers, and Czech number formatting.
 */

import type { Transaction, FinancialSummary, MonthlySummary, EventSummary, DateRangeOption } from '@/types/reporting';

// ========== DATE PARSING ==========

function normalizeDateToISO(val: unknown): string {
  if (val === null || val === undefined) return '';

  // JS Date object (from Excel with cellDates: true)
  if (val instanceof Date) {
    const year = val.getFullYear();
    const month = String(val.getMonth() + 1).padStart(2, '0');
    const day = String(val.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Excel serial number (e.g. 46023)
  if (typeof val === 'number') {
    const utcDays = Math.floor(val - 25569);
    const utcValue = utcDays * 86400;
    const dateInfo = new Date(utcValue * 1000);
    return dateInfo.toISOString().split('T')[0];
  }

  // Text string
  let str = val.toString().trim();
  if (!str) return '';

  // Remove spaces: "1. 1. 2026" -> "1.1.2026"
  str = str.replace(/\s+/g, '');

  // ISO format
  if (str.match(/^\d{4}-\d{2}-\d{2}$/)) return str;

  // Czech format DD.MM.YYYY
  const czMatch = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (czMatch) {
    const day = czMatch[1].padStart(2, '0');
    const month = czMatch[2].padStart(2, '0');
    return `${czMatch[3]}-${month}-${day}`;
  }

  // Fallback: dots with 2-digit year
  if (str.includes('.')) {
    const parts = str.split('.');
    if (parts.length >= 3) {
      const d = parts[0].padStart(2, '0');
      const m = parts[1].padStart(2, '0');
      let y = parts[2];
      if (y.length === 2) y = '20' + y;
      if (parseInt(m) <= 12 && parseInt(d) <= 31) {
        return `${y}-${m}-${d}`;
      }
    }
  }

  return '';
}

// ========== NUMBER PARSING ==========

function parseNum(val: unknown): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return val;

  let str = val.toString();
  // Remove whitespace (including non-breaking spaces from Excel)
  str = str.replace(/\s/g, '').replace(/\u00A0/g, '');
  str = str.replace(/[^0-9.,-]/g, '');
  // Czech decimal comma -> dot
  str = str.replace(',', '.');

  // Handle thousand separators: keep only last dot as decimal
  const lastDotIndex = str.lastIndexOf('.');
  if (lastDotIndex !== -1) {
    const integerPart = str.substring(0, lastDotIndex).replace(/\./g, '');
    const decimalPart = str.substring(lastDotIndex);
    str = integerPart + decimalPart;
  }

  const num = parseFloat(str);
  return isNaN(num) ? 0 : Math.abs(num);
}

// ========== EXCEL PROCESSING ==========

/**
 * Process rows from Excel file into Transaction objects.
 * Supports two sheet formats:
 * - "Akce" sheet: B=date, C=name, F=revenue, H=commission, I-Q=personnel, R=transport, S-V=rent
 * - "Provoz" sheet: A=date, B=description, C=amount, D=category
 */
export function processExcelData(rows: unknown[][]): Transaction[] {
  const transactions: Transaction[] = [];

  if (!rows || rows.length < 2) return [];

  rows.slice(1).forEach((row, index) => {
    if (row.length === 0) return;

    const dateColA = normalizeDateToISO(row[0]);
    const dateColB = normalizeDateToISO(row[1]);

    // Priority 1: Event row (date in column B + data in C/F)
    if (dateColB && dateColB.length === 10) {
      const description = row[2] ? row[2].toString().trim() : 'Bez názvu';

      // Revenue (column F / index 5)
      const revenue = parseNum(row[5]);
      if (revenue > 0) {
        transactions.push({
          id: `ev-${index}-inc`, date: dateColB, description, category: 'Služby', amount: revenue, type: 'income',
        });
      }

      // Commission (H/7)
      const commission = parseNum(row[7]);
      if (commission > 0) {
        transactions.push({ id: `ev-${index}-comm`, date: dateColB, description, category: 'Provize', amount: commission, type: 'expense' });
      }

      // Personnel (I-Q / 8-16)
      let personnelSum = 0;
      for (let i = 8; i <= 16; i++) personnelSum += parseNum(row[i]);
      if (personnelSum > 0) {
        transactions.push({ id: `ev-${index}-pers`, date: dateColB, description, category: 'Personál', amount: personnelSum, type: 'expense' });
      }

      // Transport (R/17)
      const transport = parseNum(row[17]);
      if (transport > 0) {
        transactions.push({ id: `ev-${index}-trans`, date: dateColB, description, category: 'Doprava', amount: transport, type: 'expense' });
      }

      // Rent Sýkora (S/18)
      const rentSykora = parseNum(row[18]);
      if (rentSykora > 0) {
        transactions.push({ id: `ev-${index}-syk`, date: dateColB, description, category: 'Rent Sýkora', amount: rentSykora, type: 'expense' });
      }

      // Rent Elsea (T/19)
      const rentElsea = parseNum(row[19]);
      if (rentElsea > 0) {
        transactions.push({ id: `ev-${index}-els`, date: dateColB, description, category: 'Rent Elsea', amount: rentElsea, type: 'expense' });
      }

      // Rent Other (U-V / 20-21)
      let rentOther = 0;
      rentOther += parseNum(row[20]);
      rentOther += parseNum(row[21]);
      if (rentOther > 0) {
        transactions.push({ id: `ev-${index}-rost`, date: dateColB, description, category: 'Rent Ostatní', amount: rentOther, type: 'expense' });
      }
    }
    // Priority 2: Operations row (date in column A)
    else if (dateColA && dateColA.length === 10) {
      const description = row[1] ? row[1].toString().trim() : 'Výdaj';
      const amount = parseNum(row[2]);
      let category = row[3] ? row[3].toString().trim() : 'Provoz';
      if (!category) category = 'Režie';

      if (amount > 0) {
        transactions.push({ id: `op-${index}`, date: dateColA, description, category, amount, type: 'expense' });
      }
    }
  });

  return transactions;
}

// ========== CALCULATIONS ==========

export function calculateSummary(transactions: Transaction[]): FinancialSummary {
  const totalRevenue = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const allExpenses = transactions.filter(t => t.type === 'expense');
  const totalExpenses = allExpenses.reduce((sum, t) => sum + t.amount, 0);

  const eventCosts = allExpenses.filter(t => t.id.startsWith('ev-')).reduce((sum, t) => sum + t.amount, 0);
  const operatingExpenses = allExpenses.filter(t => t.id.startsWith('op-')).reduce((sum, t) => sum + t.amount, 0);

  const netProfit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
  const grossProfit = totalRevenue - eventCosts;
  const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

  // Top expense category
  const expenseByCategory: Record<string, number> = {};
  allExpenses.forEach(t => { expenseByCategory[t.category] = (expenseByCategory[t.category] || 0) + t.amount; });
  let topExpenseCategory: { category: string; amount: number } | null = null;
  for (const [cat, val] of Object.entries(expenseByCategory)) {
    if (!topExpenseCategory || val > topExpenseCategory.amount) {
      topExpenseCategory = { category: cat, amount: val };
    }
  }

  // Top revenue source
  const incomeByEvent: Record<string, number> = {};
  transactions.filter(t => t.type === 'income').forEach(t => { incomeByEvent[t.description] = (incomeByEvent[t.description] || 0) + t.amount; });
  let topRevenueSource: { source: string; amount: number } | null = null;
  for (const [name, val] of Object.entries(incomeByEvent)) {
    if (!topRevenueSource || val > topRevenueSource.amount) {
      topRevenueSource = { source: name, amount: val };
    }
  }

  return { totalRevenue, totalExpenses, eventCosts, operatingExpenses, netProfit, grossProfit, grossMargin, profitMargin, topExpenseCategory, topRevenueSource };
}

export function calculateMonthlyPerformance(transactions: Transaction[]): MonthlySummary[] {
  const grouped: Record<string, MonthlySummary> = {};

  transactions.forEach(t => {
    const key = t.date.slice(0, 7);
    if (!grouped[key]) {
      const [year, month] = key.split('-');
      const dateObj = new Date(parseInt(year), parseInt(month) - 1);
      const monthName = dateObj.toLocaleString('cs-CZ', { month: 'long', year: 'numeric' });
      grouped[key] = { id: key, monthName: monthName.charAt(0).toUpperCase() + monthName.slice(1), revenue: 0, expenses: 0, profit: 0, margin: 0, transactionCount: 0 };
    }

    if (t.type === 'income') grouped[key].revenue += t.amount;
    else grouped[key].expenses += t.amount;
    grouped[key].transactionCount += 1;
  });

  return Object.values(grouped).map(item => {
    const profit = item.revenue - item.expenses;
    const margin = item.revenue > 0 ? (profit / item.revenue) * 100 : 0;
    return { ...item, profit, margin };
  }).sort((a, b) => b.id.localeCompare(a.id));
}

export function calculateEventSummaries(transactions: Transaction[]): EventSummary[] {
  const grouped: Record<string, EventSummary> = {};
  const eventNames = new Set(transactions.filter(t => t.type === 'income').map(t => t.description));

  transactions.forEach(t => {
    if (eventNames.has(t.description)) {
      const name = t.description;
      if (!grouped[name]) {
        grouped[name] = { name, date: t.date, revenue: 0, expenses: 0, profit: 0, margin: 0, transactionCount: 0 };
      }
      if (t.date > grouped[name].date) grouped[name].date = t.date;
      if (t.type === 'income') grouped[name].revenue += t.amount;
      else grouped[name].expenses += t.amount;
      grouped[name].transactionCount += 1;
    }
  });

  return Object.values(grouped).map(e => {
    const profit = e.revenue - e.expenses;
    const margin = e.revenue > 0 ? (profit / e.revenue) * 100 : 0;
    return { ...e, profit, margin };
  }).sort((a, b) => b.date.localeCompare(a.date));
}

export function filterTransactions(
  transactions: Transaction[],
  range: DateRangeOption,
  category: string,
  searchQuery: string,
): Transaction[] {
  const now = new Date();

  return transactions.filter(t => {
    const tDate = new Date(t.date);
    if (isNaN(tDate.getTime())) return false;

    // Date filter
    let dateMatch = true;
    if (range === 'thisYear') {
      dateMatch = tDate.getFullYear() === now.getFullYear();
    } else if (range === 'last30Days') {
      dateMatch = (now.getTime() - tDate.getTime()) <= 30 * 86400000;
    } else if (range === 'last90Days') {
      dateMatch = (now.getTime() - tDate.getTime()) <= 90 * 86400000;
    } else if (range.match(/^\d{4}-\d{2}$/)) {
      dateMatch = t.date.slice(0, 7) === range;
    }

    // Category filter
    const catMatch = category === 'all' || t.category === category;

    // Search filter
    let searchMatch = true;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      searchMatch = t.description.toLowerCase().includes(q) || t.amount.toString().includes(q);
    }

    return dateMatch && catMatch && searchMatch;
  });
}
