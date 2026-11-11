import test from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyFinancialInputs, evaluateFinancialScenario, financialScenarioSummary, appendFinancialSummary,
} from '../shared/founder-finances.js';

const complete = overrides => ({
  openingCash: '1000', startupPayments: '100', monthlyReceipts: '200', monthlyPayments: '300',
  months: '3', receiptsReduction: '25', paymentsIncrease: '20', receiptDelay: '1', evidenceNote: '',
  ...overrides,
});
function evaluate(overrides) {
  const result = evaluateFinancialScenario(complete(overrides));
  assert.equal(result.ok, true, JSON.stringify(result));
  return result;
}
function rejected(input, field) {
  const result = evaluateFinancialScenario(input);
  assert.equal(result.ok, false);
  assert.equal(typeof result.errors[field], 'string');
  return result;
}

test('empty inputs require explicit values and do not turn missing assumptions into zero', () => {
  const first = emptyFinancialInputs(), second = emptyFinancialInputs();
  assert.notEqual(first, second);
  assert.deepEqual(first, {
    openingCash: '', startupPayments: '', monthlyReceipts: '', monthlyPayments: '', months: '12',
    receiptsReduction: '', paymentsIncrease: '', receiptDelay: '', evidenceNote: '',
  });
  const result = evaluateFinancialScenario(first);
  assert.equal(result.ok, false);
  assert.deepEqual(result.missing, ['openingCash', 'startupPayments', 'monthlyReceipts', 'monthlyPayments', 'receiptsReduction', 'paymentsIncrease', 'receiptDelay']);
  assert.deepEqual(result.errors, {});
  assert.equal(Object.hasOwn(result, 'base'), false);
  assert.throws(() => financialScenarioSummary(first), /Complete and correct/);
  const omitted = complete(); delete omitted.months;
  assert.deepEqual(evaluateFinancialScenario(omitted).missing, ['months']);
  assert.deepEqual(evaluateFinancialScenario(complete({monthlyPayments:'   '})).missing, ['monthlyPayments']);
});

test('hand-calculated base and delayed downside retain every month including startup month', () => {
  const result = evaluate();
  assert.equal(result.currency, 'GBP');
  assert.deepEqual(result.base.rows, [
    {month:0, receipts:0, payments:10000, balance:90000},
    {month:1, receipts:20000, payments:30000, balance:80000},
    {month:2, receipts:20000, payments:30000, balance:70000},
    {month:3, receipts:20000, payments:30000, balance:60000},
  ]);
  assert.deepEqual(result.downside.rows, [
    {month:0, receipts:0, payments:10000, balance:90000},
    {month:1, receipts:0, payments:36000, balance:54000},
    {month:2, receipts:15000, payments:36000, balance:33000},
    {month:3, receipts:15000, payments:36000, balance:12000},
  ]);
  assert.deepEqual([result.base.minimum_balance,result.base.closing_balance,result.base.first_negative_month,result.base.first_zero_month], [60000,60000,null,null]);
  assert.deepEqual([result.downside.minimum_balance,result.downside.closing_balance,result.downside.first_negative_month,result.downside.first_zero_month], [12000,12000,null,null]);
});

test('explicit zero assumptions produce real zero balances and zero adjustments match the base', () => {
  const zero = evaluate({openingCash:'0',startupPayments:'0',monthlyReceipts:'0',monthlyPayments:'0',months:'1',receiptsReduction:'0',paymentsIncrease:'0',receiptDelay:'0'});
  assert.deepEqual(zero.base, zero.downside);
  assert.equal(zero.base.first_zero_month, 0);
  assert.equal(zero.base.first_negative_month, null);
  assert.equal(zero.base.minimum_balance, 0);
  assert.equal(zero.base.closing_balance, 0);
  assert.equal(zero.base.rows.length, 2);
  const unchanged = evaluate({receiptsReduction:'0',paymentsIncrease:'0',receiptDelay:'0'});
  assert.deepEqual(unchanged.base, unchanged.downside);
});

test('negative startup balance remains visible even after later recovery', () => {
  const {base,downside} = evaluate({openingCash:'10',startupPayments:'20',monthlyReceipts:'20',monthlyPayments:'5',months:'2',receiptsReduction:'0',paymentsIncrease:'0',receiptDelay:'0'});
  assert.deepEqual(base, downside);
  assert.deepEqual(base.rows.map(row=>row.balance), [-1000,500,2000]);
  assert.equal(base.first_negative_month,0);
  assert.equal(base.first_zero_month,null);
  assert.equal(base.minimum_balance,-1000);
  assert.equal(base.closing_balance,2000);
});

test('exact zero and negative crossings are distinct, including setup exhausting cash', () => {
  const result = evaluate({openingCash:'30',startupPayments:'10',monthlyReceipts:'0',monthlyPayments:'10',months:'3',receiptsReduction:'0',paymentsIncrease:'0',receiptDelay:'0'});
  assert.deepEqual(result.base.rows.map(row=>row.balance),[2000,1000,0,-1000]);
  assert.equal(result.base.first_zero_month,2);
  assert.equal(result.base.first_negative_month,3);
  const setup = evaluate({openingCash:'10',startupPayments:'10',monthlyReceipts:'0',monthlyPayments:'1',months:'1'});
  assert.equal(setup.base.first_zero_month,0);
  assert.equal(setup.base.first_negative_month,1);
  const skippedZero = evaluate({openingCash:'1',startupPayments:'0',monthlyReceipts:'0',monthlyPayments:'2',months:'1'});
  assert.equal(skippedZero.base.first_zero_month,null);
  assert.equal(skippedZero.base.first_negative_month,1);
});

test('delay suppresses receipts without catch-up and can cover the complete horizon', () => {
  const delayed = evaluate({openingCash:'100',startupPayments:'0',monthlyReceipts:'10',monthlyPayments:'1',months:'3',receiptsReduction:'0',paymentsIncrease:'0',receiptDelay:'2'});
  assert.deepEqual(delayed.downside.rows.map(row=>row.receipts),[0,0,0,1000]);
  assert.deepEqual(delayed.downside.rows.map(row=>row.balance),[10000,9900,9800,10700]);
  assert.equal(delayed.downside.minimum_balance,9800);
  assert.equal(delayed.downside.closing_balance,10700);
  const full = evaluate({openingCash:'100',startupPayments:'0',monthlyReceipts:'10',monthlyPayments:'1',months:'3',receiptDelay:'3',paymentsIncrease:'0'});
  assert.deepEqual(full.downside.rows.map(row=>row.receipts),[0,0,0,0]);
  assert.equal(full.downside.closing_balance,9700);
  const none = evaluate({receiptsReduction:'100',receiptDelay:'0'});
  assert.equal(none.downside.rows.every(row=>row.receipts===0),true);
});

test('half-penny adjustments round half-up once per monthly amount without binary float drift', () => {
  const result = evaluate({openingCash:'0',startupPayments:'0',monthlyReceipts:'0.01',monthlyPayments:'0.01',months:'3',receiptsReduction:'50',paymentsIncrease:'50',receiptDelay:'0'});
  assert.deepEqual(result.downside.rows.slice(1),[
    {month:1,receipts:1,payments:2,balance:-1},
    {month:2,receipts:1,payments:2,balance:-2},
    {month:3,receipts:1,payments:2,balance:-3},
  ]);
  const lower = evaluate({monthlyReceipts:'0.01',monthlyPayments:'0.01',receiptsReduction:'50.01',paymentsIncrease:'49.99',receiptDelay:'0'});
  assert.equal(lower.downside.rows[1].receipts,0);
  assert.equal(lower.downside.rows[1].payments,1);
  const pennies = evaluate({monthlyReceipts:'1.05',monthlyPayments:'0',receiptsReduction:'10',paymentsIncrease:'0',receiptDelay:'0'});
  assert.equal(pennies.downside.rows[1].receipts,95);
});

test('maximum inputs stay exact safe integer pence across 36 months', () => {
  const result = evaluate({openingCash:'1000000000',startupPayments:'1000000000',monthlyReceipts:'1000000000',monthlyPayments:'1000000000',months:'36',receiptsReduction:'100',paymentsIncrease:'200',receiptDelay:'36'});
  assert.equal(result.base.rows.length,37);
  assert.equal(result.base.closing_balance,0);
  assert.equal(result.downside.closing_balance,-10_800_000_000_000);
  assert.equal(result.downside.minimum_balance,-10_800_000_000_000);
  assert.equal(result.downside.first_zero_month,0);
  assert.equal(result.downside.first_negative_month,1);
  assert.equal(evaluate({openingCash:'0',startupPayments:'1000000000',monthlyReceipts:'0',monthlyPayments:'1000000000',months:'36',paymentsIncrease:'200',receiptDelay:'36'}).downside.closing_balance,-10_900_000_000_000);
  assert.equal(evaluate({openingCash:'1000000000',startupPayments:'0',monthlyReceipts:'1000000000',monthlyPayments:'0',months:'36',receiptsReduction:'0',paymentsIncrease:'0',receiptDelay:'0'}).base.closing_balance,3_700_000_000_000);
  for(const path of [result.base,result.downside]) for(const row of path.rows) {
    for(const amount of Object.values(row)) assert.equal(Number.isSafeInteger(amount),true);
  }
});

test('canonical values are copies, while input precision and explicit declarations are retained', () => {
  const input = Object.freeze(complete({openingCash:' 001.2 ',months:'03',receiptsReduction:'01.20',receiptDelay:'01',evidenceNote:'  Unchecked invoice estimate  '}));
  const result = evaluateFinancialScenario(input);
  assert.equal(result.ok,true);
  assert.notEqual(result.inputs,input);
  assert.deepEqual(result.inputs,complete({openingCash:'1.20',startupPayments:'100.00',monthlyReceipts:'200.00',monthlyPayments:'300.00',months:'3',receiptsReduction:'1.20',paymentsIncrease:'20.00',receiptDelay:'1',evidenceNote:'  Unchecked invoice estimate  '}));
  assert.equal(input.openingCash,' 001.2 ');
  const nullObject = Object.assign(Object.create(null),complete());
  assert.equal(evaluateFinancialScenario(nullObject).ok,true);
  const noNote = complete(); delete noNote.evidenceNote;
  assert.equal(evaluateFinancialScenario(noNote).inputs.evidenceNote,'');
});

test('invalid decimal notation, unsafe types and every numeric bound are rejected', () => {
  for(const value of [1,0,NaN,Infinity,null,undefined,false,{},[],1n,'-1','+1','.5','1.','1e3','1,000','1.001','1000000000.01','1'.repeat(33),'1\n']) {
    rejected(complete({openingCash:value}),'openingCash');
  }
  for(const [field,values] of Object.entries({months:['0','37','1.0','-1'],receiptDelay:['-1','4','37','0.5'],receiptsReduction:['100.01','-0.01','0.001'],paymentsIncrease:['200.01','-1','1.111']})) {
    for(const value of values) rejected(complete({[field]:value}),field);
  }
});

test('only known plain data inputs are read; accessors, inherited data and control characters fail', () => {
  for(const input of [null,undefined,[],new Date(),()=>{},'text',4,Object.create(complete()),{...complete(),unexpected:'x'},JSON.parse('{"__proto__":{}}')]) rejected(input,'_input');
  let accessed = false;
  const getter = complete(); Object.defineProperty(getter,'openingCash',{get(){accessed=true;throw Error('must not run');}});
  rejected(getter,'_input'); assert.equal(accessed,false);
  const symbolic = complete(); symbolic[Symbol('extra')]='x'; rejected(symbolic,'_input');
  const hidden = complete(); Object.defineProperty(hidden,'extra',{value:'x'}); rejected(hidden,'_input');
  for(const value of ['note\nnext','note\tmore','note\u0000','note\u007f','note\u0085','note\u2028','note\u2029','note\u202e','note\u2066',null,undefined,3,{},'x'.repeat(601)]) rejected(complete({evidenceNote:value}),'evidenceNote');
  assert.equal(evaluate( {evidenceNote:'x'.repeat(600)}).inputs.evidenceNote.length,600);
});

test('summary identifies generated date, complete assumptions, method, crossings and unverified note', () => {
  const now = Date.parse('2026-11-11T18:00:00Z');
  const summary = financialScenarioSummary(complete({evidenceNote:'Supplier quote not yet confirmed.'}),now);
  for(const content of [
    'Generated: 2026-11-11T18:00:00.000Z','not an evidence observation','Self-declared assumptions; not checked evidence or a forecast',
    'Opening cash: £1,000.00; startup payments at month 0: £100.00','Monthly receipts: £200.00; monthly payments: £300.00; horizon: 3 months',
    'receipts reduced by 25.00%','payments increased by 20.00%','delayed for 1 month.','Base: end £600.00; minimum £600.00','Downside: end £120.00; minimum £120.00',
    'first negative none in months 0–3; first zero none in months 0–3','no catch-up','half-up','intramonth','No automatic calculation of omitted costs, interest, growth, tax or future funding',
    'no profitability, viability, visa eligibility or funding outcome','Evidence / uncertainty note (self-declared): Supplier quote not yet confirmed.',
  ]) assert.ok(summary.includes(content),content);
  const crossing = financialScenarioSummary(complete({openingCash:'0',startupPayments:'0',monthlyReceipts:'0',monthlyPayments:'1',months:'1'}),now);
  assert.match(crossing,/first negative month 1; first zero month 0/);
  assert.match(crossing,/Evidence \/ uncertainty note \(self-declared\): Not provided\./);
  assert.match(crossing,/end -£1\.00/);
});

test('summary remains bounded with maximal amounts and a 600-character note; invalid generation dates fail', () => {
  const summary = financialScenarioSummary(complete({openingCash:'1000000000',startupPayments:'1000000000',monthlyReceipts:'1000000000',monthlyPayments:'1000000000',months:'36',receiptsReduction:'100',paymentsIncrease:'200',receiptDelay:'36',evidenceNote:'e'.repeat(600)}),0);
  assert.ok(summary.length <=2500,summary.length);
  assert.ok(summary.endsWith('e'.repeat(600)));
  assert.match(summary,/Generated: 1970-01-01T00:00:00\.000Z/);
  assert.match(summary,/-£108,000,000,000\.00/);
  for(const now of [NaN,Infinity,-Infinity,'2026-11-11',new Date(),null,0.5,8_640_000_000_000_001]) assert.throws(()=>financialScenarioSummary(complete(),now),/timestamp/);
});

test('appending preserves exact original text and fails without truncation above 4000 characters', () => {
  const original = '  Existing notes\r\n\nBudget draft\tkept.  ';
  const summary = financialScenarioSummary(complete(),0);
  assert.equal(appendFinancialSummary(original,summary),`${original}\n\n${summary}`);
  assert.equal(appendFinancialSummary('',summary),summary);
  assert.equal(original,'  Existing notes\r\n\nBudget draft\tkept.  ');
  assert.equal(appendFinancialSummary('a'.repeat(3997),'b').length,4000);
  assert.throws(()=>appendFinancialSummary('a'.repeat(3998),'b'),/4,000/);
  assert.throws(()=>appendFinancialSummary('a'.repeat(4001),'b'),/4,000/);
  for(const [note,text] of [[null,summary],[{},summary],['notes',undefined],['notes',''],['notes','  '],['notes\u0000',summary],['notes','x\u202e']]) assert.throws(()=>appendFinancialSummary(note,text),/text notes/);
});

test('re-appending the exact summary is idempotent but fragments are not treated as saved summaries', () => {
  const summary = financialScenarioSummary(complete(),0);
  for(const existing of [summary,`Earlier notes\n\n${summary}`,`${summary}\n\nLater notes`,`Before\n\n${summary}\n\nAfter`]) {
    assert.equal(appendFinancialSummary(existing,summary),existing);
  }
  const prefix = summary.slice(0,100);
  assert.equal(appendFinancialSummary(summary,prefix),`${summary}\n\n${prefix}`);
  const alreadyAtLimit = `${'a'.repeat(4000-summary.length-2)}\n\n${summary}`;
  assert.equal(appendFinancialSummary(alreadyAtLimit,summary),alreadyAtLimit);
  assert.throws(()=>appendFinancialSummary('a'.repeat(4001),'a'.repeat(4001)),/4,000/);
});
