import { http, HttpResponse } from 'msw';

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

function chatCompletionResponse(content: string) {
  return {
    id: 'chatcmpl-test-openrouter',
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: 'meta-llama/llama-3.3-70b-instruct:free',
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content },
        finish_reason: 'stop',
      },
    ],
    usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
  };
}

export const openrouterHandlers = [
  http.post(`${OPENROUTER_BASE}/chat/completions`, () => {
    return HttpResponse.json(chatCompletionResponse('Mock OpenRouter response'));
  }),
];

export const openrouter429Handler = http.post(`${OPENROUTER_BASE}/chat/completions`, () => {
  return HttpResponse.json(
    { error: { message: 'Rate limit exceeded', code: 429 } },
    { status: 429 },
  );
});
