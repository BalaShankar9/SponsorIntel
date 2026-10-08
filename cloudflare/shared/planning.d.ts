export const PLANNING_REVIEWED: string;
export function studyBudget(input: {
  tuition: number;
  scholarship: number;
  months: number;
  living: number;
  london: boolean;
  paid: number;
  visa: number;
  ihs: number;
  extras: number;
}): {
  tuition: number;
  living: number;
  visa: number;
  ihs: number;
  extras: number;
  total: number;
  maintenance: number;
  proofOfFunds: number;
  monthlyMinimum: number;
};
export function businessCharges(input?: {
  months?: number;
  large?: boolean;
  exempt?: boolean;
}): { licence: number; certificate: number; skills: number; total: number };
