const FINISH_REASONS = new Set(['stop', 'length', 'max_tokens', 'tool_calls', 'content_filter', 'function_call', 'not_reported', 'unknown']);
const RESPONSE_KINDS = new Set(['text', 'object', 'missing', 'other']);
const FAILURE_STAGES = new Set(['incomplete_response', 'invalid_json', 'invalid_response', 'contract_validation', 'retention_unconfirmed']);
const TOKENS = ['prompt_tokens', 'completion_tokens', 'total_tokens'];

// Only provider counters and finite status vocabulary cross the owner API.
// This does not interpret model text, establish quality, or authorize a retry.
export function boundedResearchUsage(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const counters = Object.fromEntries(TOKENS.filter(key => Number.isSafeInteger(value[key]) && value[key] >= 0 && value[key] <= 1e9).map(key => [key, value[key]]));
  return Object.keys(counters).length ? counters : null;
}

export function researchCompletion(value) {
  if (!value || value.version !== 1 || value.provider !== 'cloudflare' || !FAILURE_STAGES.has(value.failure_stage)) return null;
  return {
    version: 1,
    provider: 'cloudflare',
    failure_stage: value.failure_stage,
    finish_reason: FINISH_REASONS.has(value.finish_reason) ? value.finish_reason : 'unknown',
    response_kind: RESPONSE_KINDS.has(value.response_kind) ? value.response_kind : 'other',
    usage: boundedResearchUsage(value.usage),
  };
}
