import { http, HttpResponse } from 'msw';
import crypto from 'crypto';

export const TEST_RAZORPAY_KEY_SECRET = 'rzp_test_secret_for_tests';

/**
 * Build a Razorpay-signed webhook payload for use in tests.
 */
export function buildRazorpayWebhookPayload(
  eventType: string,
  data: Record<string, unknown>,
  secret = TEST_RAZORPAY_KEY_SECRET,
): { body: string; signature: string } {
  const event = {
    entity: 'event',
    event: eventType,
    payload: { payment: { entity: data } },
    created_at: Math.floor(Date.now() / 1000),
  };
  const body = JSON.stringify(event);
  const signature = crypto.createHmac('sha256', secret).update(body).digest('hex');
  return { body, signature };
}

/**
 * Build a valid Razorpay order payment signature for client-side verification tests.
 */
export function buildRazorpayOrderSignature(
  orderId: string,
  paymentId: string,
  secret = TEST_RAZORPAY_KEY_SECRET,
): string {
  return crypto
    .createHmac('sha256', secret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
}

export const razorpayHandlers = [
  http.post('https://api.razorpay.com/v1/orders', () => {
    return HttpResponse.json({
      id: `order_test_${crypto.randomBytes(8).toString('hex')}`,
      entity: 'order',
      amount: 50000,
      currency: 'INR',
      status: 'created',
    });
  }),
];
