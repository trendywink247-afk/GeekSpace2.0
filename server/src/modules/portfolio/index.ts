/**
 * Portfolio Domain — Barrel Export
 *
 * Re-exports for public portfolio pages, visitor analytics,
 * AI-assisted editing, and portfolio suggestion engine.
 *
 * @module portfolio
 * @see docs/MICROSERVICES_ROADMAP.md — Wave 1 extraction candidate
 */

// ── Routes ──────────────────────────────────────────────────────────
export { portfolioRouter } from '../../routes/portfolio.js';

// ── Services ────────────────────────────────────────────────────────
export {
  generatePortfolioSuggestions,
  applySuggestion,
} from '../../services/portfolio-suggestions.js';
