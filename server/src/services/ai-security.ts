// ============================================================
// AI Security Layer — Prompt Injection Detection & Content Safety
//
// Provides defense against:
// - Prompt injection attacks
// - Jailbreak attempts
// - PII leakage in outputs
// - System prompt extraction attempts
//
// Usage:
//   const security = new AISecurityService();
//   const result = await security.validateInput(userMessage);
//   if (!result.safe) { log and block }
// ============================================================

import { logger } from '../logger.js';

// ---- Configuration ----

export interface SecurityConfig {
  enabled: boolean;
  mode: 'log-only' | 'block' | 'sanitize';
  maxInputLength: number;
  maxOutputLength: number;
  blockScoreThreshold: number; // 0-1, higher = more strict
  logAllViolations: boolean;
  redactPIIInOutput: boolean;
}

const DEFAULT_CONFIG: SecurityConfig = {
  enabled: process.env.AI_SECURITY_ENABLED !== 'false', // Enabled by default
  mode: (process.env.AI_SECURITY_MODE as SecurityConfig['mode']) || 'log-only', // Start safe
  maxInputLength: parseInt(process.env.AI_SECURITY_MAX_INPUT_LENGTH || '10000'),
  maxOutputLength: parseInt(process.env.AI_SECURITY_MAX_OUTPUT_LENGTH || '50000'),
  blockScoreThreshold: parseFloat(process.env.AI_SECURITY_THRESHOLD || '0.7'),
  logAllViolations: true,
  redactPIIInOutput: true,
};

// ---- Types ----

export interface SecurityCheckResult {
  safe: boolean;
  score: number; // 0-1, higher = more suspicious
  violations: SecurityViolation[];
  sanitized?: string;
  action: 'allow' | 'block' | 'sanitize';
}

export interface SecurityViolation {
  type: 'prompt_injection' | 'jailbreak' | 'pii_leak' | 'system_leak' | 'length' | 'encoding' | 'other';
  pattern: string;
  position: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
}

// ---- Pattern Definitions ----

// Prompt injection patterns - attempts to override system instructions
const PROMPT_INJECTION_PATTERNS = [
  {
    pattern: /ignore\s+(?:all\s+)?(?:previous|above|prior)\s+(?:instructions|prompts|commands)/gi,
    severity: 'critical' as const,
    description: 'Attempt to ignore previous instructions',
  },
  {
    pattern: /forget\s+(?:everything|all|your\s+instructions)/gi,
    severity: 'critical' as const,
    description: 'Attempt to reset instructions',
  },
  {
    pattern: /system\s*:\s*new\s+instruction/gi,
    severity: 'critical' as const,
    description: 'System instruction override attempt',
  },
  {
    pattern: /you\s+are\s+now\s+(?:a|an)\s+/gi,
    severity: 'high' as const,
    description: 'Role reassignment attempt',
  },
  {
    pattern: /disregard\s+(?:your|the)\s+(?:instructions|training)/gi,
    severity: 'high' as const,
    description: 'Training disregard attempt',
  },
  {
    pattern: /(?:revert|return)\s+to\s+(?:original|previous)\s+(?:mode|state)/gi,
    severity: 'medium' as const,
    description: 'Mode reset attempt',
  },
];

// Jailbreak patterns - attempts to bypass safety measures
const JAILBREAK_PATTERNS = [
  {
    pattern: /DAN|do\s+anything\s+now/gi,
    severity: 'critical' as const,
    description: 'DAN jailbreak attempt',
  },
  {
    pattern: /(?:ignore|bypass|disable)\s+(?:safety|ethical|content|policy)/gi,
    severity: 'critical' as const,
    description: 'Safety bypass attempt',
  },
  {
    pattern: /(?:pretend|act\s+as|simulate)\s+(?:you\s+have|there\s+are\s+no)\s+(?:no\s+)?(?:restrictions|limits|rules)/gi,
    severity: 'high' as const,
    description: 'Restriction removal simulation',
  },
  {
    pattern: /hypothetically|for\s+educational\s+purposes|in\s+a\s+fictional\s+scenario/gi,
    severity: 'medium' as const,
    description: 'Hypothetical framing (possible bypass)',
  },
  {
    pattern: /(?:developer|debug|admin)\s*mode/gi,
    severity: 'high' as const,
    description: 'Developer mode activation attempt',
  },
];

// System prompt leak patterns
const SYSTEM_LEAK_PATTERNS = [
  {
    pattern: /(?:what|tell\s+me)\s+(?:is|are)\s+your\s+(?:instructions|system\s+prompt|prompt)/gi,
    severity: 'high' as const,
    description: 'System prompt extraction attempt',
  },
  {
    pattern: /repeat\s+(?:after\s+me|the\s+following|this\s+word\s+for\s+word)/gi,
    severity: 'medium' as const,
    description: 'Repetition attack (possible extraction)',
  },
  {
    pattern: /(?:print|output|show)\s+(?:your|the)\s+(?:system|prompt|instruction)/gi,
    severity: 'high' as const,
    description: 'Direct system prompt request',
  },
];

// PII patterns for detection
const PII_PATTERNS = [
  { type: 'email', pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g },
  { type: 'phone', pattern: /\b(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/g },
  { type: 'ssn', pattern: /\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/g },
  { type: 'credit_card', pattern: /\b(?:\d{4}[-.\s]?){3}\d{4}\b/g },
  { type: 'api_key', pattern: /\b(?:sk-|pk-|api[_-]?key|token)[:\s]?["']?[a-zA-Z0-9_\-]{20,}["']?/gi },
];

// Encoding obfuscation patterns
const OBFUSCATION_PATTERNS = [
  {
    pattern: /\b(?:[A-Za-z0-9+/]{40,}={0,2})\b/g, // Base64-like strings
    severity: 'medium' as const,
    description: 'Possible base64 encoding',
  },
  {
    pattern: /\\u[0-9a-fA-F]{4}/g, // Unicode escapes
    severity: 'low' as const,
    description: 'Unicode escape sequences',
  },
  {
    pattern: /\x[0-9a-fA-F]{2}/g, // Hex escapes
    severity: 'low' as const,
    description: 'Hex escape sequences',
  },
  {
    pattern: /zero width|invisible|zwj|zwnj|U+200B|U+200C|U+200D/gi,
    severity: 'high' as const,
    description: 'Invisible character usage',
  },
];

// ---- Security Service Class ----

export class AISecurityService {
  private config: SecurityConfig;

  constructor(config: Partial<SecurityConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    if (this.config.enabled) {
      logger.info(`AI Security Layer initialized (mode: ${this.config.mode})`);
    } else {
      logger.warn('AI Security Layer is DISABLED');
    }
  }

  /**
   * Validate user input for security threats
   */
  async validateInput(input: string): Promise<SecurityCheckResult> {
    if (!this.config.enabled) {
      return { safe: true, score: 0, violations: [], action: 'allow' };
    }

    const violations: SecurityViolation[] = [];

    // Check length
    if (input.length > this.config.maxInputLength) {
      violations.push({
        type: 'length',
        pattern: 'length_exceeded',
        position: 0,
        severity: 'medium',
        description: `Input exceeds maximum length (${input.length} > ${this.config.maxInputLength})`,
      });
    }

    // Check prompt injection patterns
    for (const { pattern, severity, description } of PROMPT_INJECTION_PATTERNS) {
      const matches = input.matchAll(pattern);
      for (const match of matches) {
        violations.push({
          type: 'prompt_injection',
          pattern: match[0].substring(0, 50),
          position: match.index || 0,
          severity,
          description,
        });
      }
    }

    // Check jailbreak patterns
    for (const { pattern, severity, description } of JAILBREAK_PATTERNS) {
      const matches = input.matchAll(pattern);
      for (const match of matches) {
        violations.push({
          type: 'jailbreak',
          pattern: match[0].substring(0, 50),
          position: match.index || 0,
          severity,
          description,
        });
      }
    }

    // Check system leak patterns
    for (const { pattern, severity, description } of SYSTEM_LEAK_PATTERNS) {
      const matches = input.matchAll(pattern);
      for (const match of matches) {
        violations.push({
          type: 'system_leak',
          pattern: match[0].substring(0, 50),
          position: match.index || 0,
          severity,
          description,
        });
      }
    }

    // Check obfuscation patterns
    for (const { pattern, severity, description } of OBFUSCATION_PATTERNS) {
      const matches = Array.from(input.matchAll(pattern));
      if (matches.length > 3) { // Threshold for obfuscation
        violations.push({
          type: 'encoding',
          pattern: matches[0]?.[0]?.substring(0, 50) || 'obfuscation',
          position: matches[0]?.index || 0,
          severity,
          description: `${description} (${matches.length} instances)`,
        });
      }
    }

    // Calculate risk score
    const score = this.calculateScore(violations);

    // Determine action
    let action: SecurityCheckResult['action'] = 'allow';
    let sanitized: string | undefined;

    if (score >= this.config.blockScoreThreshold) {
      action = this.config.mode === 'block' ? 'block' : 'log-only';
    } else if (violations.length > 0 && this.config.mode === 'sanitize') {
      action = 'sanitize';
      sanitized = this.sanitizeInput(input, violations);
    }

    const result: SecurityCheckResult = {
      safe: action !== 'block',
      score,
      violations,
      sanitized,
      action,
    };

    // Log violations
    if (violations.length > 0 && this.config.logAllViolations) {
      logger.warn('AI Security: Input validation violations', {
        score,
        action,
        violationCount: violations.length,
        violationTypes: violations.map(v => v.type),
        sample: input.substring(0, 100).replace(/\n/g, ' '),
      });
    }

    return result;
  }

  /**
   * Filter and redact sensitive content from LLM output
   */
  filterOutput(output: string): { safe: boolean; filtered: string; redactions: string[] } {
    if (!this.config.enabled || !this.config.redactPIIInOutput) {
      return { safe: true, filtered: output, redactions: [] };
    }

    let filtered = output;
    const redactions: string[] = [];

    // Check length
    if (output.length > this.config.maxOutputLength) {
      filtered = filtered.substring(0, this.config.maxOutputLength) + 
        '\n\n[Content truncated for security]';
      redactions.push('length_truncated');
    }

    // Check for PII in output
    for (const { type, pattern } of PII_PATTERNS) {
      const matches = filtered.matchAll(pattern);
      for (const match of matches) {
        const redaction = `[REDACTED_${type.toUpperCase()}]`;
        filtered = filtered.replace(match[0], redaction);
        redactions.push(type);
      }
    }

    // Check for system prompt leakage in output
    if (this.containsSystemLeak(output)) {
      logger.warn('AI Security: Potential system prompt leak detected in output');
      filtered = '[Content blocked: potential system information leak]';
      redactions.push('system_leak');
      return { safe: false, filtered, redactions };
    }

    return { 
      safe: redactions.length === 0, 
      filtered, 
      redactions: [...new Set(redactions)] 
    };
  }

  /**
   * Calculate risk score based on violations
   */
  private calculateScore(violations: SecurityViolation[]): number {
    if (violations.length === 0) return 0;

    const severityWeights = {
      critical: 1.0,
      high: 0.7,
      medium: 0.4,
      low: 0.1,
    };

    let totalScore = 0;
    for (const v of violations) {
      totalScore += severityWeights[v.severity];
    }

    // Normalize to 0-1 with diminishing returns for multiple violations
    return Math.min(1, totalScore / (1 + totalScore * 0.5));
  }

  /**
   * Sanitize input by removing/replacing problematic patterns
   */
  private sanitizeInput(input: string, violations: SecurityViolation[]): string {
    let sanitized = input;

    for (const v of violations) {
      switch (v.type) {
        case 'encoding':
          // Remove common obfuscation
          sanitized = sanitized.replace(/\\u[0-9a-fA-F]{4}/g, '');
          sanitized = sanitized.replace(/\x[0-9a-fA-F]{2}/g, '');
          break;
        case 'prompt_injection':
        case 'jailbreak':
          // Replace trigger words with neutral text
          sanitized = sanitized.replace(
            /ignore|forget|disregard|bypass/gi,
            '[REDACTED]'
          );
          break;
      }
    }

    return sanitized.trim();
  }

  /**
   * Check if output contains system prompt information
   */
  private containsSystemLeak(output: string): boolean {
    const leakIndicators = [
      /system\s+prompt/i,
      /instructions?:\s*.+/i,
      /you\s+are\s+(?:an\s+)?AI\s+assistant/i,
      /training\s+data/i,
      /model\s+architecture/i,
    ];

    return leakIndicators.some(pattern => pattern.test(output));
  }

  /**
   * Get current configuration
   */
  getConfig(): SecurityConfig {
    return { ...this.config };
  }

  /**
   * Update configuration at runtime
   */
  updateConfig(config: Partial<SecurityConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('AI Security config updated', { mode: this.config.mode, enabled: this.config.enabled });
  }
}

// ---- Singleton Instance ----

let securityService: AISecurityService | null = null;

export function getSecurityService(): AISecurityService {
  if (!securityService) {
    securityService = new AISecurityService();
  }
  return securityService;
}

export function resetSecurityService(config?: Partial<SecurityConfig>): AISecurityService {
  securityService = new AISecurityService(config);
  return securityService;
}

// ---- Convenience Functions ----

export async function validateInputSecurity(input: string): Promise<SecurityCheckResult> {
  return getSecurityService().validateInput(input);
}

export function filterOutputSecurity(output: string): { safe: boolean; filtered: string; redactions: string[] } {
  return getSecurityService().filterOutput(output);
}

// Default export
export default AISecurityService;
