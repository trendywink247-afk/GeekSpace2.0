import express from 'express';

const PORT = parseInt(process.env.PICOCLAW_PORT || '8080', 10);
const MODEL = process.env.PICOCLAW_MODEL || 'qwen2.5-coder:1.5b';
const OLLAMA_BASE_URL = (process.env.OLLAMA_BASE_URL || 'http://localhost:11434').replace(/\/+$/, '');
const OLLAMA_TIMEOUT_MS = parseInt(process.env.PICOCLAW_TIMEOUT_MS || '15000', 10);
let modelWarmed = false;

const app = express();
app.use(express.json());

// --------------- Health ---------------
app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    model: MODEL,
    uptime: process.uptime(),
    modelWarmed,
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
        keep_alive: '5m',
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

// --------------- Warmup ---------------
async function warmupModel() {
  console.log(`Warming up model ${MODEL}...`);
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const res = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: MODEL,
          prompt: 'hi',
          stream: false,
          keep_alive: '10m',
          options: { num_predict: 1 },
        }),
        signal: AbortSignal.timeout(60000),
      });
      if (res.ok) {
        modelWarmed = true;
        console.log(`Model ${MODEL} warmed up (attempt ${attempt})`);
        return;
      }
    } catch (err) {
      console.log(`Warmup attempt ${attempt}/5 failed: ${err.message}`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  console.warn('Model warmup failed after 5 attempts — first request may be slow');
}

// Keep model loaded by pinging every 4 minutes (Ollama default unload is 5 min)
setInterval(async () => {
  try {
    await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, prompt: '', stream: false, keep_alive: '10m', options: { num_predict: 0 } }),
      signal: AbortSignal.timeout(5000),
    });
  } catch { /* ignore */ }
}, 4 * 60 * 1000);

// --------------- Start ----------------
app.listen(PORT, '0.0.0.0', () => {
  console.log(`PicoClaw listening on 0.0.0.0:${PORT}`);
  console.log(`  model  : ${MODEL}`);
  console.log(`  ollama : ${OLLAMA_BASE_URL}`);
  console.log(`  timeout: ${OLLAMA_TIMEOUT_MS}ms`);
  warmupModel();
});
