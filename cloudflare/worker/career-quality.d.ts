export function sourceWarnings(cv?: string): string[];
export function contactFromText(text?: string): {
  name?: string;
  email?: string;
  phone?: string;
};
export function draftWarnings(
  text?: string,
  cv?: string,
  kind?: string,
): string[];

export function cleanDraft(text?: string): string;
