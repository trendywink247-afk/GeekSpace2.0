import express from 'express';

const PORT = parseInt(process.env.PICOCLAW_PORT || '8080', 10);
const MODEL = process.env.PICOCLAW_MODEL || 'qwen2.5-coder:1.5b';
const OLLAMA_BASE_URL = (process.env.OLLAMA_BASE_URL || 'http://localhost:11434').replace(/\/+$/, '');
const OLLAMA_TIMEOUT_MS = 5000;

const app = express();
app.use(express.json());

// --------------- Health ---------------
app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    model: MODEL,
    uptime: process.uptime(),
  });
});

// --------------- Chat -----------------
app.post('/api/chat', async (req, res) => {
  const { message, system } = req.body;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'message (string) is required' });
  }

  const messages = [];
  if (system) {
    messages.push({ role: 'system', content: system });
  }
  messages.push({ role: 'user', content: message });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);

  const start = Date.now();

  try {
    const ollamaRes = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        messages,
        stream: false,
        options: {
          num_predict: 256,
          temperature: 0.3,
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!ollamaRes.ok) {
      const text = await ollamaRes.text().catch(() => '');
      return res.status(502).json({
        error: 'Ollama request failed',
        status: ollamaRes.status,
        detail: text,
      });
    }

    const data = await ollamaRes.json();
    const duration_ms = Date.now() - start;

    return res.json({
      response: data.message?.content || '',
      tokens_in: data.prompt_eval_count || 0,
      tokens_out: data.eval_count || 0,
      model: data.model || MODEL,
      duration_ms,
    });
  } catch (err) {
    clearTimeout(timer);

    if (err.name === 'AbortError') {
      return res.status(504).json({
        error: 'Ollama timeout',
        timeout_ms: OLLAMA_TIMEOUT_MS,
      });
    }

    return res.status(502).json({
      error: 'Ollama connection failed',
      detail: err.message,
    });
  }
});

// --------------- Start ----------------
app.listen(PORT, '0.0.0.0', () => {
  console.log(`PicoClaw listening on 0.0.0.0:${PORT}`);
  console.log(`  model : ${MODEL}`);
  console.log(`  ollama: ${OLLAMA_BASE_URL}`);
});
