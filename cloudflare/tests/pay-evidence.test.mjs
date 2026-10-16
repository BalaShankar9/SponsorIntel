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
