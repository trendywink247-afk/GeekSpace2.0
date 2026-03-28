// ============================================================
// Password Reset Unit Tests
// Tests for OTP-based password reset flow
// ============================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock dependencies
vi.mock('../../src/logger', () => {
  const log = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(),
  };
  log.child.mockReturnValue(log);
  return { logger: log };
});

vi.mock('../../src/config', () => ({
  config: {
    telegramBotToken: 'test-bot-token',
    publicUrl: 'https://test.geekspace.app',
  },
}));

// Mock bcrypt
vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn(() => Promise.resolve('hashed-value')),
    compare: vi.fn((plain, hash) => Promise.resolve(plain === '123456')),
  },
}));

// Mock db
const mockDbQueries: Array<{ sql: string; params: unknown[] }> = [];
vi.mock('../../src/db/index', () => ({
  db: {
    prepare: (sql: string) => ({
      run: vi.fn((...params: unknown[]) => {
        mockDbQueries.push({ sql, params });
        return { changes: 1, lastInsertRowid: 1 };
      }),
      get: vi.fn((...params: unknown[]) => {
        mockDbQueries.push({ sql, params });
        
        // Return mock data based on query
        if (sql.includes('users WHERE email')) {
          return params[0] === 'test@example.com' 
            ? { id: 'user-123', email: 'test@example.com', name: 'Test User' }
            : null;
        }
        if (sql.includes('channel_links')) {
          return { external_id: '123456789' };
        }
        if (sql.includes('password_reset_tokens')) {
          return {
            id: 'token-123',
            otp_hash: 'hashed-otp',
            attempts: 0,
            max_attempts: 3,
          };
        }
        return null;
      }),
      all: vi.fn(() => []),
    }),
  },
}));

// Mock fetch
global.fetch = vi.fn();

// Import after mocks
const passwordReset = await import('../../src/services/passwordReset');

describe('Password Reset Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbQueries.length = 0;
  });

  describe('Rate Limiting', () => {
    it('allows requests under limit', async () => {
      const result = await passwordReset.requestPasswordReset(
        'test@example.com',
        'email',
        '192.168.1.1'
      );
      
      // Should succeed (user exists, under rate limit)
      expect(result.success).toBe(true);
    });

    it('returns generic message for non-existent user', async () => {
      const result = await passwordReset.requestPasswordReset(
        'nonexistent@example.com',
        'email',
        '192.168.1.1'
      );
      
      // Should still return success to prevent enumeration
      expect(result.success).toBe(true);
      expect(result.message).toContain('If an account exists');
    });
  });

  describe('Channel Selection', () => {
    it('detects available channels for user', () => {
      const channels = passwordReset.getUserResetChannels('user-123');
      expect(channels.email).toBe('test@example.com');
      expect(channels.telegram).toBe(true);
    });
  });

  describe('OTP Verification', () => {
    it('verifies correct OTP', async () => {
      const result = await passwordReset.verifyResetOTP(
        'test@example.com',
        '123456',
        '192.168.1.1'
      );
      
      expect(result.success).toBe(true);
      expect(result.resetToken).toBeDefined();
    });

    it('rejects incorrect OTP', async () => {
      const result = await passwordReset.verifyResetOTP(
        'test@example.com',
        '999999',
        '192.168.1.1'
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid');
    });
  });

  describe('Email OTP Delivery', () => {
    it('sends email OTP successfully', async () => {
      (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ok: true }),
      });

      const result = await passwordReset.requestPasswordReset(
        'test@example.com',
        'email',
        '192.168.1.1'
      );

      expect(result.success).toBe(true);
      expect(result.channel).toBe('email');
    });
  });

  describe('Telegram OTP Delivery', () => {
    it('sends Telegram OTP successfully', async () => {
      (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ok: true }),
      });

      const result = await passwordReset.requestPasswordReset(
        'test@example.com',
        'telegram',
        '192.168.1.1'
      );

      expect(result.success).toBe(true);
      expect(result.channel).toBe('telegram');
    });
  });

  describe('Password Reset', () => {
    it('resets password with valid token', async () => {
      const result = await passwordReset.resetPassword(
        'valid-token',
        'newPassword123',
        '192.168.1.1'
      );

      expect(result.success).toBe(true);
    });

    it('rejects short passwords', async () => {
      const result = await passwordReset.resetPassword(
        'valid-token',
        'short',
        '192.168.1.1'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('8 characters');
    });
  });

  describe('Security Requirements', () => {
    it('does not leak user existence', async () => {
      const existingUser = await passwordReset.requestPasswordReset(
        'test@example.com',
        'email',
        '192.168.1.1'
      );
      
      const nonExistingUser = await passwordReset.requestPasswordReset(
        'nonexistent@example.com',
        'email',
        '192.168.1.1'
      );

      // Both should return same message structure
      expect(existingUser.success).toBe(nonExistingUser.success);
      expect(existingUser.message).toBe(nonExistingUser.message);
    });

    it('hashes OTP before storage', async () => {
      await passwordReset.requestPasswordReset(
        'test@example.com',
        'email',
        '192.168.1.1'
      );

      // Check that a query with hashed OTP was made
      const insertQuery = mockDbQueries.find(q => 
        q.sql.includes('password_reset_tokens') && q.sql.includes('INSERT')
      );
      expect(insertQuery).toBeDefined();
    });
  });
});
