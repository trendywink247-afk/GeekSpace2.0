import { http, HttpResponse } from 'msw';

const GROQ_BASE = 'https://api.groq.com/openai/v1';

function chatCompletionResponse(content: string) {
  return {
    id: 'chatcmpl-test-groq',
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: 'llama-3.3-70b-versatile',
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

export const groqHandlers = [
  http.post(`${GROQ_BASE}/chat/completions`, () => {
    return HttpResponse.json(chatCompletionResponse('Mock Groq response'));
  }),
];

export const groq429Handler = http.post(`${GROQ_BASE}/chat/completions`, () => {
  return HttpResponse.json(
    { error: { message: 'Rate limit exceeded', type: 'rate_limit_error' } },
    { status: 429 },
  );
});

export const groq500Handler = http.post(`${GROQ_BASE}/chat/completions`, () => {
  return HttpResponse.json(
    { error: { message: 'Internal server error', type: 'server_error' } },
    { status: 500 },
  );
});
