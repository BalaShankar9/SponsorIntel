import test from "node:test";
import assert from "node:assert/strict";
import { payEvidence } from "../shared/pay-evidence.js";
import { salaryExcerpt } from "../worker/jobs.js";

test("conflicting advertised ranges stay separate without choosing a true salary", () => {
  const pay = payEvidence("London | £85,000 - £110,000 base salary per year\nBenefits\n£78,000 - £110,000 base salary per year");
  assert.deepEqual(pay.quotes, ["London | £85,000 - £110,000 base salary per year", "£78,000 - £110,000 base salary per year"]);
  assert.equal(pay.multiple, true);
  assert.equal(pay.proRata, false);
});

test("pro-rata and OTE wording survives and is never converted to base salary", () => {
  const intern = payEvidence("📍London | 💰 £42,500 pro rata | Data\n💰£42,500 pro rata");
  assert.equal(intern.proRata, true);
  assert.equal(intern.multiple, false);
  assert.equal(intern.quotes.length, 1);
  assert.ok(intern.quotes.every((s) => s.includes("pro rata")));
  const sales = payEvidence("£67,000 Total OTE (base salary + commission)");
  assert.equal(sales.variablePay, true);
  assert.deepEqual(sales.quotes, ["£67,000 Total OTE (base salary + commission)"]);
  assert.match(salaryExcerpt("£42,500 pro rata"), /pro rata/);
});

test("standalone employer pay range is preserved without inventing a pay period", () => {
  assert.deepEqual(payEvidence("Benefits\n£101K - £192K").quotes, ["£101K - £192K"]);
  assert.equal(salaryExcerpt("£101K - £192K"), "£101K - £192K");
  assert.deepEqual(payEvidence("Salary: GBP 35,000 per annum\nPay: £12.75 per hour.").quotes,
    ["Salary: GBP 35,000 per annum", "Pay: £12.75 per hour."]);
});

test("funding, revenue and benefit budgets are not pay", () => {
  for (const text of ["We helped with £25 million of loan repayments.", "Annual revenue of £500,000.",
    "Annual learning budget of £1,000.", "We pay an equipment budget of £500.", "Salary sacrifice scheme worth £1,000.",
    "Our funding is £101K - £192K", "£1,000 learning budget each year"])
    assert.deepEqual(payEvidence(text).quotes, [], text);
  assert.deepEqual(payEvidence("Salary is $50,000 per year.").quotes, []);
  assert.equal(salaryExcerpt("The salary is &pound;35,000 per annum."), "The salary is £35,000 per annum.");
});

test("multiple pay components and range conditions remain visible", () => {
  const pay = payEvidence("Base salary range: £27,976 - £40,800 + Commission (100% of base). Realistic OTE of £64,000+\nOur approach is to pay between the minimum and mid-point (£27,976 - £34,000) until performance can be assessed.");
  assert.equal(pay.quotes.length, 3);
  assert.equal(pay.variablePay, true);
  assert.ok(pay.quotes[2].includes("until performance"));
});

test("repeated exact statements collapse, and bounded output discloses shortening", () => {
  assert.equal(payEvidence("Salary £35,000\nSalary £35,000").multiple, false);
  assert.deepEqual(payEvidence("Salary £35,000\nLondon | Salary £35,000 + benefits").quotes, ["London | Salary £35,000 + benefits"]);
  const many = payEvidence(Array.from({ length: 5 }, (_, i) => `Salary £${35000 + i}`).join("\n"));
  assert.equal(many.quotes.length, 4);
  assert.equal(many.shortened, true);
  const long = payEvidence("Salary £35,000 " + "context ".repeat(130));
  assert.equal(long.shortened, true);
  assert.equal(long.quotes[0].length, 801);
  assert.deepEqual(payEvidence(null).quotes, []);
});

test("a separate salary heading retains the amount, qualification conditions and FTE context", () => {
  // Observed public DfE Carpentry wording, 18 October 2026. Spelling is original.
  const amount = "£33,400-£52,100 dependent upon experience and qualifcation dependent upon qualification and experience";
  const quote = "Full time equivalent salary\n" + amount;
  const pay = payEvidence("Contract type\nPermanent\n\n" + quote + "\nWhat skills and experience we're looking for\nIndustry experience required.");
  assert.deepEqual(pay.quotes, [quote]);
  assert.equal(pay.fullTimeEquivalent, true);
  assert.equal(pay.proRata, false);
  assert.equal(salaryExcerpt(quote), quote);
  assert.doesNotMatch(pay.quotes.join(" "), /per annum|per year|take.home/);
});

test("FTE and actual salaries remain separate; fractions and hourly rates are not annualised", () => {
  const pay = payEvidence("Full-time equivalent salary\n£30,000 dependent on qualifications\nActual salary:\n£18,000 pro rata for 0.6 FTE\nHourly rate\nGBP 15.50 dependent on experience");
  assert.deepEqual(pay.quotes, ["Full-time equivalent salary\n£30,000 dependent on qualifications", "Actual salary:\n£18,000 pro rata for 0.6 FTE", "Hourly rate\nGBP 15.50 dependent on experience"]);
  assert.equal(pay.multiple, true);assert.equal(pay.fullTimeEquivalent, true);assert.equal(pay.proRata, true);
});

test("salary context stops at the next statement and never labels benefits, foreign pay or bare FTE fractions", () => {
  for (const text of ["Salary\n0.88 FTE", "Salary\nBenefits\n£1,000 dependent on training needs",
    "Salary\nNot disclosed\n£500 dependent on equipment needs", "Salary\n£1,000 learning budget each year",
    "Full time equivalent salary\n$33,400-$52,100 dependent on experience", "Full time equivalent salary\nCompetitive",
    "Salary\n\n£500 equipment budget", "Salary sacrifice\n£500 dependent on contributions"]) {
    assert.deepEqual(payEvidence(text).quotes, [], text);
    assert.equal(salaryExcerpt(text), "", text);
  }
  assert.deepEqual(payEvidence("Salary:\r\n\r\n£33,400 dependent on experience").quotes, ["Salary:\n£33,400 dependent on experience"]);
});

test("adjacent salary bands retain every role label and currency without selecting a range", () => {
  const block = "SALARY RANGE:\nJunior hires: £100,000-£150,000 (~$136,000-$205,000)\nSenior hires: £150,000-£200,000 (~$205,000-$273,000)\nStaff hires: £200,000-£290,000 (~$273,000-$395,000)";
  assert.deepEqual(payEvidence(block.replaceAll('\n','\n\n') + "\nBenefits\n£500 dependent on training needs").quotes, [block]);
  assert.deepEqual(payEvidence("Salary\n£35,000 dependent on experience\n£500 equipment budget\n£1,000 dependent on learning needs").quotes, ["Salary\n£35,000 dependent on experience"]);
});
