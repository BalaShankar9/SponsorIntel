import React from "react";
import { renderToString } from "react-dom/server";
import { App } from "./main";
import { CareerProvider } from "./career-data";
export { pageMeta, structuredData } from "./seo";
export function render(path: string) {
  return renderToString(
    <CareerProvider>
      <App initialPath={path} />
    </CareerProvider>,
  );
}
