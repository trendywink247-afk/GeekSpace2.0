import { http, passthrough } from 'msw';
import { setupServer } from 'msw/node';
import { groqHandlers } from './handlers/groq.js';
import { openrouterHandlers } from './handlers/openrouter.js';
import { stripeHandlers } from './handlers/stripe.js';
import { razorpayHandlers } from './handlers/razorpay.js';
import { googleHandlers } from './handlers/google.js';
import { githubHandlers } from './handlers/github.js';

// Let Supertest traffic to the local Express server pass through.
// Supertest binds on a dynamic port, so we match by regex on the host.
const localPassthroughHandlers = [
  http.all(/http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//, () => passthrough()),
];

export const defaultHandlers = [
  ...localPassthroughHandlers,
  ...groqHandlers,
  ...openrouterHandlers,
  ...stripeHandlers,
  ...razorpayHandlers,
  ...googleHandlers,
  ...githubHandlers,
];

export const server = setupServer(...defaultHandlers);
