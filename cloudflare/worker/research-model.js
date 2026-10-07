// Provider choice is deployment configuration, never model-controlled input.
// Premium providers remain disconnected until keys AND explicit provider configuration exist.
export function researchModels(env) {
  const provider = env.RESEARCH_PROVIDER || 'cloudflare';
  const reviewer = env.RESEARCH_REVIEW_PROVIDER || 'cloudflare';
  return {
    investigator: { provider, model: env.RESEARCH_MODEL || env.AI_MODEL },
    reviewer: { provider: reviewer, model: env.RESEARCH_REVIEW_MODEL || env.AI_REVIEW_MODEL },
  };
}

export function parseModelJSON(value) {
  // Workers AI JSON mode may return a parsed object (not a text response).
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    if (JSON.stringify(value).length > 32000) throw Error('Invalid model response.');
    return value;
  }
  if (typeof value !== 'string' || value.length > 32000) throw Error('Invalid model response.');
  return JSON.parse(value.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''));
}

async function boundedJSON(response) {
  if (!response.ok || !response.body) throw Error('Model service unavailable.');
  const reader = response.body.getReader();
  const chunks = []; let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 512000) { await reader.cancel(); throw Error('Model response exceeded limit.'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder().decode(bytes));
}

export async function callResearchModel(env, config, system, input) {
  const content = JSON.stringify(input);
  if (content.length > 90000) throw Error('Research context exceeded limit.');
  const messages = [{ role: 'system', content: system }, { role: 'user', content }];
  let value, usage, finish;
  if (config.provider === 'cloudflare') {
    const r = await env.AI.run(config.model, {
      messages, max_tokens: 8192, temperature: 0.1,
      ...(config.model.includes('glm-4.7') ? { chat_template_kwargs: { enable_thinking: true } } : {}),
      response_format: { type: 'json_object' },
    });
    value = r.response || r.choices?.[0]?.message?.content;
    usage = r.usage; finish = r.choices?.[0]?.finish_reason;
  } else if (config.provider === 'openai' && env.OPENAI_API_KEY) {
    const r = await boundedJSON(await fetch('https://api.openai.com/v1/responses', {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(100000),
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + env.OPENAI_API_KEY },
      body: JSON.stringify({ model: config.model, instructions: system,
        input: content, reasoning: { effort: 'high' }, max_output_tokens: 6000,
        text: { format: { type: 'json_object' } }, store: false }),
    }));
    if (r.status !== 'completed') throw Error('Model response incomplete.');
    value = r.output?.filter(x => x.type === 'message').flatMap(x => x.content || [])
      .filter(x => x.type === 'output_text').map(x => x.text).join(''); usage = r.usage;
  } else if (config.provider === 'anthropic' && env.ANTHROPIC_API_KEY) {
    const r = await boundedJSON(await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(100000),
      headers: { 'Content-Type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: config.model, system, messages: [{ role: 'user', content }],
        max_tokens: 6000, thinking: { type: 'adaptive' }, output_config: { effort: 'high' } }),
    }));
    value = r.content?.filter(x => x.type === 'text').map(x => x.text).join('');
    usage = r.usage; finish = r.stop_reason;
  } else throw Error('Selected model provider is not connected.');
  if (['length', 'max_tokens'].includes(finish)) throw Error('Model response incomplete.');
  // Record usage and the structured decision, never private chain of thought.
  return { value: parseModelJSON(value), usage: usage || null };
}
