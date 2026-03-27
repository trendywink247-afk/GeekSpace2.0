// ============================================================
// Portfolio module types
// ============================================================

/** A single project entry within a portfolio. */
export interface PortfolioProject {
  name?: string;
  title?: string;
  description?: string;
  url?: string;
  repo?: string;
  image?: string;
  tags?: string[];
}

/** Social links stored as a flexible key-value map. */
export interface PortfolioSocial {
  github?: string;
  linkedin?: string;
  twitter?: string;
  website?: string;
  [key: string]: string | undefined;
}

/** Visibility settings per section. */
export interface PortfolioVisibility {
  [section: string]: boolean;
}

/** Milestone / timeline entry. */
export interface PortfolioMilestone {
  title?: string;
  date?: string;
  description?: string;
}

/** Full portfolio record returned by the API. */
export interface Portfolio {
  user_id: string;
  username: string;
  headline: string | null;
  about: string | null;
  avatar: string | null;
  location: string | null;
  role: string | null;
  company: string | null;
  layout: string | null;
  meta_description: string | null;
  skills: string[] | unknown[];
  projects: PortfolioProject[];
  milestones: PortfolioMilestone[];
  social: PortfolioSocial;
  visibility: PortfolioVisibility;
  agentEnabled: boolean;
  isPublic: boolean;
  view_count: number;
  last_viewed_at: string | null;
  created_at: string;
  updated_at: string;
}

/** A row from the daily analytics breakdown. */
export interface AnalyticsRow {
  day: string;
  views: number;
}

/** Portfolio contact-form submission stored in portfolio_contacts. */
export interface PortfolioContact {
  id: string;
  sender_name: string;
  sender_email: string | null;
  message: string;
  created_at: string;
}

/** Visitor referrer source aggregate. */
export interface AnalyticsSource {
  source: string;
  visits: number;
}
