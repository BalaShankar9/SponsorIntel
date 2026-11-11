// A deterministic illustration of the user's cash assumptions, not a forecast.
const MONEY_KEYS = ['openingCash', 'startupPayments', 'monthlyReceipts', 'monthlyPayments'];
const NUMERIC_KEYS = [...MONEY_KEYS, 'months', 'receiptsReduction', 'paymentsIncrease', 'receiptDelay'];
const INPUT_KEYS = [...NUMERIC_KEYS, 'evidenceNote'];
const MAX_MONEY = 100_000_000_000n;
const INPUT_CONTROLS = /[\u0000-\u001f\u007f-\u009f\u2028-\u202e\u2066-\u2069]/;
const NOTE_CONTROLS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/;

export function emptyFinancialInputs() {
  return {
    openingCash: '', startupPayments: '', monthlyReceipts: '', monthlyPayments: '',
    months: '12', receiptsReduction: '', paymentsIncrease: '', receiptDelay: '', evidenceNote: '',
  };
}

function hundredths(text) {
  const [whole, fraction = ''] = text.split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
}

function decimal(value) {
  return `${value / 100n}.${String(value % 100n).padStart(2, '0')}`;
}

function validate(input) {
  const missing = [], errors = {}, canonical = emptyFinancialInputs(), values = {};
  let descriptors;
  try {
    if (!input || typeof input !== 'object' || Array.isArray(input)
      || ![Object.prototype, null].includes(Object.getPrototypeOf(input))) {
      return {ok: false, missing, errors: {_input: 'Use a plain object of named text inputs.'}};
    }
    descriptors = Object.getOwnPropertyDescriptors(input);
    if (Reflect.ownKeys(descriptors).some(key => typeof key !== 'string' || !INPUT_KEYS.includes(key))
      || Object.values(descriptors).some(descriptor => !Object.hasOwn(descriptor, 'value'))) {
      return {ok: false, missing, errors: {_input: 'Only the named data inputs are supported.'}};
    }
  } catch {
    return {ok: false, missing, errors: {_input: 'The input object could not be read safely.'}};
  }

  for (const key of NUMERIC_KEYS) {
    if (!Object.hasOwn(descriptors, key)) { missing.push(key); continue; }
    const raw = descriptors[key].value;
    if (typeof raw !== 'string' || raw.length > 32 || INPUT_CONTROLS.test(raw)) {
      errors[key] = 'Enter a short number as text, without control characters.';
      continue;
    }
    const text = raw.trim();
    if (!text) { missing.push(key); continue; }
    const integer = key === 'months' || key === 'receiptDelay';
    if (!(integer ? /^\d+$/ : /^\d+(?:\.\d{1,2})?$/).test(text)) {
      errors[key] = integer ? 'Enter a whole number.' : 'Enter a non-negative decimal with at most two decimal places.';
      continue;
    }
    const value = integer ? BigInt(text) : hundredths(text);
    const minimum = key === 'months' ? 1n : 0n;
    const maximum = MONEY_KEYS.includes(key) ? MAX_MONEY
      : key === 'receiptsReduction' ? 10_000n : key === 'paymentsIncrease' ? 20_000n : 36n;
    if (value < minimum || value > maximum) {
      errors[key] = MONEY_KEYS.includes(key) ? 'Enter an amount from 0 to 1,000,000,000 GBP.'
        : key === 'receiptsReduction' ? 'Enter a reduction from 0 to 100 percent.'
          : key === 'paymentsIncrease' ? 'Enter an increase from 0 to 200 percent.'
            : key === 'months' ? 'Enter a horizon from 1 to 36 months.' : 'Enter a delay from 0 to the selected number of months.';
      continue;
    }
    values[key] = value;
    canonical[key] = integer ? String(value) : decimal(value);
  }
  if (values.receiptDelay !== undefined && values.months !== undefined && values.receiptDelay > values.months) {
    errors.receiptDelay = 'The receipt delay cannot exceed the selected number of months.';
  }
  const evidenceNote = Object.hasOwn(descriptors, 'evidenceNote') ? descriptors.evidenceNote.value : '';
  if (typeof evidenceNote !== 'string' || evidenceNote.length > 600 || INPUT_CONTROLS.test(evidenceNote)) {
    errors.evidenceNote = 'Use a single-line evidence note of at most 600 characters, without control characters.';
  } else canonical.evidenceNote = evidenceNote;
  return missing.length || Object.keys(errors).length ? {ok: false, missing, errors} : {ok: true, canonical, values};
}

function scenario(values, receipts, payments, delay) {
  let balance = values.openingCash - values.startupPayments;
  const rows = [{month: 0, receipts: 0, payments: Number(values.startupPayments), balance: Number(balance)}];
  for (let month = 1; month <= Number(values.months); month++) {
    const received = month <= delay ? 0n : receipts;
    balance += received - payments;
    rows.push({month, receipts: Number(received), payments: Number(payments), balance: Number(balance)});
  }
  return {
    rows,
    first_negative_month: rows.find(row => row.balance < 0)?.month ?? null,
    first_zero_month: rows.find(row => row.balance === 0)?.month ?? null,
    minimum_balance: Math.min(...rows.map(row => row.balance)),
    closing_balance: Number(balance),
  };
}

export function evaluateFinancialScenario(input) {
  const checked = validate(input);
  if (!checked.ok) return checked;
  const {values} = checked;
  // All adjustments use integer arithmetic and round the adjusted amount half-up once.
  const downsideReceipts = (values.monthlyReceipts * (10_000n - values.receiptsReduction) + 5_000n) / 10_000n;
  const downsidePayments = (values.monthlyPayments * (10_000n + values.paymentsIncrease) + 5_000n) / 10_000n;
  return {
    ok: true, inputs: checked.canonical, currency: 'GBP',
    base: scenario(values, values.monthlyReceipts, values.monthlyPayments, 0),
    downside: scenario(values, downsideReceipts, downsidePayments, Number(values.receiptDelay)),
  };
}

function money(pence) {
  const value = BigInt(pence), absolute = value < 0n ? -value : value;
  const whole = String(absolute / 100n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${value < 0n ? '-' : ''}£${whole}.${String(absolute % 100n).padStart(2, '0')}`;
}

function firstMonth(month, horizon) {
  return month === null ? `none in months 0–${horizon}` : `month ${month}`;
}

function duration(months) {
  return `${months} month${months === '1' ? '' : 's'}`;
}

export function financialScenarioSummary(input, now = Date.now()) {
  const result = evaluateFinancialScenario(input);
  if (!result.ok) throw new TypeError('Complete and correct the financial inputs before preparing a summary.');
  if (typeof now !== 'number' || !Number.isSafeInteger(now) || !Number.isFinite(new Date(now).getTime())) {
    throw new TypeError('Use a valid generation timestamp in milliseconds.');
  }
  const assumptions = result.inputs;
  const summary = [
    'SPONSOR INTEL — CASH SCENARIO',
    `Generated: ${new Date(now).toISOString()}. This is a calculation date, not an evidence observation.`,
    'Self-declared assumptions; not checked evidence or a forecast. Currency: GBP.',
    `Opening cash: ${money(hundredths(assumptions.openingCash))}; startup payments at month 0: ${money(hundredths(assumptions.startupPayments))}.`,
    `Monthly receipts: ${money(hundredths(assumptions.monthlyReceipts))}; monthly payments: ${money(hundredths(assumptions.monthlyPayments))}; horizon: ${duration(assumptions.months)}.`,
    `Downside: receipts reduced by ${assumptions.receiptsReduction}%; monthly payments increased by ${assumptions.paymentsIncrease}%; receipts delayed for ${duration(assumptions.receiptDelay)}.`,
    ...[['Base', result.base], ['Downside', result.downside]].map(([label, path]) =>
      `${label}: end ${money(path.closing_balance)}; minimum ${money(path.minimum_balance)}; first negative ${firstMonth(path.first_negative_month, assumptions.months)}; first zero ${firstMonth(path.first_zero_month, assumptions.months)}.`),
    'Method: month 0 is opening cash less startup payments. Base monthly amounts stay constant. Downside startup payments are unchanged; the same increased payment applies every month. Delayed receipts are zero, then the reduced monthly amount starts, with no catch-up.',
    'Adjusted monthly amounts round once to the nearest penny, half-up. Balances use whole pence. Only month 0 and month-end balances are shown; intramonth payment timing and shortfalls are not modelled.',
    'No automatic calculation of omitted costs, interest, growth, tax or future funding. Include any amounts you need in your assumptions. This establishes no profitability, viability, visa eligibility or funding outcome.',
    `Evidence / uncertainty note (self-declared): ${assumptions.evidenceNote || 'Not provided.'}`,
  ].join('\n');
  if (summary.length > 2500) throw new RangeError('The scenario summary exceeds 2,500 characters.');
  return summary;
}

export function appendFinancialSummary(existingNote, summary) {
  if (typeof existingNote !== 'string' || typeof summary !== 'string' || !summary.trim()
    || NOTE_CONTROLS.test(existingNote) || NOTE_CONTROLS.test(summary)) {
    throw new TypeError('Use text notes and a nonempty summary without unsafe control characters.');
  }
  if (existingNote.length > 4000 || summary.length > 4000) {
    throw new RangeError('A note or summary exceeds 4,000 characters. Existing notes have not changed.');
  }
  // Match the whole saved block, never a fragment inside a longer summary.
  if (existingNote === summary || existingNote.startsWith(`${summary}\n\n`)
    || existingNote.endsWith(`\n\n${summary}`) || existingNote.includes(`\n\n${summary}\n\n`)) return existingNote;
  const combined = existingNote ? `${existingNote}\n\n${summary}` : summary;
  if (combined.length > 4000) throw new RangeError('The existing note and summary exceed 4,000 characters. Keep the original note and export the summary separately.');
  return combined;
}
