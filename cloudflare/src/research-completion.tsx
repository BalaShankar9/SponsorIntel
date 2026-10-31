import React from 'react';
import {researchCompletion} from '../shared/research-completion.js';

export function ResearchCompletionNote({value}:{value:unknown}) {
  const receipt = researchCompletion(value);
  if (!receipt) return <p className="fine-print">Provider completion details were not recorded for this failure. Its cause has not been reconstructed.</p>;
  const stages = {
    incomplete_response:'The provider reported an incomplete response. No result was accepted.',
    invalid_json:'A response was received, but its JSON could not be read.',
    invalid_response:'A response was received, but its content did not meet the response format or size limits.',
    contract_validation:'The response was read, but the step’s evidence or structure checks rejected it.',
    retention_unconfirmed:'The response passed the step checks, but saving its result could not be confirmed.',
  };
  const counters = receipt.usage;
  return <div className="fine-print">
    <p>{stages[receipt.failure_stage]} Completion reason: <strong>{receipt.finish_reason.replaceAll('_',' ')}</strong>. Response form: {receipt.response_kind}.</p>
    <p>{counters ? <>Provider-reported tokens: {counters.prompt_tokens !== undefined && <>input {counters.prompt_tokens.toLocaleString('en-GB')} · </>}{counters.completion_tokens !== undefined && <>output {counters.completion_tokens.toLocaleString('en-GB')} · </>}{counters.total_tokens !== undefined && <>total {counters.total_tokens.toLocaleString('en-GB')} · </>}these are counters, not a billing receipt.</> : 'Token usage was not reported in the supported fields.'}</p>
    <p>This record does not authorize a retry or higher limits. The failed attempt and its reservation remain retained.</p>
  </div>;
}
