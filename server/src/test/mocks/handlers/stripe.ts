import { http, HttpResponse } from 'msw';
import crypto from 'crypto';

export const TEST_STRIPE_WEBHOOK_SECRET = 'whsec_test_secret_for_tests_only';

/**
 * Build a Stripe-signed webhook payload for use in tests.
 * Pass the result's body and signature to your request.
 */
export function buildStripeWebhookPayload(
  eventType: string,
  data: Record<string, unknown>,
  secret = TEST_STRIPE_WEBHOOK_SECRET,
): { body: string; signature: string } {
  const timestamp = Math.floor(Date.now() / 1000);
  const event = {
    id: `evt_test_${crypto.randomBytes(8).toString('hex')}`,
    object: 'event',
    type: eventType,
    created: timestamp,
    data: { object: data },
    livemode: false,
    api_version: '2023-10-16',
  };
  const body = JSON.stringify(event);
  const signedPayload = `${timestamp}.${body}`;
  const sig = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
  const signature = `t=${timestamp},v1=${sig}`;
  return { body, signature };
}

export const stripeHandlers = [
  // Stripe public key fetch (used internally by stripe SDK setup checks)
  http.get('https://api.stripe.com/v1/payment_methods/:id', () => {
    return HttpResponse.json({ id: 'pm_test', object: 'payment_method' });
  }),
];
