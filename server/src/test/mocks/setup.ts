import { server } from './server.js';

beforeAll(() => {
  // 'bypass' (not 'error') so tests that supply their own fetch mock via
  // vi.stubGlobal('fetch', ...) (e.g. media-generation.test.ts) are not
  // intercepted by MSW before their mock runs.
  server.listen({ onUnhandledRequest: 'bypass' });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
