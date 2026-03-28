// ============================================================
// LLM Span Instrumentation — custom OTel spans for LLM tier calls
// Safe to call even when OpenTelemetry is not enabled (no-op).
// ============================================================

import { trace, type Span, SpanStatusCode } from '@opentelemetry/api';

const TRACER_NAME = 'agentin-api.llm';

/**
 * Start a custom span for an LLM tier call.
 *
 * Returns a Span that MUST be ended via {@link endLLMSpan}.
 * When OTel is disabled the returned span is a no-op span that
 * silently discards all attributes — no performance overhead.
 *
 * @param tierName  - Human-readable tier identifier (e.g. "tier-1-ollama")
 * @param model     - Model name (e.g. "hermes3:8b")
 * @param provider  - Provider identifier (e.g. "ollama", "groq")
 */
export function startLLMSpan(tierName: string, model: string, provider: string): Span {
  const tracer = trace.getTracer(TRACER_NAME);
  const span = tracer.startSpan(`llm.${tierName}`, {
    attributes: {
      'llm.tier': tierName,
      'llm.model': model,
      'llm.provider': provider,
    },
  });
  return span;
}

/**
 * End an LLM span, recording success/failure and optional token count.
 *
 * @param span       - The span returned by {@link startLLMSpan}
 * @param success    - Whether the LLM call succeeded
 * @param tokenCount - Optional total token count (input + output)
 */
export function endLLMSpan(span: Span, success: boolean, tokenCount?: number): void {
  span.setAttribute('llm.success', success);
  if (tokenCount !== undefined) {
    span.setAttribute('llm.token_count', tokenCount);
  }
  span.setStatus(
    success
      ? { code: SpanStatusCode.OK }
      : { code: SpanStatusCode.ERROR, message: 'LLM call failed' },
  );
  span.end();
}
