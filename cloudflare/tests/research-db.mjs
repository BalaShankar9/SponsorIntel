import { DatabaseSync } from "node:sqlite";
import { readFileSync,readdirSync } from "node:fs";
export function database(t) {
  const sql = new DatabaseSync(":memory:");
  t.after(() => sql.close());
  for (const name of readdirSync(new URL("../migrations/", import.meta.url))
    .filter((x) => x.endsWith(".sql"))
    .sort())
    sql.exec(
      readFileSync(new URL("../migrations/" + name, import.meta.url), "utf8"),
    );
  const DB = {
    prepare(query) {
      let args = [];
      return {
        bind(...a) {
          args = a;
          return this;
        },
        exec() {
          const s = sql.prepare(query);
          return s.columns().length
            ? { results: s.all(...args), success: true }
            : { ...s.run(...args), results: [], success: true };
        },
        async first() {
          return sql.prepare(query).get(...args) || null;
        },
        async all() {
          return { results: sql.prepare(query).all(...args) };
        },
        async run() {
          return this.exec();
        },
      };
    },
    async batch(statements) {
      sql.exec("BEGIN");
      try {
        const r = statements.map((s) => s.exec());
        sql.exec("COMMIT");
        return r;
      } catch (e) {
        sql.exec("ROLLBACK");
        throw e;
      }
    },
  };
  return {
    sql,
    DB,
    SOURCE_WORKFLOW: {
      async create() {
        return { id: "test" };
      },
      async get() {
        return {
          async status() {
            return { status: "running" };
          },
        };
      },
    },
  };
}
