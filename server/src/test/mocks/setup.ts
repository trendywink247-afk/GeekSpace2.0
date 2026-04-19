import { server } from './server.js';

beforeAll(() => {
  // 'bypass': unhandled requests fall through to the original fetch (or real network),
  // which is needed for test files that use vi.stubGlobal('fetch', mockFn) at module level —
  // MSW wraps whatever is in globalThis.fetch at server.listen() time, and bypass lets it through.
  server.listen({ onUnhandledRequest: 'bypass' });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
