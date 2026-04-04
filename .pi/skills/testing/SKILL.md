# Testing Skill — Vitest + Playwright + TEST_MODE

## Testing Stack
- **Vitest** for unit/integration tests (frontend + backend)
- **Playwright** for E2E testing across browsers
- **Testing Library React** for component testing
- **Supertest** for API endpoint testing
- **TEST_MODE** environment flag for mocking external services

## Frontend Testing

### Unit Tests (Vitest)
```bash
npm run test              # Run all tests
npm run test:watch        # Watch mode  
npm run test:coverage     # Generate coverage report
```

### Component Testing Pattern
```typescript
// src/components/__tests__/Button.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Button } from '../Button';

describe('Button', () => {
  it('renders with correct text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button')).toHaveTextContent('Click me');
  });
});
```

### E2E Tests (Playwright)
```bash
npm run e2e               # Run E2E tests
npm run e2e:report        # View test report
```

## Backend Testing

### API Tests (Vitest + Supertest)
```bash
cd server
TEST_MODE=true npm test          # Run with mocked services
TEST_MODE=true npm run test:watch  # Watch mode
TEST_MODE=true npm run test:coverage  # Coverage report
```

### API Testing Pattern
```typescript
// server/src/modules/users/tests/routes.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../../app.js';
import { createTestUser, getAuthToken } from '../../../test-utils.js';

describe('Users API', () => {
  beforeEach(() => {
    // Reset database state
  });

  it('GET /api/v1/users/profile returns user profile', async () => {
    const user = createTestUser();
    const token = getAuthToken(user.id);
    
    const response = await request(app)
      .get('/api/v1/users/profile')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
      
    expect(response.body.id).toBe(user.id);
  });
});
```

## TEST_MODE Mocking

### LLM Services
When `TEST_MODE=true`, all external LLM providers return mocked responses:
```typescript
// server/src/modules/agent/services/llm.ts
if (config.TEST_MODE) {
  return {
    success: true,
    response: 'Mocked LLM response',
    provider: 'test-mock',
    tokensUsed: 50
  };
}
```

### External APIs
- **Stripe/Razorpay**: Mocked payment processing
- **Gmail/Calendar**: Mocked Google API responses  
- **Telegram**: Mocked bot messaging
- **File uploads**: In-memory storage
- **Redis**: In-memory cache

### Database
- Tests use isolated SQLite database (`:memory:` or temp file)
- Automatic rollback between tests
- Seeded with predictable test data

## CI/CD Testing Pipeline

### Required Tests (must pass)
```bash
# Frontend
npx tsc -b --noEmit      # TypeScript compilation
npm run test             # Vitest unit tests
npm run build            # Production build

# Backend  
cd server && npx tsc --noEmit  # TypeScript compilation
cd server && TEST_MODE=true npm test  # API tests

# E2E (staging environment)
npm run e2e              # Playwright tests
```

## Test File Organization
```
tests/                   # E2E tests (Playwright)
├── auth.spec.ts
├── dashboard.spec.ts  
└── agents.spec.ts

src/                     # Frontend unit tests
├── components/__tests__/
├── hooks/__tests__/
└── utils/__tests__/

server/src/modules/      # Backend tests per module
├── auth/tests/
├── users/tests/
└── agent/tests/
```

## Coverage Requirements
- **Frontend**: >80% line coverage for critical paths
- **Backend**: >85% coverage for API endpoints  
- **E2E**: Core user journeys (auth, dashboard, agent creation)

## Debugging Failed Tests
```bash
# Frontend
npm run test -- --reporter=verbose --run  # Detailed output

# Backend with debugging
cd server
DEBUG=app:* TEST_MODE=true npm test      # Debug logs

# E2E with trace
npm run e2e -- --trace on               # Full browser trace
npx playwright show-trace test-results/   # View trace
```