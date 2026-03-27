// ============================================================
// Razorpay Payment Service — INR payments for Indian users
// Handles order creation, signature verification, webhooks
// ============================================================

import Razorpay from 'razorpay';
import crypto from 'crypto';

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || '',
  key_secret: process.env.RAZORPAY_KEY_SECRET || '',
});

export const razorpayEnabled = !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

export async function createRazorpayOrder(amountINR: number, userId: string, plan: string) {
  return await razorpay.orders.create({
    amount: amountINR * 100, // paise
    currency: 'INR',
    receipt: `agentin_${userId}_${plan}_${Date.now()}`,
    notes: { userId, plan },
  });
}

export function verifyRazorpaySignature(
  orderId: string, paymentId: string, signature: string
): boolean {
  const body = `${orderId}|${paymentId}`;
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
    .update(body).digest('hex');
  // Use timingSafeEqual for constant-time comparison
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length) return false;
  return crypto.timingSafeEqual(sigBuf, expBuf);
}
