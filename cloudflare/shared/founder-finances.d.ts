export type FinancialInputKey = 'openingCash' | 'startupPayments' | 'monthlyReceipts' | 'monthlyPayments' | 'months' | 'receiptsReduction' | 'paymentsIncrease' | 'receiptDelay' | 'evidenceNote';
export type FinancialInputs = Record<FinancialInputKey, string>;
/** All money values are integer pence. Month 0 includes startup payments only. */
export type FinancialCashRow = {month: number; receipts: number; payments: number; balance: number};
export type FinancialScenarioResult = {
  rows: FinancialCashRow[];
  first_negative_month: number | null;
  first_zero_month: number | null;
  minimum_balance: number;
  closing_balance: number;
};
export type FinancialEvaluation = {
  ok: true;
  /** Money and percentages use two decimal places; months and delay are integer strings. */
  inputs: FinancialInputs;
  currency: 'GBP';
  base: FinancialScenarioResult;
  downside: FinancialScenarioResult;
} | {
  ok: false;
  missing: FinancialInputKey[];
  errors: Partial<Record<FinancialInputKey | '_input', string>>;
};
export function emptyFinancialInputs(): FinancialInputs;
export function evaluateFinancialScenario(input: unknown): FinancialEvaluation;
/** Throws for incomplete/invalid input or an invalid millisecond timestamp; at most 2,500 characters. */
export function financialScenarioSummary(input: unknown, now?: number): string;
/** Preserves the original note and an already-present exact summary block; throws instead of truncating beyond 4,000 characters. */
export function appendFinancialSummary(existingNote: string, summary: string): string;
