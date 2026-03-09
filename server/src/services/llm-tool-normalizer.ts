/**
 * LLM Tool Schema Normalizer
 *
 * Different LLM providers expect different formats for tool schemas.
 * This module normalizes between them so the waterfall works correctly
 * regardless of which provider is used.
 *
 * OpenAI format (Groq, Together AI, OpenRouter): { tools: [...] }
 * Gemini format: { tools: [{ functionDeclarations: [...] }] }
 */

export interface ToolSchema {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface NormalizedToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

/**
 * Convert an OpenAI-format tools array to the format expected by a provider.
 * Returns the input unchanged for OpenAI-compatible providers.
 */
export function normalizeToolsForProvider(
  tools: ToolSchema[],
  provider: string,
): unknown {
  if (provider === 'gemini') {
    // Gemini uses functionDeclarations nested inside a tools object
    return [{
      functionDeclarations: tools.map((t) => ({
        name: t.function.name,
        description: t.function.description,
        parameters: t.function.parameters,
      })),
    }];
  }
  // Groq, Together AI, OpenRouter, Edith — OpenAI tools format natively
  return tools;
}

/**
 * Extract a tool call from a provider API response into a common format.
 * Returns null if the response contains no tool call.
 */
export function normalizeToolCallResponse(
  response: unknown,
  provider: string,
): NormalizedToolCall | null {
  if (provider === 'gemini') {
    const r = response as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ functionCall?: { name: string; args: Record<string, unknown> } }>;
        };
      }>;
    };
    const call = r?.candidates?.[0]?.content?.parts?.[0]?.functionCall;
    if (!call) return null;
    return { name: call.name, arguments: call.args };
  }

  // OpenAI format (Groq, Together, OpenRouter, Edith)
  const r = response as {
    choices?: Array<{
      message?: {
        tool_calls?: Array<{
          function: { name: string; arguments: string };
        }>;
      };
    }>;
  };
  const call = r?.choices?.[0]?.message?.tool_calls?.[0];
  if (!call) return null;
  try {
    return {
      name: call.function.name,
      arguments: JSON.parse(call.function.arguments) as Record<string, unknown>,
    };
  } catch {
    return null;
  }
}
