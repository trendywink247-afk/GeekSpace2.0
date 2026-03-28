// ============================================================
// Contact Router Unit Tests (ES Module Compatible)
// Tests for human-to-human contact system
// ============================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock config
vi.mock('../../src/config', async () => {
  return {
    config: {
      telegramBotToken: 'test-bot-token',
      whatsappToken: 'test-whatsapp-token',
      whatsappBusinessId: 'test-business-id',
      publicUrl: 'https://test.geekspace.app',
      isTestMode: true,
    },
  };
});

// Mock logger
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

// Mock db with spy functions
const mockDbQueries: Record<string, unknown[]> = {};

vi.mock('../../src/db/index', () => ({
  db: {
    prepare: (sql: string) => ({
      run: vi.fn((...params: unknown[]) => {
        const key = sql.slice(0, 50);
        if (!mockDbQueries[key]) mockDbQueries[key] = [];
        mockDbQueries[key].push(params);
        return { changes: 1, lastInsertRowid: 1 };
      }),
      get: vi.fn((...params: unknown[]) => {
        // Return mock data based on query type
        if (sql.includes('channel_links')) {
          return { external_id: '123456789' };
        }
        if (sql.includes('user_contact_preferences')) {
          return {
            availability_mode: 'auto_reply_on',
            share_availability_level: 'preferences_only',
            default_response_template: 'I\'m busy',
            working_hours_start: 9,
            working_hours_end: 18,
            quiet_hours_start: null,
            quiet_hours_end: null,
          };
        }
        if (sql.includes('contact_requests')) {
          return {
            id: 'req-1',
            from_user_id: 'user-x',
            from_name: 'User X',
            to_user_id: 'user-y',
            status: 'pending',
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
const contactRouter = await import('../../src/services/contactRouter');

describe('Contact Router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockDbQueries).forEach(k => delete mockDbQueries[k]);
  });

  describe('Channel Status Detection', () => {
    it('detects Telegram channel', async () => {
      const status = await contactRouter.getUserChannelStatus('user-y');
      expect(status.telegram).toBe(true);
      expect(status.preferred).toBe('telegram');
    });
  });

  describe('Availability Response', () => {
    it('returns response based on preferences', async () => {
      const response = await contactRouter.getAvailabilityResponse('user-y');
      expect(response).toBeDefined();
      expect(typeof response).toBe('string');
    });
  });

  describe('Telegram Notification', () => {
    it('sends notification via Telegram API', async () => {
      (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ok: true }),
      });

      const request = {
        id: 'req-1',
        fromUserId: 'user-x',
        fromName: 'User X',
        fromPhone: null,
        fromEmail: null,
        toUserId: 'user-y',
        source: 'explore' as const,
        intention: 'Collaboration',
        initialMessage: 'Want to work together',
        status: 'pending' as const,
        channelNotified: 'none' as const,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      };

      const result = await contactRouter.notifyUserOfContactRequest(request);

      expect(global.fetch).toHaveBeenCalled();
      const fetchCall = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(fetchCall[0]).toContain('api.telegram.org');
    });

    it('handles API errors gracefully', async () => {
      (global.fetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Network error')
      );

      const request = {
        id: 'req-2',
        fromUserId: null,
        fromName: 'Guest User',
        fromPhone: '+1234567890',
        fromEmail: null,
        toUserId: 'user-y',
        source: 'portfolio' as const,
        intention: 'Question',
        initialMessage: null,
        status: 'pending' as const,
        channelNotified: 'none' as const,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      };

      const result = await contactRouter.notifyUserOfContactRequest(request);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Accept/Decline Flow', () => {
    it('accepts request and creates conversation', async () => {
      const result = await contactRouter.handleAcceptRequest('req-1', 'user-y');
      
      expect(result.success).toBe(true);
      expect(result.conversationId).toBeDefined();
    });

    it('declines request successfully', async () => {
      const result = await contactRouter.handleDeclineRequest('req-1', 'user-y');
      
      expect(result.success).toBe(true);
    });
  });

  describe('Quiet Hours', () => {
    it('returns false when no quiet hours set', () => {
      const result = contactRouter.isInQuietHours('user-y');
      expect(result).toBe(false);
    });
  });
});
