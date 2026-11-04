export type ResearchCompletion = {
  version: 1;
  provider: 'cloudflare';
  failure_stage: 'incomplete_response' | 'invalid_json' | 'invalid_response' | 'contract_validation' | 'retention_unconfirmed';
  finish_reason: 'stop' | 'length' | 'max_tokens' | 'tool_calls' | 'content_filter' | 'function_call' | 'not_reported' | 'unknown';
  response_kind: 'text' | 'object' | 'missing' | 'other';
  usage: {prompt_tokens?: number; completion_tokens?: number; total_tokens?: number} | null;
};
export function boundedResearchUsage(value: unknown): ResearchCompletion['usage'];
export function researchCompletion(value: unknown): ResearchCompletion | null;
