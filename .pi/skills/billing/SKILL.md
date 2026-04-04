# Billing Skill — Stripe + Razorpay + Credits + Integrations

## Payment Stack
- **Stripe** for international payments (credit cards, subscriptions)
- **Razorpay** for Indian market (UPI, wallets, net banking)
- **Credits system** for usage-based billing (LLM tokens, API calls)
- **OAuth integrations** (Google, GitHub, Telegram)
- **Webhooks** for real-time payment processing
- **Rate limiting** by plan tier

## Billing Module Structure
```
server/src/modules/billing/
├── services/
│   ├── stripe.ts              # Stripe payment processing
│   ├── razorpay.ts           # Razorpay payment processing  
│   └── credit-service.ts      # Credits management + usage tracking
├── routes.ts                 # Payment endpoints + webhooks
├── types.ts                  # Payment, subscription, credit types
└── __tests__/               # Payment flow tests
```

## Credits System

### Credit Types
- **Free tier**: 1000 credits/month (resets monthly)
- **Pro tier**: 10,000 credits/month + rollover
- **Enterprise**: Unlimited credits
- **Pay-per-use**: $0.01/credit for free users exceeding quota

### Usage Tracking
```typescript
// Credit deduction pattern
const cost = calculateLLMCost(provider, tokensUsed);
const success = await deductCredits(userId, cost);
if (!success) {
  throw new Error('Insufficient credits');
}
```

### Credit Sources
- **Monthly allocation** based on subscription plan
- **One-time purchases** (credit packs)
- **Promotional credits** (referrals, bonuses)
- **Rollover credits** (Pro+ plans only)

## Stripe Integration

### Subscription Plans
```javascript
// server/src/modules/billing/services/stripe.ts
const PLANS = {
  free: { credits: 1000, price: 0 },
  pro: { credits: 10000, price: 1500 }, // $15/month
  enterprise: { credits: -1, price: 5000 } // $50/month, unlimited
};
```

### Webhook Handling
```typescript
// Handle subscription updates
app.post('/api/v1/billing/stripe/webhook', (req, res) => {
  const event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  
  switch (event.type) {
    case 'customer.subscription.updated':
      updateUserSubscription(event.data.object);
      break;
    case 'invoice.payment_succeeded':
      allocateCredits(event.data.object);
      break;
  }
});
```

## Razorpay Integration

### Payment Methods
- **UPI** (PhonePe, Google Pay, Paytm)
- **Net banking** (all major Indian banks)
- **Credit/debit cards**
- **Digital wallets** (Paytm, Mobikwik, etc.)

### Order Creation
```typescript
// Create Razorpay order
const order = await razorpay.orders.create({
  amount: amount * 100, // paise
  currency: 'INR',
  receipt: `credit_${userId}_${Date.now()}`
});
```

## OAuth & Integrations

### Supported Providers
```
server/src/modules/integrations/
├── services/
│   ├── google-oauth.ts       # Gmail, Calendar, Drive integration
│   ├── github-oauth.ts       # Repository access, CI/CD hooks  
│   ├── telegram-bot.ts       # Notification delivery
│   └── resend-email.ts       # Email notifications
```

### Integration Flow
1. **OAuth consent** → redirect to provider
2. **Token exchange** → store refresh tokens
3. **Permission scopes** → read calendars, send emails, etc.  
4. **Webhook setup** → real-time sync
5. **Rate limiting** → per-integration quotas

## Telegram Integration

### Bot Features
- **Payment notifications** → subscription renewals, low credits
- **Agent updates** → goal completions, task failures
- **System alerts** → downtime, maintenance windows

### Setup Commands
```bash
# Register Telegram webhook
curl -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  -d "url=https://api.agentin.chat/api/v1/integrations/telegram/webhook"
```

## Gmail Integration

### Email Automation
- **Welcome emails** → onboarding sequences
- **Billing notifications** → payment reminders, receipts
- **Weekly summaries** → agent activity reports
- **Security alerts** → login notifications

### API Limits
- **Free users**: 100 API calls/day
- **Pro users**: 1,000 API calls/day  
- **Enterprise**: 10,000 API calls/day

## Rate Limiting by Plan

### Request Limits (per minute)
```javascript
const RATE_LIMITS = {
  free: { api: 60, llm: 10, integrations: 5 },
  pro: { api: 300, llm: 50, integrations: 20 },
  enterprise: { api: 1000, llm: 200, integrations: 100 }
};
```

### Enforcement
```typescript
// Check rate limits before processing
const limits = getRateLimits(userPlan);
const usage = await getCurrentUsage(userId);
if (usage.api >= limits.api) {
  throw new Error('API rate limit exceeded');
}
```

## Testing Payment Flows
```bash
cd server
TEST_MODE=true npm test          # Mock all payment providers

# Test webhook endpoints
curl -X POST localhost:3001/api/v1/billing/stripe/webhook \
  -H "stripe-signature: test" \
  -d '{"type": "customer.subscription.updated"}'
```

## Environment Configuration
```bash
# Stripe
STRIPE_SECRET_KEY=sk_test_...    # Secret key
STRIPE_WEBHOOK_SECRET=whsec_...  # Webhook signature verification

# Razorpay  
RAZORPAY_KEY_ID=rzp_test_...     # API key
RAZORPAY_KEY_SECRET=...          # Secret key

# OAuth
GOOGLE_CLIENT_ID=...             # OAuth 2.0 credentials
GITHUB_CLIENT_ID=...             # OAuth app credentials  
TELEGRAM_BOT_TOKEN=...           # Bot API token
```