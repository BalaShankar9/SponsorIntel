const number = (value, max) =>
  Math.max(
    0,
    Math.min(max, Number.isFinite(Number(value)) ? Number(value) : 0),
  );
export const PLANNING_REVIEWED = "2026-10-05";
export function studyBudget(input) {
  const tuition = number(input.tuition, 200000),
    scholarship = Math.min(tuition, number(input.scholarship, 200000)),
    months = Math.max(1, number(input.months, 72)),
    living = number(input.living, 10000);
  const monthlyMinimum = input.london ? 1529 : 1171;
  const outstandingTuition = Math.max(
    0,
    tuition - scholarship - number(input.paid, 200000),
  );
  const maintenance = monthlyMinimum * Math.min(9, Math.ceil(months));
  const visa = number(input.visa, 20000),
    ihs = number(input.ihs, 20000),
    extras = number(input.extras, 50000);
  return {
    tuition: tuition - scholarship,
    living: months * living,
    visa,
    ihs,
    extras,
    total: tuition - scholarship + months * living + visa + ihs + extras,
    maintenance,
    proofOfFunds: outstandingTuition + maintenance,
    monthlyMinimum,
  };
}
export function businessCharges({
  months = 36,
  large = false,
  exempt = false,
} = {}) {
  const duration = Math.max(1, Math.min(60, Math.ceil(Number(months) || 36)));
  const licence = large ? 1682 : 611,
    certificate = 525,
    firstYear = large ? 1320 : 480,
    halfYear = large ? 660 : 240;
  const skills = exempt
    ? 0
    : firstYear + Math.max(0, Math.ceil((duration - 12) / 6)) * halfYear;
  return {
    licence,
    certificate,
    skills,
    total: licence + certificate + skills,
  };
}
