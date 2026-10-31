import test from "node:test";
import assert from "node:assert/strict";
import {
  parseCSVLine,
  csvRows,
  csvSource,
  toRecord,
  keyFor,
  idFor,
  querySpec,
  boundedText,
} from "../worker/data.js";
const stream = (chunks) =>
  new ReadableStream({
    start(c) {
      for (const x of chunks) c.enqueue(new TextEncoder().encode(x));
      c.close();
    },
  });
test("CSV keeps embedded commas and escaped quotation marks", () =>
  assert.deepEqual(
    parseCSVLine('"A, B ""Care""",London,,Worker (A rating),Skilled Worker\r'),
    ['A, B "Care"', "London", "", "Worker (A rating)", "Skilled Worker"],
  ));
test("Streaming parser handles split chunks, quotes and embedded newlines", async () => {
  const rows = [];
  for await (const row of csvRows(
    stream([
      '"A,',
      ' ""B""\nC",Lon',
      "don,,A,Skilled Worker\r\nNext,City,,A,Other\n",
    ]),
  ))
    rows.push(row);
  assert.equal(rows.length, 2);
  assert.equal(rows[0][0], 'A, "B"\nC');
  assert.equal(rows[1][0], "Next");
});
test("Malformed and oversized data fail closed", async () => {
  await assert.rejects(async () => {
    for await (const r of csvRows(stream(['"broken']))) {
    }
  }, /Malformed/);
  await assert.rejects(async () => {
    for await (const r of csvRows(stream(["longer than limit"]), 3)) {
    }
  }, /size/);
  assert.throws(() => toRecord(["bad", "schema"]), /columns/);
  assert.throws(() => toRecord(["", "", "", "A", "Route"]), /Incomplete/);
});
test("Entity ID is stable across whitespace and case changes", async () => {
  const k = keyFor(" Google (UK) Limited ", " London ", "");
  assert.equal(k, keyFor("google (UK)  Limited", "London", ""));
  assert.equal(await idFor(k), "9b5118bc5373ee74b8a6c3a2");
  assert.match(await idFor(k), /^[a-f0-9]{24}$/);
});
test("Source discovery only accepts the official dated CSV", () => {
  assert.deepEqual(
    csvSource(
      '<a href="https://assets.publishing.service.gov.uk/media/abc/register-2026-10-02.csv">',
    ),
    {
      url: "https://assets.publishing.service.gov.uk/media/abc/register-2026-10-02.csv",
      date: "2026-10-02",
    },
  );
  assert.throws(
    () => csvSource('<a href="https://evil.test/register-2026-10-02.csv">'),
    /not found/,
  );
});
test("Search inputs remain bind parameters and literal wildcards", () => {
  const spec = querySpec(
    new URLSearchParams({ q: "%' OR 1=1 --", city: "London", page: "-2" }),
  );
  assert.equal(spec.page, 1);
  assert.ok(!spec.where.includes("1=1"));
  assert.equal(spec.values[0], "%\\%' OR 1=1 --%");
  assert.equal(spec.values.at(-1), "London");
  assert.equal(querySpec(new URLSearchParams({ page: "Infinity" })).page, 1);
});
test("Fetch body bound enforced without trusting Content-Length", async () => {
  await assert.rejects(() => boundedText(new Response("123456"), 3), /size/);
  assert.equal(await boundedText(new Response("abc"), 3), "abc");
});
