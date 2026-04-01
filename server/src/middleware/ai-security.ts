// ============================================================
// AI Security Middleware — Express middleware for chat routes
//
// Applies prompt injection detection and content safety to
// all AI chat endpoints. Logs violations and can block/sanitize
// based on configuration.
//
// Usage:
//   import { aiSecurityMiddleware } from './middleware/ai-security.js';
//   router.post('/chat', aiSecurityMiddleware, async (req, res) => { ... });
// ============================================================

import type { Request, Response, NextFunction } from 'express';
import { validateInputSecurity, filterOutputSecurity, type SecurityCheckResult } from '../services/ai-security.js';
import { logger } from '../logger.js';

// Extend Express Request type to include security result
declare module 'express-serve-static-core' {
  interface Request {
    securityCheck?: SecurityCheckResult;
  }
}

/**
 * Middleware to validate incoming chat messages for security threats
 * Runs before the route handler - checks input only
 */
export async function aiSecurityInputMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Extract message from various possible locations
    const message = req.body?.message || req.body?.content || req.body?.prompt;
    
    if (!message || typeof message !== 'string') {
      // No message to check, proceed
      return next();
    }

    // Run security check
    const result = await validateInputSecurity(message);
    
    // Attach result to request for potential use in route handler
    req.securityCheck = result;

    // Handle based on action
    switch (result.action) {
      case 'block':
        logger.warn('AI Security: Blocking request due to security violations', {
          userId: (req as any).user?.id || 'anonymous',
          violations: result.violations.map(v => v.type),
          score: result.score,
        });
        
        res.status(400).json({
          error: 'Security violation detected',
          code: 'SECURITY_VIOLATION',
          details: process.env.NODE_ENV === 'development' ? result.violations : undefined,
        });
        return;

      case 'sanitize':
        // Replace the message with sanitized version
        if (result.sanitized) {
          logger.info('AI Security: Sanitized input message', {
            userId: (req as any).user?.id || 'anonymous',
            violations: result.violations.map(v => v.type),
          });
          
          // Update the request body with sanitized content
          if (req.body.message) req.body.message = result.sanitized;
          if (req.body.content) req.body.content = result.sanitized;
          if (req.body.prompt) req.body.prompt = result.sanitized;
        }
        break;

      case 'log-only':
        // Just log, don't block (default safe mode)
        logger.warn('AI Security: Violations detected (log-only mode)', {
          userId: (req as any).user?.id || 'anonymous',
          violations: result.violations.map(v => ({ type: v.type, severity: v.severity })),
          score: result.score,
        });
        break;

      case 'allow':
      default:
        // No violations or below threshold
        break;
    }

    next();
  } catch (error) {
    // Fail open - if security check fails, log and continue
    logger.error('AI Security: Middleware error, allowing request', { error });
    next();
  }
}

/**
 * Middleware factory to filter LLM output responses
 * This should be used as a response interceptor
 * 
 * Usage in route:
 *   const originalJson = res.json.bind(res);
 *   res.json = aiSecurityOutputMiddleware(res, originalJson);
 */
export function createOutputFilterMiddleware(
  res: Response,
  originalJson: typeof res.json
): typeof res.json {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function(body: any): Response {
    try {
      // Check if this is a chat response with content
      const content = body?.reply || body?.content || body?.message || body?.text;
      
      if (content && typeof content === 'string') {
        const result = filterOutputSecurity(content);
        
        if (!result.safe || result.redactions.length > 0) {
          logger.warn('AI Security: Filtered output', {
            redactions: result.redactions,
            originalLength: content.length,
            filteredLength: result.filtered.length,
          });
          
          // Replace the content with filtered version
          if (body.reply) body.reply = result.filtered;
          if (body.content) body.content = result.filtered;
          if (body.message) body.message = result.filtered;
          if (body.text) body.text = result.filtered;
        }
      }
    } catch (error) {
      // Fail open - log and continue with original response
      logger.error('AI Security: Output filter error', { error });
    }
    
    return originalJson(body);
  };
}

/**
 * Combined middleware that sets up both input validation and output filtering
 * Use this for routes that need full protection
 */
export function aiSecurityMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Set up output filter
  const originalJson = res.json.bind(res);
  res.json = createOutputFilterMiddleware(res, originalJson);
  
  // Run input validation
  aiSecurityInputMiddleware(req, res, next);
}

// Export convenience middleware
export { validateInputSecurity, filterOutputSecurity };
export default aiSecurityMiddleware;
