// ============================================================
// Content module types
// ============================================================

/** A user-created artifact (HTML app, widget, code snippet, etc.). */
export interface Artifact {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  type: string;
  content: string;
  domain: string | null;
  is_public: boolean;
  expires_at: string | null;
  permanent: boolean;
  view_count: number;
  created_at: string;
  updated_at: string;
}

/** Custom domain mapped to an artifact deployment. */
export interface ArtifactDomain {
  id: string;
  artifact_id: string;
  domain: string;
  verified: boolean;
  created_at: string;
}

/** Deployment record for a published artifact. */
export interface ArtifactDeployment {
  id: string;
  artifact_id: string;
  user_id: string;
  url: string;
  status: 'pending' | 'active' | 'failed' | 'expired';
  deployed_at: string;
}

/** A reusable template for creating artifacts or projects. */
export interface Template {
  id: string;
  title: string;
  description: string | null;
  category: string;
  content: string;
  thumbnail_url: string | null;
  is_official: boolean;
  author_id: string | null;
  use_count: number;
  created_at: string;
  updated_at: string;
}

/** Grouping category for templates. */
export interface TemplateCategory {
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
}
